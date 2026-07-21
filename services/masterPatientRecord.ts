import Dexie, { Table } from 'dexie';
import { PreAuthRecord, PatientRecord } from '../components/PreAuthWizard/types';
import type { DenialAppealResult } from '../engine/denialAppealGenerator';
import { mapToWhoCode, validateCode, getDescription } from './icdService';
import {
  Case,
  generateCaseId,
  generateActivityId,
  updateCompletenessMetric,
  PatientInfo,
  InsuranceInfo,
  ClinicalInfo,
  DocumentEntry,
  AuthorizationRecord,
  EnhancementRequest,
  AppealRecord,
  Activity,
  BillingInfo,
  CompletenessMetric,
} from './caseModel';

// --- LEGACY SCHEMA DEFINITIONS (backward compat) ---

export interface PatientProfile {
    name: string;
    age: number;
    gender: string;
    contact?: string;
    contactNumber?: string;
    address?: string;
    uhid?: string;
}

export interface InsuranceDetails {
    insurer?: string;
    insurerName?: string;
    policyNumber: string;
    sumInsured: number;
    TPA?: string;
    tpaName?: string;
    policyType?: string;
    roomRentLimit?: number;
    icuRentLimit?: number;
}

export interface EncounterDetails {
    admissionDate?: string;
    dischargeDate?: string;
    diagnosis?: string;
    diagnoses?: any[];
    treatmentPlan?: string;
    chiefComplaints?: string;
    historyOfPresentIllness?: string;
    relevantClinicalFindings?: string;
    wardType?: string;
    icuDays?: number;
}

export interface DocumentEntry {
    id: string;
    name: string;
    type: string;
    extractedData?: any;
}

export interface AuthorizationRecord {
    id: string;
    status: string;
    requestedAmount?: number;
    approvedAmount?: number;
    denialReason?: string;
    queryDetails?: string;
    queryResponseText?: string;           // Phase 2: text response drafted for query
    queryRespondedAt?: string;            // Phase 2: timestamp of response
    submittedAt?: string;
    respondedAt?: string;
    tpaReceiptId?: string;
    irdaiText?: string;
    tpaEvidenceReview?: any;
}

export interface EnhancementEntry {
    id: string;
    trigger: 'new_procedure' | 'extended_stay' | 'icu_upgrade';
    requestedAmount: number;
    approvedAmount?: number;              // set when TPA responds approved/partial
    deductionReason?: string;
    queryDetails?: string;
    denialReason?: string;
    queryResponseText?: string;           // if TPA raised a query on this enhancement
    queryRespondedAt?: string;            // Phase 2: timestamp of response
    status: string;
    gaps: string[];
    anticipatedQueries: any[];
    reviewedAt: string;
    details: any;
    reviewEngineReport?: {                // mirrors EnhancementReviewReport from engine
        status: 'sufficient' | 'pending_documents';
        gaps: string[];
        anticipatedQueries: any[];
        requiredEvidence: string[];
        insufficientEvidence: string[];
        reasoningTrace: string[];
        reviewedAt: string;
    };
}

// ── Audit event type constants ─────────────────────────────────────────────────
export const AUDIT_EVENTS = {
    ENHANCEMENT_REQUESTED:    'enhancement_requested',
    ENHANCEMENT_REVIEWED:     'enhancement_reviewed',
    ENHANCEMENT_RESOLVED:     'enhancement_resolved',
    QUERY_RESPONSE_GENERATED: 'query_response_generated',
    QUERY_RESPONSE_SENT:      'query_response_sent',
    TPA_RESPONSE_RECEIVED:    'tpa_response_received',
} as const;

export interface ClaimEntry {
    id: string;
    claimAmount: number;
    status: string;
    billDetails?: any;
    claimDocuments?: any;
}

export interface AppealEntry {
    id: string;
    appealStatus: 'draft' | 'submitted' | 'resolved';
    generatedAt: string;
    denialReason: string;
    appealLetterEnglish: string;
    appealLetterHindi?: string;
    totalReasons: number;
    addressedCount: number;
    priorityScore: number;
}

export interface AuditLogEntry {
    timestamp: string;
    action: string;
    user?: string;
    actor?: string;
    details?: any;
}

export interface TimelineEvent {
    timestamp: string;
    event: string;
    description: string;
}

