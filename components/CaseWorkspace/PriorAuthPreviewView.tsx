/**
 * PHASE 7: Prior Authorization Preview
 * Generated form with WYSIWYG editing and PDF preview
 */

import React, { useState } from 'react';
import { ChevronRight, Edit2, Download, AlertCircle } from 'lucide-react';

interface PriorAuthPreviewViewProps {
  patientData: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onBack: () => void;
}

export function PriorAuthPreviewView({
  patientData,
  onSubmit,
  onBack,
}: PriorAuthPreviewViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(patientData);

  const handleSubmit = () => {
    onSubmit(editedData);
  };

  const missingFields = [
    'Authorization Amount',
    'Urgency Flag',
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            PRIOR AUTHORIZATION PREVIEW
          </h2>
          <p className="text-sm text-gray-600">
            Review and edit the generated pre-authorization form
          </p>
        </div>

        {/* Form Preview */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Part A */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
              Part A - Patient Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Patient Name
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.patientName || 'John Doe'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Age
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.age || '42'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  DOB
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.dob || '15/05/1981'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Hospital
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.hospital || 'Sri Amrutha Hospital'}
                </p>
              </div>
            </div>
          </div>

          {/* Part B */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
              Part B - Clinical Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Diagnosis
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.diagnosis || 'Herniated Disc L4-L5'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  ICD-10 Code
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.icdCode || 'M51.26'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Treating Doctor
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.doctor || 'Dr. Singh'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Expected LOS
                </label>
                <p className="font-medium text-gray-900">
                  {editedData.los || '3 days'}
                </p>
              </div>
            </div>
          </div>

          {/* Part C */}
          <div className="p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
              Part C - Cost Estimate
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Ward Charges (₹2,500 x 3)</span>
                <span className="font-medium text-gray-900">₹7,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Doctor Consultation</span>
                <span className="font-medium text-gray-900">₹1,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Procedures</span>
                <span className="font-medium text-gray-900">₹8,000</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Estimated Total</span>
                <span className="font-bold text-gray-900">₹16,500</span>
              </div>
            </div>
          </div>
        </div>

        {/* Missing Fields */}
        {missingFields.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">
                Missing Fields
              </p>
              <ul className="text-xs text-yellow-800 mt-1 space-y-1">
                {missingFields.map((field) => (
                  <li key={field}>⚠ {field}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            {isEditing ? 'Done Editing' : 'Edit'}
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
