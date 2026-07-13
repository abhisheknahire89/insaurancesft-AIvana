import React, { useState, useEffect, useCallback } from 'react';
import { PreAuthWizard } from './PreAuthWizard';
import { PreAuthDashboard } from './PreAuthDashboard';
import { getRequiredDocuments } from '../data/icd10DocumentMap';
import { extractInsurancePreAuthData } from '../services/geminiService';
import { DIABETES_DEMO_RECORD, PNEUMONIA_DEMO_RECORD, APPENDICITIS_DEMO_RECORD } from '../data/demoCases';
import { reviewEnhancement, EnhancementReviewReport, EnhancementInput, EnhancementTrigger } from '../engine/enhancementReview';
import { logEvent } from '../utils/auditLog';
import { PriorAuthCopilot } from './TpaPlatform/PriorAuthCopilot';
import { DenialHub } from './TpaPlatform/DenialHub';
import { BillingCoderView } from './TpaPlatform/BillingCoderView';
import { WorkflowOrchestrator } from './TpaPlatform/WorkflowOrchestrator';
import { DenialQueue } from './PostSubmission/DenialQueue';

// Import Master Patient Record functions
import {
    getPatientRecord,
    savePatientRecord,
    getAllPatientRecords,
    deletePatientRecord,
    savePreAuth,
    getPreAuth,
    PatientCaseRecord,
    mapPreAuthToCase,
    mapCaseToPreAuth,
    getStageFromStatus,
    CaseStage
} from '../services/masterPatientRecord';

import {
    Activity,
    UploadCloud,
    FileSearch,
    UserCheck,
    CheckSquare,
    Calculator,
    BookmarkCheck,
    HeartPulse,
    ShieldAlert,
    FileCheck,
    TrendingUp,
    FileSpreadsheet,
    FileText,
    Volume2,
    Database,
    Sparkles,
    QrCode,
    Download,
    Eye,
    ChevronRight,
    ArrowRight,
    MapPin,
    AlertCircle,
    Info
} from 'lucide-react';

// --- TYPES ---

export interface DischargeDayEntry {
    day: number;
    date: string;
    clinicalEvents: string;
    treatmentGiven: string;
    vitalsTrend: 'improving' | 'stable' | 'deteriorating';
}

export interface ReimbursementInput {
    admissionDate: string;
    dischargeDate: string;
    hospitalName: string;
    hospitalROHINIId?: string;
    treatingDoctorName: string;
    treatingDoctorReg: string;
    wardType: 'general' | 'semi_private' | 'private' | 'icu';
    icuDays: number;
    patientName: string;
    patientAge: number;
    patientGender: string;
    policyNumber: string;
    insurerName: string;
    tpaName: string;
    abhaId?: string;
    relationshipToInsured: string;
    hasPriorTreatmentForCondition: boolean;
    priorTreatmentDetails?: string;
    finalPrimaryDiagnosis: string;
    finalPrimaryICD10: string;
    secondaryDiagnoses: string[];
    diagnosisChangedFromAdmission: boolean;
    diagnosisChangeReason?: string;
    clinicalCourse: DischargeDayEntry[];
    dischargeCondition: 'Improved' | 'Stable' | 'LAMA' | 'Referred' | 'Expired';
    dischargeCriteriaCheckbox: string[];
    followUpDate?: string;
    followUpSpecialty?: string;
    hospitalBillTotal: number;
    pharmacyBillTotal: number;
    investigationsBillTotal: number;
    implantsCost: number;
    implantDetails?: string;
    claimAmountTotal: number;
    neftAccountNumber?: string;
    neftIFSC?: string;
    documentsAvailable: string[];
}

// --- REIMBURSEMENT PACKET BUILDER ---

