/**
 * IRDAI Compliance & Validation Service
 *
 * Validates extracted clinical data against IRDAI requirements for pre-authorization.
 * Ensures every pre-auth submission is complete, auditable, and compliant.
 *
 * IRDAI Requirements for Pre-Authorization:
 * 1. Full patient demographics with identification
 * 2. Clinical information with supporting evidence
 * 3. Complete diagnosis with ICD codes
 * 4. Procedure details with clinical justification
 * 5. Medical necessity with supporting tests/reports
 * 6. Estimated costs with itemization
 * 7. Complete audit trail of all extracted data
 * 8. Conflict resolution for ambiguous fields
 * 9. Doctor and hospital authorization
 * 10. Timestamp and source tracking for all fields
 */

import type { Case } from './caseModel';
import type { ReconciliationResult } from './reconciliationEngine';
import type { ProvenanceIndex } from './provenanceService';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'requires_review';
export type ValidationLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ValidationError {
  field: string;
  level: ValidationLevel;
  message: string;
  requirement: string;
  suggestedFix?: string;
}

export interface ComplianceReport {
  caseId: string;
  status: ComplianceStatus;
  generatedAt: string;

  // Validation results
  validationErrors: ValidationError[];
  validationWarnings: ValidationError[];

  // Field coverage
  fieldCoverage: {
    demographics: number; // %
    clinical: number; // %
    procedure: number; // %
    medical_necessity: number; // %
    documentation: number; // %
    overall: number; // %
  };

  // Requirement checklist
  requirements: {
    name: string;
    status: 'met' | 'not_met' | 'partial';
    details?: string;
  }[];

  // IRDAI compliance score (0-100)
  complianceScore: number;

  // Audit trail completeness
  auditTrail: {
    complete: boolean;
    fieldsWithProvenance: number;
    fieldsWithoutProvenance: number;
    conflictResolutions: number;
    unresolved: number;
  };

  // Recommendations
  recommendations: string[];

  // Signature (for pre-auth submission)
  approvedForSubmission: boolean;
  approvalDetails?: {
    approvedBy: string;
    approvedAt: string;
    approvalNotes?: string;
  };
}

/**
 * Validate case for IRDAI compliance before pre-auth submission
 */
export function validateCaseForIRDAICompliance(
  caseRecord: Case,
  reconciliation: ReconciliationResult,
  provenanceIndex: ProvenanceIndex
): ComplianceReport {
  console.log(`[IRDAI Compliance] Validating case ${caseRecord.id}`);

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const fieldCoverage = {
    demographics: 0,
    clinical: 0,
    procedure: 0,
    medical_necessity: 0,
    documentation: 0,
    overall: 0,
  };

  // Step 1: Validate demographics
  validateDemographics(caseRecord.patient, errors, warnings);
  fieldCoverage.demographics = calculateDemographicsCoverage(caseRecord.patient);

  // Step 2: Validate clinical information
  validateClinicalInfo(caseRecord.clinical, errors, warnings);
  fieldCoverage.clinical = calculateClinicalCoverage(caseRecord.clinical);

  // Step 3: Validate procedure details
  validateProcedure(caseRecord.clinical, errors, warnings);
  fieldCoverage.procedure = calculateProcedureCoverage(caseRecord.clinical);

  // Step 4: Validate medical necessity
  validateMedicalNecessity(caseRecord.clinical, errors, warnings);
  fieldCoverage.medical_necessity = calculateMedicalNecessityCoverage(caseRecord.clinical);

  // Step 5: Validate documentation
  validateDocumentation(caseRecord.documents, errors, warnings);
  fieldCoverage.documentation = calculateDocumentationCoverage(caseRecord.documents);

  // Step 6: Validate conflicts are resolved
  validateConflictResolution(reconciliation, errors, warnings);

  // Calculate overall coverage
  fieldCoverage.overall = Math.round(
    (fieldCoverage.demographics +
      fieldCoverage.clinical +
      fieldCoverage.procedure +
      fieldCoverage.medical_necessity +
      fieldCoverage.documentation) /
      5
  );

  // Build audit trail report
  const auditTrailReport = buildAuditTrailReport(provenanceIndex, reconciliation);

  // Create requirement checklist
  const requirements = buildRequirementChecklist(caseRecord, reconciliation);

  // Calculate compliance score
  const complianceScore = calculateComplianceScore(
    errors,
    warnings,
    fieldCoverage,
    auditTrailReport,
    requirements
  );

  // Generate recommendations
  const recommendations = generateRecommendations(errors, warnings, fieldCoverage);

  const status: ComplianceStatus =
    errors.filter(e => e.level === 'critical').length === 0
      ? 'compliant'
      : complianceScore >= 80
      ? 'requires_review'
      : 'non_compliant';

  return {
    caseId: caseRecord.id,
    status,
    generatedAt: new Date().toISOString(),
    validationErrors: errors,
    validationWarnings: warnings,
    fieldCoverage,
    requirements,
    complianceScore,
    auditTrail: auditTrailReport,
    recommendations,
    approvedForSubmission: status === 'compliant' && complianceScore >= 90,
  };
}

