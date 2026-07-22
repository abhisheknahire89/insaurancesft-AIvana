/**
 * Provenance Tracking Service
 *
 * Tracks every extracted clinical field back to its source with complete audit trail.
 * Enables IRDAI compliance through full traceability and auditability.
 *
 * Every field stores:
 * - value: The extracted value
 * - confidence: Extraction confidence (0-1)
 * - source: PATIENT_NOTE | DOCUMENT
 * - sourceDocument: Document ID
 * - documentType: Type of document
 * - pageNumber: Page where found
 * - boundingBox: Pixel coordinates
 * - extractionMethod: MANUAL | SARVAM_OCR | GEMINI_AI | REGEX
 * - timestamp: When extracted
 * - doctor: Which doctor entered it
 * - conflictResolution: Resolution status for conflicts
 */

export type DataSource = 'PATIENT_NOTE' | 'DOCUMENT';
export type ExtractionMethod = 'MANUAL' | 'SARVAM_OCR' | 'GEMINI_AI' | 'REGEX' | 'HUMAN_VERIFIED';
export type ConflictResolution = 'PATIENT_NOTE_WINS' | 'DOCUMENT_WINS' | 'COORDINATOR_REVIEW' | null;

export interface FieldProvenance {
  // Value
  value: any;
  confidence: number;

  // Source
  source: DataSource;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  sourcePageNumber?: number;

  // Location in document
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Extraction method
  extractionMethod: ExtractionMethod;
  extractedAt: string;
  extractedBy?: string;

  // Attribution
  doctor?: string;
  department?: string;
  hospital?: string;

  // Additional metadata
  notes?: string;
  rawText?: string;
  normalizedValue?: any;
}

export interface ConflictedField {
  patientNoteValue: FieldProvenance | null;
  documentValue: FieldProvenance | null;
  conflict: true;
  resolutionStatus: ConflictResolution;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface FieldWithProvenance {
  value: any;
  provenance: FieldProvenance | ConflictedField;
  isConflicted: boolean;
}

export interface ProvenanceIndex {
  caseId: string;
  createdAt: string;

  // Map of field paths to their provenance
  // Example: "demographics.name" -> FieldProvenance
  fieldProvenance: Map<string, FieldWithProvenance>;

  // Conflict tracking
  conflicts: Array<{
    fieldPath: string;
    patientNoteValue: any;
    documentValue: any;
    resolutionStatus: ConflictResolution;
  }>;

  // Source document tracking
  sourceDocuments: SourceDocument[];

