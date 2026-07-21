/**
 * Insurance Operations Platform — Unified Data Model
 *
 * Replaces the split PatientCaseRecord / PreAuthRecord architecture with a single
 * Case object that accumulates activity over its life. All role-based workflows,
 * approval gates, completeness scoring, and timeline/audit trail are first-class
 * properties, never bolted on or mapped via adapters.
 */

// ============================================
// ROLE MODEL (§1)
// ============================================

export type Role =
  | 'insurance_coordinator'      // Primary user; creates/enriches cases
  | 'senior_reviewer'             // Approves gated actions (manager)
  | 'billing_executive'           // Owns Billing/Settlement stages
  | 'treating_doctor'             // Provides clinical docs, responds to queries
  | 'medical_records'             // Supplies missing reports/documents
  | 'reception'                   // Registers patient, creates bare-minimum case
  | 'tpa'                         // External; reviews & responds (not a login)
  | 'patient';                    // Limited; receives updates, uploads policy

export interface Actor {
  id: string;
  role: Role;
  name: string;
  email?: string;
  phone?: string;
}

// ============================================
// APPROVAL GATES (§1 & §2)
// ============================================

export type GateableTransition =
  | 'submit_prior_auth'
  | 'submit_enhancement'
  | 'submit_appeal';

export interface ApprovalRule {
  transition: GateableTransition;
  requiresApproval: boolean;
  approverRole: Role;
  amountThreshold?: number;
}

export interface ApprovalGateConfig {
  hospitalId: string;
  rules: ApprovalRule[];
}

// ============================================
// LIFECYCLE STAGES (§5)
// ============================================

export type CaseStatus =
  | 'patient_registered'          // Reception intake complete
  | 'insurance_verified'          // Policy confirmed
  | 'clinical_info_available'     // Diagnosis/ICD confirmed
  | 'documents_uploaded'          // All docs received
  | 'ready_for_prior_auth'        // Hard validation passed
  | 'submitted_to_tpa'            // Awaiting TPA review
  | 'query_raised'                // TPA query active
  | 'enhancement_requested'       // Enhancement loop active
  | 'denied'                      // TPA denied
  | 'appeal_drafted'              // Appeal ready (not yet submitted)
  | 'discharge_billing'           // Discharge process active
  | 'settlement'                  // Final settlement pending
  | 'completed'                   // Closed (approved/settled/no-appeal-needed)
  | 'cancelled';                  // Never submitted / patient withdrawn

// ============================================
// ACTIVITY / TIMELINE (§2)
// ============================================

export interface Activity {
  id: string;
  timestamp: string;
  event: ActivityEventType;
  actor?: Actor;
  description: string;
  details?: Record<string, any>;
}

export type ActivityEventType =
  // Registration & verification
  | 'case_created'
  | 'insurance_verified'
  | 'clinical_info_added'
  | 'document_uploaded'
  | 'field_corrected'

  // Prior auth workflow
  | 'prior_auth_submitted'
  | 'completeness_updated'

  // TPA interactions
  | 'tpa_query_received'
  | 'tpa_response_sent'
  | 'tpa_approved'
  | 'tpa_denied'

  // Enhancement workflow
  | 'enhancement_requested'
  | 'enhancement_response_sent'

  // Denial & appeal
  | 'denial_analysis_complete'
  | 'appeal_drafted'
  | 'appeal_submitted'

  // Discharge & settlement
  | 'discharge_initiated'
  | 'settlement_complete'

  // Admin
  | 'case_reassigned'
  | 'approval_gate_triggered'
  | 'approval_granted';

// ============================================
// DOCUMENTS & PROVENANCE (§7)
// ============================================

export interface FieldProvenance {
  confidence: number;             // 0-100
  source: string;                 // Filename, timestamp, or "manual entry"
  extractedFrom?: string;         // Document ID if from OCR/extraction
  extractedAtPage?: number;
  timestamp?: string;
}

export interface DocumentEntry {
  id: string;
  name: string;
  fileType: 'pdf' | 'image' | 'document';
  uploadedAt: string;
  uploadedBy?: Actor;
  extractedData?: Record<string, any>;
  extractedAt?: string;
  extractionConfidence?: number;
  category?: 'insurance_card' | 'id_proof' | 'medical_report' | 'billing' | 'other';
}

// ============================================
// PATIENT PROFILE (NEW UNIFIED SHAPE)
// ============================================

