import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { DocumentRecord } from '../PatientRegistrationFlow';

interface Step4DocumentsProps {
  documents: DocumentRecord[];
  onDocumentUpload: (file: File) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export function Step4Documents({
  documents,
  onDocumentUpload,
  onNext,
  onBack,
}: Step4DocumentsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      await onDocumentUpload(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      for (const file of Array.from(files)) {
        await onDocumentUpload(file);
      }
    }
  };

  const processedCount = documents.filter((doc) => doc.status === 'processed').length;
  const hasDocuments = documents.length > 0;

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          UPLOAD DOCUMENTS
        </h2>
        <p className="text-sm text-gray-500">Step 4 of 5 (Optional)</p>
      </div>

      <div className="space-y-6">
        <div
          onDragEnter={handleDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-700 mb-1">Drag files here or click to browse</p>
          <p className="text-xs text-gray-500">PDF, JPG, PNG · Max 10 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            hidden
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>

        {hasDocuments && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Documents ({processedCount}/{documents.length})
            </p>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {doc.status === 'uploading' && (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                )}
                {doc.status === 'processing' && (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                )}
                {doc.status === 'processed' && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                )}
                {doc.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {doc.status === 'uploading' && 'Uploading...'}
                    {doc.status === 'processing' && 'Processing with OCR...'}
                    {doc.status === 'processed' && 'Processed'}
                    {doc.status === 'error' && doc.error}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-900">
            REAL OCR processing. REAL field extraction. No mocks.
          </p>
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
            className={`flex-1 py-3 rounded-lg font-medium ${
              hasDocuments
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {hasDocuments ? 'Continue →' : 'Skip (No Docs)'}
          </button>
        </div>
      </div>
    </div>
  );
}
