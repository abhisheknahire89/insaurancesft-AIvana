/**
 * QueryRaisedView — TPA Query Response Workflow
 *
 * Renders when case status = "query_raised"
 * Displays TPA's query + AI-generated suggested response + supporting docs
 *
 * Uses existing tpaQueryPredictionService engine
 */

import React, { useState, useEffect } from 'react';
import {
  MessageSquare, AlertCircle, CheckCircle2, Send, Loader2,
  FileText, Plus
} from 'lucide-react';
import { Case } from '../../../services/caseModel';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { recordQueryResponse } from '../../../services/masterPatientRecord';

interface QueryRaisedViewProps {
  caseRecord: Case;
  onUpdate: (updated: Case) => void;
}

export const QueryRaisedView: React.FC<QueryRaisedViewProps> = ({
  caseRecord,
  onUpdate
}) => {
  const [responseText, setResponseText] = useState(
    caseRecord.authorization.queryResponseText || ''
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryDetails = caseRecord.authorization.queryDetails || '';

  const handleGenerateResponse = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // TODO: Call generateQueryResponse() from queryResponseService
      // For now, show placeholder
      setResponseText(
        'Dear [TPA Name],\n\n' +
        'Thank you for your query regarding the above mentioned case.\n\n' +
        'We herewith furnish the following additional information:\n\n' +
        '1. [Evidence item 1]\n' +
        '2. [Evidence item 2]\n' +
        '3. [Evidence item 3]\n\n' +
        'Please find attached the supporting documents.\n\n' +
        'Yours sincerely,\n[Hospital Name]'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate response');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendResponse = async () => {
    if (!responseText.trim()) {
      setError('Response cannot be empty');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await recordQueryResponse(
        caseRecord.id,
        caseRecord.authorization.id,
        'pre_auth',
        responseText
      );

      // Update local state
      const updated = { ...caseRecord };
      updated.authorization.queryResponseText = responseText;
      updated.authorization.queryRespondedAt = new Date().toISOString();
      updated.status = 'submitted_to_tpa'; // Back to awaiting TPA review
      onUpdate(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to send response');
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* TPA Query Details */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          TPA Query Received
        </h3>

        <div className="space-y-2">
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Query Date:</span>{' '}
            {caseRecord.authorization.queryRaisedAt
              ? new Date(caseRecord.authorization.queryRaisedAt).toLocaleDateString()
              : 'Recent'}
          </div>

          <div className="mt-4 p-4 bg-white border border-amber-100 rounded-lg">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              TPA's Query
            </div>
            <div className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
              {queryDetails || 'Query details pending...'}
            </div>
          </div>
        </div>
      </div>

      {/* AI-Suggested Response */}
      <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-opd-primary">Response to TPA</h3>
          <button
            onClick={handleGenerateResponse}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-opd-primary border border-opd-primary rounded-lg hover:bg-opd-input-bg transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Generate AI Draft
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <textarea
          value={responseText}
          onChange={e => setResponseText(e.target.value)}
          rows={8}
          placeholder="Draft your response to the TPA query here. Click 'Generate AI Draft' for an AI-assisted starting point."
          className="w-full p-3 border border-opd-border rounded-lg font-mono text-sm resize-none focus:outline-none focus:border-opd-primary"
        />

        <div className="text-xs text-opd-text-muted">
          Response will be sent back to TPA. TPA may request further information or make a decision.
        </div>
      </div>

      {/* Supporting Documents */}
      <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-opd-primary">Supporting Documents</h3>

        <div className="space-y-2">
          {caseRecord.documents.length > 0 ? (
            caseRecord.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 border border-opd-border rounded-lg hover:bg-opd-input-bg transition">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-opd-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-opd-text-primary truncate">
                      {doc.name}
                    </div>
                    <div className="text-xs text-opd-text-muted">
                      Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {doc.extractedData && (
                  <ProvenanceBadge
                    provenance={{
                      confidence: doc.extractionConfidence || 85,
                      source: doc.name,
                      timestamp: doc.extractedAt,
                    }}
                    variant="inline"
                  />
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-opd-text-muted text-center py-4">
              No documents uploaded yet. Consider attaching supporting reports.
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button className="flex-1 px-4 py-3 border border-opd-border text-opd-text-secondary font-semibold rounded-lg hover:bg-opd-input-bg transition">
          Request More Information from Doctor
        </button>
        <button
          onClick={handleSendResponse}
          disabled={!responseText.trim() || isSending}
          className="flex-1 px-4 py-3 bg-opd-primary text-white font-semibold rounded-lg hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Response to TPA
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default QueryRaisedView;
