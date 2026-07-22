/**
 * Document Classification Service
 *
 * Deterministic classification of uploaded medical documents into 20+ types.
 * Uses Sarvam AI extracted text + keyword patterns for accurate classification.
 *
 * Document types:
 * - Clinical: Admission Note, Discharge Summary, Progress Notes, Doctor Notes, Case Sheet
 * - Nursing: Nursing Notes, OT Notes, Anaesthesia Notes
 * - Diagnostic: Lab Reports, Radiology Reports, ECG, Echo, MRI, CT, USG, X-ray
 * - Administrative: Prescription, Medicine Chart, Insurance Card, Policy Copy
 * - Identity: Aadhaar, PAN
 * - Financial: Bills, Receipts, Cost Estimate
 * - Legal: Consent Forms, Referral Letter, Previous Medical Records
 */

export type DocumentType =
  | 'ADMISSION_NOTE'
  | 'DISCHARGE_SUMMARY'
  | 'PROGRESS_NOTES'
  | 'DOCTOR_NOTES'
  | 'CASE_SHEET'
  | 'NURSING_NOTES'
  | 'OT_NOTES'
  | 'ANAESTHESIA_NOTES'
  | 'LAB_REPORT'
  | 'RADIOLOGY_REPORT'
  | 'ECG'
  | 'ECHO'
  | 'MRI'
  | 'CT'
  | 'USG'
  | 'XRAY'
  | 'PRESCRIPTION'
  | 'MEDICINE_CHART'
  | 'INSURANCE_CARD'
  | 'POLICY_COPY'
  | 'AADHAAR'
  | 'PAN'
  | 'BILLS'
  | 'RECEIPTS'
  | 'COST_ESTIMATE'
  | 'CONSENT_FORM'
  | 'REFERRAL_LETTER'
  | 'PREVIOUS_MEDICAL_RECORDS'
  | 'OTHER';

export interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
  keywords: string[];
  reasonForClassification: string;
  suggestedAlternatives: DocumentType[];
}

export interface DocumentMetadata {
  type: DocumentType;
  date: string | null;
  time: string | null;
  hospital: string | null;
  doctor: string | null;
  department: string | null;
  pageCount: number;
  extractionConfidence: number;
}

const classificationPatterns: Record<DocumentType, RegExp[]> = {
  ADMISSION_NOTE: [
    /admission note/i,
    /admitted on/i,
    /admission date/i,
    /reason for admission/i,
    /chief complaint.*admission/i,
  ],
  DISCHARGE_SUMMARY: [
    /discharge summary/i,
    /discharged on/i,
    /discharge date/i,
    /final diagnosis/i,
    /hospital course.*discharge/i,
  ],
  PROGRESS_NOTES: [
    /progress note/i,
    /daily progress/i,
    /clinical progress/i,
    /patient progress/i,
  ],
  DOCTOR_NOTES: [
    /doctor.*note/i,
    /physician note/i,
    /clinical note/i,
    /consultant note/i,
  ],
  CASE_SHEET: [
    /case sheet/i,
    /case summary/i,
    /case details/i,
  ],
  NURSING_NOTES: [
    /nursing note/i,
    /nurse.*observation/i,
    /nursing assessment/i,
  ],
  OT_NOTES: [
    /OT note/i,
    /operation theatre/i,
    /operative note/i,
    /surgical note/i,
    /intraoperative/i,
  ],
  ANAESTHESIA_NOTES: [
    /anaesthesia note/i,
    /anesthesia note/i,
    /anaesthetic record/i,
    /anesthetic record/i,
  ],
  LAB_REPORT: [
    /laboratory report/i,
    /lab report/i,
    /blood test/i,
    /lab results/i,
    /CBC|DLC|Hb|TLC|platelets/i,
  ],
  RADIOLOGY_REPORT: [
    /radiology report/i,
    /radiological report/i,
    /imaging report/i,
    /radiologist/i,
  ],
  ECG: [
    /ECG|electrocardiogram/i,
    /heart rate|rhythm|interval/i,
  ],
  ECHO: [
    /echocardiography|echo|cardiac ultrasound/i,
    /ejection fraction|chambers/i,
  ],
  MRI: [
    /MRI|magnetic resonance imaging/i,
    /MRI scan|MR imaging/i,
  ],
  CT: [
    /CT scan|computed tomography|CT image/i,
    /CT finding/i,
  ],
  USG: [
    /ultrasound|USG|sonography/i,
    /ultrasound report/i,
  ],
  XRAY: [
    /X-ray|XRay|radiograph/i,
    /chest X-ray|X-ray finding/i,
  ],
  PRESCRIPTION: [
    /prescription|Rx/i,
    /prescribed medicine/i,
    /medicine list/i,
  ],
  MEDICINE_CHART: [
    /medicine chart|medication chart/i,
    /drug chart|medication schedule/i,
  ],
  INSURANCE_CARD: [
    /insurance card/i,
    /policy card/i,
    /member card/i,
  ],
  POLICY_COPY: [
    /policy copy|policy document/i,
    /insurance policy/i,
    /policy details/i,
  ],
  AADHAAR: [
    /aadhaar|aadhar/i,
    /unique identification authority/i,
  ],
  PAN: [
    /PAN|permanent account number/i,
    /tax identification/i,
  ],
  BILLS: [
    /bill|billing|invoice/i,
    /hospital bill|medical bill/i,
    /total amount|amount charged/i,
  ],
  RECEIPTS: [
    /receipt|paid receipt/i,
    /receipt number/i,
  ],
  COST_ESTIMATE: [
    /cost estimate|estimated cost/i,
    /cost breakdown/i,
    /estimate sheet/i,
  ],
  CONSENT_FORM: [
    /consent form|informed consent/i,
    /consent for procedure/i,
  ],
  REFERRAL_LETTER: [
    /referral letter|referred by/i,
    /letter of referral/i,
  ],
  PREVIOUS_MEDICAL_RECORDS: [
    /previous medical record|prior record/i,
    /medical history record/i,
    /old records/i,
  ],
  OTHER: [],
};

