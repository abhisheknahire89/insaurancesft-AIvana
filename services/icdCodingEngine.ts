/**
 * ICD-10 Clinical Coding Engine
 *
 * Maps clinical evidence to appropriate ICD-10 codes AFTER case unification.
 * This is NOT extraction—it is medical coding logic applied to the unified clinical picture.
 *
 * Workflow:
 * 1. Extraction Pipeline: Extract and reconcile all clinical data
 * 2. Case Unification: Merge all sources into unified Case model
 * 3. ICD Coding Engine: DERIVES codes from unified clinical evidence
 *
 * The ICD engine:
 * - Takes complete clinical picture as input
 * - Analyzes symptoms, findings, investigations, procedures
 * - Maps to most specific ICD-10 codes
 * - Provides clinical justification for each code
 * - Validates against clinical logic (can't have contradictory codes)
 * - Never infers beyond evidence (only maps what is documented)
 */

import type { Case } from './caseModel';
import type { ReconciliationResult } from './reconciliationEngine';

export interface ICDCodeMapping {
  code: string;
  description: string;
  category: 'primary_diagnosis' | 'secondary_diagnosis' | 'complication' | 'procedure' | 'external_cause';
  clinicalEvidence: string[]; // What in the record supports this code
  confidence: number; // 0-1 based on evidence strength
  specificityLevel: 'chapter' | 'category' | 'subcategory' | 'subclassification'; // How specific the code is
  requiresSeventhCharacter?: boolean;
  seventhCharacter?: string;
}

export interface DiagnosisCodeingResult {
  caseId: string;
  codingStatus: 'completed' | 'pending_review' | 'unable_to_code';
  primaryDiagnosis: ICDCodeMapping | null;
  secondaryDiagnoses: ICDCodeMapping[];
  complicationCodes: ICDCodeMapping[];
  procedureCodes: ICDCodeMapping[];
  excludedCodes: {
    code: string;
    reason: string;
  }[];
  clinicalJustification: string;
  reviewNotes?: string;
  codedBy?: string;
  codedAt?: string;
  validationWarnings: string[];
}

/**
 * Main ICD coding entry point - runs AFTER case unification
 */
export function deriveICDCodesFromUnifiedCase(
  unifiedCase: Case,
  reconciliation: ReconciliationResult
): DiagnosisCodeingResult {
  console.log(`[ICD Coding] Deriving codes for unified case ${unifiedCase.id}`);

  const result: DiagnosisCodeingResult = {
    caseId: unifiedCase.id,
    codingStatus: 'completed',
    primaryDiagnosis: null,
    secondaryDiagnoses: [],
    complicationCodes: [],
    procedureCodes: [],
    excludedCodes: [],
    clinicalJustification: '',
    validationWarnings: [],
  };

  // Step 1: Analyze clinical evidence from unified case
  const clinicalEvidence = extractClinicalEvidence(unifiedCase);

  // Step 2: Derive primary diagnosis
  result.primaryDiagnosis = derivePrimaryDiagnosis(clinicalEvidence, unifiedCase);

  // Step 3: Identify secondary diagnoses
  result.secondaryDiagnoses = deriveSecondaryDiagnoses(clinicalEvidence, unifiedCase);

  // Step 4: Identify complications
  result.complicationCodes = deriveComplicationCodes(clinicalEvidence, unifiedCase);

  // Step 5: Map procedures
  result.procedureCodes = deriveProcedureCodes(unifiedCase);

  // Step 6: Validate code combination logic
  const validation = validateCodeCombinations(result, unifiedCase);
  result.validationWarnings = validation.warnings;
  result.excludedCodes = validation.excludedCodes;

  // Step 7: Generate clinical justification
  result.clinicalJustification = generateCodingJustification(
    result,
    clinicalEvidence,
    unifiedCase
  );

  // Step 8: Determine if review needed
  if (result.validationWarnings.length > 0 || result.codingStatus === 'pending_review') {
    result.codingStatus = 'pending_review';
  }

  console.log(`[ICD Coding] Coding complete:`, {
    primaryCode: result.primaryDiagnosis?.code,
    secondaryCodes: result.secondaryDiagnoses.length,
    procedureCodes: result.procedureCodes.length,
    warnings: result.validationWarnings.length,
  });

  return result;
}

/**
 * Extract clinical evidence from unified case
 */
