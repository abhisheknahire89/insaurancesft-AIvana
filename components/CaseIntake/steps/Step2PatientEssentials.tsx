import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface Step2PatientEssentialsProps {
  mobile: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O' | '';
  onMobileChange: (mobile: string) => void;
  onDateOfBirthChange: (dob: string) => void;
  onGenderChange: (gender: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function isValidMobile(mobile: string): boolean {
  return /^[0-9]{10}$/.test(mobile);
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const [day, month, year] = parts.map((p) => parseInt(p, 10));
  return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900;
}

export function Step2PatientEssentials({
  mobile,
  dateOfBirth,
  gender,
  onMobileChange,
  onDateOfBirthChange,
  onGenderChange,
  onNext,
  onBack,
}: Step2PatientEssentialsProps) {
  const [touched, setTouched] = useState({ mobile: false, dateOfBirth: false });

  const isMobileValid = !mobile || isValidMobile(mobile);
  const isDOBValid = !dateOfBirth || isValidDate(dateOfBirth);
  const isFormValid = mobile && dateOfBirth && gender && isMobileValid && isDOBValid;

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          PATIENT ESSENTIALS
        </h2>
        <p className="text-sm text-gray-500">Step 2 of 5</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Number (10 digits)
          </label>
          <input
            type="text"
            value={mobile}
            onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setTouched((prev) => ({ ...prev, mobile: true }))}
            placeholder="9876543210"
            maxLength={10}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {touched.mobile && mobile && !isMobileValid && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Enter 10 digit mobile
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date of Birth (DD/MM/YYYY)
          </label>
          <input
            type="text"
            value={dateOfBirth}
            onChange={(e) => onDateOfBirthChange(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, dateOfBirth: true }))}
            placeholder="15/05/1980"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {touched.dateOfBirth && dateOfBirth && !isDOBValid && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Invalid date format
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Gender
          </label>
          <div className="flex gap-4">
            {[
              { value: 'M', label: 'Male' },
              { value: 'F', label: 'Female' },
              { value: 'O', label: 'Other' },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender"
                  value={option.value}
                  checked={gender === option.value}
                  onChange={(e) => onGenderChange(e.target.value)}
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
            Verify →
          </button>
        </div>
      </div>
    </div>
  );
}
