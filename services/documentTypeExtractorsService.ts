/**
 * Document Type-Specific Extractors
 *
 * Extracts structured data from various document types:
 * - Prescriptions: Medications, dosages, frequencies, durations
 * - Discharge Summaries: Admitting diagnosis, treatment, discharge instructions
 * - Medical Bills: Itemized charges, taxes, total amounts
 * - Insurance Documents: Policy details, coverage, exclusions
 * - Consent Forms: Procedure, risks, authorization
 * - Referral Letters: Source, destination, referral reason
 */

// ==================== PRESCRIPTION EXTRACTION ====================

export interface PrescriptionMedicine {
  name: string;
  strength?: string;
  unit?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: 'oral' | 'injection' | 'topical' | 'inhalation' | null;
  instructions?: string;
}

export interface PrescriptionReport {
  reportType: 'PRESCRIPTION';
  prescriptionDate: string | null;
  prescribedBy: string | null;
  licenseNumber?: string;
  patientName: string | null;
  patientAge: string | null;
  patientGender: string | null;
  diagnosis: string | null;

  medicines: PrescriptionMedicine[];
  specialInstructions?: string;
  followUpDate?: string;
  totalMedicines: number;

  confidence: number;
}

export async function extractPrescription(reportText: string): Promise<PrescriptionReport> {
  return {
    reportType: 'PRESCRIPTION',
    prescriptionDate: extractDateFromText(reportText),
    prescribedBy: extractField(reportText, /(?:prescribed|issued)\s+by[:\s]*([^\n]+)/i),
    licenseNumber: extractField(reportText, /(?:reg|license|ref)[:\s]*([^\n]+)/i),

    patientName: extractField(reportText, /(?:patient|name)[:\s]*([^\n]+)/i),
    patientAge: extractField(reportText, /age[:\s]*(\d+)/i),
    patientGender: extractField(reportText, /(?:sex|gender)[:\s]*(M|F|Male|Female)/i),
    diagnosis: extractField(reportText, /(?:diagnosis|indication)[:\s]*([^\n]+)/i),

    medicines: extractMedicines(reportText),
    specialInstructions: extractField(reportText, /(?:instructions|notes)[:\s]*([\s\S]+?)(?=\n\n|follow|$)/i),
    followUpDate: extractField(reportText, /follow[\s-]*?up[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i),
    totalMedicines: extractMedicines(reportText).length,

    confidence: 0.9,
  };
}

function extractMedicines(text: string): PrescriptionMedicine[] {
  const medicines: PrescriptionMedicine[] = [];

  const pattern = /([A-Za-z\s]+?)(?:\s+(\d+)(?:\s*(mg|ml|g|IU))?)?[\s–-]*(\d+)\s*(?:mg|ml|tablet|capsule)?[\s–-]*([A-Za-z\s]+?)\s*[-–]\s*([0-9/×]+\s*(?:hours|day|week|month|times)?)[^\n]*(?:\n|$)/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    medicines.push({
      name: match[1].trim(),
      strength: match[2],
      unit: match[3],
      dosage: match[4],
      frequency: match[6],
      duration: extractDuration(text, match[0]),
      route: extractRoute(match[5]),
      instructions: match[0],
    });
  }

  return medicines;
}

function extractRoute(text: string): 'oral' | 'injection' | 'topical' | 'inhalation' | null {
  const lower = text.toLowerCase();
  if (lower.includes('oral') || lower.includes('tablet') || lower.includes('capsule')) return 'oral';
  if (lower.includes('injection') || lower.includes('iv') || lower.includes('im')) return 'injection';
  if (lower.includes('topical') || lower.includes('cream') || lower.includes('ointment')) return 'topical';
  if (lower.includes('inhalation') || lower.includes('inhaler')) return 'inhalation';
  return null;
}

function extractDuration(text: string, medicineText: string): string {
  const pattern = /(\d+)\s*(?:day|week|month|year)s?/i;
  const match = medicineText.match(pattern);
  return match ? match[0] : 'As prescribed';
}

// ==================== DISCHARGE SUMMARY EXTRACTION ====================

export interface DischargeSummary {
  reportType: 'DISCHARGE_SUMMARY';
  admissionDate: string | null;
  dischargeDate: string | null;
  lengthOfStay: number | null;

  patientDemographics: {
    name: string | null;
    age: string | null;
    gender: string | null;
    mrNumber: string | null;
  };

  admittingDiagnosis: string | null;
  finalDiagnosis: string[];
  icdCodes: string[];

  treatmentSummary: string | null;
  procedures: string[];
  complications: string[];

  dischargeInstructions: string | null;
  medications: PrescriptionMedicine[];
  followUpInstructions: string | null;
  restrictions: string[];

  confidence: number;
}