function extractClinicalEvidence(unifiedCase: Case): ClinicalEvidence {
  return {
    chiefComplaints: unifiedCase.clinical.chiefComplaints || '',
    diagnosis: unifiedCase.clinical.diagnosis || '',
    hpi: unifiedCase.clinical.historyOfPresentIllness || '',
    pastMedicalHistory: unifiedCase.clinical.pastMedicalHistory || '',
    physicalExamFindings: unifiedCase.clinical.relevantClinicalFindings || '',
    labFindings: unifiedCase.clinical.labResults || [],
    imagingFindings: unifiedCase.clinical.imaging || [],
    procedures: unifiedCase.clinical.proposedProcedure || '',
    medications: unifiedCase.clinical.medications || [],
    comorbidities: extractComorbidities(unifiedCase),
    severity: unifiedCase.clinical.severity || 'unknown',
    admissionType: unifiedCase.clinical.admissionType || 'unknown',
  };
}

interface ClinicalEvidence {
  chiefComplaints: string;
  diagnosis: string;
  hpi: string;
  pastMedicalHistory: string;
  physicalExamFindings: string;
  labFindings: any[];
  imagingFindings: any[];
  procedures: string;
  medications: any[];
  comorbidities: string[];
  severity: string;
  admissionType: string;
}

/**
 * Derive primary diagnosis code from clinical evidence
 */
function derivePrimaryDiagnosis(
  evidence: ClinicalEvidence,
  unifiedCase: Case
): ICDCodeMapping | null {
  // If diagnosis is already confirmed in unified case, use that
  if (unifiedCase.clinical.diagnosis) {
    const diagnosis = unifiedCase.clinical.diagnosis.toLowerCase();
    const codeMapping = mapDiagnosisToICD10(diagnosis, evidence);

    if (codeMapping) {
      return {
        ...codeMapping,
        category: 'primary_diagnosis',
        clinicalEvidence: buildEvidenceList(evidence, diagnosis),
        confidence: calculateDiagnosisConfidence(evidence, diagnosis),
      };
    }
  }

  // If no diagnosis documented, coding cannot proceed
  console.warn('[ICD Coding] No primary diagnosis documented - unable to code');
  return null;
}

/**
 * Derive secondary diagnoses from comorbidities and findings
 */
function deriveSecondaryDiagnoses(
  evidence: ClinicalEvidence,
  unifiedCase: Case
): ICDCodeMapping[] {
  const secondaryDiagnoses: ICDCodeMapping[] = [];

  // Extract from past medical history
  for (const comorbidity of evidence.comorbidities) {
    const codeMapping = mapDiagnosisToICD10(comorbidity, evidence);
    if (codeMapping && codeMapping.code !== unifiedCase.clinical.icd10Code) {
      secondaryDiagnoses.push({
        ...codeMapping,
        category: 'secondary_diagnosis',
        clinicalEvidence: [`Documented in past medical history: ${comorbidity}`],
        confidence: 0.85,
      });
    }
  }

  // Extract from lab findings that indicate conditions
  for (const labResult of evidence.labFindings) {
    const conditionCode = mapLabFindingToCondition(labResult);
    if (conditionCode) {
      const codeMapping = mapDiagnosisToICD10(conditionCode, evidence);
      if (codeMapping) {
        secondaryDiagnoses.push({
          ...codeMapping,
          category: 'secondary_diagnosis',
          clinicalEvidence: [`Lab abnormality: ${labResult.testName} = ${labResult.value}`],
          confidence: calculateLabEvidenceConfidence(labResult),
        });
      }
    }
  }

  // Extract from imaging findings
  for (const imaging of evidence.imagingFindings) {
    const conditionCode = extractConditionFromImaging(imaging);
    if (conditionCode) {
      const codeMapping = mapDiagnosisToICD10(conditionCode, evidence);
      if (codeMapping) {
        secondaryDiagnoses.push({
          ...codeMapping,
          category: 'secondary_diagnosis',
          clinicalEvidence: [`Imaging finding: ${imaging.findings}`],
          confidence: 0.8,
        });
      }
    }
  }

  return secondaryDiagnoses;
}

/**
 * Derive complication codes from documented complications
 */
