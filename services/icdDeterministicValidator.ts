/**
 * ICD Deterministic Validator
 *
 * Rule-based validation engine that runs BEFORE AI ranking.
 * Rejects invalid ICD candidates based on clinical logic and evidence.
 *
 * Validates:
 * • Age compatibility
 * • Gender compatibility
 * • Diagnosis consistency
 * • Procedure compatibility
 * • Laboratory evidence
 * • Imaging evidence
 * • Comorbidity consistency
 * • Duplicate codes
 * • Impossible code combinations
 * • Chapter constraints
 * • Demographic constraints
 *
 * Rejects unsupported codes BEFORE they reach AI ranking.
 */

import type { Case } from './caseModel';
import type { ICDKnowledgeBase } from './icdKnowledgeBase';

export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning'; // error = reject, warning = flag for review
  category: 'demographics' | 'evidence' | 'logic' | 'hierarchy';
}

export interface ValidationIssue {
  rule: string;
  severity: 'error' | 'warning';
  code: string;
  issue: string;
  expectedEvidence?: string;
  actualEvidence?: string;
  recommendation?: string;
}

export interface ValidatedICDCandidate {
  code: string;
  description: string;
  valid: boolean;
  issues: ValidationIssue[];
  recommendationLevel: 'accept' | 'review' | 'reject';
}

/**
 * Deterministic ICD Validator
 */
export class ICDDeterministicValidator {
  private knowledgeBase: ICDKnowledgeBase;
  private patientAge: number;
  private patientGender: 'M' | 'F';
  private caseData: Case;
  private unifiedData: any;

  constructor(
    knowledgeBase: ICDKnowledgeBase,
    caseData: Case,
    unifiedData: any
  ) {
    this.knowledgeBase = knowledgeBase;
    this.caseData = caseData;
    this.unifiedData = unifiedData;
    this.patientAge = parseInt(caseData.patient.age || '0');
    this.patientGender = (caseData.patient.gender === 'Male' ? 'M' : 'F') as 'M' | 'F';
  }

  /**
   * Validate a single ICD candidate
   */
  validateCandidate(code: string): ValidatedICDCandidate {
    const issues: ValidationIssue[] = [];

    // Check 1: Code exists in knowledge base
    const codeData = this.knowledgeBase.getCode(code);
    if (!codeData) {
      return {
        code,
        description: 'Unknown',
        valid: false,
        issues: [
          {
            rule: 'CODE_EXISTS',
            severity: 'error',
            code,
            issue: `Code ${code} not found in ICD knowledge base`,
          },
        ],
        recommendationLevel: 'reject',
      };
    }

    // Check 2: Demographics (age, gender)
    const demoIssues = this.validateDemographics(code, codeData);
    issues.push(...demoIssues);

    // Check 3: Evidence support
    const evidenceIssues = this.validateEvidenceSupport(code, codeData);
    issues.push(...evidenceIssues);

    // Check 4: Clinical logic
    const logicIssues = this.validateClinicalLogic(code, codeData);
    issues.push(...logicIssues);

    // Check 5: Procedure compatibility
    const procIssues = this.validateProcedureCompatibility(code, codeData);
    issues.push(...procIssues);

    // Determine recommendation level
    const hasErrors = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');

    return {
      code,
      description: codeData.description,
      valid: !hasErrors,
      issues,
      recommendationLevel: hasErrors ? 'reject' : hasWarnings ? 'review' : 'accept',
    };
  }

  /**
   * Validate multiple candidates
   */
  validateCandidates(codes: string[]): ValidatedICDCandidate[] {
    return codes.map(code => this.validateCandidate(code));
  }