/**
 * Classify a document based on its text content
 */
export function classifyDocument(extractedText: string): DocumentClassification {
  const textLower = extractedText.toLowerCase();

  // Count keyword matches for each type
  const scores: Record<DocumentType, number> = {} as Record<DocumentType, number>;

  for (const [docType, patterns] of Object.entries(classificationPatterns)) {
    let matches = 0;
    for (const pattern of patterns) {
      const patternMatches = (extractedText.match(pattern) || []).length;
      matches += patternMatches;
    }
    scores[docType as DocumentType] = matches;
  }

  // Find best match
  let bestType: DocumentType = 'OTHER';
  let bestScore = 0;
  const alternatives: DocumentType[] = [];

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      alternatives.push(bestType);
      bestType = type as DocumentType;
      bestScore = score;
    } else if (score > 0) {
      alternatives.push(type as DocumentType);
    }
  }

  // Sort alternatives by score
  alternatives.sort((a, b) => (scores[b] || 0) - (scores[a] || 0));

  // Calculate confidence (0.5 if no patterns matched, higher if matched)
  const confidence =
    bestScore > 0
      ? Math.min(0.5 + (bestScore * 0.1), 1.0) // 0.5 minimum, up to 1.0
      : 0.3; // Low confidence if no patterns matched

  // Extract keywords that matched
  const matchedKeywords: string[] = [];
  const patterns = classificationPatterns[bestType];
  for (const pattern of patterns) {
    const matches = extractedText.match(pattern);
    if (matches) {
      matchedKeywords.push(pattern.source);
    }
  }

  return {
    documentType: bestType,
    confidence,
    keywords: matchedKeywords,
    reasonForClassification:
      bestScore > 0
        ? `Matched ${bestScore} pattern(s) for ${bestType}`
        : `No specific patterns matched, classified as ${bestType}`,
    suggestedAlternatives: alternatives.slice(0, 3),
  };
}

/**
 * Extract metadata from classified document
 */
export function extractDocumentMetadata(
  extractedText: string,
  documentType: DocumentType,
  pageCount: number,
  extractionConfidence: number
): DocumentMetadata {
  const text = extractedText;

  return {
    type: documentType,
    date: extractDateFromText(text),
    time: extractTimeFromText(text),
    hospital: extractHospitalFromText(text),
    doctor: extractDoctorFromText(text),
    department: extractDepartmentFromText(text),
    pageCount,
    extractionConfidence,
  };
}

// ==================== HELPER EXTRACTION FUNCTIONS ====================

function extractDateFromText(text: string): string | null {
  // Match various date formats
  const datePatterns = [
    /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/, // DD-MM-YYYY or MM/DD/YYYY
    /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/, // YYYY-MM-DD
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return null;
}

function extractTimeFromText(text: string): string | null {
  const timePattern = /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/;
  const match = text.match(timePattern);
  return match ? match[0] : null;
}

function extractHospitalFromText(text: string): string | null {
  const hospitalPattern = /(?:hospital|clinic|medical centre|healthcare|facility)[:\s]*([^\n,]+)/i;
  const match = text.match(hospitalPattern);
  return match ? match[1].trim() : null;
}

function extractDoctorFromText(text: string): string | null {
  const doctorPatterns = [
    /(?:doctor|dr\.?|physician|consultant)[:\s]*([^\n,]+)/i,
    /(?:treating doctor|attending physician)[:\s]*([^\n,]+)/i,
  ];

  for (const pattern of doctorPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

function extractDepartmentFromText(text: string): string | null {
  const departmentPattern = /(?:department|dept)[:\s]*([^\n,]+)/i;
  const match = text.match(departmentPattern);
  return match ? match[1].trim() : null;
}

/**
 * Get human-readable name for document type
 */
export function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    ADMISSION_NOTE: 'Admission Note',
    DISCHARGE_SUMMARY: 'Discharge Summary',
    PROGRESS_NOTES: 'Progress Notes',
    DOCTOR_NOTES: 'Doctor Notes',
    CASE_SHEET: 'Case Sheet',
    NURSING_NOTES: 'Nursing Notes',
    OT_NOTES: 'OT Notes',
    ANAESTHESIA_NOTES: 'Anaesthesia Notes',
    LAB_REPORT: 'Lab Report',
    RADIOLOGY_REPORT: 'Radiology Report',
    ECG: 'ECG',
    ECHO: 'Echocardiography',
    MRI: 'MRI',
    CT: 'CT Scan',
    USG: 'Ultrasound',
    XRAY: 'X-ray',
    PRESCRIPTION: 'Prescription',
    MEDICINE_CHART: 'Medicine Chart',
    INSURANCE_CARD: 'Insurance Card',
    POLICY_COPY: 'Policy Copy',
    AADHAAR: 'Aadhaar',
    PAN: 'PAN',
    BILLS: 'Bills',
    RECEIPTS: 'Receipts',
    COST_ESTIMATE: 'Cost Estimate',
    CONSENT_FORM: 'Consent Form',
    REFERRAL_LETTER: 'Referral Letter',
    PREVIOUS_MEDICAL_RECORDS: 'Previous Medical Records',
    OTHER: 'Other Document',
  };

  return labels[type];
}
