/**
 * CaseIntakeFlow — Unified case creation (§5)
 *
 * Replaces three separate intake channels (QR scan, Manual entry, Document upload)
 * with one bare-minimum form.
 *
 * Reception's job is ONLY to register the patient and hand off to the Coordinator:
 * - Patient Name · Mobile Number · UHID/MRN (if available)
 * - Insurance/TPA Name · Policy Number (if available)
 * - Corporate/Retail · Admission Type · Ward Type (if known) · Treating Doctor (if known)
 * - Insurance card photo (optional) · Govt ID (optional)
 *
 * On save, case status becomes "patient_registered" and ownership passes to Coordinator
 * (who enriches: diagnosis, admission reason, medical necessity, ICD-10, procedure, LOS/cost, documents).
 *
 * NO mandatory validation gates. Progressive completeness scoring.
 */

import React, { useState } from 'react';
import { ChevronRight, Upload, AlertCircle, CheckCircle2, Loader2, Zap, FileText } from 'lucide-react';
import { Case, newCase, updateCompletenessMetric, enrichCaseFromExtraction, ExtractedPatientData } from '../../services/caseModel';
import { saveCase } from '../../services/masterPatientRecord';
import { extractFormFieldsFromDocuments, extractFromMultiDocumentPDF, FormExtractionResult } from '../../services/patientFormExtractorService';

interface CaseIntakeFlowProps {
  onCaseCreated: (caseRecord: Case) => void;
  onCancel: () => void;
  intakeChannel?: 'qr_scan' | 'manual' | 'document_upload';
}

/**
 * Detect document type from filename
 */
function detectDocumentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('aadhaar')) return 'aadhaar';
  if (lower.includes('discharge')) return 'discharge';
  if (lower.includes('sie')) return 'sie';
  if (lower.includes('bill') || lower.includes('invoice')) return 'bill';
  if (lower.includes('consultation')) return 'consultation';
  if (lower.includes('declaration')) return 'declaration';
  return 'unknown';
}

/**
 * Generate mock OCR text for single document (in production, call actual OCR service)
 */
function generateMockOCRText(filename: string): string {
  // Real benchmark case data
  const mockData: Record<string, string> = {
    aadhaar: `AADHAAR
    Name: D SHIVARAM
    DOB: 15-03-1976
    Age: 48
    Gender: Male
    Address: Plot 123, Kamareddy`,

    sie: `SIE LABS PATIENT FORM
    Patient Name: D Shivaram
    Insurer: Star Health
    Policy Number: CPG 2026 13000 0961872
    Policy Type: Group
    Admission Type: Emergency
    Hospital: Sri Amrutha Hospital`,

    discharge: `SRI AMRUTHA HOSPITAL - KAMAREDDY
    Discharge Summary
    Patient: D Shivaram
    Treating Doctor: Dr. Ch. Raghavender
    Admission Date: 12-06-2024
    Discharge Date: 18-06-2024
    Diagnosis: Acute Coronary Syndrome with STEMI`,

    bill: `MEDICAL BILLS - SRI AMRUTHA HOSPITAL
    Patient: D Shivaram
    Ward Charges: Semi-Private ₹2,500/day
    Doctor Consultation: ₹1,000
    Pharmacy: ₹5,234
    Total: ₹28,456`,
  };

  const docType = detectDocumentType(filename);
  return mockData[docType] || mockData.aadhaar;
}

/**
 * Generate mock multi-page PDF OCR (simulates real PDF with multiple document types)
 * Realistic benchmark case: Real patient PDF contained 11 pages with mixed documents
 */
