/**
 * Page-by-Page Document Extraction Service
 *
 * Extracts medical information page by page from documents:
 * - Classifies each page
 * - Extracts specific medical fields (ICD-10, procedures, LOS, etc)
 * - Consolidates results across all pages
 */

export interface PageClassification {
  pageNumber: number;
  documentType: 'discharge_summary' | 'imaging_report' | 'lab_report' | 'doctor_notes' | 'medical_records' | 'unknown';
  confidence: number;
  summary: string;
}

export interface ExtractedMedicalFields {
  icd10Codes: string[];
  proposedProcedures: string[];
  expectedLengthOfStay?: number;
  diagnosis?: string;
  chiefComplaints?: string;
  vitals?: Record<string, string>;
  findings?: string[];
  medications?: string[];
  doctorName?: string;
  hospitalName?: string;
  consultationDate?: string;
}

export interface PageExtractionResult {
  pageNumber: number;
  classification: PageClassification;
  extractedFields: ExtractedMedicalFields;
  rawText: string;
  confidence: number;
}

export interface ConsolidatedExtractionResult {
  totalPages: number;
  pageResults: PageExtractionResult[];
  consolidatedFields: ExtractedMedicalFields;
  confidence: number;
  sourcePages: Record<string, number>; // field -> page number mapping
}

/**
 * Classify a single page of text
 */
export function classifyPageContent(text: string, pageNumber: number): PageClassification {
  const lowerText = text.toLowerCase();

  // Discharge summary detection
  if (lowerText.includes('discharge summary') ||
      (lowerText.includes('discharge') && lowerText.includes('diagnosis') && lowerText.includes('procedure'))) {
    return {
      pageNumber,
      documentType: 'discharge_summary',
      confidence: 0.95,
      summary: 'Discharge Summary'
    };
  }

  // Imaging report detection
  if (lowerText.match(/mri|ct scan|x-ray|ultrasound|imaging|scan findings/i)) {
    return {
      pageNumber,
      documentType: 'imaging_report',
      confidence: 0.9,
      summary: 'Imaging Report'
    };
  }

  // Lab report detection
  if (lowerText.match(/laboratory|lab result|blood test|pathology|test result/i)) {
    return {
      pageNumber,
      documentType: 'lab_report',
      confidence: 0.9,
      summary: 'Lab Report'
    };
  }

  // Doctor notes detection
  if (lowerText.includes("doctor's note") || lowerText.includes('physician note') ||
      lowerText.includes('clinical note') || lowerText.includes('consultation note')) {
    return {
      pageNumber,
      documentType: 'doctor_notes',
      confidence: 0.85,
      summary: "Doctor's Notes"
    };
  }

  // Medical records
  if (lowerText.match(/medical record|patient record|admission|consultation/i)) {
    return {
      pageNumber,
      documentType: 'medical_records',
      confidence: 0.8,
      summary: 'Medical Records'
    };
  }

  return {
    pageNumber,
    documentType: 'unknown',
    confidence: 0.5,
    summary: 'Unknown Document Type'
  };
}

/**
 * Extract medical fields from page text
 */
