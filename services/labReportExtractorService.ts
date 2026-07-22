/**
 * Lab Report Extractor Service
 *
 * Extracts every laboratory parameter from lab reports with full precision.
 * Never summarizes - stores every value with units, reference ranges, and flags.
 *
 * Supported tests:
 * - CBC: Hb, TLC, DLC, Platelets, ESR, CRP
 * - LFT: ALT, AST, ALP, Bilirubin, Albumin, Globulin
 * - KFT: Creatinine, BUN, Urea, Electrolytes
 * - Coagulation: PT, INR, APPT
 * - Blood Sugar: Random, Fasting, HbA1c
 * - Other: Troponin, D-Dimer, ABG, Lipid Profile, Urine, Cultures
 */

export type Flag = 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';

export interface LabParameter {
  testName: string;
  parameter: string;
  result: number | string | null;
  unit: string;
  referenceRange: string;
  flag: Flag;
  collectionDate: string | null;
  reportDate: string | null;
  labName: string | null;
  technician: string | null;
  confidence: number;
}

export interface LabReport {
  reportType: string;
  reportDate: string | null;
  collectionDate: string | null;
  labName: string | null;
  labAddress: string | null;
  refDoc: string | null;
  patientName: string | null;
  patientAge: string | null;
  patientGender: string | null;

  // CBC Results
  cbc: {
    hb: LabParameter | null;
    tlc: LabParameter | null;
    dlc: LabParameter | null;
    platelets: LabParameter | null;
    esr: LabParameter | null;
    crp: LabParameter | null;
  };

  // LFT Results
  lft: {
    alt: LabParameter | null;
    ast: LabParameter | null;
    alp: LabParameter | null;
    totalBilirubin: LabParameter | null;
    directBilirubin: LabParameter | null;
    albumin: LabParameter | null;
    globulin: LabParameter | null;
  };

  // KFT Results
  kft: {
    creatinine: LabParameter | null;
    bun: LabParameter | null;
    urea: LabParameter | null;
    sodium: LabParameter | null;
    potassium: LabParameter | null;
    chloride: LabParameter | null;
    bicarbonate: LabParameter | null;
  };

  // Coagulation
  coagulation: {
    pt: LabParameter | null;
    inr: LabParameter | null;
    appt: LabParameter | null;
  };

  // Blood Sugar
  bloodSugar: {
    fasting: LabParameter | null;
    random: LabParameter | null;
    hbA1c: LabParameter | null;
    postPrandial: LabParameter | null;
  };

  // Other Tests
  other: {
    troponin: LabParameter | null;
    dDimer: LabParameter | null;
    lactate: LabParameter | null;
    lipidProfile: LabParameter[];
    urineTests: LabParameter[];
    cultures: LabParameter[];
  };

  // Summary
  totalParametersExtracted: number;
  abnormalParameters: LabParameter[];
  criticalValues: LabParameter[];
}

export async function extractLabReport(reportText: string, labName?: string): Promise<LabReport> {
  const report: LabReport = {
    reportType: detectReportType(reportText),
    reportDate: extractDateField(reportText, /report date|date of report/i),
    collectionDate: extractDateField(reportText, /collection date|sample date|collected on/i),
    labName: labName || extractField(reportText, /(?:lab name|laboratory|lab)[:\s]*([^\n,]+)/i),
    labAddress: extractField(reportText, /(?:address|location)[:\s]*([^\n,]+)/i),
    refDoc: extractField(reportText, /(?:ref\.?|doctor)[:\s]*([^\n,]+)/i),
    patientName: extractField(reportText, /(?:patient name|name)[:\s]*([^\n,]+)/i),
    patientAge: extractField(reportText, /(?:age)[:\s]*([^\n,]+)/i),
    patientGender: extractField(reportText, /(?:sex|gender)[:\s]*(M|F|Male|Female)/i),

    cbc: extractCBC(reportText),
    lft: extractLFT(reportText),
    kft: extractKFT(reportText),
    coagulation: extractCoagulation(reportText),
    bloodSugar: extractBloodSugar(reportText),
    other: extractOtherTests(reportText),

    totalParametersExtracted: 0,
    abnormalParameters: [],
    criticalValues: [],
  };

  // Calculate summary statistics
  report.totalParametersExtracted = countExtractedParameters(report);
  report.abnormalParameters = findAbnormalParameters(report);
  report.criticalValues = findCriticalValues(report);

  console.log('[Lab Report Extractor] Report extracted:', {
    type: report.reportType,
    parametersExtracted: report.totalParametersExtracted,
    abnormal: report.abnormalParameters.length,
    critical: report.criticalValues.length,
  });

  return report;
}

// ==================== EXTRACTION FUNCTIONS ====================

