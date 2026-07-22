/**
 * Reconciliation Engine
 *
 * Merges two sources (patient notes + documents) with full conflict tracking.
 * Implements two-source reconciliation rules where patient notes are primary source.
 * Never overwrites patient note values; flags conflicts for coordinator review.
 *
 * Rules:
 * 1. Patient note values are immutable
 * 2. Document values provide supporting evidence
 * 3. Conflicts detected when values differ
 * 4. Critical fields require coordinator decision
 * 5. Full audit trail maintained
 */

import type { ExtractedClinicalNote } from './clinicalNoteExtractorService';
import type {
  ProvenanceIndex,
  FieldProvenance,
  ConflictedField,
  DataSource,
  ExtractionMethod,
} from './provenanceService';
import { addFieldToProvenance, resolveConflict, getPendingReviews } from './provenanceService';

export interface ReconciliationResult {
  caseId: string;
  reconciliationStatus: 'pending' | 'complete' | 'requires_review';
  mergedData: Record<string, any>;
  conflicts: ConflictRecord[];
  pendingReviews: PendingReview[];
  statistics: ReconciliationStats;
  timestamp: string;
}

export interface ConflictRecord {
  fieldPath: string;
  patientNoteValue: any;
  documentValue: any;
  confidence: {
    patientNote: number;
    document: number;
  };
  isCritical: boolean;
  resolutionRequired: boolean;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  decidedAt: string;
  decidedBy?: string;
  choice: 'PATIENT_NOTE' | 'DOCUMENT' | 'MERGED';
  reasoning?: string;
}

export interface PendingReview {
  fieldPath: string;
  patientNoteValue: any;
  documentValue: any;
  reason: string;
}

export interface ReconciliationStats {
  totalFieldsExtracted: number;
  fieldsFromPatientNote: number;
  fieldsFromDocuments: number;
  conflictedFields: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  extractionMethodDistribution: Record<ExtractionMethod, number>;
  criticality: {
    demographics: number;
    medical: number;
    procedures: number;
    billing: number;
  };
}

const CRITICAL_FIELDS = new Set([
  'demographics.name',
  'demographics.dob',
  'demographics.gender',
  'demographics.contactNumber',
  'visitInformation.admissionDate',
  'visitInformation.estimatedDischargeDate',
  'chiefComplaint.primaryComplaint',
  'diagnosis.provisionalDiagnosis',
  'diagnosis.icdCodes',
  'plannedProcedure.procedureName',
  'plannedProcedure.icdCode',
  'medicalNecessity.medicalNecessityStatement',
  'estimates.totalEstimatedCost',
]);

/**
 * Reconcile patient note with document extractions
 */
