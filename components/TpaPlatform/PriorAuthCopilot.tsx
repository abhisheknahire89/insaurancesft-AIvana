import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Globe, Award, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import { runPriorAuthWorkflow, PriorAuthInput } from '../../engine/priorAuthWorkflow';
import { PriorAuthAnalysis } from '../../services/geminiService';

// Pre-seeded messy multi-page clinical records to simulate a 70-page chart review
const DEMO_CHARTS = [
    {
        id: 'chart-dengue-mjpjay',
        title: 'Case Chart: Dinesh Kumar (Dengue, MJPJAY - MH)',
        description: 'Messy 3-page chart with clinical history, daily platelet monitoring log, and MJPJAY registration.',
        patientDetails: { name: 'Dinesh Kumar', age: 42, gender: 'Male', stateCode: 'MH' },
        insuranceDetails: { tpaName: 'Medi Assist TPA', insurerName: 'Star Health', policyNumber: 'POL-99201-2026', sumInsured: 300000, wardType: 'General' as const, roomRentPerDay: 2500, isEmergency: true },
        doctorDetails: { doctorName: 'Dr. Sunil Bhardwaj', doctorRegistrationNumber: 'MCI-88271', hospitalSealApplied: true, signatureConfirmed: true },
        clinicalNote: `ADMISSION CLINICAL MEMORANDUM & OUTPATIENT NOTES
Patient: Dinesh Kumar, 42-year-old male. Presenting with high-grade fever (103.4 F) for 4 days, severe arthralgia, retro-orbital pain, and persistent vomiting. Has been unable to keep fluids down for 24 hours.
Past history: Hypertension on Amlodipine 5mg.
O/E: Dehydrated, extremities cool. BP 100/70 mmHg, Pulse 110/min, Temp 102.8 F, SpO2 96% on room air.
Impression: Suspected Dengue Hemorrhagic Fever. Outpatient oral rehydration failed. Admitted for IV fluids, supportive care, and platelet monitoring.

--- DAILY NURSING FLOWSHEET & LAB RESULTS ---
Day 1: Patient started on IV Normal Saline at 100ml/hr. Vomiting subsided. CBC drawn. Platelet count: 48,000/mcL. Hematocrit: 46%.
Day 2: Vitals stable. Extremities warm. Platelet count dropped to 28,000/mcL. General ward stay continued. Refuse discharge due to severe bleeding risk (epistaxis/gums).
Day 3: NS1 Antigen test confirmed positive. Platelet count: 22,000/mcL. Clinician recommends stay extension.
No major complications or active internal hemorrhage. Patient stable on IV therapy.`,
        documents: [
            { name: 'NS1_Antigen_Report.pdf', type: 'application/pdf', textContent: 'NS1 Antigen Test: POSITIVE. Patient ID: Dinesh-901.' },
            { name: 'Platelet_Count_Log.xlsx', type: 'application/octet-stream', textContent: 'Platelet counts: Day 1: 48k; Day 2: 28k; Day 3: 22k. Hct: 46%.' }
        ]
    },
    {
        id: 'chart-cabg-commercial',
        title: 'Case Chart: Rajesh Shah (CABG, Commercial - Paramount)',
        description: 'Complex cardiology chart with angiography report, ECG, and private room rent capping alerts.',
        patientDetails: { name: 'Rajesh Shah', age: 61, gender: 'Male', stateCode: 'KA' },
        insuranceDetails: { tpaName: 'Paramount Health Services TPA', insurerName: 'Care Health', policyNumber: 'POL-10827-2025', sumInsured: 500000, wardType: 'Private' as const, roomRentPerDay: 7500, isEmergency: false },
        doctorDetails: { doctorName: 'Dr. Vivek Murthy', doctorRegistrationNumber: '', hospitalSealApplied: false, signatureConfirmed: true }, // missing reg and seal
        clinicalNote: `CARDIAC CATHETERIZATION & CLINICAL COURSE NOTES
Patient: Rajesh Shah, 61M. Chronic stable angina for 6 months, worsening over the last 2 weeks to CCS Class III. Walk distance limited to 50 meters.
Risk factors: Type 2 Diabetes, Dyslipidemia.
Coronary Angiography (CAG) done on 02/07/2026 showing:
- Left Main: 30% plaque
- LAD: 90% proximal stenosis
- LCx: 80% mid stenosis
- RCA: 85% distal stenosis
Triple Vessel Disease (TVD). Recommend Coronary Artery Bypass Grafting (CABG) surgery under general anesthesia.
Echocardiogram: LVEF 45%, mild hypokinesia of anterior wall.
Patient requested private room. Room rent agreed at 7,500 INR/day. Scheduled for elective CABG on 07/07/2026.
Note: Hospital official seal will be stamped upon admission approval. Doctor registration number MCI database lookup pending.`,
        documents: [
            { name: 'Angiography_Report.jpg', type: 'image/jpeg', textContent: 'CAG Report: Proximal LAD 90% blocked, RCA 85% blocked. TVD diagnosis.' },
            { name: 'ECHO_Report.pdf', type: 'application/pdf', textContent: 'ECHO: LVEF 45%. Mid anteroseptal hypokinesia.' }
        ]
    }
];