export interface PatientInfo {
  // Demographics
  name: string;
  contactNumber: string;
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string;
  age?: number;

  // Hospital IDs
  uhid?: string;
  mrn?: string;

  // Address
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;

  // Additional identifiers
  aadhaarNumber?: string;
  panNumber?: string;
  abhaId?: string;

  // Provenance
  provenance: Record<keyof PatientInfo, FieldProvenance>;
}

// ============================================
// INSURANCE DETAILS (NEW UNIFIED SHAPE)
// ============================================

export interface InsuranceInfo {
  insurerName: string;
  tpaName: string;
  policyNumber: string;
  policyType?: 'corporate' | 'retail' | 'govt';
  sumInsured: number;
  roomRentLimit?: number;
  icuRentLimit?: number;

  // Verification
  verified: boolean;
  verifiedAt?: string;
  verificationErrors?: string[];

  // Provenance
  provenance: Record<keyof Omit<InsuranceInfo, 'provenance'>, FieldProvenance>;
}

// ============================================
// CLINICAL DETAILS (NEW UNIFIED SHAPE)
// ============================================

export interface ClinicalInfo {
  // Admission
  admissionDate: string;
  admissionType: 'emergency' | 'planned' | 'unknown';
  wardType?: string;

  // Diagnosis
  chiefComplaints?: string;
  diagnosis?: string;
  icd10Code?: string;
  icd10Confirmed: boolean;
  diagnosisSource?: 'deterministic_lookup' | 'ai_suggested' | 'manual_entry';

  // Clinical details
  historyOfPresentIllness?: string;
  relevantClinicalFindings?: string;
  pastMedicalHistory?: string;

  // Treatment plan
  proposedProcedure?: string;
  expectedLengthOfStay?: number;
  expectedDaysInICU?: number;

  // Severity
  severity?: 'low' | 'moderate' | 'high' | 'critical';

  // Provenance
  provenance: Record<keyof Omit<ClinicalInfo, 'provenance'>, FieldProvenance>;
}

// ============================================
// AUTHORIZATION & TPA RESPONSE
// ============================================

export interface AuthorizationRecord {
  id: string;
  status: 'pending' | 'approved' | 'partial' | 'denied' | 'query_raised';
  requestedAmount: number;
  approvedAmount?: number;

  // TPA response
  tpaReceiptId?: string;
  submittedAt?: string;
  respondedAt?: string;

  // Query management
  queryDetails?: string;
  queryRaisedAt?: string;
  queryResponseText?: string;
  queryRespondedAt?: string;

  // Denial
  denialReason?: string;

  // Evidence review
  tpaEvidenceReview?: Record<string, any>;
  irdaiText?: string;
}

// ============================================
// ENHANCEMENT REQUEST
// ============================================

export interface EnhancementRequest {
  id: string;
  trigger: 'new_procedure' | 'extended_stay' | 'icu_upgrade' | 'manual_request';
  requestedAmount: number;
  justification: string;

  status: 'draft' | 'submitted' | 'query_raised' | 'approved' | 'partial' | 'denied';
  approvedAmount?: number;

  // Query (if raised)
  queryDetails?: string;
  queryRaisedAt?: string;
  queryResponseText?: string;
  queryRespondedAt?: string;

  // AI review (before submission)
  reviewEngineReport?: {
    status: 'sufficient' | 'pending_documents';
    gaps: string[];
    anticipatedQueries: string[];
    requiredEvidence: string[];
  };

  // Provenance
  requestedAt: string;
  requestedBy?: Actor;
  respondedAt?: string;
  respondedBy?: Actor;
}

// ============================================
// BILLING & SETTLEMENT
// ============================================

export interface BillingInfo {
  estimatedAmount?: number;
  finalAmount?: number;
  approvedAmount?: number;

  // Caps and deductions
  roomRentApplied?: number;
  copayAmount?: number;
  deductibleAmount?: number;

  // Settlement
  amountReceived?: number;
  settlementDate?: string;
  varianceReason?: string;

  status: 'pending' | 'finalized' | 'settled';
}

// ============================================
// APPEAL (AFTER DENIAL)
// ============================================

export interface AppealRecord {
  id: string;
  denialReason: string;
  appealStatus: 'draft' | 'submitted' | 'resolved';