export async function extractDischargeSummary(reportText: string): Promise<DischargeSummary> {
  return {
    reportType: 'DISCHARGE_SUMMARY',
    admissionDate: extractDateFromText(reportText),
    dischargeDate: extractDateFromText(reportText, /discharge[\s]*date/i),
    lengthOfStay: extractNumericField(reportText, /length\s+of\s+stay[:\s]*(\d+)/i),

    patientDemographics: {
      name: extractField(reportText, /(?:patient|name)[:\s]*([^\n]+)/i),
      age: extractField(reportText, /age[:\s]*(\d+)/i),
      gender: extractField(reportText, /(?:sex|gender)[:\s]*(M|F|Male|Female)/i),
      mrNumber: extractField(reportText, /(?:MR|medical record)[:\s]*([^\n]+)/i),
    },

    admittingDiagnosis: extractField(reportText, /admitting\s+diagnosis[:\s]*([^\n]+)/i),
    finalDiagnosis: extractDiagnosisList(reportText),
    icdCodes: extractICDCodes(reportText),

    treatmentSummary: extractField(reportText, /treatment[:\s]*([\s\S]+?)(?=procedures?|complications?|$)/i),
    procedures: extractProcedureList(reportText),
    complications: extractComplicationsList(reportText),

    dischargeInstructions: extractField(reportText, /discharge\s+instructions?[:\s]*([\s\S]+?)(?=medications?|follow|restrictions|$)/i),
    medications: extractMedicines(reportText),
    followUpInstructions: extractField(reportText, /follow[\s-]*?up[:\s]*([\s\S]+?)(?=restrictions|$)/i),
    restrictions: extractRestrictions(reportText),

    confidence: 0.9,
  };
}

function extractDiagnosisList(text: string): string[] {
  const diagnoses: string[] = [];
  const match = text.match(/(?:final|discharge)\s+diagnosis[\s:]*([\s\S]+?)(?=procedures?|ICD|treatment|$)/i);
  if (match) {
    const lines = match[1].split(/\n|[•·]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 3) {
        diagnoses.push(trimmed);
      }
    });
  }
  return diagnoses;
}

function extractICDCodes(text: string): string[] {
  const codes: string[] = [];
  const pattern = /(?:ICD[:\s-]*)?([A-Z]\d{2}(?:\.\d{1,2})?)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    codes.push(match[1]);
  }
  return [...new Set(codes)];
}

function extractProcedureList(text: string): string[] {
  const procedures: string[] = [];
  const match = text.match(/procedures?[\s:]*([\s\S]+?)(?=complication|medication|discharge|$)/i);
  if (match) {
    const lines = match[1].split(/\n|[•·]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 3) {
        procedures.push(trimmed);
      }
    });
  }
  return procedures;
}

function extractComplicationsList(text: string): string[] {
  const complications: string[] = [];
  const match = text.match(/complications?[\s:]*([\s\S]+?)(?=discharge|medication|treatment|$)/i);
  if (match) {
    const lines = match[1].split(/\n|[•·]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 0 && !trimmed.match(/^none|no complication/i)) {
        complications.push(trimmed);
      }
    });
  }
  return complications;
}

function extractRestrictions(text: string): string[] {
  const restrictions: string[] = [];
  const match = text.match(/restrictions?[\s:]*([\s\S]+?)(?=\n\n|$)/i);
  if (match) {
    const lines = match[1].split(/\n|[•·]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 0) {
        restrictions.push(trimmed);
      }
    });
  }
  return restrictions;
}

// ==================== MEDICAL BILL EXTRACTION ====================

export interface BillLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

export interface MedicalBill {
  reportType: 'BILLS';
  billDate: string | null;
  billNumber: string | null;
  hospital: string | null;

  patientName: string | null;
  mrNumber: string | null;
  admissionDate: string | null;
  dischargeDate: string | null;

  lineItems: BillLineItem[];
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  totalAmount: number | null;

  paymentStatus: 'paid' | 'pending' | 'partial' | 'unknown';
  confidence: number;
}

export async function extractMedicalBill(reportText: string): Promise<MedicalBill> {
  return {
    reportType: 'BILLS',
    billDate: extractDateFromText(reportText),
    billNumber: extractField(reportText, /bill\s+(?:no|number|id)[:\s]*([^\n]+)/i),
    hospital: extractField(reportText, /(?:hospital|clinic|facility)[:\s]*([^\n]+)/i),

    patientName: extractField(reportText, /(?:patient|name)[:\s]*([^\n]+)/i),
    mrNumber: extractField(reportText, /(?:MR|medical record)[:\s]*([^\n]+)/i),
    admissionDate: extractDateFromText(reportText, /admission[\s]*date/i),
    dischargeDate: extractDateFromText(reportText, /discharge[\s]*date/i),

    lineItems: extractBillLineItems(reportText),
    subtotal: extractNumericField(reportText, /subtotal[:\s]*(?:₹|Rs\.?)?([0-9,]+(?:\.\d{2})?)/i),
    tax: extractNumericField(reportText, /(?:tax|GST)[:\s]*(?:₹|Rs\.?)?([0-9,]+(?:\.\d{2})?)/i),
    discount: extractNumericField(reportText, /discount[:\s]*(?:₹|Rs\.?)?([0-9,]+(?:\.\d{2})?)/i),
    totalAmount: extractNumericField(reportText, /total(?:\s+amount)?[:\s]*(?:₹|Rs\.?)?([0-9,]+(?:\.\d{2})?)/i),

    paymentStatus: extractPaymentStatus(reportText),
    confidence: 0.85,
  };
}