export const PriorAuthCopilot: React.FC = () => {
    const [clinicalNote, setClinicalNote] = useState('');
    const [tpaName, setTpaName] = useState('Medi Assist TPA');
    const [wardType, setWardType] = useState<'General' | 'Semi-Private' | 'Private' | 'ICU'>('General');
    const [roomRent, setRoomRent] = useState(2500);
    const [sumInsured, setSumInsured] = useState(300000);
    const [isEmergency, setIsEmergency] = useState(false);
    const [stateCode, setStateCode] = useState('MH');

    const [doctorName, setDoctorName] = useState('Dr. Sunil Bhardwaj');
    const [doctorReg, setDoctorReg] = useState('MCI-88271');
    const [sealApplied, setSealApplied] = useState(true);
    const [sigConfirmed, setSigConfirmed] = useState(true);

    const [attachments, setAttachments] = useState<Array<{ name: string; type: string; base64?: string; textContent?: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<PriorAuthAnalysis | null>(null);
    const [languageTab, setLanguageTab] = useState<'en' | 'hi'>('en');
    const [dragActive, setDragActive] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadDemoChart = (demoId: string) => {
        const demo = DEMO_CHARTS.find(d => d.id === demoId);
        if (!demo) return;
        setClinicalNote(demo.clinicalNote);
        setTpaName(demo.insuranceDetails.tpaName);
        setWardType(demo.insuranceDetails.wardType);
        setRoomRent(demo.insuranceDetails.roomRentPerDay);
        setSumInsured(demo.insuranceDetails.sumInsured);
        setIsEmergency(demo.insuranceDetails.isEmergency);
        setStateCode(demo.patientDetails.stateCode);
        setDoctorName(demo.doctorDetails.doctorName);
        setDoctorReg(demo.doctorDetails.doctorRegistrationNumber);
        setSealApplied(demo.doctorDetails.hospitalSealApplied);
        setSigConfirmed(demo.doctorDetails.signatureConfirmed);
        setAttachments(demo.documents);
        setAnalysis(null);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const files = Array.from(e.dataTransfer.files);
            await processFiles(files);
        }
    };

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const files = Array.from(e.target.files);
            await processFiles(files);
        }
    };

    const processFiles = async (files: File[]) => {
        const newAttachments = await Promise.all(
            files.map(file => {
                return new Promise<{ name: string; type: string; base64?: string; textContent?: string }>((resolve) => {
                    const reader = new FileReader();
                    if (file.type.startsWith('image/')) {
                        reader.readAsDataURL(file);
                        reader.onload = () => {
                            resolve({
                                name: file.name,
                                type: file.type,
                                base64: (reader.result as string).split(',')[1]
                            });
                        };
                    } else {
                        // For PDF or text, read as text snippet mock
                        reader.readAsText(file);
                        reader.onload = () => {
                            resolve({
                                name: file.name,
                                type: file.type,
                                textContent: (reader.result as string).substring(0, 5000)
                            });
                        };
                    }
                });
            })
        );
        setAttachments(prev => [...prev, ...newAttachments]);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const runAnalysis = async () => {
        setLoading(true);
        try {
            const input: PriorAuthInput = {
                clinicalNote,
                uploadedDocuments: attachments,
                patientDetails: {
                    name: 'Selected Patient',
                    age: 45,
                    gender: 'Male',
                    stateCode
                },
                insuranceDetails: {
                    tpaName,
                    insurerName: 'General Care Insurer',
                    policyNumber: 'POL-12345',
                    sumInsured,
                    wardType,
                    roomRentPerDay: roomRent,
                    isEmergency
                },
                doctorDetails: {
                    doctorName,
                    doctorRegistrationNumber: doctorReg,
                    hospitalSealApplied: sealApplied,
                    signatureConfirmed: sigConfirmed
                }
            };
            const result = await runPriorAuthWorkflow(input);
            setAnalysis(result);
        } catch (e) {
            console.error(e);
            alert("Pre-auth analysis failed. Check API key settings.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeInUp">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-opd-border shadow-sm text-left">
                <div>
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-2">
                        <Globe className="w-3.5 h-3.5" /> Fairway Style Pre-Auth Copilot
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-opd-text-primary font-lora">Prior Authorization Audit & Medical Necessity Engine</h2>
                    <p className="text-xs text-opd-text-secondary mt-0.5 leading-relaxed">Automating medical necessity justifications, evidence matching, and TPA checklist verification using Gemini Multimodal reasoning.</p>
                </div>
                <div className="flex items-center gap-2.5">
                    {DEMO_CHARTS.map(chart => (
                        <button
                            key={chart.id}
                            onClick={() => loadDemoChart(chart.id)}
                            className="px-3.5 py-2 bg-opd-input-bg hover:bg-gray-50 text-[11px] font-bold text-opd-text-primary rounded-xl transition border border-opd-border active:scale-95 text-left max-w-xs shadow-sm"
                            title={chart.description}
                            type="button"
                        >
                            ⚡ Load {chart.id.includes('dengue') ? 'Dengue' : 'CABG'} Chart
                        </button>
                    ))}
                </div>
            </div>

            {/* Input Workspace split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                
                {/* Left Side: Medical Record & Settings Input (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white border border-opd-border rounded-3xl p-6 space-y-4 shadow-sm text-opd-text-primary">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-opd-primary tracking-wide uppercase font-lora">Patient Clinical Chart Note</h3>
                            <button
                                onClick={() => setClinicalNote('')}
                                className="text-[10px] text-opd-text-secondary hover:text-opd-primary transition uppercase font-semibold"
                                type="button"
                            >
                                Clear Note
                            </button>
                        </div>
                        
                        <textarea
                            value={clinicalNote}
                            onChange={(e) => setClinicalNote(e.target.value)}
                            placeholder="Type or paste the messy clinical note, outpatient logs, or laboratory results here..."
                            rows={8}
                            className="form-input font-mono"
                        />

                        {/* File Upload Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition shadow-sm ${
                                dragActive ? 'border-opd-primary bg-primary-tint/10' : 'border-opd-border hover:border-opd-primary bg-opd-input-bg/30'
                            }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileInput}
                                multiple
                                className="hidden"
                            />
                            <Upload className="w-8 h-8 text-opd-text-muted mx-auto mb-2" />
                            <p className="text-xs font-bold text-opd-text-primary">Drag & drop scanned reports, ECGs, or pre-auth forms here</p>
                            <p className="text-[10px] text-opd-text-secondary mt-1">Supports PDF, JPG, PNG, and XLSX files for vision extraction</p>
                        </div>

                        {/* Attachments List */}
                        {attachments.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                                <h4 className="text-[10px] font-bold text-opd-text-secondary uppercase tracking-wide">Uploaded Evidentiary Documents ({attachments.length})</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {attachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-opd-input-bg rounded-xl border border-opd-border text-[11px] shadow-sm">
                                            <span className="truncate text-opd-text-primary max-w-[150px] font-medium" title={file.name}>📄 {file.name}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                                                className="text-red-700 hover:text-red-800 font-bold ml-2 text-xs font-sans"
                                                type="button"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Insurer and Doctor Settings Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        {/* Insurance Parameters */}
                        <div className="bg-white border border-opd-border rounded-3xl p-6 space-y-4 shadow-sm text-opd-text-primary">
                            <h3 className="text-xs font-bold text-opd-primary font-lora border-b border-opd-border pb-2">Insurance Parameters</h3>
                            <div className="space-y-3 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-opd-text-secondary font-semibold mb-1 block">TPA / Insurer</label>
                                        <select value={tpaName} onChange={(e) => setTpaName(e.target.value)} className="w-full p-2 bg-opd-input-bg border border-opd-border rounded-xl text-xs text-opd-text-primary focus:outline-none focus:border-opd-primary transition">
                                            <option value="Medi Assist TPA">Medi Assist TPA</option>
                                            <option value="Paramount Health Services TPA">Paramount TPA</option>
                                            <option value="MDIndia Health Insurance TPA">MDIndia TPA</option>
                                            <option value="Heritage Health TPA">Heritage Health TPA</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-opd-text-secondary font-semibold mb-1 block">State Scheme Jurisdiction</label>
                                        <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="w-full p-2 bg-opd-input-bg border border-opd-border rounded-xl text-xs text-opd-text-primary focus:outline-none focus:border-opd-primary transition">
                                            <option value="MH">Maharashtra (MJPJAY)</option>
                                            <option value="KA">Karnataka (AB-ArK)</option>
                                            <option value="TN">Tamil Nadu (CMCHIS)</option>
                                            <option value="UP">Uttar Pradesh (PMJAY)</option>
                                            <option value="DL">Delhi (Commercial Only)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] text-opd-text-secondary font-semibold mb-1 block">Sum Insured (₹)</label>
                                        <input type="number" value={sumInsured} onChange={(e) => setSumInsured(Number(e.target.value))} className="w-full p-2 bg-opd-input-bg border border-opd-border rounded-xl text-xs text-opd-text-primary focus:outline-none focus:border-opd-primary transition" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-opd-text-secondary font-semibold mb-1 block">Ward Type</label>
                                        <select value={wardType} onChange={(e) => setWardType(e.target.value as any)} className="w-full p-2 bg-opd-input-bg border border-opd-border rounded-xl text-xs text-opd-text-primary focus:outline-none focus:border-opd-primary transition">
                                            <option value="General">General</option>
                                            <option value="Semi-Private">Semi-Private</option>
                                            <option value="Private">Private</option>
                                            <option value="ICU">ICU</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-opd-text-secondary font-semibold mb-1 block">Room Rent/Day (₹)</label>
                                        <input type="number" value={roomRent} onChange={(e) => setRoomRent(Number(e.target.value))} className="w-full p-2 bg-opd-input-bg border border-opd-border rounded-xl text-xs text-opd-text-primary focus:outline-none focus:border-opd-primary transition" />
                                    </div>
                                </div>
                                <div className="flex items-center pt-2">
                                    <label className="flex items-center space-x-2 cursor-pointer font-semibold text-opd-text-secondary select-none">
                                        <input type="checkbox" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} className="accent-opd-primary" />
                                        <span>Emergency Admission</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Doctor Declarations */}
                        <div className="bg-white border border-opd-border rounded-3xl p-6 space-y-4 shadow-sm text-opd-text-primary">
                            <h3 className="text-xs font-bold text-opd-primary font-lora border-b border-opd-border pb-2">Medical Declarations & Seals</h3>
                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="text-[10px] text-opd-text-secondary font-semibold mb-1 block">Doctor Name</label>
                                    <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="w-full p-2 bg-opd-input-bg border border-opd-border rounded-xl text-xs text-opd-text-primary focus:outline-none focus:border-opd-primary transition" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-opd-text-secondary font-semibold mb-1 block">MCI / State Medical Council Registration No.</label>
                                    <input type="text" value={doctorReg} onChange={(e) => setDoctorReg(e.target.value)} placeholder="E.g. MCI-12345" className="w-full p-2 bg-opd-input-bg border border-opd-border rounded-xl text-xs text-opd-text-primary focus:outline-none focus:border-opd-primary transition" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1 font-semibold text-opd-text-secondary">
                                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                                        <input type="checkbox" checked={sealApplied} onChange={(e) => setSealApplied(e.target.checked)} className="accent-opd-primary" />
                                        <span>Hospital Seal Applied</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                                        <input type="checkbox" checked={sigConfirmed} onChange={(e) => setSigConfirmed(e.target.checked)} className="accent-opd-primary" />
                                        <span>Doctor Sign-off Done</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={runAnalysis}
                        disabled={loading || !clinicalNote}
                        className="w-full py-4 rounded-2xl bg-opd-primary hover:bg-opd-primary/95 text-white font-bold tracking-wider text-sm transition shadow-sm disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99] flex items-center justify-center gap-2"
                        type="button"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Ingesting Messy Chart & Running Clinical Audit...</span>
                            </>
                        ) : (
                            <span>Run Fairway AI Pre-Auth Audit 🚀</span>
                        )}
                    </button>
                </div>

                {/* Right Side: Audit Results Console (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                    {analysis ? (
                        <div className="bg-white border border-opd-border rounded-3xl p-6 space-y-6 overflow-hidden relative shadow-sm text-opd-text-primary text-left">
                            
                            {/* Top Decision Badge */}
                            <div className="flex items-center justify-between border-b border-opd-border pb-4">
                                <h3 className="text-sm font-bold text-opd-primary font-lora tracking-wide uppercase">Audit Report</h3>
                                <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-xl tracking-wider border ${
                                    analysis.decision === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    analysis.decision === 'Denied' ? 'bg-red-50 text-red-750 border-red-200' :
                                    'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                    {analysis.decision}
                                </span>
                            </div>

                            {/* Medical Necessity Reasoning */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-opd-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                    <Award className="w-3.5 h-3.5 text-opd-primary" /> Medical Necessity Verdict
                                </h4>
                                <p className="text-xs text-opd-text-primary leading-relaxed bg-opd-input-bg p-4 rounded-2xl border border-opd-border shadow-sm">
                                    {analysis.justification}
                                </p>
                            </div>

                            {/* Multi-lingual summary tab */}
                            <div className="border border-opd-border rounded-2xl overflow-hidden shadow-sm">
                                <div className="flex bg-opd-input-bg border-b border-opd-border text-[11px] font-bold">
                                    <button
                                        onClick={() => setLanguageTab('en')}
                                        className={`flex-1 py-2.5 transition flex items-center justify-center gap-1.5 ${languageTab === 'en' ? 'bg-opd-primary text-white shadow-sm' : 'text-opd-text-secondary hover:text-opd-primary'}`}
                                        type="button"
                                    >
                                        English Summary
                                    </button>
                                    <button
                                        onClick={() => setLanguageTab('hi')}
                                        className={`flex-1 py-2.5 transition flex items-center justify-center gap-1.5 ${languageTab === 'hi' ? 'bg-opd-primary text-white shadow-sm' : 'text-opd-text-secondary hover:text-opd-primary'}`}
                                        type="button"
                                    >
                                        हिन्दी सारांश (Hindi)
                                    </button>
                                </div>
                                <div className="p-4 bg-white text-xs leading-relaxed text-opd-text-primary font-medium">
                                    {languageTab === 'en' ? (
                                        <p>{analysis.englishSummary}</p>
                                    ) : (
                                        <p className="font-sans text-opd-text-primary">{analysis.hindiSummary}</p>
                                    )}
                                </div>
                            </div>

                            {/* Evidence Highlights (Messy Document matching) */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-opd-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700" /> Highlighted Evidence Ingested
                                </h4>
                                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                                    {analysis.evidenceHighlights.map((hl, idx) => (
                                        <div key={idx} className={`p-3 rounded-2xl border text-[11px] leading-relaxed ${
                                            hl.severity === 'supportive' 
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                                : 'bg-red-50 border-red-200 text-red-800'
                                        }`}>
                                            <span className="font-bold text-[9px] block uppercase tracking-wider mb-1 opacity-70">
                                                {hl.severity === 'supportive' ? '✓ SUPPORTIVE EVIDENCE' : '⚠ CLINICAL CHALLENGE'}
                                            </span>
                                            <blockquote className="font-mono bg-opd-input-bg px-2 py-1 rounded border border-opd-border my-1 block text-opd-text-primary">
                                                "{hl.snippet}"
                                            </blockquote>
                                            <span className="text-[10px] text-opd-text-secondary mt-1 block font-sans">
                                                <strong>Relevance:</strong> {hl.relevance}
                                            </span>
                                        </div>
                                    ))}
                                    {analysis.evidenceHighlights.length === 0 && (
                                        <p className="text-xs text-opd-text-muted italic">No structured highlights detected in notes.</p>
                                    )}
                                </div>
                            </div>

                            {/* Information Gaps and Missing Items */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-opd-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Insufficient Information Gaps
                                </h4>
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 shadow-sm">
                                    {analysis.missingInformation.length > 0 ? (
                                        <ul className="list-disc pl-4 space-y-1.5 text-xs text-amber-800 font-medium">
                                            {analysis.missingInformation.map((gap, idx) => (
                                                <li key={idx}>{gap}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                                            <CheckCircle className="w-4 h-4" /> All clinical & mandatory verification gaps resolved.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Policy Citations Card */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-opd-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-opd-primary" /> Payer Policy & IRDAI Citations
                                </h4>
                                <div className="space-y-2">
                                    {analysis.policyCitations.map((cite, idx) => (
                                        <div key={idx} className="p-3 bg-opd-input-bg rounded-2xl border border-opd-border flex justify-between items-start gap-4 shadow-sm">
                                            <div className="text-[11px]">
                                                <span className="font-bold text-opd-text-primary block">{cite.clause}</span>
                                                <span className="text-opd-text-secondary mt-0.5 block">{cite.description}</span>
                                            </div>
                                            <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-black border ${
                                                cite.status === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                cite.status === 'Non-Compliant' ? 'bg-red-50 text-red-750 border-red-200' :
                                                'bg-gray-50 text-gray-700 border-gray-200'
                                            }`}>
                                                {cite.status}
                                            </span>
                                        </div>
                                    ))}
                                    {analysis.policyCitations.length === 0 && (
                                        <p className="text-xs text-opd-text-muted italic">No matching policy clauses cited.</p>
                                    )}
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="bg-white border border-dashed border-opd-border rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[500px] shadow-sm text-opd-text-primary">
                            <FileText className="w-12 h-12 text-opd-text-muted mb-3" />
                            <h3 className="text-sm font-bold font-lora text-opd-primary">Awaiting Clinical Audit Analysis</h3>
                            <p className="text-xs text-opd-text-secondary mt-1 max-w-xs mx-auto leading-relaxed">Fill out the clinical note or load a pre-seeded demo chart on the left, then trigger the engine audit to view results.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