export type CaseStage =
    | 'admission'
    | 'docs_uploaded'
    | 'documents_uploaded'
    | 'patient_identified'
    | 'ai_processing'
    | 'hospital_review'
    | 'ready_to_submit'
    | 'submitted_to_tpa'
    | 'tpa_review'
    | 'approved'
    | 'payment';

/** Higher = more urgent. Used by CaseList sort and triage dot. */
export const URGENCY_RANK: Record<CaseStage, number> = {
    tpa_review:          10,
    submitted_to_tpa:    9,
    ready_to_submit:     8,
    hospital_review:     7,
    ai_processing:       6,
    docs_uploaded:       5,
    documents_uploaded:  5,
    patient_identified:  4,
    admission:           3,
    approved:            2,
    payment:             1,
};

export function getStageFromStatus(status: string, hasDocs: boolean): CaseStage {
    switch (status) {
        case 'draft':
            return hasDocs ? 'docs_uploaded' : 'admission';
        case 'pending_documents':
            return 'docs_uploaded';
        case 'ready_to_submit':
            return 'ready_to_submit';
        case 'submitted':
            return 'submitted_to_tpa';
        case 'query_raised':
        case 'denied':
            return 'tpa_review';
        case 'approved':
            return 'approved';
        case 'closed':
            return 'payment';
        default:
            return 'admission';
    }
}

export interface PatientCaseRecord {
    id: string; // Unified case ID
    patientProfile: PatientProfile;
    insuranceDetails: InsuranceDetails;
    encounters: EncounterDetails[];
    documents: DocumentEntry[];
    authorizations: AuthorizationRecord[];
    enhancements: EnhancementEntry[];
    claims: ClaimEntry[];
    appeals: AppealEntry[];
    auditLog: AuditLogEntry[];
    timeline: TimelineEvent[];
    currentStage: CaseStage;

    // QR self-registration metadata
    intakeChannel?: 'qr_scan' | 'manual' | 'upload' | string;
    sessionToken?: string;

    // Legacy support field containing full state
    rawPreAuthRecord?: any;
    createdAt: string;
    updatedAt: string;
}

// --- DEXIE DATABASE CLASS ---

class MasterPatientDatabase extends Dexie {
    cases!: Table<Case, string>;
    patientCases!: Table<PatientCaseRecord, string>; // Deprecated alias for backward compat
    patients!: Table<PatientRecord, string>; // Legacy table for wizard autocompletion

    constructor() {
        super('AivanaMasterPatientDB');
        this.version(2).stores({
            cases: 'id, updatedAt, status, hospitalId',
            patientCases: 'id, updatedAt', // Deprecated
            patients: 'id, patientName, mobileNumber'
        });
    }
}

export const db = new MasterPatientDatabase();

// --- MAPPING UTILITIES (NEW) ---

/**
 * Convert legacy PreAuthRecord to new unified Case model.
 * Used for data migration and backward compatibility.
 */
