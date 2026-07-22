/**
 * Clinical Extraction Pipeline - Complete Orchestrator
 *
 * Orchestrates the full extraction workflow:
 * 1. Patient Note Extraction (primary source)
 * 2. Document Classification
 * 3. Type-Specific Document Extraction
 * 4. Radiology/Lab Report Extraction
 * 5. Provenance Tracking
 * 6. Two-Source Reconciliation
 * 7. Conflict Detection & Resolution
 * 8. Audit Trail Generation
 *
 * This pipeline ensures:
 * - Patient notes are immutable (primary source)
 * - Documents provide supporting evidence
 * - Full traceability of every extracted field
 * - IRDAI compliance through complete audit trails
 * - Deterministic extraction (never infers, only extracts)
 */

import type { Case } from './caseModel';
import type { ExtractedClinicalNote } from './clinicalNoteExtractorService';
import { extractClinicalNote } from './clinicalNoteExtractorService';
import {
  classifyDocument,
  extractDocumentMetadata,
  type DocumentType,
  type DocumentClassification,
  type DocumentMetadata,
} from './documentClassifierService';
import { extractLabReport } from './labReportExtractorService';
import {
  extractECGReport,
  extractEchoReport,
  extractMRIReport,
  extractCTReport,
  extractUSGReport,
  extractXRayReport,
  type ImagingReport,
} from './radiologyExtractorService';
import {
  extractPrescription,
  extractDischargeSummary,
  extractMedicalBill,
  extractInsuranceDocument,
  extractConsentForm,
  extractReferralLetter,
} from './documentTypeExtractorsService';
import { processDocumentFile } from './documentProcessingService';
import {
  createProvenanceIndex,
  addFieldToProvenance,
  recordSourceDocument,
  getExtractionReport,
  exportProvenanceForAudit,
  type ProvenanceIndex,
  type FieldProvenance,
  type SourceDocument,
} from './provenanceService';
import {
  reconcileSourcesWithProvenance,
  resolveFieldConflict,
  exportReconciliationResult,
  type ReconciliationResult,
} from './reconciliationEngine';

export interface PipelineInput {
  caseId: string;
  patientNoteText: string;
  doctorId: string;
  uploadedDocuments?: File[];
}

export interface PipelineOutput {
  caseId: string;
  status: 'success' | 'partial' | 'error';
  patientNoteExtraction: ExtractedClinicalNote;
  documentExtractions: DocumentExtractionResult[];
  reconciliation: ReconciliationResult;
  provenanceIndex: ProvenanceIndex;
  auditTrail: string;
  conflictSummary: {
    totalConflicts: number;
    criticalConflicts: number;
    resolvedConflicts: number;
    pendingReviews: number;
  };
}

export interface DocumentExtractionResult {
  documentId: string;
  fileName: string;
  classification: DocumentClassification;
  metadata: DocumentMetadata;
  extractedData: any;
  confidence: number;
  processedAt: string;
}

/**
 * Main pipeline entry point - orchestrates complete extraction workflow
 */