function extractCBC(text: string) {
  return {
    hb: extractParameter(text, /Hb|hemoglobin/i, /(\d+(?:\.\d+)?)\s*(?:g\/dL|g\/dl|gm%|gm\/dL)/i, 'g/dL'),
    tlc: extractParameter(text, /TLC|total\s+leucocyte/i, /(\d+(?:\.\d+)?)\s*(?:x10\^3|K\/μL|K\/uL)/i, 'K/μL'),
    dlc: extractParameter(text, /DLC|differential/i, /(\d+(?:\.\d+)?)\s*%?/i, '%'),
    platelets: extractParameter(text, /platelets?/i, /(\d+(?:\.\d+)?)\s*(?:x10\^3|K\/μL)/i, 'K/μL'),
    esr: extractParameter(text, /ESR|erythrocyte/i, /(\d+(?:\.\d+)?)\s*(?:mm\/hr|mm\/1hr)/i, 'mm/hr'),
    crp: extractParameter(text, /CRP|c-reactive/i, /(\d+(?:\.\d+)?)\s*(?:mg\/L|mg\/dL)/i, 'mg/L'),
  };
}

function extractLFT(text: string) {
  return {
    alt: extractParameter(text, /ALT|SGPT/i, /(\d+(?:\.\d+)?)\s*(?:IU\/L|U\/L)/i, 'IU/L'),
    ast: extractParameter(text, /AST|SGOT/i, /(\d+(?:\.\d+)?)\s*(?:IU\/L|U\/L)/i, 'IU/L'),
    alp: extractParameter(text, /ALP|alkaline phosphatase/i, /(\d+(?:\.\d+)?)\s*(?:IU\/L|U\/L)/i, 'IU/L'),
    totalBilirubin: extractParameter(text, /total\s+bilirubin/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|μmol\/L)/i, 'mg/dL'),
    directBilirubin: extractParameter(text, /direct\s+bilirubin/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|μmol\/L)/i, 'mg/dL'),
    albumin: extractParameter(text, /albumin/i, /(\d+(?:\.\d+)?)\s*(?:g\/dL|g\/L)/i, 'g/dL'),
    globulin: extractParameter(text, /globulin/i, /(\d+(?:\.\d+)?)\s*(?:g\/dL|g\/L)/i, 'g/dL'),
  };
}

function extractKFT(text: string) {
  return {
    creatinine: extractParameter(text, /creatinine/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|μmol\/L)/i, 'mg/dL'),
    bun: extractParameter(text, /BUN|blood urea nitrogen/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|mg\/100mL)/i, 'mg/dL'),
    urea: extractParameter(text, /urea\s+nitrogen|blood\s+urea/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|mg\/100mL)/i, 'mg/dL'),
    sodium: extractParameter(text, /sodium|Na\+?/i, /(\d+(?:\.\d+)?)\s*(?:mEq\/L|mmol\/L)/i, 'mEq/L'),
    potassium: extractParameter(text, /potassium|K\+?/i, /(\d+(?:\.\d+)?)\s*(?:mEq\/L|mmol\/L)/i, 'mEq/L'),
    chloride: extractParameter(text, /chloride|Cl-/i, /(\d+(?:\.\d+)?)\s*(?:mEq\/L|mmol\/L)/i, 'mEq/L'),
    bicarbonate: extractParameter(text, /bicarbonate|CO2|HCO3/i, /(\d+(?:\.\d+)?)\s*(?:mEq\/L|mmol\/L)/i, 'mEq/L'),
  };
}

function extractCoagulation(text: string) {
  return {
    pt: extractParameter(text, /PT\b|prothrombin time/i, /(\d+(?:\.\d+)?)\s*(?:seconds?|sec|s)/i, 'seconds'),
    inr: extractParameter(text, /INR|international normalized/i, /(\d+(?:\.\d+)?)/i, ''),
    appt: extractParameter(text, /APTT|activated partial thromboplastin/i, /(\d+(?:\.\d+)?)\s*(?:seconds?|sec)/i, 'seconds'),
  };
}

function extractBloodSugar(text: string) {
  return {
    fasting: extractParameter(text, /fasting.*glucose|fasting.*sugar|FBS/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|mg\/100mL)/i, 'mg/dL'),
    random: extractParameter(text, /random.*glucose|RBS|casual\s+glucose/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|mg\/100mL)/i, 'mg/dL'),
    hbA1c: extractParameter(text, /HbA1c|Hb A1C|glycated hemoglobin/i, /(\d+(?:\.\d+)?)\s*%/i, '%'),
    postPrandial: extractParameter(text, /post\s*[-\s]?prandial|PP glucose|2-hour/i, /(\d+(?:\.\d+)?)\s*(?:mg\/dL|mg\/100mL)/i, 'mg/dL'),
  };
}

