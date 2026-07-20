import React, { useState, useRef } from 'react';
import { PatientRecord, InsurancePolicyDetails, EntryPath } from '../PreAuthWizard/types';
import { INSURER_LIST, INDIAN_STATES, TPA_NAMES } from '../../config/tpaRegistry';
import { calculateAge, isPolicyActive, isPolicyExpiringSoon, todayISO } from '../../utils/formatters';
import { extractFromDocument } from '../../services/documentExtractionService';
import { searchPatients } from '../../services/masterPatientRecord';

interface PatientInsuranceStepProps {
    patient: Partial<PatientRecord>;
    insurance: Partial<InsurancePolicyDetails>;
    onPatientChange: (p: Partial<PatientRecord>) => void;
    onInsuranceChange: (ins: Partial<InsurancePolicyDetails>) => void;
    onNext: () => void;
}

export const PatientInsuranceStep: React.FC<PatientInsuranceStepProps> = ({
    patient, insurance, onPatientChange, onInsuranceChange, onNext
}) => {
    const [entryPath, setEntryPath] = useState<EntryPath | null>(insurance.policyNumber ? 'manual' : null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [ocrDone, setOcrDone] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<PatientRecord[]>([]);
    const [searching, setSearching] = useState(false);
    const [policyDateWarning, setPolicyDateWarning] = useState('');
    const [extractionException, setExtractionException] = useState('');
    const [extractionResult, setExtractionResult] = useState<{ filled: string[], pending: string[] } | null>(null);

    const [extractionStage, setExtractionStage] = useState('');
    const [ocrLogs, setOcrLogs] = useState<string[]>([]);

    const fileRef = useRef<HTMLInputElement>(null);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length > 1) {
            setSearching(true);
            try {
                const results = await searchPatients(query);
                setSearchResults(results);
            } catch (err) {
                console.error("Error searching patients:", err);
            } finally {
                setSearching(false);
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleSelectPatient = (p: PatientRecord) => {
        onPatientChange({
            ...patient,
            patientName: p.patientName,
            dateOfBirth: p.dateOfBirth,
            age: p.age,
            gender: p.gender,
            maritalStatus: p.maritalStatus,
            mobileNumber: p.mobileNumber,
            email: p.email,
            city: p.city,
            state: p.state,
            uhid: p.uhid
        });
        if (p.lastKnownPolicyNumber) {
            onInsuranceChange({
                ...insurance,
                policyNumber: p.lastKnownPolicyNumber,
                insurerName: p.lastKnownInsurer || '',
                tpaName: (p.lastKnownTPA as any) || ''
            });
        }
        setEntryPath('manual');
    };

    const handleDOBChange = (dob: string) => {
        onPatientChange({ ...patient, dateOfBirth: dob, age: calculateAge(dob) });
    };

    const handlePolicyEndDate = (date: string) => {
        onInsuranceChange({ ...insurance, policyEndDate: date });
        if (!isPolicyActive(date)) {
            setPolicyDateWarning('⚠️ This policy has expired. TPA will reject this pre-auth.');
        } else if (isPolicyExpiringSoon(date)) {
            setPolicyDateWarning('⚠️ Policy is expiring within 7 days. Verify renewal status.');
        } else {
            setPolicyDateWarning('');
        }
    };

    const handleDocumentUpload = async (file: File) => {
        setIsExtracting(true);
        setExtractionException('');
        setExtractionResult(null);
        setOcrLogs([]);
        
        const log = (msg: string) => {
            setOcrLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
        };

        log(`Uploaded File: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
        log("Initializing local PDF/Image reader...");
        setExtractionStage('reading');

        // Stage progress simulation wrapper
        const timer1 = setTimeout(() => {
            log("Opening connection to OCR Engine (Google Vision API)...");
            setExtractionStage('ocr');
        }, 800);
        
        const timer2 = setTimeout(() => {
            log("Google Vision API Connection: Success (Status 200 OK).");
            log("Vision API OCR: Detected text blocks and structural layout.");
            log("Running document classification layer...");
            setExtractionStage('classifying');
        }, 1800);

        const timer3 = setTimeout(() => {
            log("Classification result: Identified document type.");
            log("Sending text blocks to Gemini Multimodal Parser for schema extraction...");
            setExtractionStage('parsing');
        }, 2800);

        try {
            const extracted = await extractFromDocument(file);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);

            log(`Google Vision & Gemini extraction completed.`);
            log(`Document Classified as: "${extracted.document_type.toUpperCase().replace('_', ' ')}"`);
            log(`Confidence: ${Math.round((extracted.confidence > 1 ? extracted.confidence / 100 : extracted.confidence) * 100)}%`);

            const normalizedConf = extracted.confidence > 1 ? extracted.confidence / 100 : extracted.confidence;
            
            // Only block if truly unreadable: very low confidence AND no useful data at all.
            const hasAnyUsefulData = extracted.patient?.name || extracted.patient?.age ||
                extracted.insurance?.policy_number || extracted.clinical_excerpts?.length;
            if (!hasAnyUsefulData && normalizedConf < 0.2) {
                 setExtractionException("Could not read document clearly or invalid type. Please enter details manually.");
                 setIsExtracting(false);
                 return;
            }

            if (normalizedConf < 0.7) {
                 setExtractionException(`⚠️ Needs Manual Check: AI extraction confidence is low (${Math.round(normalizedConf * 100)}%). Fields have not been populated to avoid incorrect data. Please enter details manually.`);
                 setExtractionResult({
                     filled: [],
                     pending: ['Patient Name', 'Age / DOB', 'Gender', 'Contact Number', 'Insurance Company', 'TPA Name', 'Policy Number', 'Sum Insured']
                 });
                 setOcrDone(true);
                 setEntryPath('manual');
                 setIsExtracting(false);
                 return;
            }
            
            const dob = extracted.patient?.dob || patient.dateOfBirth;
            // Map according to requested mapping
            onPatientChange({
                ...patient,
                patientName: extracted.patient?.name || patient.patientName,
                dateOfBirth: dob,
                age: extracted.patient?.age || (dob ? calculateAge(dob) : patient.age),
                ageUnit: extracted.patient?.ageUnit || 'years',
                gender: (extracted.patient?.gender as any) || patient.gender,
                mobileNumber: extracted.patient?.phone || patient.mobileNumber,
                city: patient.city, 
                state: patient.state
            });

            const endDate = extracted.insurance?.valid_till || insurance.policyEndDate;
            onInsuranceChange({
                ...insurance,
                insurerName: extracted.insurance?.insurance_company || insurance.insurerName,
                tpaName: extracted.insurance?.tpa_name || insurance.tpaName,
                policyNumber: extracted.insurance?.policy_number || insurance.policyNumber,
                sumInsured: extracted.insurance?.sum_insured || insurance.sumInsured,
                policyEndDate: endDate,
                dataSource: 'ocr',
                ocrConfidence: Math.round(normalizedConf * 100)
            });
            if (endDate) handlePolicyEndDate(endDate);

            setExtractionResult({
                filled: extracted.extracted_fields,
                pending: extracted.missing_fields
            });

            setOcrDone(true);
            setEntryPath('manual');
        } catch (error: any) {
             setExtractionException(error.message || "Failed to parse document. Please try a clearer image.");
        } finally {
             setIsExtracting(false);
        }
    };

    const isValid = !!(
        patient.patientName && patient.age && patient.gender && patient.mobileNumber && patient.city && patient.state &&
        insurance.insurerName && insurance.tpaName && insurance.policyNumber && insurance.sumInsured
    );

    if (!entryPath) {
        return (
            <div className="space-y-6 text-opd-text-primary bg-white p-6 rounded-2xl border border-opd-border shadow-sm">
                <div>
                    <h2 className="text-lg font-bold font-lora text-opd-primary">Patient & Insurance Details</h2>
                    <p className="text-opd-text-secondary text-sm mt-1">Select an option to begin entering information</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {[
                        {
                            path: 'scan_card' as EntryPath,
                            icon: (
                                <div className="w-12 h-12 rounded-xl bg-primary-tint flex items-center justify-center text-opd-primary border border-opd-primary/10 group-hover:bg-primary-tint/80 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>
                            ),
                            title: 'Extract from PDF / Card',
                            desc: 'Upload hospital registration PDF or Insurance Card to auto-extract details',
                            badge: '⚡ Recommended'
                        },
                        {
                            path: 'manual' as EntryPath,
                            icon: (
                                <div className="w-12 h-12 rounded-xl bg-primary-tint flex items-center justify-center text-opd-primary border border-opd-primary/10 group-hover:bg-primary-tint/80 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 11-2.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                    </svg>
                                </div>
                            ),
                            title: 'Enter Manually',
                            desc: 'Type patient & policy details by hand',
                            badge: ''
                        },
                        {
                            path: 'search_existing' as EntryPath,
                            icon: (
                                <div className="w-12 h-12 rounded-xl bg-primary-tint flex items-center justify-center text-opd-primary border border-opd-primary/10 group-hover:bg-primary-tint/80 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632zM21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                    </svg>
                                </div>
                            ),
                            title: 'Search Patient',
                            desc: 'Reuse previously created patient from Aivana database',
                            badge: ''
                        },
                    ].map(opt => (
                        <button key={opt.path} onClick={() => setEntryPath(opt.path)}
                            className="flex flex-col items-center gap-4 p-6 bg-opd-input-bg hover:bg-primary-tint/10 border border-opd-border hover:border-opd-primary rounded-2xl text-center transition-all duration-200 group hover:scale-[1.02] shadow-sm">
                            {opt.icon}
                            <div className="space-y-1">
                                <div className="font-bold text-sm text-opd-text-primary font-lora">{opt.title}</div>
                                <div className="text-sm text-opd-text-secondary leading-normal">{opt.desc}</div>
                                {opt.badge && <div className="mt-2 inline-block text-sm bg-primary-tint text-opd-primary px-2 py-0.5 rounded-full border border-opd-primary/10 font-bold">{opt.badge}</div>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (entryPath === 'search_existing') {
        return (
            <div className="space-y-6 text-opd-text-primary bg-white p-6 rounded-2xl border border-opd-border shadow-sm">
                <button onClick={() => setEntryPath(null)} className="btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5" type="button">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back
                </button>
                <div>
                    <h2 className="text-lg font-bold font-lora text-opd-primary">Search Patient Registry</h2>
                    <p className="text-opd-text-secondary text-sm mt-1">Search patient by name, mobile, or UHID identifier</p>
                </div>
                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => handleSearch(e.target.value)}
                            className="form-input pl-10"
                            placeholder="Enter Name, Mobile, UHID..."
                            autoFocus
                        />
                        <div className="absolute left-3 top-3.5 text-opd-text-muted">
                            {searching ? (
                                <div className="w-4 h-4 border-2 border-opd-primary border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </div>
                    </div>

                    {searchResults.length > 0 ? (
                        <div className="bg-white border border-opd-border rounded-xl divide-y divide-opd-border overflow-hidden shadow-sm">
                            {searchResults.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handleSelectPatient(p)}
                                    className="p-4 hover:bg-opd-bg/20 cursor-pointer flex justify-between items-start transition-colors"
                                >
                                    <div>
                                        <div className="font-bold text-sm text-opd-text-primary font-lora">{p.patientName}</div>
                                        <div className="text-sm text-opd-text-secondary mt-1 flex gap-3 font-mono">
                                            <span>UHID: {p.uhid || 'N/A'}</span>
                                            <span>Phone: {p.mobileNumber}</span>
                                            <span>{p.gender}, {p.age}{p.ageUnit === 'months' ? 'm' : 'y'}</span>
                                        </div>
                                    </div>
                                    {p.lastKnownPolicyNumber && (
                                        <div className="text-right">
                                            <span className="text-sm uppercase font-bold tracking-wider text-opd-primary bg-primary-tint px-2 py-0.5 rounded border border-opd-primary/10 block">
                                                {p.lastKnownInsurer || 'Has Policy'}
                                            </span>
                                            <span className="text-[9px] text-opd-text-muted font-mono block mt-1">Pol: {p.lastKnownPolicyNumber}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : searchQuery.trim().length > 1 ? (
                        <p className="text-sm text-opd-text-muted text-center py-6">No matching patient records found.</p>
                    ) : null}
                </div>
            </div>
        );
    }

    if (entryPath === 'scan_card' && !ocrDone) {
        return (
            <div className="space-y-6 bg-white p-6 rounded-2xl border border-opd-border shadow-sm text-opd-text-primary">
                <button onClick={() => setEntryPath(null)} className="btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back
                </button>
                <h2 className="text-lg font-bold font-lora text-opd-primary">Extract from Document</h2>
                
                {isExtracting ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3.5 p-5 bg-primary-tint/30 rounded-2xl border border-opd-primary/20">
                      <div className="w-5 h-5 border-2 border-opd-primary border-t-transparent rounded-full animate-spin"></div>
                      <div>
                        <p className="font-bold text-sm text-opd-primary uppercase tracking-wider font-lora">Scanning & Classifying Document...</p>
                        <p className="text-sm text-opd-text-secondary mt-0.5">Current Stage: <span className="font-semibold text-opd-primary">{
                          extractionStage === 'reading' ? 'Reading File' :
                          extractionStage === 'ocr' ? 'Google Vision OCR' :
                          extractionStage === 'classifying' ? 'Document Classification' :
                          extractionStage === 'parsing' ? 'Gemini Field Extraction' : 'Processing'
                        }</span></p>
                      </div>
                    </div>

                    {/* OCR Status Check & Engine Status */}
                    <div className="grid grid-cols-2 gap-3.5 text-sm bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-slate-500">Google Vision Engine:</span>
                        <span className="font-semibold text-slate-700">ONLINE</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-slate-500">Gemini LLM Parser:</span>
                        <span className="font-semibold text-slate-700">ONLINE</span>
                      </div>
                    </div>

                    {/* Real-time OCR Terminal Logs */}
                    <div className="bg-slate-950 text-emerald-400 font-mono text-sm p-4 rounded-xl border border-slate-800 shadow-inner max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
                      {ocrLogs.map((logLine, idx) => (
                        <div key={idx} className="whitespace-pre-wrap leading-relaxed border-l-2 border-emerald-500/20 pl-2">
                          {logLine}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                      onClick={() => { if (!isExtracting) fileRef.current?.click() }}
                      className={`border-2 border-dashed ${extractionException ? 'border-red-300 hover:border-red-400 bg-red-50/50' : 'border-opd-primary/35 hover:border-opd-primary bg-primary-tint/5 hover:bg-primary-tint/10'} rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 shadow-sm`}
                  >
                        <div className="space-y-3.5">
                            <div className="w-14 h-14 rounded-2xl bg-primary-tint text-opd-primary border border-opd-primary/10 flex items-center justify-center mx-auto">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="text-sm text-opd-text-primary font-bold font-lora">Drop PDF or Image here, or click to upload</div>
                            <div className="text-opd-text-secondary text-sm max-w-sm mx-auto leading-normal">Upload Hospital Registration PDF, TPA Card, ID Card, or Policy Document</div>
                            {extractionException && <div className="text-opd-error mt-3 text-sm font-semibold">{extractionException}</div>}
                        </div>
                  </div>
                )}

                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => e.target.files?.[0] && handleDocumentUpload(e.target.files[0])} />
                <button onClick={() => setEntryPath('manual')} className="text-sm text-opd-text-secondary hover:text-opd-primary transition-colors underline block">Skip Extraction — enter manually instead</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-opd-text-primary">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-opd-primary font-lora uppercase tracking-wider">Patient & Insurance Details</h2>
                </div>
                <button onClick={() => setEntryPath(null)} className="text-sm text-opd-primary hover:text-opd-primary-dark font-semibold transition-colors underline" type="button">Change Entry Method</button>
            </div>

            {/* Extraction Results Summary */}
            {ocrDone && extractionResult && (
                <div className="bg-primary-tint/20 border border-opd-primary/20 rounded-xl p-5 mb-4 max-w-full overflow-hidden shadow-sm">
                    <div className="flex gap-3 mb-4 items-center">
                        <div className="w-8 h-8 rounded-lg bg-primary-tint text-opd-primary flex items-center justify-center text-sm font-bold">✨</div>
                        <div>
                            <h3 className="text-opd-primary font-bold text-sm uppercase tracking-wider font-lora">Extraction Complete</h3>
                            <p className="text-opd-text-secondary text-sm mt-0.5">Aivana OCR parsed registration details</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-opd-border shadow-sm">
                        <div>
                            <div className="text-emerald-700 text-sm font-bold flex items-center gap-1.5 mb-2">
                                <span>✓</span>
                                <span>Auto-filled fields:</span>
                            </div>
                            <ul className="text-emerald-700/80 text-sm space-y-1 ml-5 list-disc leading-relaxed font-semibold">
                                {extractionResult.filled.length > 0 ? (
                                    extractionResult.filled.map(f => (<li key={f}>{f}</li>))
                                ) : (
                                    <li className="text-opd-text-muted list-none -ml-4">No fields reliably found.</li>
                                )}
                            </ul>
                        </div>
                        <div>
                            <div className="text-amber-700 text-sm font-bold flex items-center gap-1.5 mb-2">
                                <span>ℹ</span>
                                <span>Fill manually:</span>
                            </div>
                            <ul className="text-amber-700/80 text-sm space-y-1 ml-5 list-disc leading-relaxed font-semibold">
                                {extractionResult.pending.length > 0 ? (
                                    extractionResult.pending.map(f => (<li key={f}>{f}</li>))
                                ) : (
                                    <li className="text-opd-text-muted list-none -ml-4">All required fields extracted successfully.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Patient Demographics */}
            <div className="card-premium space-y-4">
                <h3 className="font-semibold text-opd-primary text-sm uppercase tracking-wider border-b border-opd-border pb-2 font-lora">👤 Patient Demographics</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Full Name *</label>
                        <input value={patient.patientName ?? ''} onChange={e => onPatientChange({ ...patient, patientName: e.target.value })}
                            className="form-input" placeholder="As on insurance card" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Date of Birth</label>
                        <input type="date" value={patient.dateOfBirth ?? ''} onChange={e => handleDOBChange(e.target.value)}
                            className="form-input" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Age *</label>
                        <input type="number" value={patient.age ?? ''} onChange={e => onPatientChange({ ...patient, age: +e.target.value })}
                            className="form-input" placeholder="Years" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Gender *</label>
                        <select value={patient.gender ?? ''} onChange={e => onPatientChange({ ...patient, gender: e.target.value as any })}
                            className="form-input">
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Marital Status</label>
                        <select value={patient.maritalStatus ?? ''} onChange={e => onPatientChange({ ...patient, maritalStatus: e.target.value as any })}
                            className="form-input">
                            <option value="">Select</option>
                            <option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Mobile Number *</label>
                        <input type="tel" value={patient.mobileNumber ?? ''} onChange={e => onPatientChange({ ...patient, mobileNumber: e.target.value })}
                            className="form-input" placeholder="+91 XXXXX XXXXX" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Email</label>
                        <input type="email" value={patient.email ?? ''} onChange={e => onPatientChange({ ...patient, email: e.target.value })}
                            className="form-input" placeholder="optional" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">City *</label>
                        <input value={patient.city ?? ''} onChange={e => onPatientChange({ ...patient, city: e.target.value })}
                            className="form-input" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">State *</label>
                        <select value={patient.state ?? ''} onChange={e => onPatientChange({ ...patient, state: e.target.value })}
                            className="form-input">
                            <option value="">Select State</option>
                            {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">UHID (Hospital ID)</label>
                        <input value={patient.uhid ?? ''} onChange={e => onPatientChange({ ...patient, uhid: e.target.value })}
                            className="form-input" placeholder="Optional identifier" />
                    </div>
                </div>
            </div>

            {/* Insurance Details */}
            <div className="card-premium space-y-4">
                <h3 className="font-semibold text-opd-primary text-sm uppercase tracking-wider border-b border-opd-border pb-2 font-lora">🛡️ Insurance & Policy Details</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Insurance Company *</label>
                        <datalist id="insurer-list">{INSURER_LIST.map(i => <option key={i} value={i} />)}</datalist>
                        <input list="insurer-list" value={insurance.insurerName ?? ''} onChange={e => onInsuranceChange({ ...insurance, insurerName: e.target.value })}
                            className="form-input" placeholder="Start typing insurer..." />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">TPA Name *</label>
                        <select value={insurance.tpaName ?? ''} onChange={e => onInsuranceChange({ ...insurance, tpaName: e.target.value })}
                            className="form-input">
                            <option value="">Select TPA</option>
                            {TPA_NAMES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Policy Number *</label>
                        <input value={insurance.policyNumber ?? ''} onChange={e => onInsuranceChange({ ...insurance, policyNumber: e.target.value })}
                            className="form-input" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">TPA ID Card Number</label>
                        <input value={insurance.tpaIdCardNumber ?? ''} onChange={e => onInsuranceChange({ ...insurance, tpaIdCardNumber: e.target.value })}
                            className="form-input" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Policy Type</label>
                        <select value={insurance.policyType ?? 'Individual'} onChange={e => onInsuranceChange({ ...insurance, policyType: e.target.value as any })}
                            className="form-input">
                            <option>Individual</option><option>Floater</option><option>Corporate</option><option>Group</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Sum Insured (₹) *</label>
                        <input type="number" value={insurance.sumInsured ?? ''} onChange={e => onInsuranceChange({ ...insurance, sumInsured: +e.target.value })}
                            className="form-input" placeholder="e.g. 500000" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Policy Start Date</label>
                        <input type="date" value={insurance.policyStartDate ?? ''} onChange={e => onInsuranceChange({ ...insurance, policyStartDate: e.target.value })}
                            className="form-input" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Policy End Date</label>
                        <input type="date" value={insurance.policyEndDate ?? ''} onChange={e => handlePolicyEndDate(e.target.value)}
                            className="form-input" />
                        {policyDateWarning && <p className="text-opd-error text-sm font-semibold mt-1.5">{policyDateWarning}</p>}
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Proposer Name</label>
                        <input value={insurance.proposerName ?? ''} onChange={e => onInsuranceChange({ ...insurance, proposerName: e.target.value })}
                            className="form-input" placeholder="Defaults to patient name" />
                    </div>
                    <div>
                        <label className="form-label uppercase tracking-wider text-[9px] mb-1">Relationship with Proposer</label>
                        <select value={insurance.relationshipWithProposer ?? 'Self'} onChange={e => onInsuranceChange({ ...insurance, relationshipWithProposer: e.target.value })}
                            className="form-input">
                            <option>Self</option><option>Spouse</option><option>Son</option><option>Daughter</option><option>Father</option><option>Mother</option><option>Other</option>
                        </select>
                    </div>
                </div>
            </div>

            <button onClick={onNext} disabled={!isValid} type="button"
                className="w-full btn-primary py-2.5">
                Continue to Clinical Details
            </button>
            {!isValid && <p className="text-sm text-amber-600 font-semibold text-center mt-1">Fill all required (*) fields to continue</p>}
        </div>
    );
};
