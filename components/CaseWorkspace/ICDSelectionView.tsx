/**
 * PHASE 6: ICD-10 Selection
 * Knowledge base search with AI reasoning
 */

import React, { useState } from 'react';
import { Check, ChevronRight, Search } from 'lucide-react';

interface ICDCode {
  code: string;
  description: string;
  confidence: number;
  evidence: string;
}

interface ICDSelectionViewProps {
  diagnosis: string;
  onSelect: (code: string) => void;
  onBack: () => void;
}

export function ICDSelectionView({
  diagnosis,
  onSelect,
  onBack,
}: ICDSelectionViewProps) {
  const [selected, setSelected] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Simulate ICD codes from AI recommendation
  const recommendedCodes: ICDCode[] = [
    {
      code: 'M51.26',
      description:
        'Intervertebral disc displacement, thoracic/lumbar region',
      confidence: 92,
      evidence: '"L4-L5" explicitly stated, "herniated" in note',
    },
    {
      code: 'M51.9',
      description: 'Unspecified thoracic/lumbar disc disorder',
      confidence: 78,
      evidence: 'Clinical presentation matches typical symptoms',
    },
    {
      code: 'M54.5',
      description: 'Low back pain',
      confidence: 65,
      evidence: 'Pain symptoms mentioned in clinical note',
    },
  ];

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            SELECT ICD-10 CODE
          </h2>
          <p className="text-sm text-gray-600">
            Diagnosis: <span className="font-medium">{diagnosis}</span>
          </p>
        </div>

        {/* AI Recommendations */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            AI Recommended Codes
          </h3>
          <div className="space-y-2">
            {recommendedCodes.map((icd, idx) => (
              <button
                key={icd.code}
                onClick={() => setSelected(icd.code)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selected === icd.code
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        {idx + 1}. {icd.code}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          icd.confidence >= 85
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {icd.confidence}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">
                      {icd.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      Evidence: {icd.evidence}
                    </p>
                  </div>
                  {selected === icd.code && (
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-3" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Search */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Manual Search
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ICD-10 codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Confirm <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