/**
 * Validate patient demographics
 */
function validateDemographics(patient: any, errors: ValidationError[], warnings: ValidationError[]): void {
  const criticalFields = ['name', 'contactNumber', 'dateOfBirth'];
  const recommendedFields = ['gender', 'aadhaarNumber', 'address'];

  for (const field of criticalFields) {
    if (!patient[field]) {
      errors.push({
        field: `patient.${field}`,
        level: 'critical',
        message: `Missing critical demographic field: ${field}`,
        requirement: 'IRDAI requires complete patient identification',
        suggestedFix: `Add patient ${field}`,
      });
    }
  }

  for (const field of recommendedFields) {
    if (!patient[field]) {
      warnings.push({
        field: `patient.${field}`,
        level: 'medium',
        message: `Recommended demographic field missing: ${field}`,
        requirement: 'IRDAI recommends complete patient information for audit trails',
        suggestedFix: `Add patient ${field} if available`,
      });
    }
  }
}

/**
 * Validate clinical information
 */
function validateClinicalInfo(clinical: any, errors: ValidationError[], warnings: ValidationError[]): void {
  if (!clinical.chiefComplaints) {
    errors.push({
      field: 'clinical.chiefComplaints',
      level: 'critical',
      message: 'Chief complaint is missing',
      requirement: 'IRDAI requires documented chief complaint',
    });
  }

  if (!clinical.diagnosis) {
    errors.push({
      field: 'clinical.diagnosis',
      level: 'critical',
      message: 'Diagnosis is missing',
      requirement: 'IRDAI requires confirmed diagnosis',
    });
  }

  if (!clinical.icd10Code || !clinical.icd10Confirmed) {
    errors.push({
      field: 'clinical.icd10Code',
      level: 'critical',
      message: 'ICD-10 code is missing or not confirmed',
      requirement: 'IRDAI requires ICD-10 code confirmed by treating physician',
    });
  }

  if (!clinical.admissionDate) {
    warnings.push({
      field: 'clinical.admissionDate',
      level: 'high',
      message: 'Admission date is missing',
      requirement: 'IRDAI requires admission timestamp for audit trail',
    });
  }
}

/**
 * Validate procedure details
 */
function validateProcedure(clinical: any, errors: ValidationError[], warnings: ValidationError[]): void {
  if (!clinical.proposedProcedure) {
    errors.push({
      field: 'clinical.proposedProcedure',
      level: 'critical',
      message: 'Proposed procedure is missing',
      requirement: 'IRDAI requires documented procedure for pre-authorization',
    });
  }

  if (clinical.expectedLengthOfStay === undefined || clinical.expectedLengthOfStay === null) {
    warnings.push({
      field: 'clinical.expectedLengthOfStay',
      level: 'medium',
      message: 'Expected length of stay not specified',
      requirement: 'IRDAI requires estimated hospitalization duration',
    });
  }
}

/**
 * Validate medical necessity
 */
function validateMedicalNecessity(clinical: any, errors: ValidationError[], warnings: ValidationError[]): void {
  const necessityText = (clinical.clinicalNote?.originalText || '').toLowerCase();

  const indicators = [
    'necessary',
    'indicated',
    'required',
    'clinical need',
    'medical necessity',
  ];

  const hasMedicalNecessity = indicators.some(ind => necessityText.includes(ind));

  if (!hasMedicalNecessity) {
    warnings.push({
      field: 'clinical.medicalNecessity',
      level: 'high',
      message: 'Medical necessity statement may be incomplete',
      requirement: 'IRDAI requires explicit medical necessity documentation',
      suggestedFix: 'Add clear medical necessity statement in clinical note',
    });
  }

  // Check for supporting evidence
  if (!clinical.labResults || clinical.labResults.length === 0) {
    warnings.push({
      field: 'clinical.labResults',
      level: 'medium',
      message: 'No lab results found to support medical necessity',
      requirement: 'IRDAI expects supporting diagnostic evidence',
    });
  }

  if (!clinical.imaging || clinical.imaging.length === 0) {
    warnings.push({
      field: 'clinical.imaging',
      level: 'medium',
      message: 'No imaging reports found to support medical necessity',
      requirement: 'IRDAI expects supporting diagnostic evidence',
    });
  }
}