export function mapPreAuthToCase(preAuth: PreAuthRecord): Case {
    const selectedIndex = preAuth.clinical?.selectedDiagnosisIndex ?? 0;
    const selectedDx = preAuth.clinical?.diagnoses?.[selectedIndex];

    const now = new Date().toISOString();

    const caseRecord: Case = {
        id: preAuth.id,
        type: 'insurance_case',
        createdAt: preAuth.createdAt,
        updatedAt: preAuth.updatedAt,
        hospitalId: 'default', // TODO: will come from auth context
        status: mapLegacyStatusToNewStatus(preAuth.status),

        patient: {
            name: preAuth.patient?.patientName || '',
            contactNumber: preAuth.patient?.mobileNumber || '',
            gender: preAuth.patient?.gender,
            age: preAuth.patient?.age,
            uhid: preAuth.patient?.uhid,
            provenance: {},
        },

        insurance: {
            insurerName: preAuth.insurance?.insurerName || '',
            tpaName: preAuth.insurance?.tpaName || '',
            policyNumber: preAuth.insurance?.policyNumber || '',
            sumInsured: Number(preAuth.insurance?.sumInsured || 0),
            verified: false,
            provenance: {},
        },

        clinical: {
            admissionDate: preAuth.admission?.dateOfAdmission || now.split('T')[0],
            admissionType: preAuth.admission?.admissionType === 'Emergency' ? 'emergency' : 'planned',
            wardType: preAuth.admission?.roomCategory,
            diagnosis: selectedDx?.diagnosis,
            icd10Code: selectedDx?.icd10Code,
            icd10Confirmed: !!selectedDx?.icd10Code,
            chiefComplaints: preAuth.clinical?.chiefComplaints,
            historyOfPresentIllness: preAuth.clinical?.historyOfPresentIllness,
            relevantClinicalFindings: preAuth.clinical?.relevantClinicalFindings,
            expectedLengthOfStay: preAuth.admission?.expectedLengthOfStay,
            expectedDaysInICU: preAuth.admission?.expectedDaysInICU,
            provenance: {},
        },

        documents: (preAuth.uploadedDocuments || []).map(d => ({
            id: d.id,
            name: d.fileName,
            fileType: (d.fileType === 'pdf' ? 'pdf' : 'image') as 'pdf' | 'image',
            uploadedAt: d.uploadedAt || now,
            extractedData: (d as any).extractedData,
        })),

        authorization: {
            id: preAuth.id,
            status: mapLegacyAuthStatus(preAuth.status),
            requestedAmount: preAuth.costEstimate?.amountClaimedFromInsurer || 0,
            approvedAmount: preAuth.tpaResponse?.approvedAmount,
            denialReason: preAuth.tpaResponse?.denialReason,
            queryDetails: preAuth.tpaResponse?.queryDetails,
            submittedAt: preAuth.updatedAt,
            respondedAt: preAuth.tpaResponse?.respondedAt,
            tpaReceiptId: (preAuth.outputs as any)?.tpaReceiptId,
            irdaiText: preAuth.outputs?.irdaiText,
            tpaEvidenceReview: preAuth.tpaEvidenceReview,
        },

        enhancements: (preAuth.enhancements || []).map((e: any) => ({
            id: e.id,
            trigger: e.trigger,
            requestedAmount: e.requestedAmount,
            justification: 'Migrated from legacy',
            status: e.status,
            approvedAmount: e.approvedAmount,
            queryDetails: e.queryDetails,
            queryRaisedAt: undefined,
            queryResponseText: e.queryResponseText,
            queryRespondedAt: e.queryRespondedAt,
            reviewEngineReport: e.reviewEngineReport,
            requestedAt: now,
            respondedAt: e.respondedAt,
        })),

        billing: {
            estimatedAmount: preAuth.costEstimate?.amountClaimedFromInsurer,
            status: 'pending',
        },

        completeness: {
            overallScore: 0,
            sections: { patient: 0, insurance: 0, clinical: 0, documents: 0, prior_auth_ready: 0 },
            missingItems: [],
        },

        activities: [
            {
                id: generateActivityId(),
                timestamp: preAuth.createdAt,
                event: 'case_created',
                description: 'Migrated from legacy PreAuthRecord',
            },
        ],

        pendingApprovals: [],
        intakeChannel: (preAuth as any).intakeChannel,
    };

    updateCompletenessMetric(caseRecord);
    return caseRecord;
}

// Helper to map legacy PreAuthStatus to new CaseStatus
function mapLegacyStatusToNewStatus(legacyStatus: string): any {
    const statusMap: Record<string, string> = {
        'draft': 'insurance_verified',
        'pending_documents': 'documents_uploaded',
        'ready_to_submit': 'ready_for_prior_auth',
        'submitted': 'submitted_to_tpa',
        'query_raised': 'query_raised',
        'approved': 'discharge_billing',
        'denied': 'denied',
        'appeal_drafted': 'appeal_drafted',
        'enhancement_requested': 'enhancement_requested',
        'closed': 'completed',
    };
    return statusMap[legacyStatus] || 'patient_registered';
}

function mapLegacyAuthStatus(legacyStatus: string): 'pending' | 'approved' | 'partial' | 'denied' | 'query_raised' {
    const map: Record<string, 'pending' | 'approved' | 'partial' | 'denied' | 'query_raised'> = {
        'draft': 'pending',
        'pending_documents': 'pending',
        'ready_to_submit': 'pending',
        'submitted': 'pending',
        'query_raised': 'query_raised',
        'approved': 'approved',
        'denied': 'denied',
        'appeal_drafted': 'denied',
        'enhancement_requested': 'pending',
        'closed': 'approved',
    };
    return map[legacyStatus] || 'pending';
}