export async function runClinicalExtractionPipeline(
  input: PipelineInput,
  caseRecord: Case
): Promise<PipelineOutput> {
  console.log(`[Pipeline] Starting extraction for case ${input.caseId}`);

  const startTime = Date.now();
  const provenanceIndex = createProvenanceIndex(input.caseId);

  try {
    // Step 1: Extract patient note (primary source - immutable)
    console.log(`[Pipeline] Step 1: Extracting patient note...`);
    const patientNoteExtraction = await extractPatientNoteWithProvenance(
      input.patientNoteText,
      input.doctorId,
      provenanceIndex
    );

    // Step 2: Process uploaded documents
    console.log(`[Pipeline] Step 2: Processing uploaded documents...`);
    const documentExtractions: DocumentExtractionResult[] = [];

    if (input.uploadedDocuments && input.uploadedDocuments.length > 0) {
      for (const file of input.uploadedDocuments) {
        try {
          const result = await processAndExtractDocument(
            file,
            input.caseId,
            provenanceIndex,
            caseRecord
          );
          documentExtractions.push(result);
        } catch (error) {
          console.error(`[Pipeline] Failed to process ${file.name}:`, error);
        }
      }
    }

    // Step 3: Reconcile sources with conflict detection
    console.log(`[Pipeline] Step 3: Reconciling patient note with documents...`);
    const documentData = documentExtractions.map(d => d.extractedData);
    const reconciliation = reconcileSourcesWithProvenance(
      input.caseId,
      patientNoteExtraction,
      documentData,
      provenanceIndex
    );

    // Step 4: Generate audit trail
    console.log(`[Pipeline] Step 4: Generating audit trail...`);
    const auditTrail = exportProvenanceForAudit(provenanceIndex);

    // Step 5: Get extraction report
    const extractionReport = getExtractionReport(provenanceIndex);

    const endTime = Date.now();
    console.log(
      `[Pipeline] Extraction complete in ${(endTime - startTime) / 1000}s`
    );

    return {
      caseId: input.caseId,
      status: 'success',
      patientNoteExtraction,
      documentExtractions,
      reconciliation,
      provenanceIndex,
      auditTrail,
      conflictSummary: {
        totalConflicts: reconciliation.conflicts.length,
        criticalConflicts: reconciliation.conflicts.filter(c => c.isCritical).length,
        resolvedConflicts: extractionReport.extractionByMethod['MANUAL'] || 0,
        pendingReviews: reconciliation.pendingReviews.length,
      },
    };
  } catch (error) {
    console.error(`[Pipeline] Fatal error:`, error);
    throw error;
  }
}

/**
 * Step 1: Extract patient note with full provenance tracking
 */
async function extractPatientNoteWithProvenance(
  noteText: string,
  doctorId: string,
  provenanceIndex: ProvenanceIndex
): Promise<ExtractedClinicalNote> {
  const extraction = await extractClinicalNote(noteText, doctorId);

  // Record source document
  recordSourceDocument(provenanceIndex, {
    documentId: `patient_note_${Date.now()}`,
    documentType: 'PATIENT_NOTE',
    uploadedAt: new Date().toISOString(),
    fileName: 'patient-clinical-note',
    pageCount: 1,
    extractionConfidence: 0.95,
    extractedFields: countExtractedFields(extraction),
    doctor: doctorId,
  });

  // Add all fields to provenance
  addExtractedFieldsToProvenance(extraction, 'PATIENT_NOTE', provenanceIndex);

  return extraction;
}

/**
 * Step 2: Process and extract document with classification routing
 */