/**
 * Validate documentation completeness
 */
function validateDocumentation(documents: any[], errors: ValidationError[], warnings: ValidationError[]): void {
  const documentTypes = new Set(documents.map(d => d.category));

  const criticalTypes = ['medical_report'];
  for (const type of criticalTypes) {
    if (!documentTypes.has(type)) {
      warnings.push({
        field: 'documents',
        level: 'high',
        message: `Missing critical document type: ${type}`,
        requirement: 'IRDAI requires supporting medical documentation',
        suggestedFix: `Upload ${type}`,
      });
    }
  }

  if (documents.length === 0) {
    warnings.push({
      field: 'documents',
      level: 'medium',
      message: 'No documents uploaded',
      requirement: 'IRDAI recommends supporting documentation with pre-auth submission',
    });
  }
}

/**
 * Validate conflict resolution
 */
function validateConflictResolution(
  reconciliation: ReconciliationResult,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const unresolved = reconciliation.conflicts.filter(c => !c.resolution);

  if (unresolved.length > 0) {
    for (const conflict of unresolved.filter((_, i) => i < 3)) {
      warnings.push({
        field: conflict.fieldPath,
        level: conflict.isCritical ? 'high' : 'medium',
        message: `Unresolved conflict between patient note and document`,
        requirement: 'IRDAI requires conflict resolution for auditable records',
        suggestedFix: `Coordinator should review and resolve ${conflict.fieldPath}`,
      });
    }
  }
}

/**
 * Build audit trail report
 */
function buildAuditTrailReport(
  provenanceIndex: ProvenanceIndex,
  reconciliation: ReconciliationResult
): any {
  let fieldsWithProvenance = 0;
  let fieldsWithoutProvenance = 0;

  for (const field of provenanceIndex.fieldProvenance.values()) {
    if (field.provenance) {
      fieldsWithProvenance++;
    } else {
      fieldsWithoutProvenance++;
    }
  }

  const conflictResolutions = reconciliation.conflicts.filter(c => c.resolution).length;
  const unresolved = reconciliation.conflicts.filter(c => !c.resolution).length;

  return {
    complete: unresolved === 0 && fieldsWithoutProvenance === 0,
    fieldsWithProvenance,
    fieldsWithoutProvenance,
    conflictResolutions,
    unresolved,
  };
}

/**
 * Build IRDAI requirement checklist
 */
function buildRequirementChecklist(
  caseRecord: Case,
  reconciliation: ReconciliationResult
): Array<{ name: string; status: 'met' | 'not_met' | 'partial'; details?: string }> {
  return [
    {
      name: 'Patient Identification',
      status: caseRecord.patient.name && caseRecord.patient.contactNumber ? 'met' : 'not_met',
      details: 'Name, contact, DOB required',
    },
    {
      name: 'Insurance Verification',
      status: caseRecord.insurance.verified ? 'met' : 'not_met',
      details: 'Policy number verified with insurer',
    },
    {
      name: 'Diagnosis with ICD Code',
      status: caseRecord.clinical.icd10Confirmed ? 'met' : 'not_met',
      details: 'ICD-10 code confirmed by treating physician',
    },
    {
      name: 'Procedure Details',
      status: caseRecord.clinical.proposedProcedure ? 'met' : 'not_met',
      details: 'Procedure name and medical necessity documented',
    },
    {
      name: 'Medical Necessity',
      status: caseRecord.clinical.clinicalNote?.originalText ? 'met' : 'not_met',
      details: 'Clinical justification with supporting evidence',
    },
    {
      name: 'Cost Estimate',
      status: caseRecord.billing.estimatedAmount ? 'met' : 'partial',
      details: 'Itemized cost breakdown',
    },
    {
      name: 'Doctor Authorization',
      status: caseRecord.clinical.treatingDoctor ? 'met' : 'not_met',
      details: 'Treating physician details documented',
    },
    {
      name: 'Audit Trail',
      status: reconciliation.conflicts.filter(c => !c.resolution).length === 0 ? 'met' : 'partial',
      details: 'All field extractions with source tracking',
    },
  ];
}