/**
 * Convert new unified Case back to legacy PreAuthRecord.
 * Used for backward compatibility during transition.
 */
export function mapCaseToPreAuth(caseRecord: Case): PreAuthRecord {
    return {
        id: caseRecord.id,
        createdAt: caseRecord.createdAt,
        updatedAt: caseRecord.updatedAt,
        status: mapNewStatusToLegacyStatus(caseRecord.status),
        version: 1,
        createdBy: 'doctor',
        patient: {
            patientName: caseRecord.patient.name,
            age: caseRecord.patient.age,
            gender: (caseRecord.patient.gender as any) || 'Other',
            mobileNumber: caseRecord.patient.contactNumber,
            uhid: caseRecord.patient.uhid,
        },
        insurance: {
            insurerName: caseRecord.insurance.insurerName,
            policyNumber: caseRecord.insurance.policyNumber,
            sumInsured: caseRecord.insurance.sumInsured,
            tpaName: caseRecord.insurance.tpaName,
        },
        clinical: {
            diagnoses: [{ icd10Code: caseRecord.clinical.icd10Code, diagnosis: caseRecord.clinical.diagnosis }],
            selectedDiagnosisIndex: 0,
            chiefComplaints: caseRecord.clinical.chiefComplaints || '',
            historyOfPresentIllness: caseRecord.clinical.historyOfPresentIllness || '',
            relevantClinicalFindings: caseRecord.clinical.relevantClinicalFindings || '',
            durationOfPresentAilment: '',
            natureOfIllness: 'Acute',
            treatmentTakenSoFar: '',
            vitals: { bp: '', pulse: '', temp: '', rr: '', spo2: '' },
            severity: { phenoIntensity: 0, urgencyQuotient: 0, deteriorationVelocity: 0, overallRisk: 'Low', mustNotMiss: false },
            proposedLineOfTreatment: { medical: true, surgical: false, intensiveCare: false, investigation: false, nonAllopathic: false },
            reasonForHospitalisation: ''
        },
        admission: {
            roomCategory: (caseRecord.clinical.wardType as any) || 'General Ward',
            dateOfAdmission: caseRecord.clinical.admissionDate,
            timeOfAdmission: '',
            admissionType: caseRecord.clinical.admissionType === 'emergency' ? 'Emergency' : 'Planned',
            expectedLengthOfStay: caseRecord.clinical.expectedLengthOfStay || 3,
            expectedDaysInICU: caseRecord.clinical.expectedDaysInICU || 0,
            expectedDaysInRoom: 3,
            pastMedicalHistory: {},
            previousHospitalization: { wasHospitalizedBefore: false }
        },
        costEstimate: {
            amountClaimedFromInsurer: caseRecord.authorization.requestedAmount,
        },
        uploadedDocuments: caseRecord.documents.map(d => ({
            id: d.id,
            fileName: d.name,
            fileSizeDisplay: '0 KB',
            fileType: d.fileType,
            mimeType: d.fileType === 'image' ? 'image/png' : 'application/pdf',
            uploadedAt: d.uploadedAt,
            base64Data: '',
            documentCategory: d.category || 'other',
            autoClassified: true,
            isRequired: false,
            extractedData: d.extractedData,
        } as any)),
        documentRequirements: [],
        declarations: { patient: {}, doctor: {}, hospital: {} },
        outputs: {
            tpaReceiptId: caseRecord.authorization.tpaReceiptId,
            irdaiText: caseRecord.authorization.irdaiText,
        },
        tpaResponse: caseRecord.authorization.respondedAt ? {
            respondedAt: caseRecord.authorization.respondedAt,
            status: mapNewAuthStatusToLegacy(caseRecord.authorization.status) as any,
            approvedAmount: caseRecord.authorization.approvedAmount,
            denialReason: caseRecord.authorization.denialReason,
            queryDetails: caseRecord.authorization.queryDetails,
        } : undefined,
        tpaEvidenceReview: caseRecord.authorization.tpaEvidenceReview,
        enhancements: caseRecord.enhancements as any,
    };
}