  // Extraction statistics
  totalFieldsExtracted: number;
  fieldsWithConflict: number;
  extractionMethods: Map<ExtractionMethod, number>;
  sourceDistribution: Map<DataSource, number>;
}

export interface SourceDocument {
  documentId: string;
  documentType: string;
  uploadedAt: string;
  fileName: string;
  pageCount: number;
  extractionConfidence: number;
  extractedFields: number;
  doctor?: string;
  hospital?: string;
}

/**
 * Create new provenance index for a case
 */
export function createProvenanceIndex(caseId: string): ProvenanceIndex {
  return {
    caseId,
    createdAt: new Date().toISOString(),
    fieldProvenance: new Map(),
    conflicts: [],
    sourceDocuments: [],
    totalFieldsExtracted: 0,
    fieldsWithConflict: 0,
    extractionMethods: new Map(),
    sourceDistribution: new Map(),
  };
}

/**
 * Add field to provenance index
 */
export function addFieldToProvenance(
  index: ProvenanceIndex,
  fieldPath: string,
  value: any,
  provenance: FieldProvenance
): void {
  const existing = index.fieldProvenance.get(fieldPath);

  if (existing && existing.provenance && !(existing.provenance as any).conflict) {
    // Check if values conflict
    if (JSON.stringify(existing.value) !== JSON.stringify(value)) {
      // Conflict detected
      const conflicted: ConflictedField = {
        patientNoteValue: (existing.provenance as FieldProvenance).source === 'PATIENT_NOTE'
          ? (existing.provenance as FieldProvenance)
          : null,
        documentValue: (existing.provenance as FieldProvenance).source === 'DOCUMENT'
          ? (existing.provenance as FieldProvenance)
          : null,
        conflict: true,
        resolutionStatus: null,
      };

      if (provenance.source === 'PATIENT_NOTE') {
        conflicted.patientNoteValue = provenance;
      } else {
        conflicted.documentValue = provenance;
      }

      index.fieldProvenance.set(fieldPath, {
        value: existing.value,
        provenance: conflicted,
        isConflicted: true,
      });

      index.conflicts.push({
        fieldPath,
        patientNoteValue: conflicted.patientNoteValue?.value,
        documentValue: conflicted.documentValue?.value,
        resolutionStatus: null,
      });

      index.fieldsWithConflict++;
    }
  } else {
    index.fieldProvenance.set(fieldPath, {
      value,
      provenance,
      isConflicted: false,
    });
  }

  // Update statistics
  index.totalFieldsExtracted++;
  const methodCount = index.extractionMethods.get(provenance.extractionMethod) || 0;
  index.extractionMethods.set(provenance.extractionMethod, methodCount + 1);

  const sourceCount = index.sourceDistribution.get(provenance.source) || 0;
  index.sourceDistribution.set(provenance.source, sourceCount + 1);
}

/**
 * Record source document
 */
export function recordSourceDocument(
  index: ProvenanceIndex,
  doc: SourceDocument
): void {
  index.sourceDocuments.push(doc);
}

/**
 * Resolve conflict with decision
 */
export function resolveConflict(
  index: ProvenanceIndex,
  fieldPath: string,
  resolution: ConflictResolution,
  resolvedBy?: string,
  notes?: string
): void {
  const field = index.fieldProvenance.get(fieldPath);
  if (field && field.isConflicted) {
    const conflicted = field.provenance as ConflictedField;
    conflicted.resolutionStatus = resolution;
    conflicted.resolvedAt = new Date().toISOString();
    conflicted.resolvedBy = resolvedBy;
    conflicted.resolutionNotes = notes;

    // Update the value based on resolution
    if (resolution === 'PATIENT_NOTE_WINS' && conflicted.patientNoteValue) {
      field.value = conflicted.patientNoteValue.value;
    } else if (resolution === 'DOCUMENT_WINS' && conflicted.documentValue) {
      field.value = conflicted.documentValue.value;
    }

    // Update conflict tracking
    const conflictRecord = index.conflicts.find(c => c.fieldPath === fieldPath);
    if (conflictRecord) {
      conflictRecord.resolutionStatus = resolution;
    }
  }
}

/**
 * Get audit trail for a field
 */
export function getFieldAuditTrail(index: ProvenanceIndex, fieldPath: string): any {
  const field = index.fieldProvenance.get(fieldPath);
  if (!field) return null;

  const provenance = field.provenance as FieldProvenance | ConflictedField;

  if ((provenance as any).conflict) {
    const conflicted = provenance as ConflictedField;
    return {
      fieldPath,
      conflict: true,
      patientNoteValue: conflicted.patientNoteValue,
      documentValue: conflicted.documentValue,
      resolution: conflicted.resolutionStatus,
      resolvedAt: conflicted.resolvedAt,
      resolvedBy: conflicted.resolvedBy,
      notes: conflicted.resolutionNotes,
      currentValue: field.value,
    };
  } else {
    const single = provenance as FieldProvenance;
    return {
      fieldPath,
      conflict: false,
      value: field.value,
      provenance: single,
      source: single.source,
      sourceDocument: single.sourceDocumentId,
      extractionMethod: single.extractionMethod,
      extractedAt: single.extractedAt,
      confidence: single.confidence,
    };
  }
}

/**
 * Get all fields from specific source
 */
export function getFieldsBySource(index: ProvenanceIndex, source: DataSource): Map<string, any> {
  const result = new Map();

  for (const [fieldPath, field] of index.fieldProvenance.entries()) {
    if (field.isConflicted) {
      const conflicted = field.provenance as ConflictedField;
      if (source === 'PATIENT_NOTE' && conflicted.patientNoteValue) {
        result.set(fieldPath, conflicted.patientNoteValue.value);
      } else if (source === 'DOCUMENT' && conflicted.documentValue) {
        result.set(fieldPath, conflicted.documentValue.value);
      }
    } else {
      const single = field.provenance as FieldProvenance;
      if (single.source === source) {
        result.set(fieldPath, field.value);
      }
    }
  }

  return result;
}

/**
 * Get all conflicted fields
 */
export function getConflictedFields(index: ProvenanceIndex): Array<{
  fieldPath: string;
  patientNoteValue: any;
  documentValue: any;
  resolutionStatus: ConflictResolution;
}> {
  return index.conflicts;
}

/**
 * Get pending reviews (unresolved conflicts requiring coordinator decision)
 */
export function getPendingReviews(index: ProvenanceIndex): Array<{
  fieldPath: string;
  patientNoteValue: any;
  documentValue: any;
}> {
  return index.conflicts
    .filter(c => c.resolutionStatus === null || c.resolutionStatus === 'COORDINATOR_REVIEW')
    .map(c => ({
      fieldPath: c.fieldPath,
      patientNoteValue: c.patientNoteValue,
      documentValue: c.documentValue,
    }));
}

/**
 * Get extraction coverage report
 */
export function getExtractionReport(index: ProvenanceIndex): {
  totalFields: number;
  fieldsWithConflict: number;
  unresolvedConflicts: number;
  extractionByMethod: Record<ExtractionMethod, number>;
  extractionBySource: Record<DataSource, number>;
  averageConfidence: number;
  sourceDocuments: SourceDocument[];
} {
  const unresolvedConflicts = index.conflicts.filter(
    c => c.resolutionStatus === null
  ).length;

  const extractionByMethod: Record<ExtractionMethod, number> = {} as any;
  for (const [method, count] of index.extractionMethods.entries()) {
    extractionByMethod[method] = count;
  }

  const extractionBySource: Record<DataSource, number> = {} as any;
  for (const [source, count] of index.sourceDistribution.entries()) {
    extractionBySource[source] = count;
  }

  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const field of index.fieldProvenance.values()) {
    if (!field.isConflicted) {
      const prov = field.provenance as FieldProvenance;
      totalConfidence += prov.confidence;
      confidenceCount++;
    }
  }

  return {
    totalFields: index.totalFieldsExtracted,
    fieldsWithConflict: index.fieldsWithConflict,
    unresolvedConflicts,
    extractionByMethod,
    extractionBySource,
    averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    sourceDocuments: index.sourceDocuments,
  };
}

/**
 * Export provenance for audit/compliance
 */
export function exportProvenanceForAudit(index: ProvenanceIndex): string {
  const auditData = {
    caseId: index.caseId,
    exportedAt: new Date().toISOString(),
    summary: getExtractionReport(index),
    conflicts: getPendingReviews(index),
    sourceDocuments: index.sourceDocuments,
    fieldProvenance: Array.from(index.fieldProvenance.entries()).map(([path, field]) => ({
      fieldPath: path,
      value: field.value,
      isConflicted: field.isConflicted,
      provenance: field.provenance,
    })),
  };

  return JSON.stringify(auditData, null, 2);
}
