import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    PreAuthRecord, PatientRecord, InsurancePolicyDetails,
    ClinicalDetails, AdmissionDetails, CostEstimate, WizardState
} from './types';
import { WizardProgress } from './WizardProgress';
import { PatientInsuranceStep } from './PatientInsuranceStep';
import { ClinicalDetailsStep } from './ClinicalDetailsStep';
import { AdmissionCostStep } from './AdmissionCostStep';
import { DocumentsGenerateStep } from './DocumentsGenerateStep';
import { VoiceDictationMode } from './VoiceDictationMode';
import { ClaimReadinessRail } from './ClaimReadinessRail';
import { VoiceExtractedData } from '../../services/voiceDictationService';
import { savePreAuth, savePatient, generatePreAuthId, generatePatientId } from '../../services/storageService';
import { calculateTotals } from '../../utils/costCalculator';
import { calculateCost, findConditionByICD } from '../../services/costEstimationService';
import { classifyCaseComplexity } from '../../utils/complexityClassifier';
import { todayISO, nowTimeString } from '../../utils/formatters';
import { priorAuthOrchestrator, ExtendedEvidenceReviewReport as EvidenceReviewReport } from '../../engine/priorAuthWorkflow';
import { validateCode, mapToWhoCode, getDescription } from '../../services/icdService';


interface PreAuthWizardProps {
    onClose: () => void;
    existingRecord?: PreAuthRecord;
    prefilledData?: Partial<PreAuthRecord>;
    startAtStep?: 1 | 2 | 3 | 4;
    defaultTab?: 'docs' | 'necessity' | 'summary' | 'declarations' | 'tpa-review';
    isDemo?: boolean;
    onResetDemo?: () => void;
}

/**
 * Ensures no ICD-10 code that fails WHO table validation can live in the record.
 * Any unrecognised code is mapped to its WHO parent or reset to the 'Pending ICD-10' placeholder.
 */
const sanitizeDiagnoses = (record: Partial<PreAuthRecord>): Partial<PreAuthRecord> => {
    if (!record.clinical?.diagnoses) return record;
    const cleaned = record.clinical.diagnoses.map(dx => {
        const code = dx.icd10Code ?? '';
        const isPlaceholder = !code || code === 'Pending ICD-10' || code === 'Selection required';
        if (!isPlaceholder && !validateCode(code)) {
            const mapped = mapToWhoCode(code);
            if (mapped) {
                console.log(`[sanitizeDiagnoses] Mapping non-WHO code "${code}" -> valid WHO code "${mapped}"`);
                return {
                    ...dx,
                    icd10Code: mapped,
                    icd10Description: getDescription(mapped)
                };
            }
            console.warn(`[sanitizeDiagnoses] Rejecting unrecognised code "${code}" — resetting to Pending ICD-10`);
            return { ...dx, icd10Code: 'Pending ICD-10', icd10Description: 'Selection required', isSelected: dx.isSelected };
        }
        return dx;
    });
    return { ...record, clinical: { ...record.clinical, diagnoses: cleaned } };
};

const buildEmptyRecord = (): Partial<PreAuthRecord> => ({
    id: generatePreAuthId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    version: 1,
    createdBy: 'Insurance Desk',
    patient: {},
    insurance: { dataSource: 'manual' },
    clinical: {
        dataSource: 'manual_entry',
        diagnoses: [],
        selectedDiagnosisIndex: 0,
        proposedLineOfTreatment: { medical: false, surgical: false, intensiveCare: false, investigation: false, nonAllopathic: false },
        vitals: { bp: '', pulse: '', temp: '', spo2: '', rr: '' },
        voiceCapturedFindings: [],
        chiefComplaints: '',
        durationOfPresentAilment: '',
        natureOfIllness: 'Acute',
        historyOfPresentIllness: '',
        relevantClinicalFindings: '',
        treatmentTakenSoFar: '',
        reasonForHospitalisation: '',
        additionalClinicalNotes: '',
    },
    admission: {
        admissionType: 'Emergency',
        dateOfAdmission: todayISO(),
        timeOfAdmission: nowTimeString(),
        roomCategory: 'General Ward',
        expectedDaysInICU: 0,
        expectedDaysInRoom: 0,
        expectedLengthOfStay: 0,
        pastMedicalHistory: {
            diabetes: { present: false }, hypertension: { present: false }, heartDisease: { present: false },
            asthma: { present: false }, epilepsy: { present: false }, cancer: { present: false },
            kidney: { present: false }, liver: { present: false }, hiv: { present: false },
            alcoholism: { present: false }, smoking: { present: false }, anyOther: { present: false },
        },
        previousHospitalization: { wasHospitalizedBefore: false },
    },
    costEstimate: calculateTotals({}, 0),
    uploadedDocuments: [],
    documentRequirements: [],
    declarations: { patient: {}, doctor: {}, hospital: {} },
    outputs: {},
});

