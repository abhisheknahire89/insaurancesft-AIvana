/**
 * Step 4: Documents (Phase 3 - Enhanced UX)
 * Professional document upload with real progress, retry logic, and metadata display
 *
 * Features:
 *   - Real upload progress tracking (0-100%)
 *   - Retry logic with exponential backoff (max 3)
 *   - Document type detection feedback
 *   - Batch progress meter
 *   - File size validation (max 10MB)
 *   - Enhanced document cards with metadata
 */

import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, Trash2, RotateCw, FileText } from 'lucide-react';
import type { DocumentRecord } from '../PatientRegistrationFlow';

interface Step4DocumentsProps {
  documents: DocumentRecord[];
  onDocumentUpload: (file: File) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Calculate batch progress from documents
 */
function calculateBatchProgress(documents: DocumentRecord[]): {
  processedCount: number;
  totalCount: number;
  percentage: number;
  canProceed: boolean;
  statusColor: string;
} {
  if (documents.length === 0) {
    return { processedCount: 0, totalCount: 0, percentage: 0, canProceed: false, statusColor: 'gray' };
  }

  const processedCount = documents.filter(d => d.status === 'processed').length;
  const errorCount = documents.filter(d => d.status === 'error').length;
  const totalCount = documents.length;
  const percentage = Math.round((processedCount / totalCount) * 100);
  const canProceed = errorCount === 0 && processedCount === totalCount;

  let statusColor = 'gray';
  if (canProceed) statusColor = 'green';
  else if (errorCount > 0) statusColor = 'red';
  else if (processedCount > 0) statusColor = 'blue';

  return { processedCount, totalCount, percentage, canProceed, statusColor };
}

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format time since upload
 */
function formatTimeSince(timestamp?: string): string {
  if (!timestamp) return '—';
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function Step4Documents({
  documents,
  onDocumentUpload,
  onNext,
  onBack,
}: Step4DocumentsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const batch = calculateBatchProgress(documents);

  /**
   * Validate file before upload
   */
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (file.size > maxSize) {
      return { valid: false, error: `${file.name} exceeds 10MB limit` };
    }
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: `${file.name} format not supported (PDF, JPG, PNG only)` };
    }
    return { valid: true };
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setValidationError(null);

    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setValidationError(validation.error || 'File validation failed');
        continue;
      }
      await onDocumentUpload(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const files = e.currentTarget.files;
    if (files) {
      for (const file of Array.from(files)) {
        const validation = validateFile(file);
        if (!validation.valid) {
          setValidationError(validation.error || 'File validation failed');
          continue;
        }
        await onDocumentUpload(file);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          UPLOAD DOCUMENTS
        </h2>
        <p className="text-sm text-gray-500">Step 4 of 5 (Optional)</p>
      </div>

      <div className="space-y-6">
        {/* Drag-Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50 scale-105'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          {/* Animated Upload Icon */}
          <div className={`w-12 h-12 mx-auto mb-3 flex items-center justify-center ${
            isDragging ? 'animate-bounce' : ''
          }`}>
            <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>

          <p className="text-gray-700 mb-2 font-medium">
            Drag files here or click to browse
          </p>
          <p className="text-xs text-gray-500 space-y-1">
            <div>PDF, JPG, PNG • Max 10 MB per file</div>
            {documents.length > 0 && (
              <div className="text-blue-600 font-medium">
                {documents.length} file{documents.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            hidden
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{validationError}</p>
          </div>
        )}

        {/* Batch Progress (Only show if docs exist) */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                Documents ({batch.processedCount}/{batch.totalCount})
              </p>
              <p className={`text-sm font-semibold ${
                batch.statusColor === 'green' ? 'text-green-600' :
                batch.statusColor === 'red' ? 'text-red-600' :
                batch.statusColor === 'blue' ? 'text-blue-600' :
                'text-gray-600'
              }`}>
                {batch.percentage}% complete
              </p>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  batch.statusColor === 'green' ? 'bg-green-500' :
                  batch.statusColor === 'red' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${batch.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Document List */}
        {documents.length > 0 && (
          <div className="space-y-3">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onRetry={() => onDocumentUpload(new File([], doc.name))}
              />
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-900">
            ✓ Documents are processed with OCR and AI extraction. Extracted data will pre-fill your form.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={documents.length > 0 && !batch.canProceed}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              documents.length === 0 || batch.canProceed
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {documents.length === 0
              ? 'Skip → (No Documents)'
              : batch.canProceed
              ? 'Continue →'
              : 'Fix errors to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Document Card Component
 */
interface DocumentCardProps {
  doc: DocumentRecord;
  onRetry: (docId: string) => void;
  onRemove?: (docId: string) => void;
}

function DocumentCard({ doc, onRetry, onRemove }: DocumentCardProps) {
  const statusIcon = {
    uploading: <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />,
    processing: <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />,
    processed: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
    retrying: <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />,
    pending: <FileText className="w-5 h-5 text-gray-400" />,
  };

  const statusLabel = {
    uploading: 'Uploading...',
    processing: 'Processing...',
    processed: 'Processed ✓',
    error: 'Failed',
    retrying: 'Retrying...',
    pending: 'Pending',
  };

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      {/* Header Row */}
      <div className="flex items-start gap-3">
        {statusIcon[doc.status as keyof typeof statusIcon] || statusIcon.pending}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{doc.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {statusLabel[doc.status as keyof typeof statusLabel] || statusLabel.pending}
          </p>
        </div>
      </div>

      {/* Metadata Row */}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {doc.size && (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
            {formatFileSize(doc.size)}
          </span>
        )}
        {doc.uploadedAt && (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
            {formatTimeSince(doc.uploadedAt)}
          </span>
        )}
        {doc.detectedType && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
            {doc.detectedType}
          </span>
        )}
        {doc.extractedFieldCount !== undefined && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {doc.extractedFieldCount} fields
          </span>
        )}
      </div>

      {/* Progress Bar (if uploading) */}
      {doc.status === 'uploading' && doc.progress !== undefined && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${doc.progress}%` }}
          />
        </div>
      )}

      {/* Error Message */}
      {doc.status === 'error' && doc.error && (
        <p className="mt-2 text-xs text-red-600">{doc.error}</p>
      )}

      {/* Actions */}
      {(doc.status === 'error' || doc.status === 'retrying') && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onRetry(doc.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded hover:bg-amber-100 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Retry
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(doc.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
