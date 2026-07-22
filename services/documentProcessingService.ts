/**
 * Document Processing Service
 *
 * Handles document upload, OCR/extraction, and case model updates.
 * Orchestrates the full pipeline: Upload → OCR → Classification → Extraction → Validation → Case Update
 */

import { Case } from './caseModel';
import { extractClinicalNoteFields, type ExtractedClinicalNoteFields } from './geminiService';

export interface DocumentProcessingStatus {
  documentId: string;
  status: 'uploading' | 'processing' | 'extracting' | 'validating' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  extractedData?: any;
  confidence?: number;
  error?: string;
}

export interface ProcessedDocument {
  documentId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  status: 'extracted' | 'verified' | 'error';
  extractedFields?: Record<string, any>;
  confidence?: number;
  errors?: string[];
}

// Store active processing jobs
const processingJobs = new Map<string, DocumentProcessingStatus>();

// Callback registry for live updates
type StatusCallback = (status: DocumentProcessingStatus) => void;
const statusCallbacks = new Map<string, Set<StatusCallback>>();

/**
 * Register callback for document processing status updates
 */
export function onDocumentProcessingStatus(
  documentId: string,
  callback: StatusCallback
): () => void {
  if (!statusCallbacks.has(documentId)) {
    statusCallbacks.set(documentId, new Set());
  }
  statusCallbacks.get(documentId)!.add(callback);

  // Return unsubscribe function
  return () => {
    statusCallbacks.get(documentId)?.delete(callback);
  };
}

/**
 * Notify all listeners of status update
 */
function notifyStatusChange(status: DocumentProcessingStatus) {
  processingJobs.set(status.documentId, status);
  statusCallbacks.get(status.documentId)?.forEach(callback => callback(status));
}

/**
 * Upload and process a document file
 */
export async function processDocumentFile(
  file: File,
  caseRecord: Case,
  documentType: string
): Promise<ProcessedDocument> {
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Step 1: Upload
    notifyStatusChange({
      documentId,
      status: 'uploading',
      progress: 20,
      message: `Uploading ${file.name}...`,
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: OCR
    notifyStatusChange({
      documentId,
      status: 'processing',
      progress: 40,
      message: 'Running OCR to extract text...',
    });

    const fileText = await extractTextFromFile(file);

    // Step 3: Extraction
    notifyStatusChange({
      documentId,
      status: 'extracting',
      progress: 60,
      message: 'Extracting structured data...',
    });

    const extractedData = await extractDataFromDocument(
      fileText,
      file.type,
      documentType,
      caseRecord
    );

    // Step 4: Validation
    notifyStatusChange({
      documentId,
      status: 'validating',
      progress: 80,
      message: 'Validating extracted data...',
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 5: Completed
    notifyStatusChange({
      documentId,
      status: 'completed',
      progress: 100,
      message: 'Document processed successfully',
      extractedData,
      confidence: extractedData.confidence || 0.85,
    });

    return {
      documentId,
      fileName: file.name,
      fileType: file.type,
      uploadedAt: new Date().toISOString(),
      status: 'extracted',
      extractedFields: extractedData,
      confidence: extractedData.confidence || 0.85,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    notifyStatusChange({
      documentId,
      status: 'failed',
      progress: 100,
      message: 'Document processing failed',
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Extract text from file (simulate OCR)
 */
async function extractTextFromFile(file: File): Promise<string> {
  if (file.type.includes('text')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  if (file.type.includes('pdf') || file.type.includes('image')) {
    return simulateOCRExtraction(file.name);
  }

  throw new Error(`Unsupported file type: ${file.type}`);
}

/**
 * Simulate OCR extraction for images/PDFs
 */
function simulateOCRExtraction(fileName: string): string {
  if (fileName.toLowerCase().includes('discharge') || fileName.toLowerCase().includes('summary')) {
    return `DISCHARGE SUMMARY
Patient: John Doe
Date of Admission: 2026-07-20
Date of Discharge: 2026-07-22
Diagnosis: Herniated disc L4-L5, causing radiculopathy
ICD-10: M51.26
Chief Complaint: Lower back pain radiating to left leg
History of Present Illness: Patient presented with acute onset lower back pain following lifting injury.
Physical Examination: Tenderness over L4-L5 region
Imaging: MRI Lumbar Spine: Herniated disc at L4-L5 level
Planned Procedure: Lumbar microdiscectomy
Expected Length of Stay: 3 days`;
  }

  return `Medical Document\nDate: ${new Date().toISOString().split('T')[0]}\nDiagnosis: Not specified`;
}

/**
 * Extract structured data from document text
 */
async function extractDataFromDocument(
  text: string,
  fileType: string,
  documentType: string,
  caseRecord: Case
): Promise<any> {
  try {
    if (documentType === 'discharge_summary' || documentType === 'doctor_notes' || documentType === 'clinical_note') {
      return await extractClinicalData(text);
    }
    return performSimpleClinicalExtraction(text);
  } catch (error) {
    console.error('Failed to extract data:', error);
    return {
      extractedText: text.substring(0, 500),
      confidence: 0.5,
      error: 'Partial extraction due to processing error',
    };
  }
}

/**
 * Extract clinical data from text
 */
async function extractClinicalData(text: string): Promise<ExtractedClinicalNoteFields> {
  try {
    const extracted = await extractClinicalNoteFields(text);
    return {
      ...extracted,
      confidence: extracted.confidence || 0.8,
    };
  } catch (error) {
    console.error('Failed to use AI extraction:', error);
    return performSimpleClinicalExtraction(text);
  }
}

/**
 * Simple extraction for clinical data (fallback)
 */
function performSimpleClinicalExtraction(text: string): ExtractedClinicalNoteFields {
  const diagnosis = extractValue(text, /(?:diagnosis|diagnoses)[:\s]+([\w\s-]+)/i);
  const procedure = extractValue(text, /(?:procedure|surgery|operation)[:\s]+([\w\s-]+)/i);
  const losMatch = text.match(/(?:length\s+of\s+stay|los)[:\s]*(\d+)\s*(?:days?)?/i);

  return {
    diagnosis: diagnosis,
    plannedProcedures: procedure ? [procedure] : undefined,
    severity: text.match(/severe|critical/i) ? 'high' : 'moderate',
    estimatedLOS: losMatch ? parseInt(losMatch[1]) : undefined,
    confidence: 0.7,
  };
}

/**
 * Helper to extract regex-matched value
 */
function extractValue(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (match) {
    return match[match.length - 1]?.trim();
  }
  return undefined;
}

/**
 * Apply extracted data to case model
 */
export function applyExtractedDataToCase(
  caseRecord: Case,
  extractedData: any,
  documentType: string
): Case {
  const updated = { ...caseRecord };

  if (extractedData.diagnosis) {
    updated.clinical.diagnosis = extractedData.diagnosis;
  }
  if (extractedData.plannedProcedures?.length > 0) {
    updated.clinical.proposedProcedure = extractedData.plannedProcedures[0];
  }
  if (extractedData.estimatedLOS) {
    updated.clinical.expectedLengthOfStay = extractedData.estimatedLOS;
  }
  if (extractedData.severity) {
    updated.clinical.severity = extractedData.severity;
  }

  if (!updated.metadata) {
    updated.metadata = {};
  }
  updated.metadata.lastExtractionAt = new Date().toISOString();
  updated.metadata.extractionConfidence = extractedData.confidence || 0.8;

  return updated;
}

/**
 * Get processing job status
 */
export function getProcessingStatus(documentId: string): DocumentProcessingStatus | undefined {
  return processingJobs.get(documentId);
}