function deriveComplicationCodes(
  evidence: ClinicalEvidence,
  unifiedCase: Case
): ICDCodeMapping[] {
  const complicationCodes: ICDCodeMapping[] = [];

  // Complications are only coded if explicitly documented
  // Never infer complications
  const dischargeData = (unifiedCase.clinical as any).clinicalNote;
  if (dischargeData && Array.isArray(dischargeData.complications)) {
    for (const complication of dischargeData.complications) {
      const codeMapping = mapDiagnosisToICD10(complication, evidence);
      if (codeMapping) {
        complicationCodes.push({
          ...codeMapping,
          category: 'complication',
          clinicalEvidence: [`Documented complication: ${complication}`],
          confidence: 0.95, // High confidence because explicitly documented
        });
      }
    }
  }

  return complicationCodes;
}

/**
 * Derive procedure codes from planned/performed procedures
 */
function deriveProcedureCodes(unifiedCase: Case): ICDCodeMapping[] {
  const procedureCodes: ICDCodeMapping[] = [];

  if (unifiedCase.clinical.proposedProcedure) {
    const procedure = unifiedCase.clinical.proposedProcedure.toLowerCase();
    const procedureCode = mapProcedureToICD10(procedure);

    if (procedureCode) {
      procedureCodes.push({
        code: procedureCode.code,
        description: procedureCode.description,
        category: 'procedure',
        clinicalEvidence: [`Planned procedure: ${unifiedCase.clinical.proposedProcedure}`],
        confidence: 0.95,
        specificityLevel: procedureCode.specificityLevel,
      });
    }
  }

  return procedureCodes;
}

/**
 * Map diagnosis text to ICD-10 code
 */
function mapDiagnosisToICD10(diagnosis: string, evidence: ClinicalEvidence): ICDCodeMapping | null {
  const lower = diagnosis.toLowerCase();

  // Common diagnosis mappings (would be much larger in production)
  const mappings: Record<string, ICDCodeMapping> = {
    'herniated disc': {
      code: 'M51.2',
      description: 'Unspecified internal displacement of lumbar intervertebral disc',
      category: 'primary_diagnosis',
      clinicalEvidence: [],
      confidence: 0,
      specificityLevel: 'category',
    },
    'herniated disc l4-l5': {
      code: 'M51.26',
      description: 'Unspecified internal displacement of lumbar intervertebral disc',
      category: 'primary_diagnosis',
      clinicalEvidence: [],
      confidence: 0,
      specificityLevel: 'subclassification',
    },
    'radiculopathy': {
      code: 'M54.1',
      description: 'Radiculopathy',
      category: 'primary_diagnosis',
      clinicalEvidence: [],
      confidence: 0,
      specificityLevel: 'category',
    },
    'hypertension': {
      code: 'I10',
      description: 'Essential (primary) hypertension',
      category: 'secondary_diagnosis',
      clinicalEvidence: [],
      confidence: 0,
      specificityLevel: 'category',
    },
    'diabetes': {
      code: 'E11',
      description: 'Type 2 diabetes mellitus',
      category: 'secondary_diagnosis',
      clinicalEvidence: [],
      confidence: 0,
      specificityLevel: 'category',
    },
    'acute kidney injury': {
      code: 'N17.9',
      description: 'Acute kidney injury, unspecified',
      category: 'secondary_diagnosis',
      clinicalEvidence: [],
      confidence: 0,
      specificityLevel: 'subcategory',
    },
  };

  // Try exact match first
  if (mappings[lower]) {
    return mappings[lower];
  }

  // Try partial match
  for (const [key, mapping] of Object.entries(mappings)) {
    if (lower.includes(key) || key.includes(lower)) {
      return mapping;
    }
  }

  return null;
}

/**
 * Map procedure to ICD-10-PCS code
 */
function mapProcedureToICD10(procedure: string): { code: string; description: string; specificityLevel: string } | null {
  const lower = procedure.toLowerCase();

  const procedureMappings: Record<string, any> = {
    'microdiscectomy': {
      code: '0SB34ZX',
      description: 'Excision of Lumbar Disc, Percutaneous Endoscopic Approach, Diagnostic',
      specificityLevel: 'subclassification',
    },
    'laminectomy': {
      code: '0SB84ZX',
      description: 'Excision of Lumbar Vertebra, Percutaneous Endoscopic Approach, Diagnostic',
      specificityLevel: 'subcategory',
    },
    'spinal fusion': {
      code: '0SG4071',
      description: 'Fusion of Lumbar Vertebra, Percutaneous Endoscopic Approach, Anterior Column, Interbody',
      specificityLevel: 'subclassification',
    },
  };

  for (const [key, mapping] of Object.entries(procedureMappings)) {
    if (lower.includes(key)) {
      return mapping;
    }
  }

  return null;
}