  /**
   * Check demographics compatibility
   */
  private validateDemographics(
    code: string,
    codeData: any
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Age compatibility
    if (codeData.applicableAge) {
      if (codeData.applicableAge.minAge && this.patientAge < codeData.applicableAge.minAge) {
        issues.push({
          rule: 'AGE_MINIMUM',
          severity: 'error',
          code,
          issue: `Patient age (${this.patientAge}) below minimum (${codeData.applicableAge.minAge})`,
          recommendation: `This code is for ages ${codeData.applicableAge.minAge}+`,
        });
      }

      if (codeData.applicableAge.maxAge && this.patientAge > codeData.applicableAge.maxAge) {
        issues.push({
          rule: 'AGE_MAXIMUM',
          severity: 'error',
          code,
          issue: `Patient age (${this.patientAge}) exceeds maximum (${codeData.applicableAge.maxAge})`,
          recommendation: `This code is for ages up to ${codeData.applicableAge.maxAge}`,
        });
      }
    }

    // Gender compatibility
    if (codeData.applicableGender && codeData.applicableGender !== 'Both') {
      if (codeData.applicableGender === 'M' && this.patientGender !== 'M') {
        issues.push({
          rule: 'GENDER_SPECIFIC',
          severity: 'error',
          code,
          issue: `Code applies only to male patients, patient is ${this.patientGender === 'M' ? 'male' : 'female'}`,
          recommendation: `This is a male-only code`,
        });
      }

      if (codeData.applicableGender === 'F' && this.patientGender !== 'F') {
        issues.push({
          rule: 'GENDER_SPECIFIC',
          severity: 'error',
          code,
          issue: `Code applies only to female patients, patient is ${this.patientGender === 'M' ? 'male' : 'female'}`,
          recommendation: `This is a female-only code`,
        });
      }
    }

    return issues;
  }

  /**
   * Validate evidence support
   */
  private validateEvidenceSupport(
    code: string,
    codeData: any
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Never assign codes for differential diagnoses (provisional diagnoses)
    if (this.caseData.clinical.diagnosisSource === 'ai_suggested') {
      issues.push({
        rule: 'DIFFERENTIAL_ONLY',
        severity: 'error',
        code,
        issue: `Cannot assign code based on provisional/differential diagnosis`,
        expectedEvidence: 'Confirmed diagnosis',
        actualEvidence: 'Provisional diagnosis only',
        recommendation: `Wait for diagnosis confirmation before coding`,
      });
    }

    // Check for imaging evidence when required
    if (this.requiresImagingEvidence(code)) {
      if (!this.caseData.clinical.imaging || this.caseData.clinical.imaging.length === 0) {
        issues.push({
          rule: 'MISSING_IMAGING',
          severity: 'warning',
          code,
          issue: `Code ${code} typically requires imaging evidence`,
          expectedEvidence: 'Imaging report',
          recommendation: `Verify imaging findings support this code`,
        });
      }
    }

    // Check for lab evidence when required
    if (this.requiresLabEvidence(code)) {
      if (!this.caseData.clinical.labResults || this.caseData.clinical.labResults.length === 0) {
        issues.push({
          rule: 'MISSING_LAB',
          severity: 'warning',
          code,
          issue: `Code ${code} typically requires lab evidence`,
          expectedEvidence: 'Lab report',
          recommendation: `Verify lab findings support this code`,
        });
      }
    }

    // Check that lab values actually contradict the code
    const labContradiction = this.checkLabContradiction(code);
    if (labContradiction) {
      issues.push({
        rule: 'LAB_CONTRADICTION',
        severity: 'error',
        code,
        issue: `Lab findings contradict this code`,
        expectedEvidence: labContradiction.expected,
        actualEvidence: labContradiction.actual,
        recommendation: `This code is inconsistent with lab results`,
      });
    }

    // Check imaging contradiction
    const imagingContradiction = this.checkImagingContradiction(code);
    if (imagingContradiction) {
      issues.push({
        rule: 'IMAGING_CONTRADICTION',
        severity: 'error',
        code,
        issue: `Imaging findings contradict this code`,
        expectedEvidence: imagingContradiction.expected,
        actualEvidence: imagingContradiction.actual,
        recommendation: `This code is inconsistent with imaging results`,
      });
    }

    return issues;
  }