async function processAndExtractDocument(
  file: File,
  caseId: string,
  provenanceIndex: ProvenanceIndex,
  caseRecord: Case
): Promise<DocumentExtractionResult> {
  console.log(`[Pipeline] Processing document: ${file.name}`);

  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Use Sarvam-powered document processor
  const processed = await processDocumentFile(file, caseRecord, 'AUTO_DETECT');

  // Get extracted text for classification
  let extractedText = '';
  if (typeof processed.extractedFields === 'string') {
    extractedText = processed.extractedFields;
  } else {
    extractedText = JSON.stringify(processed.extractedFields || {});
  }

  // Classify document
  const classification = classifyDocument(extractedText);

  // Extract metadata
  const metadata = extractDocumentMetadata(
    extractedText,
    classification.documentType,
    1,
    classification.confidence
  );

  // Route to type-specific extractor
  const extractedData = await routeToSpecificExtractor(
    extractedText,
    classification.documentType,
    metadata
  );

  // Record source document
  recordSourceDocument(provenanceIndex, {
    documentId,
    documentType: classification.documentType,
    uploadedAt: new Date().toISOString(),
    fileName: file.name,
    pageCount: 1,
    extractionConfidence: classification.confidence,
    extractedFields: countExtractedFields(extractedData),
    doctor: metadata.doctor,
    hospital: metadata.hospital,
  });

  return {
    documentId,
    fileName: file.name,
    classification,
    metadata,
    extractedData,
    confidence: classification.confidence,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Route to type-specific extractor based on document classification
 */
async function routeToSpecificExtractor(
  text: string,
  docType: DocumentType,
  metadata: DocumentMetadata
): Promise<any> {
  switch (docType) {
    case 'LAB_REPORT':
      return await extractLabReport(text, metadata.hospital || undefined);

    case 'ECG':
      return await extractECGReport(text);

    case 'ECHO':
      return await extractEchoReport(text);

    case 'MRI':
      return await extractMRIReport(text);

    case 'CT':
      return await extractCTReport(text);

    case 'USG':
      return await extractUSGReport(text);

    case 'XRAY':
      return await extractXRayReport(text);

    case 'PRESCRIPTION':
      return await extractPrescription(text);

    case 'DISCHARGE_SUMMARY':
      return await extractDischargeSummary(text);

    case 'BILLS':
      return await extractMedicalBill(text);

    case 'INSURANCE_CARD':
    case 'POLICY_COPY':
      return await extractInsuranceDocument(text);

    case 'CONSENT_FORM':
      return await extractConsentForm(text);

    case 'REFERRAL_LETTER':
      return await extractReferralLetter(text);

    default:
      // Generic extraction for unspecified types
      return {
        documentType: docType,
        text: text.substring(0, 1000),
        confidence: 0.5,
      };
  }
}

/**
 * Add all extracted fields from clinical note to provenance
 */
function addExtractedFieldsToProvenance(
  extraction: ExtractedClinicalNote,
  source: 'PATIENT_NOTE' | 'DOCUMENT',
  provenanceIndex: ProvenanceIndex
): void {
  const flattenedFields = flattenObject(extraction);

  for (const [fieldPath, fieldData] of Object.entries(flattenedFields)) {
    if (!fieldData || typeof fieldData !== 'object') continue;

    const value = (fieldData as any).value;
    const confidence = (fieldData as any).confidence || 0.95;
    const extractedAt = (fieldData as any).extractedAt || new Date().toISOString();
    const doctor = (fieldData as any).doctor;

    const provenance: FieldProvenance = {
      value,
      confidence,
      source: source === 'PATIENT_NOTE' ? 'PATIENT_NOTE' : 'DOCUMENT',
      extractionMethod: 'MANUAL',
      extractedAt,
      doctor,
    };

    addFieldToProvenance(provenanceIndex, fieldPath, value, provenance);
  }
}

/**
 * Resolve a critical conflict with coordinator decision
 */
export function resolveConflictWithCoordinator(
  pipelineOutput: PipelineOutput,
  fieldPath: string,
  choice: 'PATIENT_NOTE' | 'DOCUMENT' | 'MERGED',
  reasoning?: string,
  coordinatorId?: string
): void {
  resolveFieldConflict(
    pipelineOutput.provenanceIndex,
    fieldPath,
    choice,
    pipelineOutput.reconciliation.mergedData,
    reasoning,
    coordinatorId
  );

  console.log(
    `[Pipeline] Resolved ${fieldPath} with choice: ${choice}`,
    reasoning
  );
}

/**
 * Export complete pipeline output for case processing
 */
export function exportPipelineOutputForCase(output: PipelineOutput): {
  extractedData: Record<string, any>;
  provenance: string;
  reconciliation: string;
  auditTrail: string;
  conflictReport: any;
} {
  return {
    extractedData: output.reconciliation.mergedData,
    provenance: JSON.stringify(getExtractionReport(output.provenanceIndex), null, 2),
    reconciliation: exportReconciliationResult(output.reconciliation),
    auditTrail: output.auditTrail,
    conflictReport: {
      total: output.conflictSummary.totalConflicts,
      critical: output.conflictSummary.criticalConflicts,
      resolved: output.conflictSummary.resolvedConflicts,
      pending: output.conflictSummary.pendingReviews,
    },
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Flatten nested object for field tracking
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
 * Count extracted fields in data object
 */
function countExtractedFields(data: any): number {
  let count = 0;

  function traverse(obj: any) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      count += obj.length;
      obj.forEach(traverse);
    } else {
      for (const value of Object.values(obj)) {
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            traverse(value);
          } else {
            count++;
          }
        }
      }
    }
  }

  traverse(data);
  return count;
}