export const PreAuthWizard: React.FC<PreAuthWizardProps> = ({ 
    onClose, 
    existingRecord, 
    prefilledData,
    startAtStep = 1,
    defaultTab,
    isDemo = false,
    onResetDemo
}) => {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(startAtStep as any);
    const [showVoiceMode, setShowVoiceMode] = useState(false);
    // TPA report — hoisted here so the rail shows on all steps
    const [tpaReport, setTpaReport] = useState<EvidenceReviewReport | null>(null);
    const [tpaLoading, setTpaLoading] = useState(false);
    const tpaFetchKey = useRef<string>('');
    const [record, setRecord] = useState<Partial<PreAuthRecord>>(() => {
        if (existingRecord) return sanitizeDiagnoses(existingRecord);
        const empty = buildEmptyRecord();
        if (prefilledData) {
            const merged = {
                ...empty,
                ...prefilledData,
                patient: { ...empty.patient, ...prefilledData.patient },
                clinical: { ...empty.clinical, ...prefilledData.clinical },
                admission: { ...empty.admission, ...prefilledData.admission },
                costEstimate: prefilledData.costEstimate ?? empty.costEstimate,
            };
            return sanitizeDiagnoses(merged);
        }
        return empty;
    });

    const [saving, setSaving] = useState(false);

    // ── Fetch TPA review whenever the diagnosis or clinical data changes ─────
    useEffect(() => {
        const dx = record.clinical?.diagnoses?.[record.clinical.selectedDiagnosisIndex ?? 0]?.diagnosis ?? '';
        const key = `${dx}|${record.clinical?.chiefComplaints ?? ''}|${record.clinical?.relevantClinicalFindings ?? ''}`;
        if (key === tpaFetchKey.current) return; // no meaningful change
        tpaFetchKey.current = key;
        if (!dx) { setTpaReport(null); return; }
        let active = true;
        setTpaLoading(true);
        priorAuthOrchestrator(record.uploadedDocuments || [], record).then(report => {
            if (active) { setTpaReport(report); setTpaLoading(false); }
        }).catch(() => { if (active) setTpaLoading(false); });
        return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record.clinical?.diagnoses, record.clinical?.chiefComplaints, record.clinical?.relevantClinicalFindings, record.uploadedDocuments]);

    const updateRecord = useCallback(async (partial: Partial<PreAuthRecord>) => {
        const merged = { ...record, ...partial, updatedAt: new Date().toISOString() };
        const updated = sanitizeDiagnoses(merged);
        
        // Calculate Case Complexity on the fly
        const { complexity, reason } = classifyCaseComplexity(updated);
        const finalUpdated = { ...updated, complexity, complexityReason: reason };

        setRecord(finalUpdated);
        try { await savePreAuth(finalUpdated as PreAuthRecord); } catch (e) { /* silent */ }
    }, [record]);

    const handleNext = async () => {
        setSaving(true);
        await updateRecord({});
        setSaving(false);
        if (step < 4) setStep((step + 1) as any);
    };

    const handleBack = () => {
        if (step > 1) setStep((step - 1) as any);
    };

    const handleGenerate = async (irdaiText: string) => {
        const finalStatus = (record.uploadedDocuments ?? []).length === 0 ? 'pending_documents' : 'ready_to_submit';
        let tpaEvidenceReview = undefined;
        try {
            tpaEvidenceReview = await priorAuthOrchestrator(record.uploadedDocuments || [], record);
        } catch (err) {
            console.error("Failed to run TPA audit review on generate:", err);
        }
        await updateRecord({ status: finalStatus, outputs: { irdaiText }, tpaEvidenceReview });
        if (record.patient?.patientName) {
            const pat = { id: generatePatientId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...record.patient } as PatientRecord;
            await savePatient(pat);
        }
    };


    // ── Voice dictation: bulk-fill all sections, auto-calculate costs, jump to step 4 ──
    const handleVoiceComplete = async (data: VoiceExtractedData) => {
        const los = data.admission.expectedLengthOfStay ?? 0;
        const roomDays = data.admission.expectedDaysInRoom ?? los;
        const icuDays = data.admission.expectedDaysInICU ?? 0;

        // Build a smart cost estimate from the Gemini-extracted admission info
        let baseCost = calculateTotals({
            expectedRoomDays: roomDays,
            expectedIcuDays: icuDays,
        }, data.insurance.sumInsured ?? 0);

        // ✅ FIX: If voice extracted ICD code, auto-calculate costs from ICD database
        const voiceDx = data.clinical?.diagnoses?.[0];
        const voiceICD = voiceDx?.icd10Code;
        if (voiceICD) {
            const roomCat = data.admission.roomCategory ?? 'General Ward';
            const isPMJAY = data.insurance.policyType?.toLowerCase().includes('pmjay') ||
                data.insurance.policyType?.toLowerCase().includes('ayushman') || false;

            console.log(`[VoiceCostFix] Calculating costs from ICD DB: ${voiceICD}, room=${roomCat}, PMJAY=${isPMJAY}`);
            const est = calculateCost(voiceICD, roomCat, isPMJAY, los || undefined, icuDays || undefined);

            // Also fix LOS from ICD database if voice didn't capture it
            const icdCond = findConditionByICD(voiceICD);
            const finalLOS = los || (icdCond?.los.avg ?? 5);
            const finalICU = icuDays || (icdCond?.los.icu ?? 0);
            const finalWard = finalLOS - finalICU;

            baseCost = calculateTotals({
                roomRentPerDay: est.breakdown.room_rent / Math.max(1, est.los.ward_days),
                expectedRoomDays: finalWard,
                nursingChargesPerDay: est.breakdown.nursing_charges / Math.max(1, est.los.ward_days),
                icuChargesPerDay: finalICU > 0 ? est.breakdown.icu_charges / finalICU : 0,
                expectedIcuDays: finalICU,
                otCharges: est.breakdown.ot_charges,
                surgeonFee: est.breakdown.surgeon_fee,
                anesthetistFee: est.breakdown.anesthetist_fee,
                consultantFee: est.breakdown.consultant_fee,
                investigationsEstimate: est.breakdown.investigations,
                medicinesEstimate: est.breakdown.medicines,
                consumablesEstimate: est.breakdown.consumables,
                miscCharges: est.breakdown.miscellaneous,
                ...(est.source === 'PMJAY' && est.pmjay_details ? {
                    isPackageRate: true,
                    packageName: est.pmjay_details.package_name,
                    packageAmount: est.pmjay_details.package_rate,
                } : {}),
            }, data.insurance.sumInsured ?? 0);

            console.log(`[VoiceCostFix] Result: LOS=${finalLOS}, Total=₹${baseCost.totalEstimatedCost}`);
        }

        const merged: Partial<PreAuthRecord> = {
            ...record,
            patient: { ...record.patient, ...data.patient },
            insurance: { ...record.insurance, ...data.insurance, dataSource: 'manual' as const },
            clinical: {
                ...record.clinical,
                ...data.clinical,
                // ICD codes from voice are ALWAYS neutralised — user must confirm via ICD picker
                diagnoses: data.clinical?.diagnoses?.map((dx, idx) => ({
                    ...dx,
                    icd10Code: 'Pending ICD-10',
                    icd10Description: 'Selection required',
                    isSelected: idx === 0
                })) || []
            } as Partial<ClinicalDetails>,
            admission: {
                ...record.admission,
                ...data.admission,
                dateOfAdmission: record.admission?.dateOfAdmission ?? todayISO(),
                timeOfAdmission: record.admission?.timeOfAdmission ?? nowTimeString(),
            } as Partial<AdmissionDetails>,
            costEstimate: baseCost,
            updatedAt: new Date().toISOString(),
        };

        setSaving(true);
        const updated = { ...merged, updatedAt: new Date().toISOString() };
        setRecord(updated);
        try { await savePreAuth(updated as PreAuthRecord); } catch (e) { /**/ }
        setSaving(false);
        setShowVoiceMode(false);
        // Jump straight to Documents & Generate — all data is pre-filled
        setStep(4);
    };

    // ── Voice dictation overlay ─────────────────────────────────────────────────
    if (showVoiceMode) {
        return (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-opd-text-primary/45 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white border border-opd-border rounded-2xl w-full max-w-3xl my-8 mx-4 shadow-2xl overflow-hidden text-opd-text-primary">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-opd-border bg-opd-input-bg">
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-sm text-opd-text-primary font-lora">Voice Dictation</span>
                            <span className="font-mono text-xs px-2 py-0.5 bg-white border border-opd-border text-opd-text-secondary rounded-md select-all">{record.id}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {saving && (
                                <span className="text-[11px] text-opd-text-secondary flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 animate-spin text-opd-primary" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Saving...
                                </span>
                            )}
                            <button onClick={onClose} className="text-opd-text-secondary hover:text-opd-primary p-1 rounded-lg hover:bg-opd-bg transition-colors" type="button">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="px-6 py-6 bg-white">
                        <VoiceDictationMode
                            onComplete={handleVoiceComplete}
                            onCancel={() => setShowVoiceMode(false)}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-opd-text-primary/45 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white border border-opd-border rounded-2xl w-full max-w-5xl my-8 mx-4 shadow-2xl overflow-hidden flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-opd-border bg-opd-input-bg text-opd-text-primary">
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-opd-primary font-lora">New Pre-Authorization</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 bg-white border border-opd-border text-opd-text-secondary rounded-md select-all">{record.id}</span>
                        {record.complexity && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                record.complexity === 'Low' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                record.complexity === 'Medium' ? 'bg-sky-50 border-sky-200 text-sky-700' :
                                'bg-rose-50 border-rose-200 text-rose-700'
                            }`} title={record.complexityReason}>
                                {record.complexity} Complexity {record.complexity === 'Low' && '⚡ Fast-Track'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {saving && (
                            <span className="text-[10px] text-opd-text-secondary flex items-center gap-1.5 font-medium">
                                <svg className="w-3 h-3 animate-spin text-opd-primary" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Saving...
                            </span>
                        )}
                        <button onClick={onClose} className="text-opd-text-secondary hover:text-opd-primary p-1 rounded-lg hover:bg-opd-bg transition-colors" type="button">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Voice Dictation Banner — shown on step 1 */}
                {step === 1 && (
                    <div className="mx-6 mt-5 bg-primary-tint/30 border border-opd-primary/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary-tint flex items-center justify-center text-opd-primary shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-opd-primary flex items-center gap-1.5 font-lora">
                                    Voice Dictation
                                    <span className="text-[9px] uppercase tracking-wider bg-primary-tint text-opd-primary px-1.5 py-0.5 rounded font-extrabold font-sans border border-opd-primary/20">AI-Assistant</span>
                                </div>
                                <div className="text-[11px] text-opd-text-secondary mt-0.5">Speak patient notes to automatically populate clinical fields.</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowVoiceMode(true)}
                            className="btn-primary"
                            type="button">
                            Start Dictating
                        </button>
                    </div>
                )}

                {/* ── Two-column body: main content + persistent rail ── */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                    {/* ── Main content column ─────────────────────────── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                        {/* Progress Bar */}
                        <div className="px-6 pt-5 pb-3">
                            <WizardProgress currentStep={step} onStepClick={s => s < step && setStep(s)} />
                        </div>

                        {/* Step Content */}
                        <div className="px-6 pb-6 overflow-y-auto" style={{ flex: 1, minHeight: 500 }}>
                            {step === 1 && (
                                <PatientInsuranceStep
                                    patient={record.patient ?? {}}
                                    insurance={record.insurance ?? {}}
                                    onPatientChange={p => updateRecord({ patient: p })}
                                    onInsuranceChange={ins => updateRecord({ insurance: ins })}
                                    onNext={handleNext}
                                />
                            )}
                            {step === 2 && (
                                <ClinicalDetailsStep
                                    clinical={record.clinical ?? {}}
                                    caseId={record.id}
                                    doctorName={record.declarations?.doctor?.doctorName || 'Treating Doctor'}
                                    onClinicalChange={c => updateRecord({ clinical: c })}
                                    onNext={handleNext}
                                    onBack={handleBack}
                                    complexity={record.complexity}
                                />
                            )}
                            {step === 3 && (
                                <AdmissionCostStep
                                    admission={record.admission ?? {}}
                                    cost={record.costEstimate ?? {}}
                                    clinical={record.clinical ?? {}}
                                    sumInsured={record.insurance?.sumInsured ?? 0}
                                    onAdmissionChange={a => updateRecord({ admission: a })}
                                    onCostChange={c => updateRecord({ costEstimate: c })}
                                    onNext={handleNext}
                                    onBack={handleBack}
                                    complexity={record.complexity}
                                />
                            )}
                            {step === 4 && (
                                <DocumentsGenerateStep
                                    record={record}
                                    onRecordChange={r => updateRecord(r)}
                                    onBack={handleBack}
                                    onGenerate={handleGenerate}
                                    defaultTab={defaultTab}
                                    isDemo={isDemo}
                                    onResetDemo={onResetDemo}
                                    onJumpToStep={s => setStep(s)}
                                    externalTpaReport={tpaReport}
                                />
                            )}
                        </div>

                        {/* Mobile rail accordion — appears below step content */}
                        <ClaimReadinessRail
                            record={record}
                            tpaReport={tpaReport}
                            tpaLoading={tpaLoading}
                            onJumpToStep={s => setStep(s)}
                            mode="mobile"
                        />
                    </div>

                    {/* ── Persistent right rail (desktop ≥1024px) ────── */}
                    <ClaimReadinessRail
                        record={record}
                        tpaReport={tpaReport}
                        tpaLoading={tpaLoading}
                        onJumpToStep={s => setStep(s)}
                        mode="desktop"
                    />
                </div>
            </div>
        </div>
    );
};
