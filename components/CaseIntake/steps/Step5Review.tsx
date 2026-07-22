import React from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { PatientRegistrationFormData } from '../PatientRegistrationFlow';

interface Step5ReviewProps {
  formData: PatientRegistrationFormData;
  onCreate: () => Promise<void>;
  onBack: () => void;
  isCreating: boolean;
}

function ReviewRow({ label, value, status }: { label: string; value: string; status?: 'complete' | 'error' }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
        {status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
        {status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
      </div>
    </div>
  );
}

export function Step5Review({
  formData,
  onCreate,
  onBack,
  isCreating,
}: Step5ReviewProps) {
  const missingFields = [];
  if (!formData.patientName) missingFields.push('Patient Name');
  if (!formData.mobile) missingFields.push('Mobile');
  if (!formData.dateOfBirth) missingFields.push('DOB');
  if (!formData.gender) missingFields.push('Gender');
  if (!formData.tpaName) missingFields.push('TPA');
  if (!formData.policyNumber) missingFields.push('Policy');

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          REVIEW & CREATE
        </h2>
        <p className="text-sm text-gray-500">Step 5 of 5</p>
      </div>

      <div className="space-y-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">PATIENT</h3>
          <div className="space-y-2">
            <ReviewRow label="Name" value={formData.patientName} status={formData.patientName ? 'complete' : 'error'} />
            <ReviewRow label="Mobile" value={formData.mobile} status={formData.mobile ? 'complete' : 'error'} />
            <ReviewRow label="DOB" value={formData.dateOfBirth} status={formData.dateOfBirth ? 'complete' : 'error'} />
            <ReviewRow 
              label="Gender" 
              value={formData.gender === 'M' ? 'Male' : formData.gender === 'F' ? 'Female' : 'Other'} 
              status={formData.gender ? 'complete' : 'error'} 
            />
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">INSURANCE</h3>
          <div className="space-y-2">
            <ReviewRow label="TPA" value={formData.tpaName} status={formData.tpaName ? 'complete' : 'error'} />
            <ReviewRow label="Policy" value={formData.policyNumber} status={formData.policyNumber ? 'complete' : 'error'} />
            <ReviewRow label="Type" value={formData.corporateType === 'corporate' ? 'Corporate' : 'Retail'} status="complete" />
          </div>
        </div>

        {formData.documents.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">DOCUMENTS</h3>
            <div className="space-y-2">
              {formData.documents.map((doc) => (
                <ReviewRow key={doc.id} label={doc.name} value={doc.status === 'processed' ? '✓' : 'Processing'} />
              ))}
            </div>
          </div>
        )}

        {missingFields.length > 0 && (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-red-900">Missing: {missingFields.join(', ')}</p>
              </div>
            </div>
          </div>
        )}

        {missingFields.length === 0 && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-green-900">All required fields complete</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            disabled={isCreating}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={onCreate}
            disabled={isCreating || missingFields.length > 0}
            className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
              missingFields.length === 0 && !isCreating
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
            {isCreating ? 'Creating...' : 'Create Case →'}
          </button>
        </div>
      </div>
    </div>
  );
}