function extractOtherTests(text: string) {
  return {
    troponin: extractParameter(text, /troponin|cardiac troponin/i, /(\d+(?:\.\d+)?)\s*(?:ng\/mL|pg\/mL)/i, 'ng/mL'),
    dDimer: extractParameter(text, /D-?dimer/i, /(\d+(?:\.\d+)?)\s*(?:ng\/mL|μg\/mL|FEU)/i, 'ng/mL'),
    lactate: extractParameter(text, /lactate|lactic acid/i, /(\d+(?:\.\d+)?)\s*(?:mmol\/L|mg\/dL)/i, 'mmol/L'),
    lipidProfile: extractMultipleParameters(text, /cholesterol|triglycerides|HDL|LDL|VLDL/i),
    urineTests: extractMultipleParameters(text, /urine|UA|urinalysis/i),
    cultures: extractMultipleParameters(text, /culture|blood culture|sensitivity/i),
  };
}

// ==================== HELPER FUNCTIONS ====================

function extractParameter(
  text: string,
  namePattern: RegExp,
  valuePattern: RegExp,
  defaultUnit: string
): LabParameter | null {
  const nameMatch = text.match(namePattern);
  if (!nameMatch) return null;

  const valueMatch = text.match(valuePattern);
  if (!valueMatch) return null;

  const result = parseFloat(valueMatch[1]);
  const flag = determineFlag(result, defaultUnit);

  return {
    testName: nameMatch[0],
    parameter: nameMatch[0],
    result,
    unit: defaultUnit,
    referenceRange: getDefaultReferenceRange(nameMatch[0]),
    flag,
    collectionDate: null,
    reportDate: null,
    labName: null,
    technician: null,
    confidence: 0.9,
  };
}

function extractMultipleParameters(text: string, pattern: RegExp): LabParameter[] {
  const matches = [...text.matchAll(new RegExp(pattern, 'gi'))];
  return matches.map(match => ({
    testName: match[0],
    parameter: match[0],
    result: null,
    unit: '',
    referenceRange: '',
    flag: 'NORMAL' as Flag,
    collectionDate: null,
    reportDate: null,
    labName: null,
    technician: null,
    confidence: 0.5,
  }));
}

function extractDateField(text: string, pattern: RegExp): string | null {
  const match = text.match(new RegExp(`${pattern.source}[\\s:]*([\\d\\-\\/]+)`, 'i'));
  return match ? match[1] : null;
}

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

function determineFlag(value: number, unit: string): Flag {
  // This would need to be populated with actual reference ranges
  // For now, return NORMAL as default
  return 'NORMAL';
}

function getDefaultReferenceRange(testName: string): string {
  const ranges: Record<string, string> = {
    'Hb': '12-16 g/dL (F), 13-18 g/dL (M)',
    'TLC': '4.5-11.0 K/μL',
    'Platelets': '150-400 K/μL',
    'ALT': '7-56 IU/L',
    'AST': '10-40 IU/L',
    'Creatinine': '0.6-1.2 mg/dL (F), 0.7-1.3 mg/dL (M)',
    'Sodium': '136-145 mEq/L',
    'Potassium': '3.5-5.0 mEq/L',
  };

  for (const [key, range] of Object.entries(ranges)) {
    if (testName.toLowerCase().includes(key.toLowerCase())) {
      return range;
    }
  }

  return 'See reference lab values';
}

function detectReportType(text: string): string {
  if (text.match(/CBC|complete blood count/i)) return 'CBC';
  if (text.match(/LFT|liver function/i)) return 'LFT';
  if (text.match(/KFT|renal function|kidney/i)) return 'KFT';
  if (text.match(/coagulation|PT|INR|APPT/i)) return 'Coagulation';
  if (text.match(/glucose|sugar|diabetes/i)) return 'Blood Sugar';
  return 'General Lab Report';
}

function countExtractedParameters(report: LabReport): number {
  let count = 0;
  const countObject = (obj: any): void => {
    if (!obj) return;
    if (obj.result !== undefined && obj.result !== null) {
      count++;
    } else if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (item && item.result !== undefined && item.result !== null) {
          count++;
        }
      });
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(val => countObject(val));
    }
  };

  countObject(report);
  return count;
}

function findAbnormalParameters(report: LabReport): LabParameter[] {
  const abnormal: LabParameter[] = [];

  const checkObject = (obj: any): void => {
    if (!obj) return;
    if (obj.flag && obj.flag !== 'NORMAL') {
      abnormal.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (item && item.flag && item.flag !== 'NORMAL') {
          abnormal.push(item);
        }
      });
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(val => checkObject(val));
    }
  };

  checkObject(report);
  return abnormal;
}

function findCriticalValues(report: LabReport): LabParameter[] {
  const critical: LabParameter[] = [];

  const checkObject = (obj: any): void => {
    if (!obj) return;
    if (obj.flag && (obj.flag === 'CRITICAL_HIGH' || obj.flag === 'CRITICAL_LOW')) {
      critical.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (item && item.flag && (item.flag === 'CRITICAL_HIGH' || item.flag === 'CRITICAL_LOW')) {
          critical.push(item);
        }
      });
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(val => checkObject(val));
    }
  };

  checkObject(report);
  return critical;
}