function mapNewStatusToLegacyStatus(newStatus: any): any {
    const map: Record<string, string> = {
        'patient_registered': 'draft',
        'insurance_verified': 'draft',
        'clinical_info_available': 'pending_documents',
        'documents_uploaded': 'pending_documents',
        'ready_for_prior_auth': 'ready_to_submit',
        'submitted_to_tpa': 'submitted',
        'query_raised': 'query_raised',
        'enhancement_requested': 'enhancement_requested',
        'denied': 'denied',
        'appeal_drafted': 'appeal_drafted',
        'discharge_billing': 'approved',
        'settlement': 'approved',
        'completed': 'closed',
        'cancelled': 'draft',
    };
    return map[newStatus] || 'draft';
}

function mapNewAuthStatusToLegacy(newStatus: string): string {
    const map: Record<string, string> = {
        'pending': 'draft',
        'approved': 'approved',
        'partial': 'approved',
        'denied': 'denied',
        'query_raised': 'query_raised',
    };
    return map[newStatus] || 'draft';
}

// --- BACKEND SYNC SETTINGS ---
const BACKEND_URL = 'http://localhost:3001/api/cases';

// --- CORE FUNCTION EXPORTS (NEW UNIFIED API) ---

export async function getCase(id: string): Promise<Case | undefined> {
    try {
        const response = await fetch(`${BACKEND_URL}/${id}`);
        if (response.ok) {
            const data = await response.json();
            await db.cases.put(data);
            return data;
        }
    } catch (err) {
        console.warn(`[Offline Mode] Backend unreachable for getCase(${id}), falling back to IndexedDB.`, err);
    }
    return db.cases.get(id);
}

export async function saveCase(caseRecord: Case): Promise<void> {
    updateCompletenessMetric(caseRecord);
    caseRecord.updatedAt = new Date().toISOString();

    await db.cases.put(caseRecord);
    try {
        await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(caseRecord)
        });
    } catch (err) {
        console.warn(`[Offline Mode] Backend unreachable for saveCase(${caseRecord.id}), saved to IndexedDB only.`, err);
    }
}

export async function getAllCases(filter?: { hospitalId?: string; status?: string }): Promise<Case[]> {
    try {
        const response = await fetch(BACKEND_URL);
        if (response.ok) {
            const data: Case[] = await response.json();
            if (data && data.length > 0) {
                await db.cases.bulkPut(data);
            }
            return data;
        }
    } catch (err) {
        console.warn('[Offline Mode] Backend unreachable for getAllCases, falling back to IndexedDB.', err);
    }
    return db.cases.toArray();
}

// --- LEGACY BACKWARD-COMPATIBILITY API ---

export async function getPatientRecord(id: string): Promise<Case | undefined> {
    return getCase(id);
}

export async function savePatientRecord(record: any): Promise<void> {
    const caseRecord = record.type === 'insurance_case' ? record : mapPreAuthToCase(record);
    return saveCase(caseRecord);
}

export async function getAllPatientRecords(): Promise<Case[]> {
    return getAllCases();
}

export async function deleteCase(id: string): Promise<void> {
    await db.cases.delete(id);
    try {
        await fetch(`${BACKEND_URL}/${id}`, { method: 'DELETE' });
    } catch (err) {
        console.warn(`[Offline Mode] Backend unreachable for deleteCase(${id}), deleted from IndexedDB only.`, err);
    }
}

export async function updateClinicalInfo(caseId: string, clinical: Partial<ClinicalInfo>): Promise<void> {
    const caseRecord = await getCase(caseId);
    if (!caseRecord) return;

    caseRecord.clinical = { ...caseRecord.clinical, ...clinical };
    caseRecord.activities.push({
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        event: 'clinical_info_added',
        description: `Clinical info updated: ${clinical.diagnosis ? 'diagnosis' : ''} ${clinical.icd10Code ? 'ICD-10' : ''}`,
    });

    await saveCase(caseRecord);
}

export async function updateAuthorizationRecord(caseId: string, auth: Partial<AuthorizationRecord>): Promise<void> {
    const caseRecord = await getCase(caseId);
    if (!caseRecord) return;

    caseRecord.authorization = { ...caseRecord.authorization, ...auth };
    caseRecord.activities.push({
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        event: 'tpa_response_received',
        description: `Auth status set to ${auth.status} with receipt ${auth.tpaReceiptId || 'N/A'}`,
    });

    await saveCase(caseRecord);
}