function extractBillLineItems(text: string): BillLineItem[] {
  const items: BillLineItem[] = [];
  const pattern = /([A-Za-z\s]+?)\s+(\d+)\s+(?:×|x)\s+(?:₹|Rs\.)?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:₹|Rs\.)?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    items.push({
      description: match[1].trim(),
      quantity: parseInt(match[2]),
      unitPrice: parseFloat(match[3].replace(/,/g, '')),
      totalPrice: parseFloat(match[4].replace(/,/g, '')),
      category: extractCategory(match[1]),
    });
  }

  return items;
}

function extractCategory(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('room') || lower.includes('icu') || lower.includes('ward')) return 'accommodation';
  if (lower.includes('surgery') || lower.includes('operation')) return 'procedure';
  if (lower.includes('medicine') || lower.includes('drug')) return 'medications';
  if (lower.includes('lab') || lower.includes('test')) return 'diagnostics';
  if (lower.includes('consultation') || lower.includes('visit')) return 'professional';
  return 'other';
}

function extractPaymentStatus(text: string): 'paid' | 'pending' | 'partial' | 'unknown' {
  const lower = text.toLowerCase();
  if (lower.includes('paid')) return 'paid';
  if (lower.includes('pending')) return 'pending';
  if (lower.includes('partial')) return 'partial';
  return 'unknown';
}

// ==================== INSURANCE DOCUMENT EXTRACTION ====================

export interface InsurancePolicy {
  policyNumber: string | null;
  policyType: string | null;
  policyHolder: string | null;
  dependents: string[];
  sumInsured: number | null;
  premiumAmount: number | null;
  policyStartDate: string | null;
  policyEndDate: string | null;
  copay: number | null;
  deductible: number | null;
  coverage: string[];
  exclusions: string[];
  claimProcess: string | null;
  claimNotes: string | null;
}

export async function extractInsuranceDocument(reportText: string): Promise<InsurancePolicy> {
  return {
    policyNumber: extractField(reportText, /policy\s+(?:no|number)[:\s]*([^\n]+)/i),
    policyType: extractField(reportText, /policy\s+(?:type|plan)[:\s]*([^\n]+)/i),
    policyHolder: extractField(reportText, /(?:holder|member)[:\s]*([^\n]+)/i),
    dependents: extractDependents(reportText),
    sumInsured: extractNumericField(reportText, /sum\s+insured[:\s]*(?:₹|Rs\.)?([0-9,]+)/i),
    premiumAmount: extractNumericField(reportText, /premium[:\s]*(?:₹|Rs\.)?([0-9,]+(?:\.\d{2})?)/i),
    policyStartDate: extractDateFromText(reportText, /(?:effective|start|from)/i),
    policyEndDate: extractDateFromText(reportText, /(?:expiry|end|to)/i),
    copay: extractNumericField(reportText, /co[\s-]*pay[:\s]*(?:₹|Rs\.)?([0-9,]+)/i),
    deductible: extractNumericField(reportText, /deductible[:\s]*(?:₹|Rs\.)?([0-9,]+)/i),
    coverage: extractCoverage(reportText),
    exclusions: extractExclusions(reportText),
    claimProcess: extractField(reportText, /claim\s+(?:process|procedure)[:\s]*([\s\S]+?)(?=exclusion|coverage|$)/i),
    claimNotes: extractField(reportText, /claim\s+notes?[:\s]*([\s\S]+?)(?=\n\n|$)/i),
  };
}

function extractDependents(text: string): string[] {
  const dependents: string[] = [];
  const match = text.match(/dependents?[\s:]*([\s\S]+?)(?=coverage|exclusion|sum|$)/i);
  if (match) {
    const lines = match[1].split(/\n|[•·]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 2) {
        dependents.push(trimmed);
      }
    });
  }
  return dependents;
}

function extractCoverage(text: string): string[] {
  const coverage: string[] = [];
  const match = text.match(/coverage[\s:]*([\s\S]+?)(?=exclusion|deductible|claim|$)/i);
  if (match) {
    const lines = match[1].split(/\n|[•·]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 2) {
        coverage.push(trimmed);
      }
    });
  }
  return coverage;
}