/**
 * Calculate compliance score (0-100)
 */
function calculateComplianceScore(
  errors: ValidationError[],
  warnings: ValidationError[],
  fieldCoverage: Record<string, number>,
  auditTrail: any,
  requirements: any[]
): number {
  let score = 100;

  // Deduct for critical errors
  score -= errors.filter(e => e.level === 'critical').length * 20;

  // Deduct for high-level errors
  score -= errors.filter(e => e.level === 'high').length * 10;

  // Deduct for low coverage areas
  const avgCoverage = Math.round(
    (fieldCoverage.demographics +
      fieldCoverage.clinical +
      fieldCoverage.procedure +
      fieldCoverage.medical_necessity +
      fieldCoverage.documentation) /
      5
  );

  if (avgCoverage < 100) {
    score -= (100 - avgCoverage) * 0.3;
  }

  // Deduct for audit trail issues
  if (!auditTrail.complete) {
    score -= 10;
  }

  // Deduct for unmet requirements
  const unmetRequirements = requirements.filter(r => r.status === 'not_met').length;
  score -= unmetRequirements * 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate demographics coverage %
 */
function calculateDemographicsCoverage(patient: any): number {
  const fields = ['name', 'contactNumber', 'dateOfBirth', 'gender', 'address'];
  const filled = fields.filter(f => patient[f]).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Calculate clinical coverage %
 */
function calculateClinicalCoverage(clinical: any): number {
  const fields = [
    'chiefComplaints',
    'diagnosis',
    'icd10Code',
    'admissionDate',
    'historyOfPresentIllness',
  ];
  const filled = fields.filter(f => clinical[f]).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Calculate procedure coverage %
 */
function calculateProcedureCoverage(clinical: any): number {
  const fields = ['proposedProcedure', 'expectedLengthOfStay', 'severity'];
  const filled = fields.filter(f => clinical[f] !== undefined && clinical[f] !== null).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Calculate medical necessity coverage %
 */
function calculateMedicalNecessityCoverage(clinical: any): number {
  const fields = ['clinicalNote', 'labResults', 'imaging'];
  const filled = fields.filter(
    f => clinical[f] && (Array.isArray(clinical[f]) ? clinical[f].length > 0 : true)
  ).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Calculate documentation coverage %
 */
function calculateDocumentationCoverage(documents: any[]): number {
  if (!documents || documents.length === 0) return 0;

  const hasMetadata = documents.filter(d => d.category && d.uploadedAt).length;
  const coverage = (hasMetadata / Math.max(documents.length, 1)) * 100;
  return Math.round(coverage);
}

/**
 * Generate recommendations for improvement
 */
function generateRecommendations(
  errors: ValidationError[],
  warnings: ValidationError[],
  fieldCoverage: Record<string, number>
): string[] {
  const recommendations: string[] = [];

  // Add error-based recommendations
  for (const error of errors.slice(0, 3)) {
    if (error.suggestedFix) {
      recommendations.push(error.suggestedFix);
    }
  }

  // Add coverage-based recommendations
  const lowCoverageAreas = Object.entries(fieldCoverage)
    .filter(([_, coverage]) => coverage < 80 && coverage > 0)
    .map(([area]) => area);

  for (const area of lowCoverageAreas) {
    recommendations.push(`Improve ${area} coverage by adding missing details`);
  }

  // Add general recommendations
  if (errors.filter(e => e.level === 'critical').length > 0) {
    recommendations.push('Address all critical errors before submission');
  }

  if (warnings.filter(w => w.level === 'high').length > 3) {
    recommendations.push('Review high-level warnings with coordinator');
  }

  return recommendations.slice(0, 5);
}

/**
 * Export compliance report for TPA submission
 */
export function exportComplianceReport(report: ComplianceReport): string {
  const summary = {
    status: report.status,
    complianceScore: report.complianceScore,
    generatedAt: report.generatedAt,
    fieldCoverage: report.fieldCoverage,
    criticalErrors: report.validationErrors.filter(e => e.level === 'critical'),
    auditTrail: report.auditTrail,
    approvedForSubmission: report.approvedForSubmission,
  };

  return JSON.stringify(summary, null, 2);
}