export async function saveAppeal(caseId: string, appeal: AppealRecord): Promise<void> {
    const caseRecord = await getCase(caseId);
    if (!caseRecord) return;

    caseRecord.appeal = appeal;
    caseRecord.status = 'appeal_drafted';
    caseRecord.activities.push({
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        event: 'appeal_drafted',
        description: `Appeal generated with ${appeal.reasonsAddressed}/${appeal.totalReasons} reasons addressed`,
    });

    await saveCase(caseRecord);
}

export async function getAppeal(caseId: string): Promise<AppealRecord | undefined> {
    const caseRecord = await getCase(caseId);
    return caseRecord?.appeal;
}

export async function updateAppealStatus(caseId: string, status: AppealRecord['appealStatus']): Promise<void> {
    const caseRecord = await getCase(caseId);
    if (!caseRecord || !caseRecord.appeal) return;

    caseRecord.appeal.appealStatus = status;
    if (status === 'submitted') {
        caseRecord.appeal.submittedAt = new Date().toISOString();
        caseRecord.status = 'submitted_to_tpa';
    }

    caseRecord.activities.push({
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        event: status === 'submitted' ? 'appeal_submitted' : 'appeal_drafted',
        description: `Appeal status changed to ${status}`,
    });

    await saveCase(caseRecord);
}

// ── ENHANCEMENT & QUERY RESPONSE PERSISTENCE ────────────────────────────

export async function recordEnhancement(caseId: string, entry: EnhancementRequest): Promise<void> {
    const caseRecord = await getCase(caseId);
    if (!caseRecord) return;

    const idx = caseRecord.enhancements.findIndex(e => e.id === entry.id);
    if (idx > -1) {
        caseRecord.enhancements[idx] = entry;
    } else {
        caseRecord.enhancements.push(entry);
    }

    caseRecord.status = 'enhancement_requested';
    caseRecord.activities.push({
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        event: 'enhancement_requested',
        description: `Enhancement requested (${entry.trigger.replace(/_/g, ' ')}) — ₹${entry.requestedAmount.toLocaleString('en-IN')}`,
    });

    await saveCase(caseRecord);
}

export async function getEnhancements(caseId: string): Promise<EnhancementRequest[]> {
    const caseRecord = await getCase(caseId);
    return caseRecord?.enhancements ?? [];
}

export async function recordQueryResponse(
    caseId: string,
    parentId: string,
    parentType: 'pre_auth' | 'enhancement',
    responseText: string
): Promise<void> {
    const caseRecord = await getCase(caseId);
    if (!caseRecord) return;

    const now = new Date().toISOString();

    if (parentType === 'pre_auth') {
        caseRecord.authorization.queryResponseText = responseText;
        caseRecord.authorization.queryRespondedAt = now;
        caseRecord.status = 'submitted_to_tpa'; // Back to awaiting TPA review
    } else {
        const enh = caseRecord.enhancements.find(e => e.id === parentId);
        if (enh) {
            enh.queryResponseText = responseText;
            enh.queryRespondedAt = now;
        }
    }

    caseRecord.activities.push({
        id: generateActivityId(),
        timestamp: now,
        event: 'tpa_response_sent',
        description: `Query response submitted for ${parentType} — ${responseText.slice(0, 80)}…`,
    });

    await saveCase(caseRecord);
}

// --- LEGACY BACKWARD-COMPATIBILITY ADAPTERS ───────────────────────────────

export async function savePreAuth(record: PreAuthRecord): Promise<void> {
    // Legacy compliance check (sanitize diagnoses)
    if (record.clinical?.diagnoses) {
        record.clinical.diagnoses = record.clinical.diagnoses.map(dx => {
            const code = dx.icd10Code;
            if (code && !code.toLowerCase().includes('pending') && !code.toLowerCase().includes('selection')) {
                if (validateCode(code)) {
                    return dx;
                }
                const mapped = mapToWhoCode(code);
                if (mapped) {
                    console.log(`[StorageSanitizer] Mapping non-WHO code "${code}" -> valid WHO code "${mapped}"`);
                    return {
                        ...dx,
                        icd10Code: mapped,
                        icd10Description: getDescription(mapped)
                    };
                }
                console.warn(`[StorageSanitizer] Invalid non-WHO code "${code}" could not be mapped. Resetting to Pending.`);
                return {
                    ...dx,
                    icd10Code: 'Pending ICD-10',
                    icd10Description: 'Selection required'
                };
            }
            return dx;
        });
    }

    const caseRecord = mapPreAuthToCase(record);

    // Retain existing data if case already exists
    const existing = await getCase(record.id);
    if (existing) {
        caseRecord.appeal = existing.appeal;
        caseRecord.enhancements = existing.enhancements;
        caseRecord.activities = existing.activities;
    }

    await saveCase(caseRecord);
}

