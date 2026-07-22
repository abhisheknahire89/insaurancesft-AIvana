/**
 * PHASE 4: AI Processing Display
 * Real-time extraction progress with field-by-field updates
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface ExtractionField {
  name: string;
  status: 'pending' | 'extracting' | 'success' | 'error';
  value?: string;
  confidence?: number;
  error?: string;
}

interface ExtractionProgressViewProps {
  documentName: string;
  totalFields: number;
  onComplete: (fields: Record<string, any>) => void;
}

export function ExtractionProgressView({
  documentName,
  totalFields,
  onComplete,
}: ExtractionProgressViewProps) {
  const [fields, setFields] = useState<ExtractionField[]>([]);
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isExtracting, setIsExtracting] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Simulate field extraction with staggered timing
    const fieldNames = [
      'Patient Name',
      'Age',
      'Date of Birth',
      'Gender',
      'Diagnosis',
      'Treatment Plan',
      'Hospital Name',
      'Admission Date',
      'Length of Stay',
      'Treating Doctor',
    ];

    let fieldIndex = 0;
    const extractionInterval = setInterval(() => {
      if (fieldIndex < totalFields) {
        setFields((prev) => {
          const updated = [...prev];
          if (fieldIndex < updated.length) {
            updated[fieldIndex].status = 'success';
            updated[fieldIndex].confidence = Math.floor(Math.random() * 20 + 80);
          }
          if (fieldIndex + 1 < totalFields && fieldIndex + 1 >= updated.length) {
            updated.push({
              name: fieldNames[fieldIndex + 1] || `Field ${fieldIndex + 2}`,
              status: 'extracting',
            });
          }
          return updated;
        });

        const newProgress = Math.round(((fieldIndex + 1) / totalFields) * 100);
        setProgress(newProgress);
        fieldIndex++;
      } else {
        setIsExtracting(false);
        clearInterval(extractionInterval);
        // Call onComplete after a brief delay
        setTimeout(() => {
          const extractedData: Record<string, any> = {};
          fields.forEach((field) => {
            if (field.status === 'success') {
              extractedData[field.name.toLowerCase().replace(/\s+/g, '_')] = {
                value: field.value || `Extracted ${field.name}`,
                confidence: field.confidence,
              };
            }
          });
          onComplete(extractedData);
        }, 500);
      }
    }, 1500);

    // Initialize with first field
    setFields([
      {
        name: fieldNames[0] || 'Field 1',
        status: 'extracting',
      },
    ]);

    return () => clearInterval(extractionInterval);
  }, [totalFields, onComplete, fields.length]);

  const successCount = fields.filter((f) => f.status === 'success').length;
  const errorCount = fields.filter((f) => f.status === 'error').length;

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            EXTRACTING FIELDS
          </h2>
          <p className="text-sm text-gray-600">
            Processing: {documentName}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-bold text-blue-600">
              {progress}% ({successCount}/{totalFields})
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Extracted Fields */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">
            EXTRACTED FIELDS
          </h3>
          <div className="space-y-1">
            {fields.map((field, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  {field.status === 'success' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                  {field.status === 'extracting' && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                  )}
                  {field.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  {field.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {field.name}
                  </span>
                </div>
                {field.confidence && (
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {field.confidence}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs text-green-600 font-semibold">Success</div>
            <div className="text-2xl font-bold text-green-700 mt-1">
              {successCount}
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-600 font-semibold">Extracting</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">
              {isExtracting ? 1 : 0}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 font-semibold">Time</div>
            <div className="text-2xl font-bold text-gray-700 mt-1">
              {timeElapsed}s
            </div>
          </div>
        </div>

        {/* Message */}
        {!isExtracting && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  Extraction complete!
                </p>
                <p className="text-xs text-green-800 mt-1">
                  All fields processed successfully. Review and edit extracted data.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
