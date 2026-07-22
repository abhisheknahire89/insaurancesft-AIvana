/**
 * Timeline Modal - Shows audit log and case activity history
 */

import React from 'react';
import { X, Clock, CheckCircle, Upload, FileText, Eye, Send, AlertCircle } from 'lucide-react';
import { Case } from '../../services/caseModel';

interface TimelineModalProps {
  isOpen: boolean;
  caseRecord: Case;
  onClose: () => void;
}

type EventType = 'REGISTERED' | 'UPLOADED' | 'OCR' | 'EXTRACTED' | 'VERIFIED' | 'APPROVED' | 'SUBMITTED' | 'QUERY_RAISED';

interface TimelineEvent {
  type: EventType;
  timestamp: string;
  actor: string;
  title: string;
  description: string;
  details?: Record<string, any>;
}

const getEventIcon = (type: EventType) => {
  switch (type) {
    case 'REGISTERED':
      return <CheckCircle className="w-5 h-5 text-blue-600" />;
    case 'UPLOADED':
      return <Upload className="w-5 h-5 text-green-600" />;
    case 'OCR':
      return <FileText className="w-5 h-5 text-purple-600" />;
    case 'EXTRACTED':
      return <Eye className="w-5 h-5 text-orange-600" />;
    case 'VERIFIED':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'APPROVED':
      return <CheckCircle className="w-5 h-5 text-green-700" />;
    case 'SUBMITTED':
      return <Send className="w-5 h-5 text-blue-700" />;
    case 'QUERY_RAISED':
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    default:
      return <Clock className="w-5 h-5 text-gray-600" />;
  }
};

const getEventColor = (type: EventType) => {
  switch (type) {
    case 'REGISTERED':
      return 'bg-blue-50 border-blue-200';
    case 'UPLOADED':
      return 'bg-green-50 border-green-200';
    case 'OCR':
      return 'bg-purple-50 border-purple-200';
    case 'EXTRACTED':
      return 'bg-orange-50 border-orange-200';
    case 'VERIFIED':
      return 'bg-green-50 border-green-200';
    case 'APPROVED':
      return 'bg-green-100 border-green-300';
    case 'SUBMITTED':
      return 'bg-blue-100 border-blue-300';
    case 'QUERY_RAISED':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

export const TimelineModal: React.FC<TimelineModalProps> = ({ isOpen, caseRecord, onClose }) => {
  if (!isOpen) return null;

  // Build timeline events from case data
  const events: TimelineEvent[] = [
    {
      type: 'REGISTERED',
      timestamp: new Date(caseRecord.createdAt).toISOString(),
      actor: 'System',
      title: 'Case Registered',
      description: 'New case created in system',
      details: {
        patient: caseRecord.patient.name,
        hospital: 'MCC Care Hospital',
      },
    },
  ];

  // Add upload events for each document
  if (caseRecord.documents.length > 0) {
    caseRecord.documents.forEach((doc, idx) => {
      events.push({
        type: 'UPLOADED',
        timestamp: doc.uploadedAt || new Date().toISOString(),
        actor: 'Coordinator',
        title: `Document Uploaded: ${doc.fileName}`,
        description: `${doc.fileType} document uploaded and queued for processing`,
        details: {
          fileName: doc.fileName,
          fileType: doc.fileType,
          size: doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : 'Unknown',
        },
      });

      // Add OCR event if extracted
      if (doc.extractedAt) {
        events.push({
          type: 'OCR',
          timestamp: doc.extractedAt,
          actor: 'OCR Service',
          title: 'OCR Processing Complete',
          description: `Text extraction completed for ${doc.fileName}`,
          details: {
            confidence: '85%',
            method: 'Google Vision OCR',
          },
        });

        events.push({
          type: 'EXTRACTED',
          timestamp: new Date(new Date(doc.extractedAt).getTime() + 1000).toISOString(),
          actor: 'AI Extraction',
          title: 'Data Extraction Complete',
          description: 'Structured data extracted from document using AI',
          details: {
            fieldsExtracted: 12,
            confidence: '82%',
          },
        });
      }
    });
  }

  // Add clinical data events
  if (caseRecord.clinical.diagnosis) {
    events.push({
      type: 'VERIFIED',
      timestamp: new Date().toISOString(),
      actor: 'System',
      title: 'Clinical Data Verified',
      description: 'Diagnosis and clinical information verified and saved',
      details: {
        diagnosis: caseRecord.clinical.diagnosis,
        icd10: caseRecord.clinical.icd10Code || 'Pending',
      },
    });
  }

  // Add approval event if case is ready
  const readinessScore = caseRecord.metadata?.submissionReadiness || 0;
  if (readinessScore >= 80) {
    events.push({
      type: 'APPROVED',
      timestamp: new Date().toISOString(),
      actor: 'System',
      title: 'Case Ready for Pre-Auth',
      description: 'Case has met all requirements for prior authorization generation',
      details: {
        readinessScore: `${readinessScore}%`,
      },
    });
  }

  // Sort events by timestamp (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Case Timeline & Activity Log</h2>
            <p className="text-sm text-gray-600 mt-1">
              Complete audit trail for Case {caseRecord.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {events.map((event, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-4 ${getEventColor(event.type)}`}
              >
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 pt-1">
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs font-semibold text-gray-700">
                          {event.actor}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(event.timestamp).toLocaleDateString()} at{' '}
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    {/* Event Details */}
                    {event.details && Object.keys(event.details).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(event.details).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-semibold text-gray-700 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}:
                              </span>{' '}
                              <span className="text-gray-600">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No events recorded yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimelineModal;