function extractExclusions(text: string): string[] {
  const exclusions: string[] = [];
  const match = text.match(/exclusions?[\s:]*([\s\S]+?)(?=coverage|claim|policy|$)/i);
  if (match) {
    const lines = match[1].split(/\n|[•·]/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 2) {
        exclusions.push(trimmed);
      }
    });
  }
  return exclusions;
}

// ==================== CONSENT FORM EXTRACTION ====================

export interface ConsentForm {
  reportType: 'CONSENT_FORM';
  formDate: string | null;
  patientName: string | null;
  patientAge: string | null;
  procedureName: string | null;
  procedureDescription: string | null;
  risks: string[];
  benefits: string[];
  alternatives: string[];
  authorizationSignature: boolean;
  witnessPresent: boolean;
}

export async function extractConsentForm(reportText: string): Promise<ConsentForm> {
  return {
    reportType: 'CONSENT_FORM',
    formDate: extractDateFromText(reportText),
    patientName: extractField(reportText, /(?:patient|name)[:\s]*([^\n]+)/i),
    patientAge: extractField(reportText, /age[:\s]*(\d+)/i),
    procedureName: extractField(reportText, /procedure[\s]*name?[:\s]*([^\n]+)/i),
    procedureDescription: extractField(reportText, /(?:description|details)[:\s]*([\s\S]+?)(?=risks?|$)/i),
    risks: extractList(reportText, /risks?[\s:]*/) || [],
    benefits: extractList(reportText, /benefits?[\s:]*/) || [],
    alternatives: extractList(reportText, /alternatives?[\s:]*/) || [],
    authorizationSignature: reportText.match(/(?:signature|sign)/i) !== null,
    witnessPresent: reportText.match(/witness/i) !== null,
  };
}

// ==================== REFERRAL LETTER EXTRACTION ====================

export interface ReferralLetter {
  reportType: 'REFERRAL_LETTER';
  letterDate: string | null;
  from: {
    doctor: string | null;
    hospital: string | null;
    department: string | null;
  };
  to: {
    doctor: string | null;
    hospital: string | null;
    department: string | null;
  };
  patientName: string | null;
  diagnosis: string | null;
  clinicalHistory: string | null;
  referralReason: string | null;
  attachments: string[];
}

export async function extractReferralLetter(reportText: string): Promise<ReferralLetter> {
  return {
    reportType: 'REFERRAL_LETTER',
    letterDate: extractDateFromText(reportText),
    from: {
      doctor: extractField(reportText, /from[:\s]*(?:dr\.?|doctor)?([^\n]+)/i),
      hospital: extractField(reportText, /(?:hospital|clinic|from)[:\s]*([^\n]+hospital[^\n]*)/i),
      department: extractField(reportText, /department[:\s]*([^\n]+)/i),
    },
    to: {
      doctor: extractField(reportText, /to[:\s]*(?:dr\.?|doctor)?([^\n]+)/i),
      hospital: extractField(reportText, /referred\s+to[:\s]*([^\n]+)/i),
      department: extractField(reportText, /refer\s+to[:\s]*([^\n]*department[^\n]*)/i),
    },
    patientName: extractField(reportText, /(?:patient|name)[:\s]*([^\n]+)/i),
    diagnosis: extractField(reportText, /diagnosis[:\s]*([^\n]+)/i),
    clinicalHistory: extractField(reportText, /(?:clinical|medical)\s+history[:\s]*([\s\S]+?)(?=referral|reason|$)/i),
    referralReason: extractField(reportText, /(?:reason|referral)[:\s]*([\s\S]+?)(?=attachments?|$)/i),
    attachments: extractList(reportText, /attachments?[\s:]*/) || [],
  };
}

// ==================== HELPER FUNCTIONS ====================

function extractDateFromText(text: string, pattern?: RegExp): string | null {
  const searchPattern = pattern
    ? new RegExp(`${pattern.source}[\\s:]*([\\d\\-\\/]+)`, 'i')
    : /(?:date|Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/;

  const match = text.match(searchPattern);
  return match ? match[1] : null;
}

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1]?.trim().replace(/\s+/g, ' ') : null;
}

function extractNumericField(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (match) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
}

function extractList(text: string, pattern: RegExp): string[] {
  const match = text.match(new RegExp(`${pattern.source}[\\s\\S]+?(?=\\n\\n|[A-Z][a-z]+[\\s:]*|$)`, 'i'));
  if (!match) return [];

  const lines = match[0].split(/\n|[•·]/);
  return lines
    .map(line => line.trim())
    .filter(line => line.length > 2 && !line.match(/^(?:risks?|benefits?|alternatives?|attachments?)/i));
}
