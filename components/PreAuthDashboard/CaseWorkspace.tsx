/**
 * CaseWorkspace.tsx  —  Phase 2 rebuild
 *
 * Left column : uploaded documents + evidence highlights + Enhancement Ledger
 * Right rail  : (a) readiness ring  (b) missing-items checklist
 *               (c) billing codes   (d) eligibility
 *               (e) CASE ACTIONS + TIMELINE  ← NEW
 *
 * When "Log TPA Response" is clicked   → right rail slides to TpaResponsePanel
 * When "Request Enhancement" is clicked → right rail slides to EnhancementRequestPanel (3-step)
 * When "Generate Query Response" is clicked → right rail shows QueryResponsePanel
 *
 * Visual rules: scoreColorClass() convention; no new colour tokens.
 * alert() removed everywhere; replaced by inline toast banners.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    CheckCircle2, AlertCircle, XCircle, Clock, ChevronRight,
    ArrowLeft, Send, Loader2, FileText, Stethoscope, BedDouble,
    Activity, RefreshCw
} from 'lucide-react';
import { PreAuthRecord } from '../PreAuthWizard/types';
import { computeReadiness, scoreColorClass, readinessStatusLine } from '../../utils/readinessScore';
import { priorAuthOrchestrator, ExtendedEvidenceReviewReport } from '../../engine/priorAuthWorkflow';
import { runBillingCodingWorkflow, BillingInput } from '../../engine/billingCoder';
import type { BillingCodingOutput } from '../../services/geminiService';
import {
    getPatientRecord, savePatientRecord, PatientCaseRecord,
    recordEnhancement, recordQueryResponse, EnhancementEntry,
} from '../../services/masterPatientRecord';
import { reviewEnhancement, EnhancementInput } from '../../engine/enhancementReview';
import { generateQueryResponse } from '../../services/queryResponseService';
import { savePreAuth } from '../../services/masterPatientRecord';
import { submitPreAuthToTPA } from '../../services/tpaPortalService';
import { logFeedbackEvent } from '../../utils/feedbackLogger';
import { logStageTimestamp } from '../../utils/stageLogger';

// ─────────────────────────────────────────────────────────────────────────────
// Tiny re-usable sub-components (design tokens from scoreColorClass)
// ─────────────────────────────────────────────────────────────────────────────

const RING_R = 36, RING_CX = 44, RING_CY = 44, RING_SIZE = 88;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

function ScoreRing({ score }: { score: number }) {
    const colors = scoreColorClass(score);
    const offset = CIRCUMFERENCE - (CIRCUMFERENCE * score) / 100;
    return (
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke="#E1E7E6" strokeWidth={5} />
                <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none"
                    stroke={colors.stroke} strokeWidth={5} strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-bold font-lora tabular-nums leading-none"
                    style={{ fontSize: 20, color: colors.stroke }}>{score}</span>
                <span className="text-[7px] font-bold uppercase tracking-wider text-opd-text-muted mt-0.5">/100</span>
            </div>
        </div>
    );
}

interface HighlightCardProps {
    excerpt: string; relatedRule: string; sourceDocument: string;
    supportsOrContradicts: 'supports' | 'contradicts';
}
const HighlightCard: React.FC<HighlightCardProps> = ({ excerpt, relatedRule, sourceDocument, supportsOrContradicts }) => {
    const isSupport = supportsOrContradicts === 'supports';
    return (
        <div className={`border rounded-xl p-3.5 space-y-2 border-l-4 shadow-sm ${
            isSupport ? 'border-l-emerald-500 bg-emerald-50/30 border-y border-r border-opd-border'
                      : 'border-l-red-500 bg-red-50/30 border-y border-r border-opd-border'}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                    isSupport ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {isSupport ? 'Supports Admission' : 'Contradicts / Gap'}
                </span>
                <span className="text-[9px] font-mono text-opd-text-secondary truncate max-w-[160px]">{sourceDocument}</span>
            </div>
            <blockquote className="text-sm italic text-opd-text-secondary bg-opd-input-bg border border-opd-border rounded-lg px-3 py-2 leading-relaxed">
                "{excerpt}"
            </blockquote>
            <div className="text-[9px] text-opd-text-secondary font-semibold flex items-center gap-1">
                <span className="text-opd-text-muted">Rule:</span>
                <span className="text-opd-text-primary font-bold">{relatedRule}</span>
            </div>
        </div>
    );
};

interface IcdTagProps { code: string; description: string; estimatedCost?: number; confidence: 'high' | 'medium' | 'low'; }
const IcdTag: React.FC<IcdTagProps> = ({ code, description, estimatedCost, confidence }) => {
    const confColor = confidence === 'high' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : confidence === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-gray-50 border-gray-200 text-gray-700';
    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-opd-border bg-white px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-sm font-bold text-opd-primary shrink-0">{code}</span>
                <span className="text-sm text-opd-text-secondary truncate">{description}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {estimatedCost != null && (
                    <span className="text-[9px] font-bold text-opd-text-primary font-mono">
                        ₹{estimatedCost.toLocaleString('en-IN')}
                    </span>
                )}
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${confColor}`}>
                    {confidence}
                </span>
            </div>
        </div>
    );
};

type EligibilityType = 'cashless' | 'reimbursement' | 'needs_verification';
const ELIG_CONFIG: Record<EligibilityType, { label: string; text: string; bg: string; border: string; icon: string }> = {
    cashless:          { label: 'Cashless Eligible',   text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '✓' },
    reimbursement:     { label: 'Reimbursement Only',  text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: '⚠' },
    needs_verification:{ label: 'Needs Verification',  text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: '!' },
};

function StatusPill({ score }: { score: number }) {
    const colors = scoreColorClass(score);
    return (
        <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${colors.bg} ${colors.text} ${colors.border}`}>
            {score >= 80 ? '● Under Final Review' : score >= 50 ? '● Under AI Review' : '● Action Required'}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast banner
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: 'success' | 'error' | 'info'; onDismiss: () => void }) {
    const cfg = {
        success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
        error:   'bg-red-50 border-red-300 text-red-800',
        info:    'bg-blue-50 border-blue-300 text-blue-800',
    }[type];
    return (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${cfg}`}>
            <span className="flex-1 leading-snug">{msg}</span>
            <button type="button" onClick={onDismiss} className="opacity-60 hover:opacity-100 font-bold ml-1">✕</button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TpaResponsePanel  (rescued from StatusTracker lines 167–205)
// ─────────────────────────────────────────────────────────────────────────────

interface TpaResponsePanelProps {
    record: PreAuthRecord;
    onSaved: (updated: PreAuthRecord) => void;
    onCancel: () => void;
}
const TpaResponsePanel: React.FC<TpaResponsePanelProps> = ({ record, onSaved, onCancel }) => {
    const [tpaStatus, setTpaStatus] = useState<'approved' | 'denied' | 'query' | 'partial_approved'>(
        record.tpaResponse?.status ?? 'approved'
    );
    const [approvedAmount, setApprovedAmount] = useState(record.tpaResponse?.approvedAmount ?? 0);
    const [denialReason, setDenialReason]     = useState(record.tpaResponse?.denialReason ?? '');
    const [queryDetails, setQueryDetails]     = useState(record.tpaResponse?.queryDetails ?? '');
    const [saving, setSaving]                 = useState(false);
    const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedStatus =
                tpaStatus === 'approved' || tpaStatus === 'partial_approved' ? 'approved' :
                tpaStatus === 'denied' ? 'denied' : 'query_raised';

            if (record.tpaEvidenceReview?.status === 'insufficient') {
                if (tpaStatus === 'query')
                    logFeedbackEvent(record.id, 'queried_insufficient', { queryDetails, diagnosis: record.clinical?.diagnoses?.[record.clinical.selectedDiagnosisIndex ?? 0]?.diagnosis });
                else if (tpaStatus === 'approved' || tpaStatus === 'partial_approved')
                    logFeedbackEvent(record.id, 'approved_insufficient', { approvedAmount, diagnosis: record.clinical?.diagnoses?.[record.clinical.selectedDiagnosisIndex ?? 0]?.diagnosis });
            }

            const updated: PreAuthRecord = {
                ...record,
                status: updatedStatus as any,
                updatedAt: new Date().toISOString(),
                tpaResponse: { respondedAt: new Date().toISOString(), status: tpaStatus, approvedAmount, denialReason, queryDetails },
            };
            await savePreAuth(updated);
            logStageTimestamp(record.id, 'response_received');
            if (updatedStatus === 'approved') logStageTimestamp(record.id, 'final_outcome_approved');
            else if (updatedStatus === 'denied') logStageTimestamp(record.id, 'final_outcome_denied');
            setToast({ msg: `TPA response saved — status set to ${updatedStatus.replace(/_/g, ' ').toUpperCase()}.`, type: 'success' });
            setTimeout(() => { onSaved(updated); }, 1200);
        } catch (err: any) {
            setToast({ msg: `Save failed: ${err.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-opd-border">
                <span className="text-sm font-bold font-lora text-opd-primary uppercase tracking-wider">Log TPA Response</span>
                <button type="button" onClick={onCancel} className="text-opd-text-muted hover:text-opd-primary text-sm font-bold">← Back</button>
            </div>

            {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

            <div className="grid grid-cols-2 gap-2">
                {(['approved', 'partial_approved', 'query', 'denied'] as const).map(s => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer select-none bg-opd-input-bg border border-opd-border rounded-lg px-3 py-2.5 hover:border-opd-primary transition">
                        <input type="radio" name="tpaStatus" value={s} checked={tpaStatus === s}
                            onChange={() => setTpaStatus(s)} className="accent-opd-primary" />
                        <span className="text-sm font-semibold text-opd-text-secondary capitalize">{s.replace('_', ' ')}</span>
                    </label>
                ))}
            </div>

            {(tpaStatus === 'approved' || tpaStatus === 'partial_approved') && (
                <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Approved Amount (₹)</label>
                    <input type="number" value={approvedAmount} onChange={e => setApprovedAmount(+e.target.value)}
                        className="w-full border border-opd-border rounded-lg px-3 py-2 text-sm font-mono font-semibold focus:outline-none focus:border-opd-primary" />
                </div>
            )}
            {tpaStatus === 'denied' && (
                <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Denial Reason</label>
                    <textarea value={denialReason} onChange={e => setDenialReason(e.target.value)} rows={3}
                        className="w-full border border-opd-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-opd-primary" />
                </div>
            )}
            {tpaStatus === 'query' && (
                <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">TPA Query Details</label>
                    <textarea value={queryDetails} onChange={e => setQueryDetails(e.target.value)} rows={3}
                        className="w-full border border-opd-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-opd-primary" />
                </div>
            )}

            <button onClick={handleSave} disabled={saving} type="button"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-opd-primary text-white text-sm font-bold rounded-xl hover:opacity-95 transition disabled:opacity-50 shadow-sm">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Send className="w-3.5 h-3.5" /> Save TPA Response</>}
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// EnhancementRequestPanel  —  3-step wizard (Step 5)
// First real call to reviewEnhancement() in the codebase.
// ─────────────────────────────────────────────────────────────────────────────

interface EnhancementRequestPanelProps {
    record: PreAuthRecord;
    onSubmitted: (entry: EnhancementEntry) => void;
    onCancel: () => void;
}
const EnhancementRequestPanel: React.FC<EnhancementRequestPanelProps> = ({ record, onSubmitted, onCancel }) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1 fields
    const [trigger, setTrigger]       = useState<EnhancementInput['trigger']>('extended_stay');
    const [origRef, setOrigRef]       = useState('');
    const [origApproved, setOrigApproved] = useState(0);
    const [utilized, setUtilized]     = useState(0);
    const [addlAmount, setAddlAmount] = useState(0);

    // Step 2 fields — extended_stay
    const [delayReasons, setDelayReasons]   = useState('');
    const [origDischarge, setOrigDischarge] = useState('');
    const [newDischarge, setNewDischarge]   = useState('');
    const [phenoInt, setPhenoInt]           = useState(0);
    const [detVelo, setDetVelo]             = useState(0);

    // Step 2 fields — new_procedure
    const [procName, setProcName]             = useState('');
    const [procCode, setProcCode]             = useState('');
    const [procDate, setProcDate]             = useState('');
    const [clinicalFinding, setClinicalFinding] = useState('');
    const [foreseeable, setForeseeable]       = useState(false);

    // Step 2 fields — icu_upgrade
    const [detDateTime, setDetDateTime]   = useState('');
    const [detVitals, setDetVitals]       = useState('');
    const [icuIntervention, setIcuIntervention] = useState('');

    // Step 3
    const [reviewing, setReviewing]   = useState(false);
    const [report, setReport]         = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const selectedDx = record.clinical?.diagnoses?.[record.clinical.selectedDiagnosisIndex ?? 0];
    const diagnosisText = selectedDx?.diagnosis ?? '';
    const admDate = record.admission?.dateOfAdmission;

    const buildInput = (): EnhancementInput => ({
        originalApprovalRef: origRef,
        originalApprovedAmount: origApproved,
        amountUtilizedToDate: utilized,
        trigger,
        additionalAmountRequested: addlAmount,
        dischargeDelayReasons: trigger === 'extended_stay' ? delayReasons.split('\n').filter(Boolean) : undefined,
        originalDischargeDate: trigger === 'extended_stay' ? origDischarge : undefined,
        newDischargeDate: trigger === 'extended_stay' ? newDischarge : undefined,
        newProcedureName: trigger === 'new_procedure' ? procName : undefined,
        newProcedureCode: trigger === 'new_procedure' ? procCode : undefined,
        newProcedureDate: trigger === 'new_procedure' ? procDate : undefined,
        newProcedureForeseeable: trigger === 'new_procedure' ? foreseeable : undefined,
        clinicalFindingTriggeringProcedure: trigger === 'new_procedure' ? clinicalFinding : undefined,
        deteriorationDateTime: trigger === 'icu_upgrade' ? detDateTime : undefined,
        deteriorationVitals: trigger === 'icu_upgrade' ? detVitals : undefined,
        icuIntervention: trigger === 'icu_upgrade' ? icuIntervention : undefined,
        currentSeverityScores: trigger === 'extended_stay' ? { phenoIntensity: phenoInt, deteriorationVelocity: detVelo } : undefined,
    });

    const runReview = async () => {
        setReviewing(true);
        setReport(null);
        try {
            const input = buildInput();
            const result = await reviewEnhancement(input, diagnosisText, admDate);
            setReport(result);
            setStep(3);
        } catch (err: any) {
            setToast({ msg: `Review engine error: ${err.message}`, type: 'error' });
        } finally {
            setReviewing(false);
        }
    };

    const handleSubmit = async () => {
        if (report?.status === 'pending_documents') return;
        setSubmitting(true);
        try {
            const entry: EnhancementEntry = {
                id: `ENH-${Math.floor(100000 + Math.random() * 900000)}`,
                trigger,
                requestedAmount: addlAmount,
                status: report?.status === 'sufficient' ? 'submitted' : 'pending_documents',
                gaps: report?.gaps ?? [],
                anticipatedQueries: report?.anticipatedQueries ?? [],
                reviewedAt: new Date().toISOString(),
                details: {
                    originalApprovalRef: origRef,
                    delayReasons,
                    procName,
                    clinicalFinding,
                    icuIntervention,
                    detVitals,
                },
                reviewEngineReport: report ?? undefined,
            };
            await recordEnhancement(record.id, entry);
            setToast({ msg: `Enhancement ${entry.id} submitted successfully.`, type: 'success' });
            setTimeout(() => onSubmitted(entry), 1200);
        } catch (err: any) {
            setToast({ msg: `Submit failed: ${err.message}`, type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const triggerLabel: Record<string, string> = {
        extended_stay: 'Stay Duration Extension',
        new_procedure: 'New Comorbid Procedure',
        icu_upgrade:   'ICU Upgrade / Transfer',
    };

    const SEVERITY_LEVELS = [1,2,3,4,5,6,7,8,9,10];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-opd-border">
                <span className="text-sm font-bold font-lora text-opd-primary uppercase tracking-wider">
                    Request Enhancement
                </span>
                <button type="button" onClick={onCancel} className="text-opd-text-muted hover:text-opd-primary text-sm font-bold">← Back</button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-1.5">
                {([1, 2, 3] as const).map(s => (
                    <React.Fragment key={s}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                            step === s ? 'bg-opd-primary text-white' : step > s ? 'bg-emerald-500 text-white' : 'bg-opd-border text-opd-text-muted'}`}>
                            {step > s ? '✓' : s}
                        </div>
                        {s < 3 && <div className={`flex-1 h-px ${step > s ? 'bg-emerald-500' : 'bg-opd-border'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* ── Step 1: Trigger & Amounts ────────────────────────────────── */}
            {step === 1 && (
                <div className="space-y-3 text-sm">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trigger Type</label>
                        <select className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                            value={trigger} onChange={e => setTrigger(e.target.value as any)}>
                            <option value="extended_stay">Stay Duration Extension</option>
                            <option value="new_procedure">New Comorbid Procedure</option>
                            <option value="icu_upgrade">ICU Upgrade / Transfer</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Original Approval Ref #</label>
                        <input className="w-full border border-opd-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-opd-primary"
                            placeholder="e.g. PA-AIVANA-20240712-1234" value={origRef}
                            onChange={e => setOrigRef(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Originally Approved (₹)</label>
                            <input type="number" className="w-full border border-opd-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-opd-primary"
                                value={origApproved || ''} onChange={e => setOrigApproved(+e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Utilized to Date (₹)</label>
                            <input type="number" className="w-full border border-opd-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-opd-primary"
                                value={utilized || ''} onChange={e => setUtilized(+e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Additional Amount Requested (₹)</label>
                        <input type="number" className="w-full border border-opd-border rounded-lg px-3 py-2 font-mono font-semibold focus:outline-none focus:border-opd-primary"
                            placeholder="e.g. 80000" value={addlAmount || ''}
                            onChange={e => setAddlAmount(+e.target.value)} />
                    </div>
                    <button type="button" disabled={!addlAmount || addlAmount <= 0}
                        onClick={() => setStep(2)}
                        className="w-full py-2.5 bg-opd-primary text-white text-sm font-bold rounded-xl hover:opacity-95 transition disabled:opacity-40 shadow-sm">
                        Next: Clinical Details →
                    </button>
                </div>
            )}

            {/* ── Step 2: Clinical Details ─────────────────────────────────── */}
            {step === 2 && (
                <div className="space-y-3 text-sm">
                    <div className="text-xs font-bold text-opd-primary uppercase tracking-wider bg-opd-input-bg border border-opd-border rounded-lg px-3 py-1.5">
                        Trigger: {triggerLabel[trigger]}
                    </div>

                    {trigger === 'extended_stay' && (<>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clinical Delay Reasons (one per line)</label>
                            <textarea rows={3} placeholder="e.g. Fever not subsided&#10;Platelet count dropping"
                                className="w-full border border-opd-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-opd-primary"
                                value={delayReasons} onChange={e => setDelayReasons(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Original Discharge</label>
                                <input type="date" className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                                    value={origDischarge} onChange={e => setOrigDischarge(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Discharge</label>
                                <input type="date" className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                                    value={newDischarge} onChange={e => setNewDischarge(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pheno Intensity (1–10)</label>
                                <select className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                                    value={phenoInt} onChange={e => setPhenoInt(+e.target.value)}>
                                    {SEVERITY_LEVELS.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deterioration Velocity (1–10)</label>
                                <select className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                                    value={detVelo} onChange={e => setDetVelo(+e.target.value)}>
                                    {SEVERITY_LEVELS.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>
                    </>)}

                    {trigger === 'new_procedure' && (<>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Procedure Name</label>
                                <input className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                                    placeholder="e.g. ERCP" value={procName} onChange={e => setProcName(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Procedure Code</label>
                                <input className="w-full border border-opd-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-opd-primary"
                                    placeholder="e.g. 43260" value={procCode} onChange={e => setProcCode(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Procedure Date</label>
                            <input type="date" className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                                value={procDate} onChange={e => setProcDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clinical Finding Triggering This Procedure</label>
                            <textarea rows={2} className="w-full border border-opd-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-opd-primary"
                                placeholder="e.g. Intraoperative finding of common bile duct stone"
                                value={clinicalFinding} onChange={e => setClinicalFinding(e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={foreseeable} onChange={e => setForeseeable(e.target.checked)} className="accent-opd-primary w-4 h-4" />
                            <span className="text-sm text-opd-text-secondary">Procedure was foreseeable at admission</span>
                        </label>
                    </>)}

                    {trigger === 'icu_upgrade' && (<>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deterioration Date & Time</label>
                                <input type="datetime-local" className="w-full border border-opd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-opd-primary"
                                    value={detDateTime} onChange={e => setDetDateTime(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">ICU Intervention Required</label>
                                <input className="w-full border border-opd-border rounded-lg px-3 py-2 focus:outline-none focus:border-opd-primary"
                                    placeholder="e.g. Mechanical ventilation, vasopressors"
                                    value={icuIntervention} onChange={e => setIcuIntervention(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deterioration Vitals / Objective Findings</label>
                            <textarea rows={2} className="w-full border border-opd-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-opd-primary"
                                placeholder="e.g. BP 80/50 mmHg, SpO2 82%, RR 32/min"
                                value={detVitals} onChange={e => setDetVitals(e.target.value)} />
                        </div>
                    </>)}

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setStep(1)}
                            className="flex-1 py-2 border border-opd-border rounded-xl text-sm font-bold text-opd-text-secondary hover:bg-gray-50 transition">
                            ← Back
                        </button>
                        <button type="button" onClick={runReview} disabled={reviewing}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-opd-primary text-white text-sm font-bold rounded-xl hover:opacity-95 transition disabled:opacity-50 shadow-sm">
                            {reviewing ? <><Loader2 className="w-4 h-4 animate-spin" /> Reviewing…</> : 'Run AI Review →'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 3: Review Results ───────────────────────────────────── */}
            {step === 3 && report && (
                <div className="space-y-3 text-sm">
                    {/* Status badge */}
                    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                        report.status === 'sufficient'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                        {report.status === 'sufficient'
                            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                            : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span className="font-bold text-sm">
                            {report.status === 'sufficient' ? 'Sufficient — ready to submit' : 'Pending Documents'}
                        </span>
                    </div>

                    {/* Gaps */}
                    {report.gaps?.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-red-700">Documentation Gaps ({report.gaps.length})</div>
                            {report.gaps.map((g: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                                    <span className="leading-snug">{g}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Anticipated queries */}
                    {report.anticipatedQueries?.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Anticipated TPA Queries ({report.anticipatedQueries.length})</div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
                                {report.anticipatedQueries.map((q: any, i: number) => (
                                    <div key={i} className="border border-opd-border rounded-lg px-3 py-2 bg-white space-y-0.5 text-sm">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wide ${
                                                q.severity === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                                                q.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                {q.severity}
                                            </span>
                                            <span className="font-semibold text-opd-text-primary leading-snug">{q.query}</span>
                                        </div>
                                        <div className="text-[9px] text-opd-text-muted">{q.reason}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Required evidence checklist */}
                    {report.requiredEvidence?.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-opd-text-secondary">Required Evidence</div>
                            {report.requiredEvidence.map((ev: string, i: number) => {
                                const sufficient = !report.insufficientEvidence?.includes(ev);
                                return (
                                    <div key={i} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 border ${
                                        sufficient ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                        {sufficient ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                                        <span className="leading-snug">{ev}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

                     <div className="space-y-2 pt-1">
                        {report.status === 'pending_documents' && (
                            <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-lg p-2.5 leading-relaxed">
                                ⚠️ Submission Blocked: Please upload the required clinical evidence documents to resolve validation gaps before requesting this enhancement.
                            </p>
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setStep(2)}
                                className="flex-1 py-2 border border-opd-border rounded-xl text-sm font-bold text-opd-text-secondary hover:bg-gray-50 transition">
                                ← Edit
                            </button>
                            {report.status === 'pending_documents' ? (
                                <button type="button" disabled
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-100 border border-red-200 text-red-500 text-sm font-bold rounded-xl cursor-not-allowed">
                                    <XCircle className="w-3.5 h-3.5" />
                                    Submission Blocked
                                </button>
                            ) : (
                                <button type="button" onClick={() => handleSubmit()} disabled={submitting}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-opd-primary text-white text-sm font-bold rounded-xl hover:opacity-95 transition disabled:opacity-50 shadow-sm">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Submit Enhancement
                                </button>
                            )}
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// QueryResponsePanel  (Step 6 wired into CaseWorkspace)
// ─────────────────────────────────────────────────────────────────────────────

interface QueryResponsePanelProps {
    record: PreAuthRecord;
    onSubmitted: () => void;
    onCancel: () => void;
}
const QueryResponsePanel: React.FC<QueryResponsePanelProps> = ({ record, onSubmitted, onCancel }) => {
    const [generating, setGenerating] = useState(false);
    const [responseText, setResponseText] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const text = await generateQueryResponse(record);
            setResponseText(text);
        } catch (err: any) {
            setToast({ msg: err.message, type: 'error' });
        } finally {
            setGenerating(false);
        }
    };

    const handleSubmit = async () => {
        if (!responseText.trim()) return;
        setSaving(true);
        try {
            await recordQueryResponse(record.id, record.id, 'pre_auth', responseText);
            setToast({ msg: 'Query response saved and marked submitted.', type: 'success' });
            setTimeout(() => onSubmitted(), 1200);
        } catch (err: any) {
            setToast({ msg: `Save failed: ${err.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-opd-border">
                <span className="text-sm font-bold font-lora text-opd-primary uppercase tracking-wider">Generate Query Response</span>
                <button type="button" onClick={onCancel} className="text-opd-text-muted hover:text-opd-primary text-sm font-bold">← Back</button>
            </div>

            {record.tpaResponse?.queryDetails && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1 text-amber-700">TPA Query</div>
                    <p className="leading-snug">{record.tpaResponse.queryDetails}</p>
                </div>
            )}

            {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

            {!responseText ? (
                <button type="button" onClick={handleGenerate} disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-opd-primary text-white text-sm font-bold rounded-xl hover:opacity-95 transition disabled:opacity-50 shadow-sm">
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Drafting letter…</> : <><FileText className="w-4 h-4" /> Draft Clarification Letter</>}
                </button>
            ) : (
                <>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Draft Response (editable)</label>
                            <button type="button" onClick={handleGenerate} disabled={generating}
                                className="text-[9px] font-bold text-opd-primary uppercase tracking-wider flex items-center gap-1 hover:opacity-80">
                                <RefreshCw className="w-2.5 h-2.5" /> Regenerate
                            </button>
                        </div>
                        <textarea rows={10} className="w-full border border-opd-border rounded-xl px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:border-opd-primary"
                            value={responseText} onChange={e => setResponseText(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => navigator.clipboard.writeText(responseText)}
                            className="flex-1 py-2 border border-opd-border rounded-xl text-sm font-bold text-opd-text-secondary hover:bg-gray-50 transition">
                            📋 Copy
                        </button>
                        <button type="button" onClick={handleSubmit} disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-opd-primary text-white text-sm font-bold rounded-xl hover:opacity-95 transition disabled:opacity-50 shadow-sm">
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Send className="w-3.5 h-3.5" /> Submit Response</>}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface CaseWorkspaceProps {
    record: PreAuthRecord;
    onBack: () => void;
}

type RailView = 'default' | 'tpa_response' | 'enhancement' | 'query_response';

export const CaseWorkspace: React.FC<CaseWorkspaceProps> = ({ record: initialRecord, onBack }) => {
    const [record, setRecord] = useState(initialRecord);
    const [tpaReport, setTpaReport] = useState<ExtendedEvidenceReviewReport | null>(
        record.tpaEvidenceReview ?? null
    );
    const [tpaLoading, setTpaLoading]       = useState(!record.tpaEvidenceReview);
    const [billingOutput, setBillingOutput] = useState<BillingCodingOutput | null>(null);
    const [billingLoading, setBillingLoading] = useState(false);
    const [caseRecord, setCaseRecord]       = useState<PatientCaseRecord | null>(null);
    const [railView, setRailView]           = useState<RailView>('default');
    const [submitting, setSubmitting]       = useState(false);
    const [subToast, setSubToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const refreshCaseRecord = useCallback(async () => {
        const r = await getPatientRecord(record.id);
        if (r) setCaseRecord(r);
    }, [record.id]);

    useEffect(() => { refreshCaseRecord(); }, [refreshCaseRecord]);

    const selectedDx    = record.clinical?.diagnoses?.[record.clinical.selectedDiagnosisIndex ?? 0];
    const diagnosisText = selectedDx?.diagnosis ?? '—';
    const icdCode       = selectedDx?.icd10Code ?? '';

    // Load TPA review if not cached
    useEffect(() => {
        if (record.tpaEvidenceReview) return;
        let alive = true;
        setTpaLoading(true);
        priorAuthOrchestrator(record.uploadedDocuments || [], record)
            .then(r => { if (alive) setTpaReport(r); })
            .catch(e => console.error('[CaseWorkspace] TPA review error:', e))
            .finally(() => { if (alive) setTpaLoading(false); });
        return () => { alive = false; };
    }, [record]);

    // Run billing coder
    useEffect(() => {
        if (!diagnosisText || diagnosisText === '—' || billingOutput || billingLoading) return;
        let alive = true;
        setBillingLoading(true);
        const clinicalNote = [
            diagnosisText,
            record.clinical?.chiefComplaints ?? '',
            record.clinical?.historyOfPresentIllness ?? '',
            record.clinical?.relevantClinicalFindings ?? '',
        ].join('. ');

        const input: BillingInput = {
            clinicalNote,
            insurerName: record.insurance?.insurerName ?? 'Unknown',
            sumInsured:  record.insurance?.sumInsured ?? 500000,
            wardType: (['ICU','ICCU','NICU'].includes(record.admission?.roomCategory ?? '') ? 'ICU'
                : record.admission?.roomCategory === 'General Ward' ? 'General'
                : record.admission?.roomCategory === 'Semi-Private' ? 'Semi-Private'
                : 'Private') as BillingInput['wardType'],
            requestedAmount: record.costEstimate?.totalEstimatedCost ?? 0,
            resolvedICD10: icdCode,
        };

        runBillingCodingWorkflow(input)
            .then(o => { if (alive) setBillingOutput(o); })
            .catch(e => console.error('[CaseWorkspace] Billing error:', e))
            .finally(() => { if (alive) setBillingLoading(false); });
        return () => { alive = false; };
    }, [diagnosisText]);

    const eligibility: 'cashless' | 'reimbursement' | 'needs_verification' = (() => {
        if (!record.insurance?.policyNumber) return 'needs_verification';
        const cashlessApproved = billingOutput?.cashlessApproved ?? 0;
        const total = record.costEstimate?.totalEstimatedCost ?? 0;
        if (total === 0 || !billingOutput) return 'needs_verification';
        if (billingOutput.scrubbingStatus === 'Warnings' && (billingOutput.validationWarnings?.length ?? 0) > 2) return 'reimbursement';
        if (cashlessApproved > 0) return 'cashless';
        return 'needs_verification';
    })();

    const eligCfg = ELIG_CONFIG[eligibility];
    const { score, missingItems, hasInvalidICD, docsUploaded, docsRequired } = computeReadiness(record, tpaReport);
    const colors     = scoreColorClass(score);
    const statusLine = readinessStatusLine(score, missingItems.length);

    const evidenceHighlights: any[] = (tpaReport as any)?.evidenceHighlights ?? [];
    const supportHighlights   = evidenceHighlights.filter(h => h.supportsOrContradicts === 'supports');
    const contradictHighlights = evidenceHighlights.filter(h => h.supportsOrContradicts !== 'supports');

    const suggestedCodes: Array<{ code: string; description: string; cost?: number; confidence: 'high' | 'medium' | 'low' }> = [];
    if (billingOutput) {
        if (billingOutput.primaryICD10)
            suggestedCodes.push({ code: billingOutput.primaryICD10, description: billingOutput.primaryDescription, confidence: 'high' });
        (billingOutput.secondaryICD10 ?? []).forEach(s => suggestedCodes.push({ code: s.code, description: s.description, confidence: 'medium' }));
        (billingOutput.suggestedCPT ?? []).forEach(c => suggestedCodes.push({ code: c.code, description: c.description, cost: c.estimatedRate, confidence: 'medium' }));
    } else if (icdCode && !hasInvalidICD) {
        suggestedCodes.push({ code: icdCode, description: selectedDx?.icd10Description || diagnosisText, cost: record.costEstimate?.totalEstimatedCost, confidence: 'high' });
    }

    const isPostSubmission = ['submitted','approved','denied','query_raised','query_received','partial_approved','enhancement_requested'].includes(record.status);
    const canEnhance       = isPostSubmission;
    const canQueryResponse = record.status === 'query_raised';
    const isDenied         = record.status === 'denied';

    // Timeline sorted newest-first from caseRecord
    const timelineEvents = [...(caseRecord?.timeline ?? [])].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 15);

    const TIMELINE_ICONS: Record<string, React.ReactNode> = {
        created:                 <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
        updated:                 <RefreshCw className="w-3 h-3 text-blue-500" />,
        authorization_recorded:  <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
        enhancement_requested:   <Send className="w-3 h-3 text-opd-primary" />,
        query_response_sent:     <FileText className="w-3 h-3 text-purple-600" />,
        appeal_saved:            <AlertCircle className="w-3 h-3 text-red-500" />,
    };

    const handleSubmitToTpa = async () => {
        setSubmitting(true);
        setSubToast(null);
        try {
            const res = await submitPreAuthToTPA(record);
            if (res.success && res.receiptId) {
                if (record.tpaEvidenceReview?.status === 'insufficient')
                    logFeedbackEvent(record.id, 'submitted_insufficient', {
                        diagnosis: selectedDx?.diagnosis
                    });
                const updated = {
                    ...record,
                    status: 'submitted' as const,
                    updatedAt: new Date().toISOString(),
                    outputs: { ...(record.outputs ?? {}), tpaReceiptId: res.receiptId },
                };
                await savePreAuth(updated as PreAuthRecord);
                logStageTimestamp(record.id, 'submitted');
                setRecord(updated as PreAuthRecord);
                setSubToast({ msg: `Submitted ✓ Receipt: ${res.receiptId}`, type: 'success' });
            } else {
                setSubToast({ msg: res.error || 'No confirmation receipt returned.', type: 'error' });
                logStageTimestamp(record.id, 'submission_unconfirmed');
            }
        } catch (err: any) {
            setSubToast({ msg: err.message || 'Network gateway timeout.', type: 'error' });
            logStageTimestamp(record.id, 'submission_unconfirmed');
        } finally {
            setSubmitting(false);
        }
    };

    // ── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full min-h-screen bg-opd-bg text-opd-text-primary">

            {/* ── Header bar ──────────────────────────────────────────────── */}
            <div className="shrink-0 border-b border-opd-border bg-white px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
                <button type="button" onClick={onBack}
                    className="flex items-center gap-1.5 text-sm font-semibold text-opd-text-secondary hover:text-opd-primary transition-all px-3 py-1.5 rounded-lg border border-opd-border bg-opd-input-bg">
                    <ArrowLeft className="w-3 h-3" />
                    Case List
                </button>
                <div className="w-px h-4 bg-opd-border shrink-0" />
                <div className="flex items-center gap-3 flex-1 flex-wrap min-w-0">
                    <span className="font-mono text-sm text-opd-primary font-bold shrink-0">{record.id}</span>
                    <span className="text-sm font-semibold text-opd-text-primary truncate">{record.patient?.patientName || '—'}</span>
                    <div className="w-px h-3 bg-opd-border shrink-0" />
                    <span className="text-sm text-opd-text-secondary truncate max-w-[200px]">{diagnosisText}</span>
                    {icdCode && !hasInvalidICD && (
                        <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">{icdCode}</span>
                    )}
                </div>
                <StatusPill score={score} />
            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* ── LEFT: Documents + Evidence + Enhancement Ledger ─────── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

                    {/* Submit to TPA banner (if ready) */}
                    {(record.status === 'ready_to_submit' || record.status === 'draft') && (
                        <div className="space-y-2">
                            {subToast && <Toast msg={subToast.msg} type={subToast.type} onDismiss={() => setSubToast(null)} />}
                            <button type="button" onClick={handleSubmitToTpa} disabled={submitting}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-opd-primary text-white font-bold text-sm rounded-xl hover:opacity-95 transition disabled:opacity-50 shadow-sm">
                                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : '📤 Mark as Submitted to TPA'}
                            </button>
                        </div>
                    )}

                    {/* Uploaded documents */}
                    <section>
                        <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary border-b border-opd-border pb-2 mb-3">
                            Uploaded Documents ({record.uploadedDocuments?.length ?? 0})
                        </div>
                        {(record.uploadedDocuments?.length ?? 0) === 0 ? (
                            <div className="text-sm text-opd-text-muted font-medium py-4 text-center border border-dashed border-opd-border rounded-xl bg-white">
                                No documents uploaded
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {record.uploadedDocuments.map(doc => (
                                    <div key={doc.id}
                                        className="flex items-center gap-3 rounded-xl border border-opd-border bg-white px-3 py-2.5 shadow-sm text-opd-text-primary">
                                        <span className="text-base shrink-0">{doc.fileType === 'pdf' ? '📄' : '🖼️'}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-opd-text-primary truncate">{doc.fileName}</div>
                                            <div className="text-[9px] text-opd-text-secondary font-medium">{doc.documentCategory.replace(/_/g, ' ')} · {doc.fileSizeDisplay}</div>
                                            {doc.duplicateWarning  && <div className="text-[9px] text-opd-error font-bold mt-0.5">{doc.duplicateWarning}</div>}
                                            {doc.expiryWarning     && <div className="text-[9px] text-opd-error font-bold mt-0.5">{doc.expiryWarning}</div>}
                                            {doc.readabilityWarning && <div className="text-[9px] text-amber-600 font-bold mt-0.5">{doc.readabilityWarning}</div>}
                                        </div>
                                        {doc.readabilityConfidence != null && (
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                                                doc.readabilityConfidence < 70
                                                    ? 'bg-red-50 border-red-200 text-red-700 font-extrabold animate-pulse'
                                                    : doc.readabilityConfidence >= 80
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                    : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                                {doc.readabilityConfidence < 70 ? '⚠️ Needs Manual Check' : `OCR ${doc.readabilityConfidence}%`}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Evidence highlights */}
                    <section>
                        <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary border-b border-opd-border pb-2 mb-3">
                            Evidence Highlights
                            {tpaLoading && <span className="ml-2 text-opd-text-muted normal-case font-normal">— running review…</span>}
                        </div>
                        {tpaLoading ? (
                            <div className="flex items-center gap-2 py-6 px-3">
                                <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="pulse-dot inline-block w-1 h-1 rounded-full bg-opd-primary" />)}</div>
                                <span className="text-sm text-opd-text-secondary font-medium">Running Aivana review…</span>
                            </div>
                        ) : evidenceHighlights.length === 0 ? (
                            <div className="text-sm text-opd-text-muted font-medium py-4 text-center border border-dashed border-opd-border rounded-xl bg-white">
                                {record.uploadedDocuments?.length
                                    ? 'No evidence highlights extracted.'
                                    : 'Upload documents for AI evidence extraction.'}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {supportHighlights.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Supporting Evidence ({supportHighlights.length})</div>
                                        {supportHighlights.map((h, i) => <HighlightCard key={`sup-${i}`} {...h} supportsOrContradicts="supports" />)}
                                    </div>
                                )}
                                {contradictHighlights.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-red-700">Gaps & Contradictions ({contradictHighlights.length})</div>
                                        {contradictHighlights.map((h, i) => <HighlightCard key={`con-${i}`} {...h} supportsOrContradicts="contradicts" />)}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Enhancement Ledger — Step 8: extended with reviewEngineReport */}
                    {caseRecord && (
                        <section className="bg-white border border-opd-border rounded-2xl p-4 space-y-4 shadow-sm text-left">
                            <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary border-b border-opd-border pb-2.5 flex justify-between items-center">
                                <span>Enhancements ({caseRecord.enhancements?.length || 0})</span>
                                {canEnhance && (
                                    <button type="button" onClick={() => setRailView('enhancement')}
                                        className="px-2.5 py-1.5 bg-opd-primary text-white text-sm font-bold rounded-lg hover:bg-opd-primary/95 transition border uppercase tracking-wider">
                                        + Request
                                    </button>
                                )}
                            </div>
                            {(!caseRecord.enhancements || caseRecord.enhancements.length === 0) ? (
                                <p className="text-sm text-opd-text-muted italic py-3 text-center bg-gray-50/50 rounded-xl border border-dashed">
                                    No enhancements requested for this case.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {caseRecord.enhancements.map(enh => (
                                        <EnhancementCard key={enh.id} enh={enh} />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* ── RIGHT RAIL ─────────────────────────────────────────── */}
                <aside className="hidden lg:flex flex-col w-[300px] shrink-0 overflow-y-auto border-l border-opd-border bg-white px-4 py-5 gap-5 custom-scrollbar shadow-sm">

                    {/* Slide-in panels */}
                    {railView === 'tpa_response' && (
                        <TpaResponsePanel
                            record={record}
                            onSaved={updated => { setRecord(updated); setRailView('default'); refreshCaseRecord(); }}
                            onCancel={() => setRailView('default')}
                        />
                    )}
                    {railView === 'enhancement' && (
                        <EnhancementRequestPanel
                            record={record}
                            onSubmitted={_ => { setRailView('default'); refreshCaseRecord(); }}
                            onCancel={() => setRailView('default')}
                        />
                    )}
                    {railView === 'query_response' && (
                        <QueryResponsePanel
                            record={record}
                            onSubmitted={() => { setRailView('default'); refreshCaseRecord(); }}
                            onCancel={() => setRailView('default')}
                        />
                    )}

                    {railView === 'default' && (<>

                        {/* (a) Readiness score */}
                        <section>
                            <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary pb-2.5 border-b border-opd-border mb-3">Claim Readiness</div>
                            <div className="rounded-xl p-4 bg-opd-input-bg border border-opd-border flex flex-col items-center gap-2.5 shadow-sm">
                                <ScoreRing score={score} />
                                <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider border ${colors.bg} ${colors.text} ${colors.border}`}>{colors.label}</span>
                                <p className="text-sm text-center font-medium text-opd-text-secondary leading-normal max-w-[200px]">{statusLine}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1 justify-center">
                                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${docsUploaded >= docsRequired ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        {docsUploaded >= docsRequired ? '✓' : '✗'} Docs {docsUploaded}/{docsRequired}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${!hasInvalidICD ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        {!hasInvalidICD ? '✓' : '✗'} ICD-10
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* (b) Missing items */}
                        {missingItems.length > 0 && (
                            <section>
                                <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary pb-2.5 border-b border-opd-border mb-3">What to Fix ({missingItems.length})</div>
                                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-0.5">
                                    {missingItems.slice(0, 8).map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-2 rounded-lg p-2.5 border border-opd-border bg-white shadow-sm">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-opd-text-secondary leading-normal">{item.text}</div>
                                            </div>
                                            <span className="text-[9px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded shrink-0">-{item.deduction}</span>
                                        </div>
                                    ))}
                                    {missingItems.length > 8 && (
                                        <p className="text-sm text-center text-opd-text-muted font-medium">+{missingItems.length - 8} more</p>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* (c) Billing codes */}
                        <section>
                            <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary pb-2.5 border-b border-opd-border mb-3">Billing Codes & Cost</div>
                            {billingLoading ? (
                                <div className="flex items-center gap-2 py-3">
                                    <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="pulse-dot inline-block w-1 h-1 rounded-full bg-opd-primary" />)}</div>
                                    <span className="text-sm text-opd-text-secondary font-medium">Running billing coder…</span>
                                </div>
                            ) : suggestedCodes.length === 0 ? (
                                <div className="text-sm text-opd-text-muted font-medium py-3 text-center border border-dashed border-opd-border rounded-xl bg-white">
                                    No codes available — add a diagnosis.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {suggestedCodes.slice(0, 6).map((c, i) => (
                                        <IcdTag key={i} code={c.code} description={c.description} estimatedCost={c.cost} confidence={c.confidence} />
                                    ))}
                                    {billingOutput?.cashlessApproved != null && (
                                        <div className="mt-2 rounded-lg border border-opd-border bg-opd-input-bg px-3 py-2.5 flex justify-between items-center shadow-sm">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-opd-text-secondary">Cashless Approved Est.</span>
                                            <span className="font-mono text-sm font-bold text-emerald-700">₹{billingOutput.cashlessApproved.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    {billingOutput?.patientShare != null && (
                                        <div className="rounded-lg border border-opd-border bg-opd-input-bg px-3 py-2.5 flex justify-between items-center shadow-sm">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-opd-text-secondary">Patient Share Est.</span>
                                            <span className="font-mono text-sm font-bold text-amber-700">₹{billingOutput.patientShare.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    {(billingOutput?.validationWarnings?.length ?? 0) > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                            {billingOutput!.validationWarnings.slice(0,3).map((w, i) => (
                                                <div key={i} className="text-[9px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">⚠ {w}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* (d) Eligibility */}
                        <section>
                            <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary pb-2.5 border-b border-opd-border mb-3">Eligibility Status</div>
                            <div className={`rounded-xl border px-4 py-3.5 flex items-center gap-3 shadow-sm ${eligCfg.bg} ${eligCfg.border}`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border ${eligCfg.text} ${eligCfg.border}`}>{eligCfg.icon}</span>
                                <div>
                                    <div className={`text-sm font-bold ${eligCfg.text}`}>{eligCfg.label}</div>
                                    <div className="text-[9px] text-opd-text-secondary font-medium mt-0.5">
                                        {eligibility === 'cashless' ? 'Claim can be processed as cashless'
                                            : eligibility === 'reimbursement' ? 'Patient to pay upfront; submit for reimbursement'
                                            : 'Policy / billing data insufficient for determination'}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* (e) Case Actions — NEW */}
                        <section>
                            <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary pb-2.5 border-b border-opd-border mb-3">Case Actions</div>
                            <div className="flex flex-col gap-2">
                                {isPostSubmission && (
                                    <button type="button" onClick={() => setRailView('tpa_response')}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-opd-border bg-opd-input-bg hover:border-opd-primary hover:bg-white text-sm font-semibold text-opd-text-primary transition group">
                                        <div className="flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-blue-500" />Log TPA Response</div>
                                        <ChevronRight className="w-3.5 h-3.5 text-opd-text-muted group-hover:text-opd-primary" />
                                    </button>
                                )}
                                {canEnhance && (
                                    <button type="button" onClick={() => setRailView('enhancement')}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-opd-border bg-opd-input-bg hover:border-opd-primary hover:bg-white text-sm font-semibold text-opd-text-primary transition group">
                                        <div className="flex items-center gap-2"><BedDouble className="w-3.5 h-3.5 text-purple-500" />Request Enhancement</div>
                                        <ChevronRight className="w-3.5 h-3.5 text-opd-text-muted group-hover:text-opd-primary" />
                                    </button>
                                )}
                                {canQueryResponse && (
                                    <button type="button" onClick={() => setRailView('query_response')}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:border-amber-400 text-sm font-semibold text-amber-800 transition group">
                                        <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" />Generate Query Response</div>
                                        <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600" />
                                    </button>
                                )}
                                {isDenied && (
                                    <div className="text-[9px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 leading-snug font-semibold">
                                        ⚖ Case denied. Use the <strong>Ops Tools → Denial Queue</strong> to generate a citation-backed appeal letter.
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* (f) Timeline — NEW */}
                        <section>
                            <div className="text-sm font-bold font-lora uppercase tracking-wider text-opd-text-secondary pb-2.5 border-b border-opd-border mb-3">
                                Case Timeline ({timelineEvents.length})
                            </div>
                            {timelineEvents.length === 0 ? (
                                <div className="text-sm text-opd-text-muted italic py-3 text-center border border-dashed border-opd-border rounded-xl">
                                    No events yet
                                </div>
                            ) : (
                                <div className="relative pl-4 space-y-3">
                                    <div className="absolute left-1.5 top-1 bottom-1 w-px bg-opd-border" />
                                    {timelineEvents.map((ev, i) => (
                                        <div key={i} className="relative flex gap-2 items-start">
                                            <div className="absolute -left-[15px] top-0.5 w-5 h-5 rounded-full bg-white border border-opd-border flex items-center justify-center shrink-0">
                                                {TIMELINE_ICONS[ev.event] ?? <Clock className="w-3 h-3 text-opd-text-muted" />}
                                            </div>
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="text-[9px] font-mono text-opd-text-muted">
                                                    {new Date(ev.timestamp).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                                                </div>
                                                <div className="text-sm font-semibold text-opd-text-primary capitalize leading-snug">
                                                    {ev.event.replace(/_/g, ' ')}
                                                </div>
                                                <div className="text-[10px] text-opd-text-secondary leading-snug line-clamp-2">{ev.description}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                    </>)}
                </aside>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Enhancement Card — Step 8: shows reviewEngineReport, approvedAmount, gaps
// ─────────────────────────────────────────────────────────────────────────────

function EnhancementCard({ enh }: { enh: EnhancementEntry }) {
    const [expanded, setExpanded] = useState(false);
    const engineStatus = enh.reviewEngineReport?.status;

    return (
        <div className="border border-opd-border rounded-xl p-3 bg-gray-50/50 space-y-2 text-sm">
            <div className="flex justify-between items-center">
                <span className="font-bold text-opd-primary font-mono text-sm">{enh.id}</span>
                <div className="flex items-center gap-1.5">
                    {engineStatus && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border tracking-wide ${
                            engineStatus === 'sufficient' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            AI: {engineStatus === 'sufficient' ? '✓ OK' : '⚠ Gaps'}
                        </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border tracking-wide ${
                        enh.status === 'approved'         ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        enh.status === 'partial_approved' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        enh.status === 'pending_documents'? 'bg-red-50 border-red-200 text-red-700' :
                        'bg-blue-50 border-blue-200 text-blue-700'}`}>
                        {enh.status.replace(/_/g, ' ')}
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[8px]">Trigger: </span>
                    <span className="font-bold text-opd-text-primary capitalize">{enh.trigger.replace(/_/g, ' ')}</span>
                </div>
                <div>
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[8px]">Requested: </span>
                    <span className="font-mono font-bold text-opd-text-primary">₹{enh.requestedAmount.toLocaleString('en-IN')}</span>
                </div>
                {enh.approvedAmount != null && (
                    <div className="col-span-2">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[8px]">Approved: </span>
                        <span className="font-mono font-bold text-emerald-700">₹{enh.approvedAmount.toLocaleString('en-IN')}</span>
                    </div>
                )}
            </div>

            {/* Expandable review report */}
            {enh.reviewEngineReport && (
                <button type="button" onClick={() => setExpanded(v => !v)}
                    className="text-[9px] font-bold text-opd-primary uppercase tracking-wider flex items-center gap-1 hover:opacity-80 mt-1">
                    <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    {expanded ? 'Hide' : 'View'} AI Review Report
                </button>
            )}
            {expanded && enh.reviewEngineReport && (
                <div className="border border-opd-border rounded-lg p-2.5 bg-white space-y-2 text-xs">
                    {enh.reviewEngineReport.gaps?.length > 0 && (
                        <div>
                            <div className="font-bold text-red-700 uppercase tracking-wider text-[8px] mb-1">Gaps</div>
                            {enh.reviewEngineReport.gaps.map((g, i) => <div key={i} className="text-red-800 bg-red-50 rounded px-2 py-1 mb-0.5">{g}</div>)}
                        </div>
                    )}
                    {enh.reviewEngineReport.anticipatedQueries?.length > 0 && (
                        <div>
                            <div className="font-bold text-amber-700 uppercase tracking-wider text-[8px] mb-1">Anticipated Queries</div>
                            {enh.reviewEngineReport.anticipatedQueries.slice(0,3).map((q: any, i: number) => (
                                <div key={i} className="text-opd-text-secondary border border-opd-border rounded px-2 py-1 mb-0.5 leading-snug">{q.query}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