export async function getPreAuth(id: string): Promise<PreAuthRecord | undefined> {
    const caseRecord = await getCase(id);
    if (!caseRecord) return undefined;
    return mapCaseToPreAuth(caseRecord);
}

export async function getAllPreAuths(): Promise<PreAuthRecord[]> {
    const cases = await getAllCases();
    return cases.map(mapCaseToPreAuth);
}

export async function deletePreAuth(id: string): Promise<void> {
    await deleteCase(id);
}

export async function savePatient(patient: PatientRecord): Promise<void> {
    await db.patients.put(patient);
}

export async function getAllPatients(): Promise<PatientRecord[]> {
    return db.patients.toArray();
}

export async function searchPatients(query: string): Promise<PatientRecord[]> {
    const q = query.toLowerCase();
    return db.patients
        .filter(p =>
            p.patientName.toLowerCase().includes(q) ||
            p.mobileNumber.includes(q) ||
            (p.uhid && p.uhid.toLowerCase().includes(q)) ||
            (p.lastKnownPolicyNumber && p.lastKnownPolicyNumber.toLowerCase().includes(q))
        )
        .toArray();
}

export async function saveLegacyAppeal(appeal: DenialAppealResult): Promise<void> {
    const caseRecord = await getCase(appeal.recordId);
    if (!caseRecord) return;

    const appealRecord: AppealRecord = {
        id: appeal.recordId,
        appealStatus: appeal.appealStatus,
        generatedAt: appeal.generatedAt,
        denialReason: appeal.denialReasonsParsed.join('. '),
        appealLetterEnglish: appeal.appealText,
        appealLetterHindi: appeal.hindiTranslation,
        citedEvidence: appeal.citedEvidence,
        totalReasons: appeal.totalReasons,
        reasonsAddressed: appeal.addressedCount,
        priorityScore: appeal.priorityScore,
        groundedCitations: true,
    };

    await saveAppeal(appeal.recordId, appealRecord);
}

export async function getLegacyAppeal(recordId: string): Promise<DenialAppealResult | undefined> {
    const appeal = await getAppeal(recordId);
    if (!appeal) return undefined;

    return {
        recordId: appeal.id,
        appealStatus: appeal.appealStatus,
        generatedAt: appeal.generatedAt,
        denialReasonsParsed: [appeal.denialReason],
        appealText: appeal.appealLetterEnglish,
        hindiTranslation: appeal.appealLetterHindi,
        totalReasons: appeal.totalReasons,
        addressedCount: appeal.reasonsAddressed,
        priorityScore: appeal.priorityScore,
        citedEvidence: appeal.citedEvidence,
        stillMissing: [],
    };
}

export async function getAllLegacyAppeals(): Promise<DenialAppealResult[]> {
    const cases = await getAllCases();
    const results: DenialAppealResult[] = [];
    for (const c of cases) {
        if (c.appeal) {
            const appeal = c.appeal;
            results.push({
                recordId: appeal.id,
                appealStatus: appeal.appealStatus,
                generatedAt: appeal.generatedAt,
                denialReasonsParsed: [appeal.denialReason],
                appealText: appeal.appealLetterEnglish,
                hindiTranslation: appeal.appealLetterHindi,
                totalReasons: appeal.totalReasons,
                addressedCount: appeal.reasonsAddressed,
                priorityScore: appeal.priorityScore,
                citedEvidence: appeal.citedEvidence,
                stillMissing: [],
            });
        }
    }
    return results;
}

export async function updateLegacyAppealStatus(
    recordId: string,
    newStatus: DenialAppealResult['appealStatus']
): Promise<void> {
    await updateAppealStatus(recordId, newStatus as any);
}

// --- ID GENERATION (for backward compat) ---

export const generatePreAuthId = (): string => {
    return generateCaseId();
};

export const generatePatientId = (): string => `PAT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