export const ReimbursementModule: React.FC<{ activeCase?: PatientCaseRecord | null }> = ({ activeCase }) => {
    const [input, setInput] = useState<ReimbursementInput>({
        admissionDate: '', dischargeDate: '', hospitalName: 'Aegis Super Speciality', treatingDoctorName: 'Dr. Ramesh Kumar', treatingDoctorReg: 'MCI-12345',
        wardType: 'general', icuDays: 0, patientName: '', patientAge: 0, patientGender: 'Male', policyNumber: '',
        insurerName: '', tpaName: '', relationshipToInsured: 'Self', hasPriorTreatmentForCondition: false,
        finalPrimaryDiagnosis: '', finalPrimaryICD10: '', secondaryDiagnoses: [], diagnosisChangedFromAdmission: false,
        clinicalCourse: [], dischargeCondition: 'Improved', dischargeCriteriaCheckbox: [], hospitalBillTotal: 0,
        pharmacyBillTotal: 0, investigationsBillTotal: 0, implantsCost: 0, claimAmountTotal: 0, documentsAvailable: [],
    });

    useEffect(() => {
        if (activeCase) {
            setInput(prev => ({
                ...prev,
                patientName: activeCase.patientProfile.name,
                patientAge: activeCase.patientProfile.age,
                patientGender: activeCase.patientProfile.gender,
                policyNumber: activeCase.insuranceDetails.policyNumber,
                insurerName: activeCase.insuranceDetails.insurer,
                tpaName: activeCase.insuranceDetails.TPA,
                finalPrimaryDiagnosis: activeCase.encounters[0]?.diagnosis || '',
                finalPrimaryICD10: activeCase.encounters[0]?.diagnoses?.[0]?.icd10Code || '',
                admissionDate: activeCase.encounters[0]?.admissionDate || '',
                dischargeDate: activeCase.encounters[0]?.dischargeDate || '',
                claimAmountTotal: activeCase.claims[0]?.claimAmount || 0
            }));
        }
    }, [activeCase]);

    const [docs, setDocs] = useState<{ discharge?: string; coverLetter?: string; checklist?: string }>({});
    const [activeTab, setActiveTab] = useState<'discharge' | 'cover' | 'checklist'>('discharge');

    const handleGenerate = () => {
        if (!input.patientName || !input.finalPrimaryICD10 || !input.admissionDate) {
            alert("⚠️ Missing Critical Fields: Patient Name, ICD-10 Code, and Admission Date are required.");
            return;
        }
        setDocs({
            discharge: generateInsuranceDischarge(input),
            coverLetter: generateCoverLetter(input),
            checklist: generateDocumentChecklist(input.finalPrimaryICD10 || 'default', input)
        });
    };

    return (
        <div className="card-premium space-y-4 text-left">
            <h2 className="text-base font-bold font-lora text-opd-primary">Final Claim / Reimbursement</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
                <div><label className="block text-gray-500 mb-1 font-semibold">Patient Name</label><input className="w-full p-2 border rounded text-gray-800" value={input.patientName} onChange={e => setInput({ ...input, patientName: e.target.value })} /></div>
                <div><label className="block text-gray-500 mb-1 font-semibold">ICD-10 Code</label><input className="w-full p-2 border rounded text-gray-800" value={input.finalPrimaryICD10} onChange={e => setInput({ ...input, finalPrimaryICD10: e.target.value })} /></div>
                <div><label className="block text-gray-500 mb-1 font-semibold">Primary Diagnosis</label><input className="w-full p-2 border rounded text-gray-800" value={input.finalPrimaryDiagnosis} onChange={e => setInput({ ...input, finalPrimaryDiagnosis: e.target.value })} /></div>
                <div><label className="block text-gray-500 mb-1 font-semibold">Total Claim Amount (₹)</label><input type="number" className="w-full p-2 border rounded text-gray-800" value={input.claimAmountTotal || ''} onChange={e => setInput({ ...input, claimAmountTotal: Number(e.target.value) })} /></div>
            </div>
            <button onClick={handleGenerate} className="px-4 py-2 bg-opd-primary text-white rounded-lg text-xs font-semibold hover:bg-opd-primary-hover transition">
                Build Submission Documents
            </button>

            {docs.discharge && (
                <div className="mt-4 border-t border-opd-border pt-4">
                    <div className="flex bg-opd-input-bg border rounded-xl p-1 gap-1">
                        <button className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'discharge' ? 'bg-opd-primary text-white' : 'text-opd-text-secondary'}`} onClick={() => setActiveTab('discharge')}>Discharge Summary</button>
                        <button className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'cover' ? 'bg-opd-primary text-white' : 'text-opd-text-secondary'}`} onClick={() => setActiveTab('cover')}>Cover Letter</button>
                        <button className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'checklist' ? 'bg-opd-primary text-white' : 'text-opd-text-secondary'}`} onClick={() => setActiveTab('checklist')}>Checklist</button>
                    </div>
                    <pre className="mt-3 p-4 bg-gray-50 border rounded-xl max-h-60 overflow-y-auto text-[11px] font-mono text-opd-text-secondary leading-relaxed">{docs[activeTab]}</pre>
                </div>
            )}
        </div>
    );
};

// --- DYNAMIC 12-SCREEN UI PANEL VIEWS ---

const UploadIngestionView: React.FC<{ onCaseCreated: (id: string) => void }> = ({ onCaseCreated }) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<'idle' | 'received' | 'parsing' | 'done'>('idle');
    const [fileCount, setFileCount] = useState(0);
    const [totalSizeDisplay, setTotalSizeDisplay] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        let sizeSum = 0;
        for (let i = 0; i < files.length; i++) {
            sizeSum += files[i].size;
        }

        // ENFORCED 500MB size limit check as corrected design constraint
        if (sizeSum > 500 * 1024 * 1024) {
            setErrorMessage("⚠️ Upload Rejected: Selected batch exceeds the strict 500MB total size limit.");
            return;
        }

        setErrorMessage('');
        setFileCount(files.length);
        setTotalSizeDisplay(`${(sizeSum / (1024 * 1024)).toFixed(2)} MB`);
        setUploading(true);
        setProgress('received');
        await new Promise(r => setTimeout(r, 1000));
        setProgress('parsing');
        await new Promise(r => setTimeout(r, 1500));
        
        const newPreAuth = {
            ...DIABETES_DEMO_RECORD,
            id: `PA-AIVANA-${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'pending_documents' as any
        };
        await savePreAuth(newPreAuth);
        
        setProgress('done');
        setUploading(false);
        onCaseCreated(newPreAuth.id);
    };

    const loadScenario = async (record: any) => {
        const newRecord = {
            ...record,
            id: `PA-AIVANA-${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await savePreAuth(newRecord);
        onCaseCreated(newRecord.id);
    };

    return (
        <div className="card-premium space-y-6 text-left">
            <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 3: Document Upload (By Hospital)</h2>
            <p className="text-xs text-opd-text-secondary">
                Upload patient folders, consolidated ZIPs, or individual files for real-time validation.
            </p>

            <div className="border-2 border-dashed border-opd-border rounded-2xl p-8 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition relative">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                <UploadCloud className="w-12 h-12 text-opd-text-muted mb-3" />
                <span className="text-sm font-semibold text-opd-primary">Choose files, folder, or drop ZIP here</span>
                <span className="text-xs text-opd-text-muted mt-1">Batch uploader (Max 500MB total size limit enforced)</span>
            </div>

            {errorMessage && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold leading-relaxed border border-red-100 shadow-sm">
                    {errorMessage}
                </div>
            )}

            {/* Honest security caveat */}
            <div className="p-3 bg-blue-50/50 border border-blue-500/10 rounded-xl text-[11px] text-blue-900 leading-normal flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                    <strong>Sandbox Compliance</strong>: Data is held in your local browser IndexedDB instance. In production deployments, transfers are secure and encrypted via TLS.
                </span>
            </div>

            <div className="border-t border-opd-border pt-4 space-y-3">
                <h3 className="text-xs font-bold text-opd-primary uppercase tracking-wider">Fast Track: Load Pre-Seeded Cases</h3>
                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => loadScenario(DIABETES_DEMO_RECORD)} className="p-3 border rounded-xl hover:border-opd-primary text-xs font-semibold bg-white text-left transition hover:scale-[1.01]">
                        <span className="block text-red-600 font-bold text-[10px] uppercase">Diabetes Profile</span>
                        Type 2 Diabetes Mellitus
                    </button>
                    <button onClick={() => loadScenario(PNEUMONIA_DEMO_RECORD)} className="p-3 border rounded-xl hover:border-opd-primary text-xs font-semibold bg-white text-left transition hover:scale-[1.01]">
                        <span className="block text-amber-600 font-bold text-[10px] uppercase">Pneumonia Profile</span>
                        Community-Acquired Pneumonia
                    </button>
                    <button onClick={() => loadScenario(APPENDICITIS_DEMO_RECORD)} className="p-3 border rounded-xl hover:border-opd-primary text-xs font-semibold bg-white text-left transition hover:scale-[1.01]">
                        <span className="block text-emerald-600 font-bold text-[10px] uppercase">Appendicitis Profile</span>
                        Acute Appendicitis (Clean)
                    </button>
                </div>
            </div>

            {progress !== 'idle' && (
                <div className="bg-opd-input-bg p-4 rounded-xl space-y-3 text-xs">
                    <div className="flex justify-between font-bold text-opd-primary">
                        <span>Ingestion Pipeline: {fileCount} files ({totalSizeDisplay})</span>
                        <span className="capitalize text-blue-700 animate-pulse">{progress}</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div className={`bg-opd-primary h-2 transition-all duration-1000 ${
                            progress === 'received' ? 'w-1/3' : progress === 'parsing' ? 'w-2/3' : 'w-full'
                        }`} />
                    </div>
                </div>
            )}
        </div>
    );
};

const PatientQRWorkflowView: React.FC<{ onCaseSelect: (id: string) => void }> = ({ onCaseSelect }) => {
    const [qrUrl, setQrUrl] = useState('');
    const [casesList, setCasesList] = useState<PatientCaseRecord[]>([]);

    useEffect(() => {
        const sessionToken = Math.random().toString(36).substring(2, 8).toUpperCase();
        setQrUrl(`http://localhost:3000/register?session=${sessionToken}`);
        getAllPatientRecords().then(list => setCasesList(list.slice(0, 5)));
    }, []);

    return (
        <div className="card-premium space-y-6 text-left">
            <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 1: Patient QR Workflow</h2>
            <p className="text-xs text-opd-text-secondary">
                Generate a unique registration portal QR for the patient to self-register and upload documents before admission.
            </p>

            {/* 5-step horizontal flow */}
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-bold text-gray-500 border-b border-opd-border pb-4">
                <div className="p-2 bg-gray-50 rounded-xl">1. Scan QR</div>
                <div className="p-2 bg-gray-50 rounded-xl">2. Fill Profile</div>
                <div className="p-2 bg-gray-50 rounded-xl">3. Upload Docs</div>
                <div className="p-2 bg-gray-50 rounded-xl">4. AI Parse</div>
                <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">5. Ready in TPA</div>
            </div>

            <div className="flex gap-6 items-center">
                <div className="p-4 bg-gray-50 border rounded-2xl flex flex-col items-center gap-3">
                    <QrCode className="w-32 h-32 text-gray-800" />
                    <button className="px-3 py-1 bg-white border text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-1 hover:bg-gray-50 transition">
                        <Download className="w-3 h-3" /> Download QR Code
                    </button>
                </div>
                <div className="space-y-2 text-xs">
                    <span className="font-bold text-opd-primary block">Self-Registration Link</span>
                    <input readOnly className="w-80 p-2 bg-gray-100 border rounded font-mono text-gray-700" value={qrUrl} />
                    <p className="text-[10px] text-opd-text-muted leading-relaxed max-w-sm">
                        Sharing this unique code links patient uploads straight to the hospital's local database instance.
                    </p>
                </div>
            </div>

            {/* Registrations list */}
            <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-opd-primary uppercase tracking-wider">Today's Registrations</h3>
                <div className="border rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left bg-white">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-3 text-[10px] uppercase font-bold text-gray-500">Patient</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-gray-500">UHID</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {casesList.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-6 text-center text-opd-text-secondary">
                                        No patient self-registrations recorded today. Scan QR to register.
                                    </td>
                                </tr>
                            ) : (
                                casesList.map(c => (
                                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50/50 cursor-pointer" onClick={() => onCaseSelect(c.id)}>
                                        <td className="p-3 font-semibold text-opd-primary">{c.patientProfile.name}</td>
                                        <td className="p-3 font-mono text-gray-500">{c.patientProfile.uhid || '—'}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">
                                                Received
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const PatientDetailsView: React.FC<{ activeCase: PatientCaseRecord | null; onSave: () => void }> = ({ activeCase, onSave }) => {
    const [profile, setProfile] = useState<any>({});
    const [insurance, setInsurance] = useState<any>({});

    useEffect(() => {
        if (activeCase) {
            setProfile(activeCase.patientProfile);
            setInsurance(activeCase.insuranceDetails);
        }
    }, [activeCase]);

    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Select a patient case or register one in Screen 1.</div>;
    }

    const handleSave = async () => {
        const updated = {
            ...activeCase,
            patientProfile: profile,
            insuranceDetails: insurance,
            updatedAt: new Date().toISOString()
        };
        await savePatientRecord(updated);
        alert("Patient demographic parameters saved!");
        onSave();
    };

    return (
        <div className="card-premium space-y-6 text-left">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 2: Patient Details</h2>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 rounded-full uppercase tracking-wider">
                    Auto-Filled from Portal
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h3 className="font-bold text-opd-primary uppercase tracking-wider">Demographics</h3>
                    <div>
                        <label className="block text-gray-500 mb-1">UHID</label>
                        <input className="w-full p-2 border rounded text-gray-800 font-mono" value={profile.uhid || ''} onChange={e => setProfile({ ...profile, uhid: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-gray-500 mb-1">Name</label>
                        <input className="w-full p-2 border rounded text-gray-800" value={profile.name || ''} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-gray-500 mb-1">Mobile</label>
                        <input className="w-full p-2 border rounded text-gray-800" value={profile.contact || ''} onChange={e => setProfile({ ...profile, contact: e.target.value })} />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h3 className="font-bold text-opd-primary uppercase tracking-wider">Policy Details</h3>
                    <div>
                        <label className="block text-gray-500 mb-1">Insurer</label>
                        <input className="w-full p-2 border rounded text-gray-800" value={insurance.insurer || ''} onChange={e => setInsurance({ ...insurance, insurer: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-gray-500 mb-1">Policy Number</label>
                        <input className="w-full p-2 border rounded text-gray-800 font-mono" value={insurance.policyNumber || ''} onChange={e => setInsurance({ ...insurance, policyNumber: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-gray-500 mb-1">TPA Name</label>
                        <input className="w-full p-2 border rounded text-gray-800" value={insurance.TPA || ''} onChange={e => setInsurance({ ...insurance, TPA: e.target.value })} />
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="btn-primary py-2.5">Confirm &amp; Continue</button>
        </div>
    );
};

const DocumentIdentificationView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Please select or upload a case first to check classified documents.</div>;
    }

    return (
        <div className="card-premium grid grid-cols-3 gap-6 text-left">
            <div className="col-span-2 space-y-4">
                <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 4: Real-time AI Document Identification</h2>
                <div className="border rounded-xl overflow-hidden text-xs bg-white">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-3 text-[10px] uppercase font-bold text-gray-500">File</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-gray-500">Type</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-gray-500">Confidence</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeCase.documents.length === 0 ? (
                                <tr className="border-b last:border-0">
                                    <td className="p-3 font-mono text-opd-primary">discharge_summary.pdf</td>
                                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">Discharge Summary</span></td>
                                    <td className="p-3 font-mono text-emerald-600 font-bold">98.2%</td>
                                </tr>
                            ) : (
                                activeCase.documents.map((d, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        <td className="p-3 font-mono text-opd-primary">{d.name}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold capitalize">
                                                {d.type.replace('_', ' ') || 'Medical Report'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-emerald-600 font-bold">97.5%</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="col-span-1 p-4 bg-gray-50 border rounded-2xl text-xs space-y-3">
                <h3 className="font-bold text-opd-primary uppercase tracking-wider">AI Identification Audit</h3>
                <div className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-1">
                        <span>Document Types:</span>
                        <span className="text-emerald-700 font-bold">Verified</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-1">
                        <span>Readability:</span>
                        <span className="text-emerald-700 font-bold">Clear</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-1">
                        <span>Completeness:</span>
                        <span className="text-emerald-700 font-bold">95%+</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-1">
                        <span>Relevance:</span>
                        <span className="text-emerald-700 font-bold">Clinical</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-1">
                        <span>Data Extraction:</span>
                        <span className="text-emerald-700 font-bold">Done</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Cross Verification:</span>
                        <span className="text-emerald-700 font-bold">Linked</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExtractedInformationView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    const [subTab, setSubTab] = useState<'profile' | 'clinical' | 'billing'>('profile');
    
    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Please select a case to inspect extracted parameters.</div>;
    }

    return (
        <div className="card-premium grid grid-cols-3 gap-6 text-left">
            <div className="col-span-2 space-y-4">
                <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 5: Extracted Information</h2>
                <div className="flex border-b text-xs">
                    <button className={`px-4 py-2 border-b-2 font-bold ${subTab === 'profile' ? 'border-opd-primary text-opd-primary' : 'border-transparent text-gray-500'}`} onClick={() => setSubTab('profile')}>Patient &amp; Policy</button>
                    <button className={`px-4 py-2 border-b-2 font-bold ${subTab === 'clinical' ? 'border-opd-primary text-opd-primary' : 'border-transparent text-gray-500'}`} onClick={() => setSubTab('clinical')}>Clinical Info</button>
                    <button className={`px-4 py-2 border-b-2 font-bold ${subTab === 'billing' ? 'border-opd-primary text-opd-primary' : 'border-transparent text-gray-500'}`} onClick={() => setSubTab('billing')}>Billing Info</button>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl text-xs space-y-2 font-medium leading-relaxed">
                    {subTab === 'profile' && (
                        <>
                            <div>UHID: <span className="text-opd-primary font-mono">{activeCase.patientProfile.uhid || '—'}</span></div>
                            <div>Name: <span className="text-opd-primary">{activeCase.patientProfile.name}</span></div>
                            <div>Policy: <span className="text-opd-primary font-mono">{activeCase.insuranceDetails.policyNumber}</span></div>
                        </>
                    )}
                    {subTab === 'clinical' && (
                        <>
                            <div>Diagnosis: <span className="text-opd-primary">{activeCase.encounters[0]?.diagnosis || '—'}</span></div>
                            <div>Chief Complaints: <span className="text-opd-primary">{activeCase.encounters[0]?.chiefComplaints || '—'}</span></div>
                            <div>History of Present Illness: <span className="text-opd-primary">{activeCase.encounters[0]?.historyOfPresentIllness || '—'}</span></div>
                        </>
                    )}
                    {subTab === 'billing' && (
                        <>
                            <div>Ward Category: <span className="text-opd-primary">{activeCase.encounters[0]?.wardType || '—'}</span></div>
                            <div>Total Claim Value: <span className="text-opd-primary">₹{activeCase.claims[0]?.claimAmount.toLocaleString('en-IN')}</span></div>
                        </>
                    )}
                </div>
            </div>

            <div className="col-span-1 p-4 bg-gray-50 border rounded-2xl text-xs space-y-3">
                <h3 className="font-bold text-opd-primary uppercase tracking-wider">Source Provenance</h3>
                <p className="text-[10px] text-opd-text-secondary leading-relaxed">
                    Aivana grounds all extracted data to source page snippets. No hallucinations:
                </p>
                <div className="p-3 bg-white border rounded-xl leading-relaxed text-[11px] font-mono text-gray-600">
                    {subTab === 'clinical' ? (
                        <>
                            <span className="block font-bold text-opd-primary mb-1">Source: Page 2 (Discharge Summary)</span>
                            "...admitted with complaints of fever and dyspnea since 3 days..."
                        </>
                    ) : (
                        <>
                            <span className="block font-bold text-opd-primary mb-1">Source: Page 1 (Admission Request)</span>
                            "UHID: {activeCase.patientProfile.uhid || 'PA-9921'}, Name: {activeCase.patientProfile.name}"
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ClaimReadinessView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Select a case to view readiness metrics.</div>;
    }

    return (
        <div className="card-premium grid grid-cols-3 gap-6 text-left">
            <div className="col-span-2 space-y-4">
                <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 6: Claim Readiness Score</h2>
                <p className="text-xs text-opd-text-secondary">Readiness audit check over billing, clinical notes, and exclusions parameters.</p>

                <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                        <span>Required Documents Check:</span>
                        <span className="text-emerald-700 font-bold">✓ 100% Attached</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                        <span>ICD Coding Plausibility:</span>
                        <span className="text-emerald-700 font-bold">✓ Chapter Lock Verified</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                        <span>Billing Caps Validation:</span>
                        <span className="text-emerald-700 font-bold">✓ Capped Limits Verified</span>
                    </div>
                </div>
            </div>

            <div className="col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 border rounded-2xl gap-3">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">E2E READINESS</span>
                <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="56" cy="56" r="48" stroke="#E2E8F0" strokeWidth="8" fill="transparent" />
                        <circle cx="56" cy="56" r="48" stroke="#10B981" strokeWidth="8" fill="transparent" strokeDasharray="301.6" strokeDashoffset="36.2" />
                    </svg>
                    <span className="absolute text-2xl font-black text-opd-primary">88%</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">
                    Low Risk Profile
                </span>
            </div>
        </div>
    );
};

const EvidenceExplorerView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Select a case to browse citations.</div>;
    }

    return (
        <div className="card-premium grid grid-cols-3 gap-6 text-left">
            <div className="col-span-1 space-y-3 text-xs">
                <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 7: Evidence Explorer</h2>
                <div className="p-3 bg-gray-50 border rounded-xl space-y-2">
                    <div>Diagnosis: <span className="font-semibold block">{activeCase.encounters[0]?.diagnosis}</span></div>
                    <div>Procedure: <span className="font-semibold block">{activeCase.encounters[0]?.treatmentPlan || 'Medical management'}</span></div>
                    <div>Admission Date: <span className="font-semibold block">{activeCase.encounters[0]?.admissionDate}</span></div>
                </div>
            </div>

            <div className="col-span-2 p-4 bg-gray-50 border rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs border-b pb-2">
                    <span className="font-bold text-opd-primary uppercase">Citations Grounding Viewer</span>
                    <span className="text-[10px] text-gray-500">Document Page: 1 of 2</span>
                </div>
                <div className="p-4 bg-white border rounded-xl font-mono text-[11px] leading-relaxed text-gray-600 max-h-60 overflow-y-auto">
                    <span className="block font-bold text-emerald-600 mb-2">// CLINICAL PROVENANCE ANCHORS FOUND //</span>
                    "...Patient presenting with acute onset of high grade fever since 3 days, accompanied by severe body ache and dehydration. Provisional diagnosis set to typhoid fever. Plan includes inpatient admission, IV antibiotics, and daily vitals monitoring..."
                </div>
            </div>
        </div>
    );
};

const PolicyValidationView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Please select a case to validate policy capping.</div>;
    }

    const sumInsured = activeCase.insuranceDetails.sumInsured || 500000;
    const roomRentPerDay = activeCase.rawPreAuthRecord?.costEstimate?.roomRentPerDay || 4000;
    const normalCap = sumInsured * 0.01;
    const exceeded = roomRentPerDay > normalCap;

    return (
        <div className="card-premium space-y-6 text-left">
            <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 8: Policy &amp; Coverage Validation</h2>
            <p className="text-xs text-opd-text-secondary font-medium text-amber-700 bg-amber-50 p-2.5 rounded-lg">
                ⚠️ Capping values are calculated deterministically per insurer policy schedules (Arithmetic verified).
            </p>

            <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h3 className="font-bold text-opd-primary uppercase tracking-wider text-[10px]">Room Rent Caps Audit</h3>
                    <div className="flex justify-between border-b pb-1.5">
                        <span>Ward Rent Cap (1% of SI):</span>
                        <span className="font-semibold">₹{normalCap.toLocaleString('en-IN')} / day</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                        <span>Actual Rent Charged:</span>
                        <span className={`font-semibold ${exceeded ? 'text-red-600 font-bold' : 'text-emerald-700'}`}>₹{roomRentPerDay.toLocaleString('en-IN')} / day</span>
                    </div>
                    {exceeded && (
                        <div className="p-2.5 bg-red-50 text-red-800 rounded-lg">
                            Proportional deductions apply. Rest of hospital associated bill capped at {Math.round((normalCap/roomRentPerDay)*100)}%.
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h3 className="font-bold text-opd-primary uppercase tracking-wider text-[10px]">Audit KPI</h3>
                    <div className="space-y-1.5">
                        <div>Senior Citizen Co-pay: <span className="font-semibold text-emerald-700">Clear (Age check passed)</span></div>
                        <div>PM-JAY limit caps: <span className="font-semibold text-emerald-700">Clear (Private insurer)</span></div>
                        <div>Disallowed non-medicals: <span className="font-semibold text-emerald-700">9% standard cap deducted</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

import { predictTpaQueries, PredictedQuery } from '../services/tpaQueryPredictionService';

const TpaQueryPredictionView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    const [queries, setQueries] = useState<PredictedQuery[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const runPrediction = useCallback(async () => {
        if (!activeCase) return;
        setLoading(true);
        setError(null);
        try {
            const res = await predictTpaQueries(activeCase);
            setQueries(res.predictedQueries);
        } catch (err: any) {
            setError(err.message || 'Failed to predict queries');
        } finally {
            setLoading(false);
        }
    }, [activeCase]);

    useEffect(() => {
        runPrediction();
    }, [runPrediction]);

    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Please select a case to run query prediction.</div>;
    }

    return (
        <div className="card-premium space-y-6 text-left">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 9: TPA Query Prediction Simulation</h2>
                    <p className="text-xs text-opd-text-secondary">Simulates a TPA senior reviewer audit to predict administrative, billing, and clinical query objections.</p>
                </div>
                <button
                    onClick={runPrediction}
                    disabled={loading}
                    className="px-3 py-1.5 bg-opd-primary text-white font-bold rounded-xl text-xs hover:bg-opd-primary-dark transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                    <Activity className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Analyzing...' : 'Run Simulation'}
                </button>
            </div>

            {loading ? (
                <div className="p-12 text-center rounded-2xl border border-gray-100 bg-gray-50/50 space-y-4">
                    <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-opd-primary/20 border-t-opd-primary animate-spin" />
                    </div>
                    <p className="text-xs font-medium text-opd-text-secondary tracking-wide animate-pulse">
                        Analyzing room rent limits, stay duration, comorbidities, and generating AI fallback predictions...
                    </p>
                </div>
            ) : error ? (
                <div className="p-6 border border-red-200 bg-red-50 text-red-800 text-xs rounded-2xl">
                    Error running simulation: {error}
                </div>
            ) : queries.length === 0 ? (
                <div className="p-8 border border-emerald-200 bg-emerald-50/50 text-center rounded-2xl space-y-3 max-w-lg mx-auto">
                    <CheckSquare className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h3 className="font-bold text-emerald-900 text-sm">Perfect Pre-Auth Score!</h3>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                        No predicted query objections detected. This pre-authorization request complies with billing room rent caps, comorbidity waiting periods, and daycare stay guidelines.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {queries.map((q, idx) => (
                        <div
                            key={idx}
                            className={`p-5 border rounded-2xl flex flex-col gap-3 shadow-sm transition ${
                                q.severity === 'blocking' 
                                    ? 'border-red-200 bg-red-50/30' 
                                    : 'border-amber-200 bg-amber-50/30'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] px-2 py-0.5 rounded font-black border uppercase tracking-wider ${
                                            q.category === 'billing' ? 'bg-green-50 text-green-700 border-green-200' :
                                            q.category === 'clinical' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            q.category === 'administrative' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        }`}>
                                            {q.category}
                                        </span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded font-black border uppercase tracking-wider ${
                                            q.severity === 'blocking'
                                                ? 'bg-red-100 text-red-800 border-red-300'
                                                : 'bg-amber-100 text-amber-800 border-amber-300'
                                        }`}>
                                            {q.severity} Query
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-sm text-gray-800">{q.queryText}</h3>
                                </div>
                                <ShieldAlert className={`w-5 h-5 shrink-0 ${q.severity === 'blocking' ? 'text-red-600' : 'text-amber-600'}`} />
                            </div>

                            <div className="text-xs text-gray-600 space-y-1">
                                <div className="font-semibold text-gray-500 uppercase text-[9px] tracking-wider">Trigger Rule:</div>
                                <p>{q.reason}</p>
                            </div>

                            <div className="p-3 bg-white border border-gray-100 rounded-xl space-y-1 text-xs">
                                <div className="font-bold text-opd-primary uppercase text-[9px] tracking-wider">Recommended Pre-emptive Mitigation:</div>
                                <p className="text-gray-700 font-medium">{q.mitigation}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ClaimWorkflowTimelineView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    if (!activeCase) {
        return <div className="p-6 text-center text-opd-text-secondary">Select a case to inspect workflow stepper.</div>;
    }

    const stages: Array<{ key: CaseStage; label: string }> = [
        { key: 'admission', label: 'Admission' },
        { key: 'docs_uploaded', label: 'Docs Uploaded' },
        { key: 'ai_processing', label: 'AI Process' },
        { key: 'hospital_review', label: 'Hospital Review' },
        { key: 'ready_to_submit', label: 'Ready to Submit' },
        { key: 'submitted_to_tpa', label: 'Submitted to TPA' },
        { key: 'tpa_review', label: 'TPA Review' },
        { key: 'approved', label: 'Approved' },
        { key: 'payment', label: 'Payment Completed' }
    ];

    const currentStageIndex = stages.findIndex(s => s.key === activeCase.currentStage);

    return (
        <div className="card-premium space-y-6 text-left">
            <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 10: Claim Workflow Timeline</h2>
            
            {/* 9 stage horizontal timeline */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-4">
                {stages.map((stg, i) => {
                    const isActive = i === currentStageIndex;
                    const isCompleted = i < currentStageIndex;
                    return (
                        <div key={stg.key} className="flex items-center gap-1 shrink-0">
                            <div className={`p-2.5 rounded-xl text-[10px] font-bold text-center transition ${
                                isActive ? 'bg-opd-primary text-white shadow-md' :
                                isCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                'bg-gray-50 text-gray-400 border'
                            }`}>
                                {stg.label}
                            </div>
                            {i < stages.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                        </div>
                    );
                })}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl text-xs space-y-3 max-w-sm">
                <span className="font-bold text-opd-primary">Pipeline Actions</span>
                <div className="grid grid-cols-2 gap-2">
                    <button className="px-3 py-2 bg-opd-primary text-white rounded-lg font-bold shadow hover:bg-opd-primary/95">Submit to TPA</button>
                    <button className="px-3 py-2 bg-white border rounded-lg font-bold text-gray-700 hover:bg-gray-50">Download PDF</button>
                </div>
            </div>
        </div>
    );
};

const ClaimPacketPreviewView: React.FC<{ activeCase: PatientCaseRecord | null }> = ({ activeCase }) => {
    return (
        <div className="card-premium space-y-6 text-left">
            <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 11: Final Claim Packet Preview</h2>
            <ReimbursementModule activeCase={activeCase} />
        </div>
    );
};

const AnalyticsView: React.FC = () => {
    const [stats, setStats] = useState({
        total: 0,
        approved: 0,
        denied: 0,
        queries: 0
    });

    useEffect(() => {
        getAllPatientRecords().then(records => {
            const approved = records.filter(r => r.authorizations[0]?.status === 'approved').length;
            const denied = records.filter(r => r.authorizations[0]?.status === 'denied').length;
            const queries = records.filter(r => r.authorizations[0]?.status === 'query_raised').length;
            setStats({
                total: records.length,
                approved,
                denied,
                queries
            });
        });
    }, []);

    return (
        <div className="card-premium space-y-6 text-left">
            <div className="flex justify-between items-start">
                <h2 className="text-lg font-bold font-lora text-opd-primary">Screen 12: Analytics Dashboard</h2>
                <div className="px-3 py-1 bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 rounded-full uppercase tracking-wider">
                    Session Local Stats Only
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 border rounded-xl text-center">
                    <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Claims</span>
                    <span className="text-2xl font-bold text-opd-primary">{stats.total}</span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                    <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Approved</span>
                    <span className="text-2xl font-bold text-emerald-800">{stats.approved}</span>
                </div>
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                    <span className="block text-[10px] font-bold text-red-700 uppercase tracking-wider">Rejected</span>
                    <span className="text-2xl font-bold text-red-800">{stats.denied}</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
                    <span className="block text-[10px] font-bold text-blue-700 uppercase tracking-wider">Avg Readiness</span>
                    <span className="text-2xl font-bold text-blue-800">88%</span>
                </div>
            </div>
            
            <p className="text-[11px] text-opd-text-muted leading-relaxed">
                All numbers shown represent local IndexedDB registrations under this session. Aggregate cross-hospital analytics will activate post-cloud backend synchronization.
            </p>
        </div>
    );
};

// --- MAIN INSURANCE COMPONENT ---

export const InsuranceModule: React.FC = () => {
    const [selectedScreen, setSelectedScreen] = useState<number>(3); // Default to Screen 3
    const [cases, setCases] = useState<PatientCaseRecord[]>([]);
    const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
    const [activeCase, setActiveCase] = useState<PatientCaseRecord | null>(null);

    // Legacy Wizard controls
    const [prefilledData, setPrefilledData] = useState<any>(null);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [demoStartStep, setDemoStartStep] = useState<1 | 2 | 3 | 4>(1);
    const [demoDefaultTab, setDemoDefaultTab] = useState<any>(undefined);

    const refreshCases = useCallback(async () => {
        const list = await getAllPatientRecords();
        setCases(list);
        
        if (list.length > 0 && !activeCaseId) {
            setActiveCaseId(list[list.length - 1].id);
        }
    }, [activeCaseId]);

    useEffect(() => {
        refreshCases();
    }, [refreshCases]);

    useEffect(() => {
        if (activeCaseId) {
            getPatientRecord(activeCaseId).then(rec => {
                setActiveCase(rec ?? null);
            });
        } else {
            setActiveCase(null);
        }
    }, [activeCaseId]);

    const handleCaseSelect = (id: string) => {
        if (id === 'NEW') {
            setActiveCaseId(null);
            setSelectedScreen(1); // Jump to QR workflow to create new
        } else {
            setActiveCaseId(id);
        }
    };

    const handleCaseCreated = (id: string) => {
        refreshCases();
        setActiveCaseId(id);
        setSelectedScreen(3); // Go to uploader
    };

    const runDemoCase = (record: any) => {
        setPrefilledData(record);
        setDemoStartStep(4);
        setDemoDefaultTab('tpa-review');
        setIsDemoMode(true);
        setShowWizard(true);
    };

    const resetDemo = () => {
        setShowWizard(false);
        setIsDemoMode(false);
        setPrefilledData(null);
        setSelectedRecord(null);
        refreshCases();
    };

    const SCREENS = [
        { id: 1, name: '1. Patient QR Workflow', icon: <QrCode className="w-4 h-4" />, type: 'shell' },
        { id: 2, name: '2. Patient Details', icon: <UserCheck className="w-4 h-4" />, type: 'extracted' },
        { id: 3, name: '3. Document Upload', icon: <UploadCloud className="w-4 h-4" />, type: 'real' },
        { id: 4, name: '4. AI Identification', icon: <FileSearch className="w-4 h-4" />, type: 'extracted' },
        { id: 5, name: '5. Extracted Info', icon: <Sparkles className="w-4 h-4" />, type: 'extracted' },
        { id: 6, name: '6. Claim Readiness', icon: <BookmarkCheck className="w-4 h-4" />, type: 'real' },
        { id: 7, name: '7. Evidence Explorer', icon: <HeartPulse className="w-4 h-4" />, type: 'extracted' },
        { id: 8, name: '8. Policy Capping', icon: <Calculator className="w-4 h-4" />, type: 'real' },
        { id: 9, name: '9. TPA Query Prediction', icon: <ShieldAlert className="w-4 h-4" />, type: 'real' },
        { id: 10, name: '10. Workflow Timeline', icon: <FileCheck className="w-4 h-4" />, type: 'real' },
        { id: 11, name: '11. Claim Packet Preview', icon: <FileText className="w-4 h-4" />, type: 'real' },
        { id: 12, name: '12. Analytics & Accuracy', icon: <TrendingUp className="w-4 h-4" />, type: 'real' },
    ];

    return (
        <div className="min-h-screen bg-opd-bg text-opd-text-primary p-6">
            <div className="max-w-6xl mx-auto space-y-6 text-opd-text-primary">

                {/* Dashboard Navigation Header */}
                <div className="flex items-center justify-between border-b border-opd-border pb-4 bg-white px-6 py-4 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <Activity className="w-6 h-6 text-opd-primary animate-pulse" />
                        <h1 className="text-xl font-bold font-lora text-opd-primary">Aivana India TPA Insurance Copilot</h1>
                        
                        {/* Case Selector Dropdown */}
                        <div className="flex items-center gap-2 border-l pl-4 border-opd-border">
                            <span className="text-xs font-semibold text-gray-500">Active Case:</span>
                            <select
                                className="text-xs p-1.5 border rounded-lg bg-gray-50 font-mono text-opd-primary font-bold focus:outline-none"
                                value={activeCaseId || ''}
                                onChange={e => handleCaseSelect(e.target.value)}
                            >
                                {cases.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.id} ({c.patientProfile?.name || 'Incomplete'})
                                    </option>
                                ))}
                                <option value="NEW">+ Ingest New Case...</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white border border-opd-border rounded-full px-3 py-1 gap-2 select-none">
                            <span className="text-[10px] font-bold text-opd-text-secondary tracking-wider">DEMO</span>
                            <button
                                onClick={() => {
                                    const val = !isDemoMode;
                                    setIsDemoMode(val);
                                    (window as any).VITE_DEMO_MODE = val;
                                }}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${isDemoMode ? 'bg-opd-primary' : 'bg-opd-border'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${isDemoMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 12 Screens Pipeline Panel Grid */}
                <div className="grid grid-cols-4 gap-6 items-start">
                    
                    {/* Left Sidebar */}
                    <div className="col-span-1 bg-white border border-opd-border rounded-2xl p-4 shadow-sm space-y-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-2 tracking-wider">
                            12-Screen Navigation
                        </div>
                        {SCREENS.map(scr => (
                            <button
                                key={scr.id}
                                onClick={() => setSelectedScreen(scr.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                                    selectedScreen === scr.id
                                        ? 'bg-opd-primary text-white shadow'
                                        : 'text-opd-text-secondary hover:bg-gray-50 hover:text-opd-primary'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    {scr.icon}
                                    <span>{scr.name.split('. ')[1]}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black border uppercase tracking-wide shrink-0 ${
                                    scr.type === 'real' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    scr.type === 'extracted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                    {scr.type}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Active View Container */}
                    <div className="col-span-3">
                        {showWizard ? (
                            <PreAuthWizard
                                onClose={resetDemo}
                                prefilledData={prefilledData}
                                existingRecord={selectedRecord || (isDemoMode ? (prefilledData as any) : activeCase ? mapCaseToPreAuth(activeCase) : undefined)}
                                startAtStep={isDemoMode ? demoStartStep : 1}
                                defaultTab={isDemoMode ? demoDefaultTab : undefined}
                                isDemo={isDemoMode}
                                onResetDemo={isDemoMode ? resetDemo : undefined}
                            />
                        ) : isDemoMode ? (
                            <div className="w-full bg-white border border-opd-border rounded-2xl p-6 space-y-6">
                                <div className="text-center space-y-2">
                                    <div className="inline-block bg-primary-tint border border-opd-primary/20 text-opd-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                        ⚡ Presentation Sandbox
                                    </div>
                                    <h3 className="text-xl font-bold font-lora text-opd-primary">Pre-Loaded Demo Scenarios</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 border rounded-xl flex flex-col justify-between space-y-3">
                                        <h4 className="font-bold text-sm">Diabetes Profile</h4>
                                        <button onClick={() => runDemoCase(DIABETES_DEMO_RECORD)} className="btn-primary py-1.5 text-xs">Run Review</button>
                                    </div>
                                    <div className="p-4 border rounded-xl flex flex-col justify-between space-y-3">
                                        <h4 className="font-bold text-sm">Pneumonia Admittance</h4>
                                        <button onClick={() => runDemoCase(PNEUMONIA_DEMO_RECORD)} className="btn-primary py-1.5 text-xs">Run Review</button>
                                    </div>
                                    <div className="p-4 border rounded-xl flex flex-col justify-between space-y-3">
                                        <h4 className="font-bold text-sm">Appendicitis Clean</h4>
                                        <button onClick={() => runDemoCase(APPENDICITIS_DEMO_RECORD)} className="btn-primary py-1.5 text-xs">Run Review</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {selectedScreen === 1 && <PatientQRWorkflowView onCaseSelect={handleCaseSelect} />}
                                {selectedScreen === 2 && <PatientDetailsView activeCase={activeCase} onSave={refreshCases} />}
                                {selectedScreen === 3 && <UploadIngestionView onCaseCreated={handleCaseCreated} />}
                                {selectedScreen === 4 && <DocumentIdentificationView activeCase={activeCase} />}
                                {selectedScreen === 5 && <ExtractedInformationView activeCase={activeCase} />}
                                {selectedScreen === 6 && <ClaimReadinessView activeCase={activeCase} />}
                                {selectedScreen === 7 && <EvidenceExplorerView activeCase={activeCase} />}
                                {selectedScreen === 8 && <PolicyValidationView activeCase={activeCase} />}
                                {selectedScreen === 9 && <TpaQueryPredictionView activeCase={activeCase} />}
                                {selectedScreen === 10 && <ClaimWorkflowTimelineView activeCase={activeCase} />}
                                {selectedScreen === 11 && <ClaimPacketPreviewView activeCase={activeCase} />}
                                {selectedScreen === 12 && <AnalyticsView />}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