export function extractMedicalFieldsFromPage(text: string, pageType: string): ExtractedMedicalFields {
  const fields: ExtractedMedicalFields = {
    icd10Codes: [],
    proposedProcedures: [],
    findings: [],
    medications: [],
  };

  // Extract ICD-10 codes (format: A12.34, B90, etc)
  const icd10Pattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
  const icdMatches = text.match(icd10Pattern);
  if (icdMatches) {
    fields.icd10Codes = [...new Set(icdMatches)];
  }

  // Extract diagnosis
  const diagnosisMatch = text.match(/(?:diagnosis|impression|primary diagnosis)[:\s]+([\w\s\-,()]+?)(?=\n|procedure|icd|$)/i);
  if (diagnosisMatch) {
    fields.diagnosis = diagnosisMatch[1].trim();
  }

  // Extract chief complaints
  const complaintsMatch = text.match(/(?:chief complaint|cc|chief presenting complaint)[:\s]+([\w\s\-,()]+?)(?=\n|history|$)/i);
  if (complaintsMatch) {
    fields.chiefComplaints = complaintsMatch[1].trim();
  }

  // Extract proposed procedures (multiple formats)
  const procedurePatterns = [
    /(?:planned procedure|procedure|surgery|operative procedure)[:\s]+([\w\s\-,()]+?)(?=\n|expected|$)/i,
    /(?:surgical intervention|operation)[:\s]+([\w\s\-,()]+?)(?=\n|$)/i,
    /(?:microdiscectomy|laminectomy|fusion|decompression|arthroscopy|gastrectomy|mastectomy|hysterectomy|nephrectomy)/gi
  ];

  for (const pattern of procedurePatterns) {
    const match = text.match(pattern);
    if (match) {
      const proc = match[1] || match[0];
      if (!fields.proposedProcedures.includes(proc)) {
        fields.proposedProcedures.push(proc.trim());
      }
    }
  }

  // Extract expected length of stay
  const losMatch = text.match(/(?:length\s+of\s+stay|los|expected\s+stay|hospitalization)[:\s]*(\d+)\s*(?:days?)?/i);
  if (losMatch) {
    fields.expectedLengthOfStay = parseInt(losMatch[1]);
  }

  // Extract vitals
  const vitalsPatterns = {
    bp: /(?:bp|blood pressure)[:\s]*(\d+[/\-]\d+)\s*(?:mmhg)?/i,
    pulse: /(?:pulse|hr|heart rate)[:\s]*(\d+)\s*(?:bpm)?/i,
    temp: /(?:temperature|temp)[:\s]*(\d+\.?\d*)\s*(?:°c|c)?/i,
    spo2: /(?:spo2|oxygen saturation|o2 sat)[:\s]*(\d+)\s*(?:%)?/i,
    rr: /(?:rr|respiratory rate)[:\s]*(\d+)\s*(?:bpm)?/i
  };

  fields.vitals = {};
  for (const [key, pattern] of Object.entries(vitalsPatterns)) {
    const match = text.match(pattern);
    if (match) {
      fields.vitals[key] = match[1];
    }
  }
  if (Object.keys(fields.vitals).length === 0) {
    fields.vitals = undefined;
  }

  // Extract medications/drugs
  const medicationMatch = text.match(/(?:medications?|drugs prescribed|prescriptions?)[:\s]+([\w\s\-,()]+?)(?=\n|dosage|$)/i);
  if (medicationMatch) {
    const meds = medicationMatch[1].split(',').map(m => m.trim());
    fields.medications = meds.filter(m => m.length > 0);
  }

  // Extract clinical findings
  const findingsMatch = text.match(/(?:findings|clinical findings|imaging findings)[:\s]+([\w\s\-,()]+?)(?=\n|assessment|$)/i);
  if (findingsMatch) {
    const findings = findingsMatch[1].split('\n').map(f => f.trim());
    fields.findings = findings.filter(f => f.length > 0);
  }

  // Extract doctor name
  const doctorMatch = text.match(/(?:doctor|physician|dr|dr\.)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (doctorMatch) {
    fields.doctorName = doctorMatch[1];
  }

  // Extract hospital/lab name
  const hospitalMatch = text.match(/(?:hospital|clinic|laboratory|lab|center)[:\s]+([A-Za-z\s&]+?)(?=\n|address|$)/i);
  if (hospitalMatch) {
    fields.hospitalName = hospitalMatch[1].trim();
  }

  // Extract consultation date
  const dateMatch = text.match(/(?:date|consultation date|visit date)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  if (dateMatch) {
    fields.consultationDate = dateMatch[1];
  }

  return fields;
}

/**
 * Consolidate extracted fields from multiple pages
 */
export function consolidateExtractedFields(pageResults: PageExtractionResult[]): ExtractedMedicalFields {
  const consolidated: ExtractedMedicalFields = {
    icd10Codes: [],
    proposedProcedures: [],
    findings: [],
    medications: [],
  };

  const sourcePages: Record<string, number> = {};

  // Consolidate ICD-10 codes
  const allIcds = new Set<string>();
  for (const result of pageResults) {
    result.extractedFields.icd10Codes?.forEach(code => {
      allIcds.add(code);
      sourcePages[`icd10:${code}`] = result.pageNumber;
    });
  }
  consolidated.icd10Codes = Array.from(allIcds);

  // Consolidate procedures
  const allProcedures = new Set<string>();
  for (const result of pageResults) {
    result.extractedFields.proposedProcedures?.forEach(proc => {
      allProcedures.add(proc);
      sourcePages[`procedure:${proc}`] = result.pageNumber;
    });
  }
  consolidated.proposedProcedures = Array.from(allProcedures);

  // Get first available diagnosis
  consolidated.diagnosis = pageResults.find(r => r.extractedFields.diagnosis)?.extractedFields.diagnosis;
  if (consolidated.diagnosis) {
    sourcePages['diagnosis'] = pageResults.find(r => r.extractedFields.diagnosis)!.pageNumber;
  }

  // Get first available chief complaints
  consolidated.chiefComplaints = pageResults.find(r => r.extractedFields.chiefComplaints)?.extractedFields.chiefComplaints;
  if (consolidated.chiefComplaints) {
    sourcePages['chiefComplaints'] = pageResults.find(r => r.extractedFields.chiefComplaints)!.pageNumber;
  }

  // Get LOS (prefer discharge summary)
  const losResult = pageResults.find(r => r.classification.documentType === 'discharge_summary' && r.extractedFields.expectedLengthOfStay) ||
                   pageResults.find(r => r.extractedFields.expectedLengthOfStay);
  if (losResult) {
    consolidated.expectedLengthOfStay = losResult.extractedFields.expectedLengthOfStay;
    sourcePages['expectedLengthOfStay'] = losResult.pageNumber;
  }

  // Consolidate findings
  const allFindings = new Set<string>();
  for (const result of pageResults) {
    result.extractedFields.findings?.forEach(finding => allFindings.add(finding));
  }
  if (allFindings.size > 0) {
    consolidated.findings = Array.from(allFindings);
  }

  // Get vitals from first page that has them
  const vitalsResult = pageResults.find(r => r.extractedFields.vitals);
  if (vitalsResult) {
    consolidated.vitals = vitalsResult.extractedFields.vitals;
    sourcePages['vitals'] = vitalsResult.pageNumber;
  }

  // Consolidate medications
  const allMeds = new Set<string>();
  for (const result of pageResults) {
    result.extractedFields.medications?.forEach(med => allMeds.add(med));
  }
  if (allMeds.size > 0) {
    consolidated.medications = Array.from(allMeds);
  }

  return consolidated;
}

/**
 * Extract and consolidate from all pages of a document
 */
export async function extractFromAllPages(
  pages: string[],
  fileName: string
): Promise<ConsolidatedExtractionResult> {
  const pageResults: PageExtractionResult[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    const pageNumber = i + 1;

    // Classify page
    const classification = classifyPageContent(pageText, pageNumber);

    // Extract fields
    const extractedFields = extractMedicalFieldsFromPage(pageText, classification.documentType);

    // Calculate confidence based on fields found
    const fieldsFound = [
      extractedFields.icd10Codes.length > 0,
      extractedFields.proposedProcedures.length > 0,
      extractedFields.expectedLengthOfStay !== undefined,
      extractedFields.diagnosis !== undefined,
      extractedFields.chiefComplaints !== undefined,
    ].filter(Boolean).length;
    const confidence = Math.min(0.95, 0.5 + (fieldsFound * 0.1));

    pageResults.push({
      pageNumber,
      classification,
      extractedFields,
      rawText: pageText,
      confidence
    });

    console.log(`[Page ${pageNumber}] Type: ${classification.documentType}, Confidence: ${confidence.toFixed(2)}`);
    console.log(`  - ICD-10: ${extractedFields.icd10Codes.join(', ') || 'None'}`);
    console.log(`  - Procedures: ${extractedFields.proposedProcedures.join(', ') || 'None'}`);
    console.log(`  - LOS: ${extractedFields.expectedLengthOfStay || 'Not found'}`);
  }

  // Consolidate across all pages
  const consolidatedFields = consolidateExtractedFields(pageResults);

  // Calculate overall confidence
  const overallConfidence = pageResults.reduce((sum, r) => sum + r.confidence, 0) / pageResults.length;

  return {
    totalPages: pages.length,
    pageResults,
    consolidatedFields,
    confidence: overallConfidence,
    sourcePages: {}
  };
}