function generateMockMultiPageOCR(filename: string): Array<{ pageNumber: number; text: string }> {
  return [
    {
      pageNumber: 1,
      text: `SIE LABS PATIENT FORM - Page 1
      Patient Name: D Shivaram
      DOB: 15-03-1976
      Age: 48 years
      Gender: Male
      Mobile: (Will be entered manually)
      Insurer Name: Star Health
      Policy Number: CPG 2026 13000 0961872
      Policy Type: Group
      Admission Type: Emergency
      Ward Type: Semi-Private
      Treating Doctor: Dr. Ch. Raghavender`,
    },
    {
      pageNumber: 2,
      text: `SIE LABS PATIENT FORM - Page 2 (Continuation)
      Hospital: Sri Amrutha Hospital, Kamareddy
      Admission Date: 12-06-2024
      Chief Complaint: Chest pain radiating to left arm
      Preliminary Assessment: Acute Coronary Syndrome`,
    },
    {
      pageNumber: 3,
      text: `SIE LABS PATIENT FORM - Page 3 (Medical History)
      Past Medical History: Hypertension x 8 years, Type 2 Diabetes x 5 years
      Current Medications: Metformin, Lisinopril, Aspirin
      Allergies: NKDA (No Known Drug Allergies)`,
    },
    {
      pageNumber: 4,
      text: `PATIENT SELF-DECLARATION (हिंदी में)
      मैं D Shivaram घोषणा करता हूँ कि उपरोक्त जानकारी सत्य है।
      Presenting Complaint: मुझे गंभीर सीने में दर्द है जो बाईं बाजू में फैल रहा है।
      Duration: लगभग 2 घंटे
      Associated Symptoms: सांस लेने में कठिनाई, पसीना आना`,
    },
    {
      pageNumber: 5,
      text: `VERIFICATION OFFICER FEEDBACK
      Verification Status: Verified
      Officer Name: Rajesh Kumar
      Date: 13-06-2024
      Notes: Patient documents verified. All details match.`,
    },
    {
      pageNumber: 6,
      text: `VERIFICATION PHOTO - Location: Sri Amrutha Hospital
      Metadata: GPS coordinates indicate hospital location
      Photo timestamp: 12-06-2024 15:45:00`,
    },
    {
      pageNumber: 7,
      text: `VERIFICATION PHOTO 2 - Patient waiting area
      Timestamp: 12-06-2024 15:50:00`,
    },
    {
      pageNumber: 8,
      text: `VERIFICATION PHOTO 3 - Hospital admission desk
      Timestamp: 12-06-2024 15:55:00`,
    },
    {
      pageNumber: 9,
      text: `AADHAAR CARD DETAILS
      Unique Identification: AADHAAR
      Name: D SHIVARAM
      Date of Birth: 15-03-1976
      Gender: Male
      Address: Plot 123, Kamareddy, Telangana 503185
      Aadhaar Number: XXXX XXXX XXXX XXXX (Last 4: 5678)
      QR Code: [ENCODED DATA]`,
    },
    {
      pageNumber: 10,
      text: `CONSULTATION RECEIPT - Sri Amrutha Hospital
      Consultation Receipt
      Date: 12-06-2024
      Time: 15:30 - 16:00
      Patient Name: D Shivaram
      Consulted by: Dr. Ch. Raghavender
      Consultation Fee: ₹1,000
      Receipt Number: CSR-20260612-4521
      Status: Paid`,
    },
    {
      pageNumber: 11,
      text: `DISCHARGE SUMMARY - Sri Amrutha Hospital, Kamareddy
      DISCHARGE SUMMARY
      Patient Name: D SHIVARAM
      Hospital UID: UH-SAH-20260612-1234
      Admission Date: 12-06-2024
      Discharge Date: 18-06-2024
      Length of Stay: 6 days

      CLINICAL COURSE:
      48-year-old male admitted with acute onset chest pain radiating to left arm.
      Vitals on admission: BP 150/90, HR 110, RR 22, SpO2 96% on room air.

      DIAGNOSIS:
      1. Acute Coronary Syndrome with STEMI (ST-Elevation Myocardial Infarction)
      2. Type 2 Diabetes Mellitus
      3. Hypertension Stage 2

      TREATMENT PLAN:
      - Dual antiplatelet therapy (Aspirin + Clopidogrel)
      - Beta-blockers (Metoprolol)
      - ACE Inhibitors (Lisinopril)
      - Statins (Atorvastatin)
      - PCI with stent placement to LAD artery (successful)

      TREATING PHYSICIAN: Dr. Ch. Raghavender, MD DM (Cardiology)
      Ward Type: Semi-Private
      Expected Length of Stay: 6-7 days
      Discharge Diagnosis Confirmed`,
    },
    {
      pageNumber: 12,
      text: `ITEMIZED MEDICAL BILLS - Sri Amrutha Hospital
      MEDICAL BILLS SUMMARY
      Patient: D SHIVARAM
      Admission: 12-06-2024 to 18-06-2024

      ITEMIZED CHARGES:
      Ward Charges (Semi-Private): ₹2,500/day × 6 days = ₹15,000
      Doctor Consultation & PCI Procedure: ₹8,000
      Lab Tests (Troponin, ECG, Echo, Angiography): ₹5,234
      Medications & IV Fluids: ₹3,456
      Nursing Care: ₹2,100
      Operation Theater: ₹4,500
      Stent (Drug-Eluting Stent - LAD): ₹12,000
      Miscellaneous: ₹1,200

      SUBTOTAL: ₹51,490
      Discount (Insurance): -₹5,149 (10%)
      GST (5%): ₹2,317
      TOTAL AMOUNT: ₹48,658
      Insurance Approved: ₹40,000
      Patient Out-of-Pocket: ₹8,658`,
    },
    {
      pageNumber: 13,
      text: `ADDITIONAL MEDICAL BILLS - Page 2
      Lab Reports Summary:
      - Troponin I: 2.45 ng/mL (Elevated - indicates MI)
      - Creatinine: 1.1 mg/dL (Normal)
      - Glucose: 240 mg/dL (Elevated)
      - LDL Cholesterol: 185 mg/dL (High)
      - ECG: ST elevation in leads II, III, aVF
      - Echocardiogram: Ejection Fraction 35% (Reduced)

      Billing Date: 19-06-2024
      Payment Status: Partially Paid
      Insurance Claim Status: Submitted to Star Health`,
    },
    {
      pageNumber: 14,
      text: `PHARMACY BILL - Sri Amrutha Hospital Pharmacy
      PHARMACY CHARGES

      Date: 12-06-2024 to 18-06-2024
      Patient: D SHIVARAM

      Medications:
      1. Aspirin 300mg × 10 = ₹50
      2. Clopidogrel 600mg loading = ₹800
      3. Metoprolol 25mg × 30 = ₹150
      4. Lisinopril 10mg × 15 = ₹180
      5. Atorvastatin 80mg × 15 = ₹450
      6. Heparin IV × 3 vials = ₹600
      7. Normal Saline 500ml × 4 = ₹200
      8. Glucose IV 5% 500ml × 2 = ₹150
      9. Antibiotics (Ceftriaxone) × 6 = ₹450
      10. Antiemetics & Others = ₹254

      TOTAL PHARMACY: ₹3,284`,
    },
    {
      pageNumber: 15,
      text: `LAB REPORTS - Biochemistry & Hematology

      BLOOD INVESTIGATION REPORT
      Patient: D SHIVARAM
      Sample Date: 12-06-2024
      Report Date: 12-06-2024

      CARDIAC MARKERS:
      Troponin I: 2.45 ng/mL [Normal <0.04] ELEVATED
      CK-MB: 85 U/L [Normal 0-5] ELEVATED
      Myoglobin: 145 ng/mL [Normal 0-110] ELEVATED

      LIPID PROFILE:
      Total Cholesterol: 285 mg/dL [Optimal <200] HIGH
      LDL Cholesterol: 185 mg/dL [Optimal <100] HIGH
      HDL Cholesterol: 35 mg/dL [Desirable >40] LOW
      Triglycerides: 280 mg/dL [Normal <150] ELEVATED

      RENAL FUNCTION:
      Creatinine: 1.1 mg/dL [Normal 0.7-1.3] NORMAL
      BUN: 35 mg/dL [Normal 7-20] ELEVATED

      LIVER FUNCTION:
      ALT: 42 U/L [Normal <40] NORMAL
      AST: 45 U/L [Normal <40] NORMAL
      Bilirubin: 1.0 mg/dL [Normal <1.2] NORMAL`,
    },
    {
      pageNumber: 16,
      text: `ANGIOGRAPHY REPORT - Interventional Cardiology

      CORONARY ANGIOGRAPHY REPORT
      Date: 12-06-2024
      Procedure: Percutaneous Coronary Intervention (PCI) with Stent

      FINDINGS:
      Left Anterior Descending (LAD) artery: 100% occlusion at mid segment
      Right Coronary Artery (RCA): 40% stenosis
      Left Circumflex Artery (LCX): 20% stenosis

      INTERVENTION:
      - Successful PCI to LAD
      - Drug-Eluting Stent (DES) placement: 3.5 × 24 mm
      - Post-procedure TIMI 3 flow achieved
      - No complications

      MEDICATIONS GIVEN:
      - Aspirin 300mg
      - Clopidogrel 600mg loading dose
      - Heparin weight-based

      FOLLOW-UP:
      - Dual antiplatelet therapy for 12 months
      - Cardiac rehabilitation program
      - Regular follow-up with cardiology`,
    },
  ];
}