/**
 * Extract condition from lab finding
 */
function mapLabFindingToCondition(labResult: any): string | null {
  if (labResult.status === 'HIGH' || labResult.status === 'CRITICAL_HIGH') {
    if (labResult.testName?.toLowerCase().includes('glucose')) return 'Hyperglycemia';
    if (labResult.testName?.toLowerCase().includes('creatinine')) return 'Acute kidney injury';
    if (labResult.testName?.toLowerCase().includes('potassium')) return 'Hyperkalemia';
  }

  if (labResult.status === 'LOW' || labResult.status === 'CRITICAL_LOW') {
    if (labResult.testName?.toLowerCase().includes('hemoglobin')) return 'Anemia';
    if (labResult.testName?.toLowerCase().includes('potassium')) return 'Hypokalemia';
  }

  return null;
}

/**
 * Extract condition from imaging finding
 */
function extractConditionFromImaging(imaging: any): string | null {
  const findings = imaging.findings?.toLowerCase() || '';

  if (findings.includes('stenosis')) return 'Spinal stenosis';
  if (findings.includes('bulge') || findings.includes('herniat')) return 'Herniated disc';
  if (findings.includes('fracture')) return 'Vertebral fracture';
  if (findings.includes('infection') || findings.includes('osteomyelitis')) return 'Vertebral osteomyelitis';

  return null;
}

/**
 * Validate ICD code combinations for medical logic
 */
function validateCodeCombinations(
  result: DiagnosisCodeingResult,
  unifiedCase: Case
): { warnings: string[]; excludedCodes: Array<{ code: string; reason: string }> } {
  const warnings: string[] = [];
  const excludedCodes: Array<{ code: string; reason: string }> = [];

  // Check for contradictory codes
  const allCodes = [
    result.primaryDiagnosis,
    ...result.secondaryDiagnoses,
    ...result.complicationCodes,
  ].filter(Boolean);

  for (let i = 0; i < allCodes.length; i++) {
    for (let j = i + 1; j < allCodes.length; j++) {
      const contradiction = checkCodeContradiction(allCodes[i]!, allCodes[j]!);
      if (contradiction) {
        warnings.push(contradiction);
      }
    }
  }

  // Check for gender-specific contradictions
  const patientGender = unifiedCase.patient.gender;
  for (const code of allCodes) {
    if (code && isGenderSpecificCode(code.code, patientGender)) {
      warnings.push(
        `Code ${code.code} may not be appropriate for patient gender: ${patientGender}`
      );
    }
  }

  // Check for age-specific contradictions
  const patientAge = parseInt(unifiedCase.patient.age || '0');
  for (const code of allCodes) {
    if (code && isAgeSpecificCode(code.code, patientAge)) {
      warnings.push(
        `Code ${code.code} may not be appropriate for patient age: ${patientAge}`
      );
    }
  }

  return { warnings, excludedCodes };
}

/**
 * Check for medical logic contradictions between codes
 */
function checkCodeContradiction(code1: ICDCodeMapping, code2: ICDCodeMapping): string | null {
  // Example: Can't have both "normal pregnancy" and "complicated pregnancy" codes
  const contradictions = [
    { code1: 'Z34', code2: 'O26', reason: 'Cannot have both normal and complicated pregnancy' },
    { code1: 'Z80.8', code2: 'C34', reason: 'Family history of cancer contradicts active cancer diagnosis' },
  ];

  for (const contradiction of contradictions) {
    if (
      (code1.code.startsWith(contradiction.code1) && code2.code.startsWith(contradiction.code2)) ||
      (code1.code.startsWith(contradiction.code2) && code2.code.startsWith(contradiction.code1))
    ) {
      return contradiction.reason;
    }
  }

  return null;
}

/**
 * Check if code is gender-specific
 */
function isGenderSpecificCode(code: string, gender?: string): boolean {
  // O-codes are pregnancy-related (female only)
  if (code.startsWith('O') && gender !== 'Female') {
    return true;
  }

  // Some C codes are gender-specific
  if (code === 'C60' && gender === 'Female') {
    // Malignant neoplasm of penis
    return true;
  }

  return false;
}

/**
 * Check if code is age-specific
 */
function isAgeSpecificCode(code: string, age: number): boolean {
  // Z codes for newborn screening are age-specific
  if (code.startsWith('Z13') && age > 28) {
    return true;
  }

  return false;
}

/**
 * Calculate confidence for primary diagnosis
 */
