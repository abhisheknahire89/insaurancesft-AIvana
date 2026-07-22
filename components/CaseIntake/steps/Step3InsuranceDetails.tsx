import React from 'react';

interface Step3InsuranceDetailsProps {
  tpaName: string;
  policyNumber: string;
  corporateType: 'corporate' | 'retail';
  onTpaNameChange: (tpa: string) => void;
  onPolicyNumberChange: (policy: string) => void;
  onCorporateTypeChange: (type: 'corporate' | 'retail') => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3InsuranceDetails({
  tpaName,
  policyNumber,
  corporateType,
  onTpaNameChange,
  onPolicyNumberChange,
  onCorporateTypeChange,
  onNext,
  onBack,
}: Step3InsuranceDetailsProps) {
  const isFormValid = tpaName && policyNumber;

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          INSURANCE DETAILS
        </h2>
        <p className="text-sm text-gray-500">Step 3 of 5</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            TPA / Insurance Company
          </label>
          <input
            type="text"
            value={tpaName}
            onChange={(e) => onTpaNameChange(e.target.value)}
            placeholder="e.g., ICICI Lombard"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Policy Number
          </label>
          <input
            type="text"
            value={policyNumber}
            onChange={(e) => onPolicyNumberChange(e.target.value)}
            placeholder="e.g., 12345/2026"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Policy Type
          </label>
          <div className="flex gap-4">
            {[
              { value: 'corporate', label: 'Corporate' },
              { value: 'retail', label: 'Retail' },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="corporateType"
                  value={option.value}
                  checked={corporateType === option.value}
                  onChange={() => onCorporateTypeChange(option.value as 'corporate' | 'retail')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!isFormValid}
            className={`flex-1 py-3 rounded-lg font-medium ${
              isFormValid
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