export const CaseIntakeFlow: React.FC<CaseIntakeFlowProps> = ({
  onCaseCreated,
  onCancel,
  intakeChannel = 'manual'
}) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Patient Info
  // ──────────────────────────────────────────────────────────────────────────

  const [patientName, setPatientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [uhid, setUhid] = useState('');

  // ──────────────────────────────────────────────────────────────────────────
  // Insurance Info
  // ──────────────────────────────────────────────────────────────────────────

  const [insurerName, setInsurerName] = useState('');
  const [tpaName, setTpaName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyType, setPolicyType] = useState<'corporate' | 'retail' | ''>('');

  // ──────────────────────────────────────────────────────────────────────────
  // Admission Info
  // ──────────────────────────────────────────────────────────────────────────

  const [admissionType, setAdmissionType] = useState<'emergency' | 'planned' | ''>('');
  const [wardType, setWardType] = useState('');
  const [treatingDoctor, setTreatingDoctor] = useState('');

  // ──────────────────────────────────────────────────────────────────────────
  // Documents
  // ──────────────────────────────────────────────────────────────────────────

  const [insuranceCardFile, setInsuranceCardFile] = useState<File | null>(null);
  const [govtIdFile, setGovtIdFile] = useState<File | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // UI State
  // ──────────────────────────────────────────────────────────────────────────

  const [clinicalNote, setClinicalNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractionResults, setExtractionResults] = useState<FormExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [documentBreakdown, setDocumentBreakdown] = useState<Array<{
    pageRange: string;
    type: string;
    fieldsFound: string[];
  }> | null>(null);

  const canSubmit =
    patientName.trim() &&
    mobileNumber.trim() &&
    insurerName.trim() &&
    clinicalNote.trim().length >= 50 &&
    (policyNumber.trim() || tpaName.trim());

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'card' | 'id') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'card') {
        setInsuranceCardFile(file);
      } else {
        setGovtIdFile(file);
      }

      // Trigger extraction if this is a government ID (e.g., Aadhaar)
      if (type === 'id' && file) {
        await extractFromDocument(file);
      }
    }
  };

  const extractFromDocument = async (file: File) => {
    setExtracting(true);
    setExtractionError(null);
    setDocumentBreakdown(null);

    try {
      // In production, this would call real OCR service (e.g., Google Vision, Sarvam AI)
      // For demo, use mock OCR with realistic multi-page benchmark case

      let results: FormExtractionResult;
      let breakdown: Array<{ pageRange: string; type: string; fieldsFound: string[] }> | null = null;

      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Multi-page PDF: simulate pages with different document types
        const ocrPages = generateMockMultiPageOCR(file.name);
        const extraction = await extractFromMultiDocumentPDF(ocrPages, ['1', '2', '3']);
        results = extraction.results;
        breakdown = extraction.documentBreakdown;
        setDocumentBreakdown(breakdown);
      } else {
        // Single image: single document extraction
        const mockText = generateMockOCRText(file.name);
        results = await extractFormFieldsFromDocuments(
          [{ text: mockText, type: detectDocumentType(file.name) }],
          ['1', '2', '3']
        );
      }

      setExtractionResults(results);

      // Auto-populate fields with extracted data
      if (results.patientName?.value) {
        setPatientName(results.patientName.value);
      }
      if (results.insurerName?.value) {
        setInsurerName(results.insurerName.value);
      }
      if (results.policyNumber?.value) {
        setPolicyNumber(results.policyNumber.value);
      }
      if (results.policyType?.value) {
        setPolicyType(results.policyType.value as any);
      }
      if (results.treatingDoctor?.value) {
        setTreatingDoctor(results.treatingDoctor.value);
      }
      if (results.clinicalNote?.value && clinicalNote.length < 50) {
        setClinicalNote(results.clinicalNote.value);
      }
      if (results.admissionType?.value) {
        setAdmissionType(results.admissionType.value as any);
      }
      if (results.wardType?.value) {
        setWardType(results.wardType.value);
      }
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to extract document information');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      // Create bare-minimum case
      const newCaseRecord = newCase('default', {
        name: patientName,
        contactNumber: mobileNumber,
        uhid: uhid || undefined,
      }, {
        insurerName,
        tpaName,
        policyNumber,
        policyType: (policyType || 'retail') as 'corporate' | 'retail',
      });

      // Add admission details
      newCaseRecord.clinical.admissionType = (admissionType || 'planned') as 'emergency' | 'planned';
      if (wardType) newCaseRecord.clinical.wardType = wardType;
      if (treatingDoctor) newCaseRecord.clinical.treatingDoctor = treatingDoctor;

      // Add clinical note (NEW)
      newCaseRecord.clinical.clinicalNote = {
        originalText: clinicalNote,
        capturedAt: new Date().toISOString(),
        entryMethod: 'typed',
      };

      // Mark intake channel
      newCaseRecord.intakeChannel = intakeChannel;

      // Track documents and extraction results
      if (insuranceCardFile) {
        newCaseRecord.documents.push({
          id: `DOC-${Date.now()}-1`,
          name: insuranceCardFile.name,
          fileType: 'image',
          uploadedAt: new Date().toISOString(),
          category: 'insurance_card',
        });
      }
      if (govtIdFile) {
        newCaseRecord.documents.push({
          id: `DOC-${Date.now()}-2`,
          name: govtIdFile.name,
          fileType: 'image',
          uploadedAt: new Date().toISOString(),
          category: 'id_proof',
        });
      }

      // Store extraction results for audit trail
      if (extractionResults) {
        newCaseRecord.metadata = newCaseRecord.metadata || {};
        newCaseRecord.metadata.formExtractionResults = {
          extractedAt: new Date().toISOString(),
          documentName: govtIdFile?.name || 'unknown',
          results: extractionResults,
        };
      // Enrich case model with extracted data
      const enrichedCase = enrichCaseFromExtraction(newCaseRecord, extractionResults as ExtractedPatientData);
      Object.assign(newCaseRecord, enrichedCase);
      }

      // Update completeness
      updateCompletenessMetric(newCaseRecord);

      // Save to database
      await saveCase(newCaseRecord);

      setSuccess(true);

      // Notify parent after brief delay (show success message)
      setTimeout(() => {
        onCaseCreated(newCaseRecord);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create case');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-emerald-900 mb-2">Case Created Successfully</h2>
          <p className="text-emerald-800 mb-6">
            The patient has been registered and the case is now in your Inbox.
          </p>
          <p className="text-sm text-emerald-700">
            Opening case workspace in a moment…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-opd-primary mb-1">New Patient Registration</h1>
          <p className="text-sm text-opd-text-muted">
            Enter minimum patient and insurance details. Additional information can be added later by the Coordinator.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">Registration Failed</div>
              <div className="text-sm text-red-800 mt-1">{error}</div>
            </div>
          </div>
        )}

        {/* Patient Information Section */}
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-opd-primary">Patient Information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Patient Name *
              </label>
              <input
                type="text"
                required
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={e => setMobileNumber(e.target.value)}
                placeholder="e.g. 9876543210"
                maxLength={10}
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                UHID / MRN (Optional)
              </label>
              <input
                type="text"
                value={uhid}
                onChange={e => setUhid(e.target.value)}
                placeholder="e.g. UH-2024-001234"
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              />
            </div>
          </div>
        </div>

        {/* Insurance Information Section */}
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-opd-primary">Insurance Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Insurer Name *
              </label>
              <input
                type="text"
                required
                value={insurerName}
                onChange={e => setInsurerName(e.target.value)}
                placeholder="e.g. ICICI Lombard"
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                TPA Name (Optional)
              </label>
              <input
                type="text"
                value={tpaName}
                onChange={e => setTpaName(e.target.value)}
                placeholder="e.g. MDIndia"
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Policy Number (Optional)
              </label>
              <input
                type="text"
                value={policyNumber}
                onChange={e => setPolicyNumber(e.target.value)}
                placeholder="e.g. POL-2024-123456"
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Policy Type (Optional)
              </label>
              <select
                value={policyType}
                onChange={e => setPolicyType(e.target.value as any)}
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              >
                <option value="">Select…</option>
                <option value="corporate">Corporate</option>
                <option value="retail">Retail</option>
              </select>
            </div>
          </div>
        </div>

        {/* Admission Information Section */}
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-opd-primary">Admission Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Admission Type (Optional)
              </label>
              <select
                value={admissionType}
                onChange={e => setAdmissionType(e.target.value as any)}
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              >
                <option value="">Select…</option>
                <option value="emergency">Emergency</option>
                <option value="planned">Planned</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Ward Type (Optional)
              </label>
              <select
                value={wardType}
                onChange={e => setWardType(e.target.value)}
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              >
                <option value="">Select…</option>
                <option value="General Ward">General Ward</option>
                <option value="Semi-Private">Semi-Private</option>
                <option value="Private">Private</option>
                <option value="Deluxe">Deluxe</option>
                <option value="ICU">ICU</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Treating Doctor (Optional)
              </label>
              <input
                type="text"
                value={treatingDoctor}
                onChange={e => setTreatingDoctor(e.target.value)}
                placeholder="e.g. Dr. Rajesh Sharma"
                className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
              />
            </div>
          </div>
        </div>

        {/* Clinical Note Section (REQUIRED) */}
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-opd-primary">Clinical Note *</h2>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
              REQUIRED
            </span>
          </div>
          <p className="text-sm text-opd-text-muted">
            Enter or dictate the doctor's clinical notes. Minimum 50 characters. This will be used for diagnosis confirmation and prior authorization.
          </p>

          <textarea
            required
            value={clinicalNote}
            onChange={e => setClinicalNote(e.target.value)}
            placeholder="e.g. Patient 45y male presenting with severe chest pain radiating to left arm for 2 hours. Vitals: BP 150/90, HR 110. Preliminary assessment: Acute Coronary Syndrome. Plan: Urgent ECG, troponin levels, cardiology consult."
            rows={6}
            className="w-full px-3 py-2 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary font-mono text-sm"
          />

          <div className="flex items-center justify-between text-xs">
            <span className={clinicalNote.length >= 50 ? 'text-emerald-600' : 'text-red-600'}>
              {clinicalNote.length} / 50 characters (minimum)
            </span>
            {clinicalNote.length >= 50 && (
              <span className="text-emerald-600 font-semibold">✓ Valid</span>
            )}
          </div>
        </div>

        {/* Documents Section (Optional) */}
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-opd-primary">Documents (Optional)</h2>
          <p className="text-sm text-opd-text-muted">
            Upload insurance card and ID documents. They will be processed with OCR to auto-populate form fields.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Insurance Card */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Insurance Card Photo
              </label>
              <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-opd-border rounded-lg hover:bg-opd-input-bg cursor-pointer transition">
                <Upload className="w-5 h-5 text-opd-text-muted" />
                <span className="text-xs font-semibold text-opd-text-secondary">
                  {insuranceCardFile ? insuranceCardFile.name : 'Click to upload'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => handleFileUpload(e, 'card')}
                  className="hidden"
                />
              </label>
            </div>

            {/* Government ID */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Government ID Photo
              </label>
              <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-opd-border rounded-lg hover:bg-opd-input-bg cursor-pointer transition">
                {extracting ? (
                  <>
                    <Loader2 className="w-5 h-5 text-opd-primary animate-spin" />
                    <span className="text-xs font-semibold text-opd-text-secondary">Extracting…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-opd-text-muted" />
                    <span className="text-xs font-semibold text-opd-text-secondary">
                      {govtIdFile ? govtIdFile.name : 'Click to upload'}
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => handleFileUpload(e, 'id')}
                  disabled={extracting}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {extractionError && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">{extractionError}</div>
            </div>
          )}

          {extractionResults && (
            <div className="space-y-4">
              {/* Document Breakdown */}
              {documentBreakdown && documentBreakdown.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-purple-900">
                    <FileText className="w-4 h-4" />
                    Document Breakdown (Multi-Page PDF Analysis)
                  </div>
                  <div className="space-y-2 text-xs">
                    {documentBreakdown.map((doc, idx) => (
                      <div key={idx} className="bg-white rounded p-2 border border-purple-100">
                        <div className="font-semibold text-gray-900">
                          Pages {doc.pageRange} — {doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}
                        </div>
                        {doc.fieldsFound.length > 0 && (
                          <div className="text-gray-700 mt-1">
                            Fields found: {doc.fieldsFound.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-purple-800">
                    Your PDF contains {documentBreakdown.length} document types. Each was analyzed separately and results merged for accuracy.
                  </p>
                </div>
              )}

              {/* Extracted Fields */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
                  <Zap className="w-4 h-4" />
                  Fields Auto-Extracted from Document
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {extractionResults.patientName && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold">
                        {extractionResults.patientName.confidence}%
                      </span>
                      <span className="text-gray-700">Patient Name</span>
                    </div>
                  )}
                  {extractionResults.insurerName && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold">
                        {extractionResults.insurerName.confidence}%
                      </span>
                      <span className="text-gray-700">Insurer</span>
                    </div>
                  )}
                  {extractionResults.policyNumber && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold">
                        {extractionResults.policyNumber.confidence}%
                      </span>
                      <span className="text-gray-700">Policy #</span>
                    </div>
                  )}
                  {extractionResults.treatingDoctor && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold">
                        {extractionResults.treatingDoctor.confidence}%
                      </span>
                      <span className="text-gray-700">Doctor</span>
                    </div>
                  )}
                  {extractionResults.admissionType && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold">
                        {extractionResults.admissionType.confidence}%
                      </span>
                      <span className="text-gray-700">Admission Type (review)</span>
                    </div>
                  )}
                  {extractionResults.wardType && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold">
                        {extractionResults.wardType.confidence}%
                      </span>
                      <span className="text-gray-700">Ward Type (review)</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-blue-800 mt-2">
                  Form fields have been auto-populated from the uploaded document(s). Review and adjust if needed.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-opd-border rounded-lg text-opd-text-secondary font-semibold hover:bg-opd-input-bg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="flex-1 px-4 py-3 bg-opd-primary text-white font-semibold rounded-lg hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Case…
              </>
            ) : (
              <>
                Create Case
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Only the essentials are required here. The Coordinator will add clinical details,
            diagnosis, ICD codes, documents, and cost estimates later. This case will appear in the Coordinator's
            Inbox immediately.
          </p>
        </div>
      </form>
    </div>
  );
};

export default CaseIntakeFlow;