  // Appeal content
  appealLetterEnglish: string;
  appealLetterHindi?: string;
  citedEvidence: string[];
  reasonsAddressed: number;
  totalReasons: number;
  priorityScore: number;

  // Dates
  generatedAt: string;
  submittedAt?: string;
  resolvedAt?: string;

  // AI generation details
  groundedCitations: boolean;
  generatedBy?: 'deterministic' | 'ai_assisted';
}

// ============================================
// COMPLETENESS TRACKING (§5)
// ============================================

export interface CompletenessMetric {
  overallScore: number;         // 0-100
  sections: {
    patient: number;
    insurance: number;
    clinical: number;
    documents: number;
    prior_auth_ready: number;
  };
  missingItems: string[];       // ["Patient UHID", "Clinical diagnosis", "Admission date"]
  blockedReason?: string;       // If ready_for_prior_auth but cannot proceed
}

// ============================================
// UNIFIED CASE OBJECT (§2)
// ============================================

export interface Case {
  // Identity
  id: string;
  type: 'insurance_case';
  createdAt: string;
  updatedAt: string;

  // Ownership & roles
  ownerId?: string;
  ownerRole?: Role;
  hospitalId: string;

  // Status & lifecycle
  status: CaseStatus;
  previousStatus?: CaseStatus;
  statusChangedAt?: string;

  // Core data
  patient: PatientInfo;
  insurance: InsuranceInfo;
  clinical: ClinicalInfo;

  // Documents
  documents: DocumentEntry[];

  // Authorization & TPA workflow
  authorization: AuthorizationRecord;
  enhancements: EnhancementRequest[];

  // Denial & appeal (if applicable)
  denial?: {
    reason: string;
    receivedAt: string;
  };
  appeal?: AppealRecord;

  // Discharge & settlement
  billing: BillingInfo;
  dischargeDate?: string;

  // Completeness & readiness
  completeness: CompletenessMetric;

  // Activity log (real, immutable)
  activities: Activity[];

  // Approval gates
  pendingApprovals: {
    transition: GateableTransition;
    approverRole: Role;
    requestedAt: string;
    approvedAt?: string;
  }[];

  // Metadata
  intakeChannel?: 'qr_scan' | 'manual' | 'document_upload';
  sessionToken?: string;
  tags?: string[];

  // For audit/debugging
  notes?: string;
}

// ============================================
// QUEUES & VIEWS (§3, §9)
// ============================================

export interface QueueDefinition {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  visibleToRoles: Role[];

  // Filter
  statusFilter?: CaseStatus[];
  ownerRoleFilter?: Role;
  requiresPendingApproval?: boolean;

  // Sort
  sortBy: 'urgency' | 'created' | 'updated' | 'sla_risk';
  sortOrder: 'asc' | 'desc';
}

export const DEFAULT_QUEUES: Record<string, QueueDefinition> = {
  my_queue: {
    id: 'my_queue',
    name: 'My Queue',
    icon: '🏠',
    description: 'Everything needing MY action right now',
    visibleToRoles: ['insurance_coordinator', 'billing_executive'],
    sortBy: 'urgency',
    sortOrder: 'desc',
  },
  inbox: {
    id: 'inbox',
    name: 'Inbox',
    icon: '📥',
    description: 'New / incomplete cases',
    visibleToRoles: ['insurance_coordinator'],
    statusFilter: ['patient_registered', 'insurance_verified', 'clinical_info_available'],
    sortBy: 'created',
    sortOrder: 'desc',
  },
  waiting_on_tpa: {
    id: 'waiting_on_tpa',
    name: 'Waiting on TPA',
    icon: '⏳',
    visibleToRoles: ['insurance_coordinator'],
    statusFilter: ['submitted_to_tpa'],
    sortBy: 'sla_risk',
    sortOrder: 'desc',
  },
  tpa_queries: {
    id: 'tpa_queries',
    name: 'TPA Queries',
    icon: '❓',
    visibleToRoles: ['insurance_coordinator', 'treating_doctor'],
    statusFilter: ['query_raised'],
    sortBy: 'urgency',
    sortOrder: 'desc',
  },
  enhancements: {
    id: 'enhancements',
    name: 'Enhancements',
    icon: '📈',
    visibleToRoles: ['insurance_coordinator'],
    statusFilter: ['enhancement_requested'],
    sortBy: 'urgency',
    sortOrder: 'desc',
  },
  needs_appeal: {
    id: 'needs_appeal',
    name: 'Needs Appeal',
    icon: '⚖️',
    visibleToRoles: ['insurance_coordinator'],
    statusFilter: ['denied'],
    sortBy: 'created',
    sortOrder: 'desc',
  },
  needs_my_approval: {
    id: 'needs_my_approval',
    name: 'Needs My Approval',
    icon: '✅',
    visibleToRoles: ['senior_reviewer'],
    requiresPendingApproval: true,
    sortBy: 'urgency',
    sortOrder: 'desc',
  },
  billing_settlement: {
    id: 'billing_settlement',
    name: 'Billing & Settlement',
    icon: '💰',
    visibleToRoles: ['billing_executive'],
    statusFilter: ['discharge_billing', 'settlement'],
    sortBy: 'sla_risk',
    sortOrder: 'desc',
  },
};