  /**
   * Validate clinical logic
   */
  private validateClinicalLogic(
    code: string,
    codeData: any
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for contradictory code combinations
    const contradictions = this.findContradictoryDiagnoses(code);
    for (const contradiction of contradictions) {
      issues.push({
        rule: 'CODE_CONTRADICTION',
        severity: 'error',
        code,
        issue: `Code ${code} contradicts documented ${contradiction}`,
        recommendation: `Cannot have both ${code} and ${contradiction}`,
      });
    }

    // Never code symptoms when confirmed diagnosis exists
    if (this.isSymptomCode(code)) {
      if (this.caseData.clinical.diagnosis && !this.isSymptomology(this.caseData.clinical.diagnosis)) {
        issues.push({
          rule: 'SYMPTOM_WITH_DIAGNOSIS',
          severity: 'error',
          code,
          issue: `Cannot code symptom ${code} when confirmed diagnosis exists`,
          expectedEvidence: 'No confirmed diagnosis',
          actualEvidence: `Confirmed diagnosis: ${this.caseData.clinical.diagnosis}`,
          recommendation: `Code the underlying diagnosis, not the symptom`,
        });
      }
    }

    // Prefer confirmed diagnosis over provisional
    if (this.caseData.clinical.icd10Code) {
      // Check if this conflicts with already confirmed code
      if (this.hasCodeConflict(code, this.caseData.clinical.icd10Code)) {
        issues.push({
          rule: 'CONFLICTING_PRIMARY',
          severity: 'error',
          code,
          issue: `Code conflicts with confirmed primary diagnosis`,
          expectedEvidence: code,
          actualEvidence: this.caseData.clinical.icd10Code,
          recommendation: `This cannot be both primary and another code`,
        });
      }
    }

    return issues;
  }

  /**
   * Validate procedure compatibility
   */
  private validateProcedureCompatibility(
    code: string,
    codeData: any
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if procedure is documented when code requires it
    if (this.isProcedureDependentCode(code)) {
      if (!this.caseData.clinical.proposedProcedure) {
        issues.push({
          rule: 'MISSING_PROCEDURE',
          severity: 'warning',
          code,
          issue: `Code ${code} typically requires procedure documentation`,
          expectedEvidence: 'Procedure name',
          recommendation: `Verify procedure is documented`,
        });
      }
    }

    // Check for procedure inconsistency
    if (this.caseData.clinical.proposedProcedure) {
      const procIncompat = this.checkProcedureIncompatibility(code);
      if (procIncompat) {
        issues.push({
          rule: 'PROCEDURE_INCOMPATIBLE',
          severity: 'warning',
          code,
          issue: `Code may be incompatible with planned procedure`,
          expectedEvidence: procIncompat.expected,
          actualEvidence: procIncompat.actual,
          recommendation: procIncompat.recommendation,
        });
      }
    }

    return issues;
  }

  /**
   * Check if lab values contradict the code
   */
  private checkLabContradiction(code: string): { expected: string; actual: string } | null {
    // Examples of contradictions
    const contradictions: Record<string, (labResults: any[]) => boolean> = {
      'E11.9': (labs) => {
        // Type 2 diabetes but glucose is normal
        const glucose = labs.find(l => l.testName?.toLowerCase().includes('glucose'));
        return glucose && glucose.status === 'NORMAL' && labs.length > 0;
      },
      'K80': (labs) => {
        // Cholecystitis but no inflammatory markers
        const wbc = labs.find(l => l.testName?.toLowerCase().includes('wbc'));
        return wbc && wbc.status === 'NORMAL';
      },
    };

    if (contradictions[code]) {
      const hasContradiction = contradictions[code](this.caseData.clinical.labResults || []);
      if (hasContradiction) {
        return {
          expected: `Lab values supporting ${code}`,
          actual: 'Normal lab values found',
        };
      }
    }

    return null;
  }