export function reconcileSourcesWithProvenance(
  caseId: string,
  patientNoteData: ExtractedClinicalNote,
  documentExtractions: Record<string, any>[],
  provenanceIndex: ProvenanceIndex
): ReconciliationResult {
  console.log(`[Reconciliation] Starting reconciliation for case ${caseId}`);

  const mergedData: Record<string, any> = {};
  const conflicts: ConflictRecord[] = [];
  const stats: ReconciliationStats = {
    totalFieldsExtracted: 0,
    fieldsFromPatientNote: 0,
    fieldsFromDocuments: 0,
    conflictedFields: 0,
    resolvedConflicts: 0,
    pendingConflicts: 0,
    extractionMethodDistribution: {} as any,
    criticality: {
      demographics: 0,
      medical: 0,
      procedures: 0,
      billing: 0,
    },
  };

  // Step 1: Add all patient note fields (primary source - never overwritten)
  mergePatientNoteFields(caseId, patientNoteData, mergedData, provenanceIndex, stats);

  // Step 2: Merge document extractions with conflict detection
  mergeDocumentFields(caseId, documentExtractions, mergedData, provenanceIndex, stats, conflicts);

  // Step 3: Categorize conflicts
  const { resolved, pending } = categorizeConflicts(conflicts);

  // Step 4: Detect critical field conflicts
  const criticalConflicts = conflicts.filter(c => CRITICAL_FIELDS.has(c.fieldPath));
  console.log(`[Reconciliation] Found ${criticalConflicts.length} critical field conflicts`);

  const reconciliationStatus = pending.length > 0 ? 'requires_review' : 'complete';

  return {
    caseId,
    reconciliationStatus,
    mergedData,
    conflicts,
    pendingReviews: pending,
    statistics: {
      ...stats,
      resolvedConflicts: resolved.length,
      pendingConflicts: pending.length,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Merge all patient note fields (primary source)
 */
function mergePatientNoteFields(
  caseId: string,
  patientNoteData: ExtractedClinicalNote,
  merged: Record<string, any>,
  provenanceIndex: ProvenanceIndex,
  stats: ReconciliationStats
): void {
  const flattenedFields = flattenObject(patientNoteData);

  for (const [fieldPath, value] of Object.entries(flattenedFields)) {
    if (value === null || value === undefined) continue;

    merged[fieldPath] = value;
    stats.fieldsFromPatientNote++;
    stats.totalFieldsExtracted++;

    // Get provenance from source field
    const fieldProvenance = getFieldProvenance(patientNoteData, fieldPath, 'PATIENT_NOTE');

    if (fieldProvenance) {
      addFieldToProvenance(provenanceIndex, fieldPath, value, fieldProvenance);
    }
  }

  console.log(`[Reconciliation] Merged ${stats.fieldsFromPatientNote} patient note fields`);
}

/**
 * Merge document fields with conflict detection
 */
function mergeDocumentFields(
  caseId: string,
  documentExtractions: Record<string, any>[],
  merged: Record<string, any>,
  provenanceIndex: ProvenanceIndex,
  stats: ReconciliationStats,
  conflicts: ConflictRecord[]
): void {
  for (const docExtraction of documentExtractions) {
    const flattenedFields = flattenObject(docExtraction.data || docExtraction);

    for (const [fieldPath, docValue] of Object.entries(flattenedFields)) {
      if (docValue === null || docValue === undefined) continue;

      const existingValue = merged[fieldPath];

      if (existingValue !== undefined && existingValue !== null) {
        // Conflict: field exists in both sources
        if (JSON.stringify(existingValue) !== JSON.stringify(docValue)) {
          const isCritical = CRITICAL_FIELDS.has(fieldPath);

          conflicts.push({
            fieldPath,
            patientNoteValue: existingValue,
            documentValue: docValue,
            confidence: {
              patientNote: getConfidenceForField(merged, fieldPath, 'PATIENT_NOTE'),
              document: docExtraction.confidence || 0.8,
            },
            isCritical,
            resolutionRequired: isCritical,
          });

          stats.conflictedFields++;

          // Record conflict in provenance
          const docProvenance = createDocumentProvenance(
            fieldPath,
            docValue,
            docExtraction,
            'DOCUMENT'
          );
          addFieldToProvenance(provenanceIndex, fieldPath, docValue, docProvenance);
        }
      } else {
        // No conflict: field only in document
        merged[fieldPath] = docValue;
        stats.fieldsFromDocuments++;
        stats.totalFieldsExtracted++;

        const docProvenance = createDocumentProvenance(
          fieldPath,
          docValue,
          docExtraction,
          'DOCUMENT'
        );
        addFieldToProvenance(provenanceIndex, fieldPath, docValue, docProvenance);
      }
    }
  }

  console.log(`[Reconciliation] Detected ${conflicts.length} conflicts`);
}

/**
 * Resolve a conflict with coordinator decision
 */
export function resolveFieldConflict(
  provenanceIndex: ProvenanceIndex,
  fieldPath: string,
  choice: 'PATIENT_NOTE' | 'DOCUMENT' | 'MERGED',
  mergedData: Record<string, any>,
  reasoning?: string,
  decidedBy?: string
): void {
  const field = provenanceIndex.fieldProvenance.get(fieldPath);

  if (!field || !field.isConflicted) {
    console.warn(`[Reconciliation] Field ${fieldPath} is not conflicted`);
    return;
  }

  const conflicted = field.provenance as ConflictedField;
  let finalValue = field.value;

  switch (choice) {
    case 'PATIENT_NOTE':
      if (conflicted.patientNoteValue) {
        finalValue = conflicted.patientNoteValue.value;
      }
      break;

    case 'DOCUMENT':
      if (conflicted.documentValue) {
        finalValue = conflicted.documentValue.value;
      }
      break;

    case 'MERGED':
      if (conflicted.patientNoteValue && conflicted.documentValue) {
        finalValue = mergeTwoValues(
          conflicted.patientNoteValue.value,
          conflicted.documentValue.value
        );
      }
      break;
  }

  // Update provenance
  const resolution = choice === 'PATIENT_NOTE'
    ? 'PATIENT_NOTE_WINS'
    : choice === 'DOCUMENT'
    ? 'DOCUMENT_WINS'
    : 'COORDINATOR_REVIEW';

  resolveConflict(provenanceIndex, fieldPath, resolution, decidedBy, reasoning);

  // Update merged data
  mergedData[fieldPath] = finalValue;

  console.log(`[Reconciliation] Resolved ${fieldPath}: ${choice}`, reasoning);
}

/**
 * Export reconciliation results for case processing
 */
export function exportReconciliationResult(result: ReconciliationResult): string {
  const summary = {
    caseId: result.caseId,
    status: result.reconciliationStatus,
    timestamp: result.timestamp,
    fieldsExtracted: result.statistics.totalFieldsExtracted,
    conflicts: {
      total: result.conflicts.length,
      critical: result.conflicts.filter(c => c.isCritical).length,
      pending: result.pendingReviews.length,
    },
    sources: {
      patientNote: result.statistics.fieldsFromPatientNote,
      documents: result.statistics.fieldsFromDocuments,
    },
    data: result.mergedData,
    conflicts: result.conflicts,
    pendingReviews: result.pendingReviews,
  };

  return JSON.stringify(summary, null, 2);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Flatten nested object for field path comparison
 */
function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  function flatten(current: any, path: string) {
    if (current === null || current === undefined) {
      return;
    }

    if (typeof current !== 'object' || Array.isArray(current)) {
      result[path] = current;
      return;
    }

    for (const [key, value] of Object.entries(current)) {
      const newPath = path ? `${path}.${key}` : key;
      flatten(value, newPath);
    }
  }

  flatten(obj, prefix);
  return result;
}

/**
 * Get field provenance from patient note data
 */
function getFieldProvenance(
  data: ExtractedClinicalNote,
  fieldPath: string,
  source: DataSource
): FieldProvenance | null {
  // This would be populated based on the ExtractedField structure
  // which contains confidence, extractedAt, doctor, etc.

  const parts = fieldPath.split('.');
  let current: any = data;

  for (const part of parts) {
    current = current?.[part];
  }

  if (!current) return null;

  // If the value is an ExtractedField with metadata, extract it
  if (current.confidence !== undefined) {
    return {
      value: current.value,
      confidence: current.confidence,
      source,
      extractionMethod: 'MANUAL',
      extractedAt: current.extractedAt || new Date().toISOString(),
      doctor: current.doctor,
      notes: current.notes,
    };
  }

  // Otherwise create basic provenance
  return {
    value: current,
    confidence: 0.95,
    source,
    extractionMethod: 'MANUAL',
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Create provenance for document field
 */
function createDocumentProvenance(
  fieldPath: string,
  value: any,
  docExtraction: Record<string, any>,
  source: DataSource
): FieldProvenance {
  return {
    value,
    confidence: docExtraction.confidence || 0.8,
    source,
    sourceDocumentId: docExtraction.documentId,
    sourceDocumentType: docExtraction.documentType,
    sourcePageNumber: docExtraction.pageNumber,
    extractionMethod: docExtraction.extractionMethod || 'GEMINI_AI',
    extractedAt: docExtraction.extractedAt || new Date().toISOString(),
    doctor: docExtraction.doctor,
    hospital: docExtraction.hospital,
    boundingBox: docExtraction.boundingBox,
  };
}

/**
 * Get confidence for a field from provenance tracking
 */
function getConfidenceForField(
  merged: Record<string, any>,
  fieldPath: string,
  source: DataSource
): number {
  // This would be populated from the field's provenance metadata
  return source === 'PATIENT_NOTE' ? 0.95 : 0.8;
}

/**
 * Categorize conflicts into resolved and pending
 */
function categorizeConflicts(
  conflicts: ConflictRecord[]
): {
  resolved: ConflictRecord[];
  pending: ConflictRecord[];
} {
  return {
    resolved: conflicts.filter(c => c.resolution !== undefined),
    pending: conflicts.filter(c => c.resolution === undefined && c.isCritical),
  };
}

/**
 * Merge two conflicting values using intelligent strategy
 */
function mergeTwoValues(value1: any, value2: any): any {
  // If both are strings, concatenate with separator
  if (typeof value1 === 'string' && typeof value2 === 'string') {
    return `${value1} (Supporting: ${value2})`;
  }

  // If both are arrays, merge uniquely
  if (Array.isArray(value1) && Array.isArray(value2)) {
    return [...new Set([...value1, ...value2])];
  }

  // If both are objects, deep merge
  if (typeof value1 === 'object' && typeof value2 === 'object') {
    return { ...value1, ...value2 };
  }

  // Default: return primary value
  return value1;
}
