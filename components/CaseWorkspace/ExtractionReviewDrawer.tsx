/**
 * PHASE 5: Extraction Review
 * Edit and approve extracted fields with confidence badges
 */

import React, { useState } from 'react';
import { ChevronDown, Check, AlertCircle, Edit2 } from 'lucide-react';

interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
  source: string;
}

interface ExtractionReviewDrawerProps {
  fields: ExtractedField[];
  onApprove: (approvedFields: Record<string, string>) => void;
  onBack: () => void;
}

export function ExtractionReviewDrawer({
  fields,
  onApprove,
  onBack,
}: ExtractionReviewDrawerProps) {
  const [editedFields, setEditedFields] = useState<Record<string, string>>(
    fields.reduce((acc, f) => ({ ...acc, [f.label]: f.value }), {})
  );
  const [editingField, setEditingField] = useState<string | null>(null);

  const handleApprove = () => {
    onApprove(editedFields);
  };

  const groupedFields = {
    'Patient Information': fields.slice(0, 3),
    'Medical Information': fields.slice(3),
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            REVIEW EXTRACTED FIELDS
          </h2>
          <p className="text-sm text-gray-600">
            Verify and edit extracted data before proceeding
          </p>
        </div>

        {/* Field Groups */}
        {Object.entries(groupedFields).map(([groupName, groupFields]) => (
          <div key={groupName} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              {groupName}
            </h3>
            <div className="space-y-2">
              {groupFields.map((field, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                        {field.label}
                      </label>
                      {editingField === field.label ? (
                        <input
                          type="text"
                          value={editedFields[field.label] || ''}
                          onChange={(e) =>
                            setEditedFields({
                              ...editedFields,
                              [field.label]: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onBlur={() => setEditingField(null)}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900">
                          {editedFields[field.label] || field.value}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          field.confidence >= 90
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {field.confidence}%
                      </span>
                      <button
                        onClick={() => setEditingField(field.label)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Source: {field.source}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Approve & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