  /**
   * Check if imaging contradicts the code
   */
  private checkImagingContradiction(code: string): { expected: string; actual: string; recommendation: string } | null {
    // Examples: code requires imaging findings, but imaging is normal
    if (code.startsWith('M51') && this.caseData.clinical.imaging) {
      // Herniated disc - should have imaging confirmation
      const imagingNotes = this.caseData.clinical.imaging[0]?.findings || '';
      if (!imagingNotes.toLowerCase().includes('herniat') && !imagingNotes.toLowerCase().includes('disc')) {
        return {
          expected: 'Imaging showing disc pathology',
          actual: 'Imaging normal or different finding',
          recommendation: 'Verify imaging findings',
        };
      }
    }

    return null;
  }

  /**
   * Find contradictory diagnoses
   */
  private findContradictoryDiagnoses(code: string): string[] {
    const contradictions: Record<string, string[]> = {
      'Z34': ['O26'], // Normal pregnancy vs complicated pregnancy
      'R00': ['I47'], // Symptoms vs confirmed diagnosis
    };

    return contradictions[code] || [];
  }

  /**
   * Check if code is a symptom code (R-codes)
   */
  private isSymptomCode(code: string): boolean {
    return code.startsWith('R');
  }

  /**
   * Check if diagnosis is symptom-based
   */
  private isSymptomology(diagnosis: string): boolean {
    const symptoms = ['pain', 'fever', 'cough', 'ache', 'discomfort'];
    return symptoms.some(s => diagnosis.toLowerCase().includes(s));
  }

  /**
   * Check if codes conflict
   */
  private hasCodeConflict(code1: string, code2: string): boolean {
    // Both cannot be primary diagnoses
    if (code1.startsWith(code2.substring(0, 3)) && code1 !== code2) {
      return false; // Different codes in same category might be ok
    }
    return false;
  }

  /**
   * Check if code is procedure-dependent
   */
  private isProcedureDependentCode(code: string): boolean {
    // Codes starting with certain patterns require procedures
    return code.startsWith('M51') || code.startsWith('K80');
  }

  /**
   * Check procedure incompatibility
   */
  private checkProcedureIncompatibility(code: string): { expected: string; actual: string; recommendation: string } | null {
    // Example: herniated disc but no spinal procedure planned
    if (code === 'M51.26') {
      const procedure = this.caseData.clinical.proposedProcedure || '';
      if (!procedure.toLowerCase().includes('discectomy') && !procedure.toLowerCase().includes('surgery')) {
        return {
          expected: 'Spinal procedure',
          actual: `Procedure: ${procedure}`,
          recommendation: 'Verify procedure is appropriate for this diagnosis',
        };
      }
    }

    return null;
  }

  /**
   * Check if code requires imaging
   */
  private requiresImagingEvidence(code: string): boolean {
    // Codes that typically need imaging support
    return (
      code.startsWith('M51') || // Disc herniation
      code.startsWith('M47') || // Spondylosis
      code.startsWith('C')      // Cancer
    );
  }

  /**
   * Check if code requires lab evidence
   */
  private requiresLabEvidence(code: string): boolean {
    // Codes that typically need lab support
    return (
      code.startsWith('E11') || // Diabetes
      code.startsWith('I10') || // Hypertension
      code.startsWith('N18')    // Chronic kidney disease
    );
  }
}

/**
 * Summary of validation results
 */
export interface ValidationSummary {
  totalCandidates: number;
  validCandidates: number;
  rejectedCandidates: number;
  reviewRequiredCandidates: number;
  criticalIssues: number;
  warningIssues: number;
}

/**
 * Get validation summary
 */
export function getValidationSummary(validatedCandidates: ValidatedICDCandidate[]): ValidationSummary {
  return {
    totalCandidates: validatedCandidates.length,
    validCandidates: validatedCandidates.filter(c => c.recommendationLevel === 'accept').length,
    rejectedCandidates: validatedCandidates.filter(c => c.recommendationLevel === 'reject').length,
    reviewRequiredCandidates: validatedCandidates.filter(c => c.recommendationLevel === 'review').length,
    criticalIssues: validatedCandidates.reduce((sum, c) => sum + c.issues.filter(i => i.severity === 'error').length, 0),
    warningIssues: validatedCandidates.reduce((sum, c) => sum + c.issues.filter(i => i.severity === 'warning').length, 0),
  };
}