// ============================================
// HELPERS
// ============================================

export function newCase(
  hospitalId: string,
  patient: Partial<PatientInfo>,
  insurance: Partial<InsuranceInfo>
): Case {
  const now = new Date().toISOString();
  return {
    id: generateCaseId(),
    type: 'insurance_case',
    createdAt: now,
    updatedAt: now,
    hospitalId,
    status: 'patient_registered',
    patient: {
      name: patient.name || '',
      contactNumber: patient.contactNumber || '',
      provenance: {},
    },
    insurance: {
      insurerName: insurance.insurerName || '',
      tpaName: insurance.tpaName || '',
      policyNumber: insurance.policyNumber || '',
      sumInsured: insurance.sumInsured || 0,
      verified: false,
      provenance: {},
    },
    clinical: {
      admissionDate: new Date().toISOString().split('T')[0],
      admissionType: 'unknown',
      icd10Confirmed: false,
      provenance: {},
    },
    documents: [],
    authorization: {
      id: generateCaseId(),
      status: 'pending',
      requestedAmount: 0,
    },
    enhancements: [],
    billing: { status: 'pending' },
    completeness: {
      overallScore: 0,
      sections: { patient: 0, insurance: 0, clinical: 0, documents: 0, prior_auth_ready: 0 },
      missingItems: [],
    },
    activities: [
      {
        id: generateActivityId(),
        timestamp: now,
        event: 'case_created',
        description: 'Case created via reception intake',
      },
    ],
    pendingApprovals: [],
  };
}

export function generateCaseId(): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `CASE-${dateStr}-${seq}`;
}

export function generateActivityId(): string {
  return `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function computeCompletenessScore(c: Case): number {
  const sections = {
    patient: c.patient.name && c.patient.contactNumber ? 100 : 50,
    insurance: c.insurance.insurerName && c.insurance.policyNumber ? 100 : 50,
    clinical: c.clinical.diagnosis && c.clinical.icd10Code ? 100 : 50,
    documents: c.documents.length > 0 ? Math.min(100, c.documents.length * 25) : 0,
    prior_auth_ready: c.status === 'ready_for_prior_auth' ? 100 : 0,
  };
  const avg = Object.values(sections).reduce((a, b) => a + b, 0) / Object.keys(sections).length;
  return Math.round(avg);
}

export function computeMissingItems(c: Case): string[] {
  const missing: string[] = [];
  if (!c.patient.name) missing.push('Patient name');
  if (!c.patient.contactNumber) missing.push('Patient contact');
  if (!c.insurance.insurerName) missing.push('Insurer name');
  if (!c.insurance.policyNumber) missing.push('Policy number');
  if (!c.clinical.diagnosis) missing.push('Clinical diagnosis');
  if (!c.clinical.icd10Code) missing.push('ICD-10 code');
  if (c.documents.length === 0) missing.push('Admission documents');
  return missing;
}

export function updateCompletenessMetric(c: Case): void {
  c.completeness = {
    overallScore: computeCompletenessScore(c),
    sections: {
      patient: c.patient.name && c.patient.contactNumber ? 100 : 50,
      insurance: c.insurance.insurerName && c.insurance.policyNumber ? 100 : 50,
      clinical: c.clinical.diagnosis && c.clinical.icd10Code ? 100 : 50,
      documents: c.documents.length > 0 ? Math.min(100, c.documents.length * 25) : 0,
      prior_auth_ready: c.status === 'ready_for_prior_auth' ? 100 : 0,
    },
    missingItems: computeMissingItems(c),
  };
}
