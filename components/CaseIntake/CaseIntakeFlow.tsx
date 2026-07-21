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
import { ChevronRight, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Case, newCase, updateCompletenessMetric } from '../../services/caseModel';
import { saveCase } from '../../services/masterPatientRecord';

interface CaseIntakeFlowProps {
  onCaseCreated: (caseRecord: Case) => void;
  onCancel: () => void;
  intakeChannel?: 'qr_scan' | 'manual' | 'document_upload';
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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    patientName.trim() &&
    mobileNumber.trim() &&
    insurerName.trim() &&
    (policyNumber.trim() || tpaName.trim());

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'card' | 'id') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'card') {
        setInsuranceCardFile(file);
      } else {
        setGovtIdFile(file);
      }
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
      if (treatingDoctor) newCaseRecord.clinical.wardType = treatingDoctor;

      // Mark intake channel
      newCaseRecord.intakeChannel = intakeChannel;

      // TODO: If documents were uploaded, process them with OCR/extraction
      // For now, just mark that they exist
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

        {/* Documents Section (Optional) */}
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-opd-primary">Documents (Optional)</h2>
          <p className="text-sm text-opd-text-muted">
            Upload insurance card and ID documents. They will be processed with OCR.
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
                <Upload className="w-5 h-5 text-opd-text-muted" />
                <span className="text-xs font-semibold text-opd-text-secondary">
                  {govtIdFile ? govtIdFile.name : 'Click to upload'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => handleFileUpload(e, 'id')}
                  className="hidden"
                />
              </label>
            </div>
          </div>
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
