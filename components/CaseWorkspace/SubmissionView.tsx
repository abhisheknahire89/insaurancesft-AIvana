/**
 * PHASE 8: Submission
 * PDF generation, TPA submission, timeline tracking
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Download, Loader2, Check, Clock } from 'lucide-react';

interface SubmissionViewProps {
  formData: Record<string, any>;
  onComplete: () => void;
}

export function SubmissionView({
  formData,
  onComplete,
}: SubmissionViewProps) {
  const [generatedPDF, setGeneratedPDF] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    // Simulate PDF generation
    const timer = setTimeout(() => {
      setGeneratedPDF(true);
      setIsGenerating(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (submitted) {
      const interval = setInterval(() => {
        setSubmissionProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + Math.random() * 40;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [submitted]);

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      onComplete();
    }, 3000);
  };

  const referenceNumber = `PAR-20260722-${Math.floor(Math.random() * 10000)}`;

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            SUBMIT AUTHORIZATION
          </h2>
          <p className="text-sm text-gray-600">
            Generate PDF and submit to TPA
          </p>
        </div>

        {/* Step 1: Generate PDF */}
        <div className="p-6 bg-white rounded-lg border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              1. Generate PDF
            </h3>
            {generatedPDF ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : isGenerating ? (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            ) : null}
          </div>
          {generatedPDF && (
            <>
              <p className="text-sm text-gray-600">
                ✓ Pre-authorization form generated (2.3 MB)
              </p>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </>
          )}
          {isGenerating && (
            <p className="text-sm text-gray-600">Generating PDF...</p>
          )}
        </div>

        {/* Step 2: Submit to TPA */}
        {generatedPDF && (
          <div className="p-6 bg-white rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                2. Submit to TPA
              </h3>
              {submitted ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Clock className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <p className="text-sm text-gray-600">
              Sending to: <span className="font-medium">ICICI Lombard</span>
            </p>
            {submitted ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className="font-medium text-green-600">Complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <button
                onClick={handleSubmit}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Submit Now
              </button>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {submitted && (
          <div className="p-6 bg-green-50 rounded-lg border border-green-200 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-900">
                  Authorization Submitted
                </h3>
                <p className="text-sm text-green-800 mt-1">
                  Successfully submitted at 10:35 AM on 22/07/2026
                </p>
              </div>
            </div>

            {/* Reference Number */}
            <div className="p-3 bg-white rounded border border-green-200">
              <p className="text-xs text-gray-600 mb-1">Reference Number</p>
              <p className="font-mono font-bold text-gray-900">
                {referenceNumber}
              </p>
            </div>

            {/* Timeline */}
            <div className="space-y-2 text-sm">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Timeline
              </p>
              <div className="flex gap-3">
                <div className="text-gray-600">22/07/2026 10:35 AM</div>
                <div className="text-gray-900 font-medium">
                  Submitted to TPA
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-gray-600">22/07/2026 02:00 PM</div>
                <div className="text-gray-900 font-medium">
                  TPA Acknowledged receipt
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-gray-400">Waiting...</div>
                <div className="text-gray-500">TPA processing</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {submitted && (
          <button
            onClick={onComplete}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Continue to Inbox
          </button>
        )}
      </div>
    </div>
  );
}
