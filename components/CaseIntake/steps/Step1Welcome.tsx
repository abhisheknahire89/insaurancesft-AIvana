import React from 'react';
import { Upload } from 'lucide-react';

interface Step1WelcomeProps {
  patientName: string;
  onPatientNameChange: (name: string) => void;
  onNext: () => void;
  onDocumentUpload: () => void;
}

export function Step1Welcome({
  patientName,
  onPatientNameChange,
  onNext,
  onDocumentUpload,
}: Step1WelcomeProps) {
  const isValid = patientName.trim().length > 0;

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          CREATE NEW PRE-AUTHORIZATION
        </h2>
        <p className="text-sm text-gray-500">Step 1 of 5</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient Name
          </label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => onPatientNameChange(e.target.value)}
            placeholder="Full name as per ID"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <button
          onClick={onDocumentUpload}
          className="w-full py-3 flex items-center justify-center gap-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
        >
          <Upload className="w-4 h-4" />
          Upload Documents (Optional)
        </button>

        <button
          onClick={onNext}
          disabled={!isValid}
          className={`w-full py-3 rounded-lg font-medium ${
            isValid
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
