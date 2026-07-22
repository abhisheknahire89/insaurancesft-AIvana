/**
 * Phase 2: Clinical Details Accordion
 * 
 * Collapsed: Shows AI summary line
 * Expanded: Shows full note + search + source info
 * 
 * Data Flow:
 * Case Model → Extract summary fields → Display
 * On expand → POST /api/clinical/summarize → Display AI summary
 * User searches → Filter + highlight in note
 */

import React, { useState } from 'react';
import { ChevronDown, Search, RefreshCw } from 'lucide-react';

interface ClinicalDetailsAccordionProps {
  diagnosis: string;
  chiefComplaints: string;
  treatingDoctor: string;
  expectedLengthOfStay: number;
  admissionDate: string;
  clinicalNote: string;
  patientAge: number;
}

export function ClinicalDetailsAccordion({
  diagnosis,
  chiefComplaints,
  treatingDoctor,
  expectedLengthOfStay,
  admissionDate,
  clinicalNote,
  patientAge,
}: ClinicalDetailsAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const handleExpand = async () => {
    if (!isExpanded && !aiSummary) {
      setIsLoadingSummary(true);
      try {
        const response = await fetch('/api/clinical/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diagnosis,
            chiefComplaints,
            admissionDate,
            expectedLengthOfStay,
            patientAge,
          }),
        });
        if (response.ok) {
          const { summary } = await response.json();
          setAiSummary(summary);
        }
      } catch (err) {
        console.error('Failed to generate summary:', err);
      } finally {
        setIsLoadingSummary(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  // Highlight search text in clinical note
  const highlightedNote = searchText
    ? clinicalNote
        .split(new RegExp(`(${searchText})`, 'gi'))
        .map((part, idx) =>
          part.toLowerCase() === searchText.toLowerCase()
            ? `<mark>${part}</mark>`
            : part
        )
        .join('')
    : clinicalNote;

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Header - Always Visible */}
      <button
        onClick={handleExpand}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              📋 CLINICAL DETAILS
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {patientAge}y | {diagnosis} | LOS {expectedLengthOfStay}d | Dr. {treatingDoctor}
            </p>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-4 bg-gray-50">
          {/* AI Summary */}
          {isLoadingSummary ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating summary...
            </div>
          ) : aiSummary ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-900 mb-1">AI SUMMARY</p>
              <p className="text-sm text-blue-800">{aiSummary}</p>
            </div>
          ) : null}

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search in clinical note (Ctrl+F)"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Full Clinical Note */}
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-2">FULL CLINICAL NOTE</p>
            <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: highlightedNote }} />
            </div>
            <style>{`
              mark {
                background-color: #fef08a;
                padding: 2px 4px;
                border-radius: 2px;
              }
            `}</style>
          </div>

          {/* Source Info */}
          <div className="text-xs text-gray-500">
            Source: Patient Note | Confidence: 95%
          </div>
        </div>
      )}
    </div>
  );
}