function calculateDiagnosisConfidence(evidence: ClinicalEvidence, diagnosis: string): number {
  let confidence = 0.7; // Base confidence

  // Increase if confirmed by multiple sources
  if (evidence.imagingFindings.length > 0) confidence += 0.1;
  if (evidence.labFindings.length > 0) confidence += 0.05;
  if (evidence.physicalExamFindings) confidence += 0.05;

  return Math.min(confidence, 0.95);
}

/**
 * Calculate confidence based on lab evidence
 */
function calculateLabEvidenceConfidence(labResult: any): number {
  // Critical values have highest confidence
  if (labResult.status?.includes('CRITICAL')) return 0.95;
  // High/Low has good confidence
  if (labResult.status?.includes('HIGH') || labResult.status?.includes('LOW')) return 0.85;
  return 0.7;
}

/**
 * Build evidence list for a diagnosis
 */
function buildEvidenceList(evidence: ClinicalEvidence, diagnosis: string): string[] {
  const evidenceList: string[] = [];

  if (evidence.diagnosis.toLowerCase().includes(diagnosis)) {
    evidenceList.push(`Documented diagnosis: ${evidence.diagnosis}`);
  }

  if (evidence.hpi.toLowerCase().includes(diagnosis)) {
    evidenceList.push(`Documented in history: Present in HPI`);
  }

  if (evidence.physicalExamFindings.toLowerCase().includes(diagnosis)) {
    evidenceList.push(`Physical exam findings support diagnosis`);
  }

  for (const imaging of evidence.imagingFindings) {
    if (imaging.findings?.toLowerCase().includes(diagnosis)) {
      evidenceList.push(`Imaging confirms: ${imaging.findings}`);
    }
  }

  return evidenceList;
}

/**
 * Generate clinical justification for coding
 */
function generateCodingJustification(
  result: DiagnosisCodeingResult,
  evidence: ClinicalEvidence,
  unifiedCase: Case
): string {
  const lines: string[] = [];

  lines.push('ICD-10 CODING JUSTIFICATION\n');
  lines.push(`Case: ${unifiedCase.id}`);
  lines.push(`Patient: ${unifiedCase.patient.name}, Age: ${unifiedCase.patient.age}`);
  lines.push(`Admission Type: ${evidence.admissionType}`);
  lines.push(`Severity: ${evidence.severity}\n`);

  if (result.primaryDiagnosis) {
    lines.push(`PRIMARY DIAGNOSIS: ${result.primaryDiagnosis.code}`);
    lines.push(`Description: ${result.primaryDiagnosis.description}`);
    lines.push(`Clinical Evidence:`);
    result.primaryDiagnosis.clinicalEvidence.forEach(ev => lines.push(`  • ${ev}`));
    lines.push(`Confidence: ${(result.primaryDiagnosis.confidence * 100).toFixed(0)}%\n`);
  }

  if (result.secondaryDiagnoses.length > 0) {
    lines.push(`SECONDARY DIAGNOSES (${result.secondaryDiagnoses.length}):`);
    result.secondaryDiagnoses.forEach(diag => {
      lines.push(`  • ${diag.code} - ${diag.description}`);
    });
    lines.push('');
  }

  if (result.procedureCodes.length > 0) {
    lines.push(`PROCEDURES (${result.procedureCodes.length}):`);
    result.procedureCodes.forEach(proc => {
      lines.push(`  • ${proc.code} - ${proc.description}`);
    });
    lines.push('');
  }

  if (result.validationWarnings.length > 0) {
    lines.push(`VALIDATION WARNINGS (${result.validationWarnings.length}):`);
    result.validationWarnings.forEach(warning => {
      lines.push(`  ⚠ ${warning}`);
    });
    lines.push('');
  }

  lines.push('Coding is based on unified clinical evidence and medical coding standards.');

  return lines.join('\n');
}

/**
 * Extract comorbidities from past medical history
 */
function extractComorbidities(unifiedCase: Case): string[] {
  const comorbidities: string[] = [];
  const pmiText = unifiedCase.clinical.pastMedicalHistory || '';

  // Simple extraction - in production would be more sophisticated
  const conditions = [
    'hypertension',
    'diabetes',
    'heart disease',
    'asthma',
    'copd',
    'cancer',
    'thyroid',
    'arthritis',
  ];

  for (const condition of conditions) {
    if (pmiText.toLowerCase().includes(condition)) {
      comorbidities.push(condition);
    }
  }

  return comorbidities;
}
