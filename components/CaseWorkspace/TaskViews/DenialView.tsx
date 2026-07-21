/**
 * DenialView — Denial Analysis & Appeal Generation Workflow
 *
 * Renders when case status = "denied"
 * Displays denial reason + AI-generated citation-grounded appeal + supporting evidence
 *
 * Uses existing denialAppealGenerator engine (real, grounded, not fake)
 */

import React, { useState, useEffect } from 'react';
import {
  Scale, AlertTriangle, CheckCircle2, Send, Loader2,
  FileText, Play, Plus, Copy
} from 'lucide-react';
import { Case, AppealRecord, generateActivityId } from '../../../services/caseModel';
import { ProvenanceBadge } from '../ProvenanceBadge';
import { saveAppeal, updateAppealStatus } from '../../../services/masterPatientRecord';
import { generateDenialAppeal } from '../../../engine/denialAppealGenerator';

interface DenialViewProps {
  caseRecord: Case;
  onUpdate: (updated: Case) => void;
}

export const DenialView: React.FC<DenialViewProps> = ({
  caseRecord,
  onUpdate
}) => {
  const [appealDraft, setAppealDraft] = useState<AppealRecord | null>(caseRecord.appeal || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'analyze' | 'review' | 'submitted'>(
    caseRecord.appeal?.appealStatus === 'submitted' ? 'submitted' : 'analyze'
  );

  const denialReason = caseRecord.authorization.denialReason || 'Reason not specified';

  const handleGenerateAppeal = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // Call real denialAppealGenerator engine
      const result = await generateDenialAppeal(caseRecord);

      const newAppeal: AppealRecord = {
        id: `APPEAL-${Date.now()}`,
        denialReason: denialReason,
        appealStatus: 'draft',
        appealLetterEnglish: result.appealText,
        appealLetterHindi: result.hindiTranslation,
        citedEvidence: result.citedEvidence,
        reasonsAddressed: result.addressedCount,
        totalReasons: result.totalReasons,
        priorityScore: result.priorityScore,
        groundedCitations: true,
        generatedAt: new Date().toISOString(),
        generatedBy: 'ai_assisted',
      };

      setAppealDraft(newAppeal);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to generate appeal');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (!appealDraft) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await saveAppeal(caseRecord.id, appealDraft);
      await updateAppealStatus(caseRecord.id, 'submitted');

      // Update local state
      const updated = { ...caseRecord };
      updated.appeal = appealDraft;
      updated.status = 'submitted_to_tpa';
      updated.activities.push({
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        event: 'appeal_submitted',
        description: `Appeal submitted with ${appealDraft.reasonsAddressed}/${appealDraft.totalReasons} reasons addressed`,
      });

      onUpdate(updated);
      setStep('submitted');
    } catch (err: any) {
      setError(err.message || 'Failed to submit appeal');
      setIsSubmitting(false);
    }
  };

  const handleDeclineAppeal = () => {
    // Mark case as completed (no appeal)
    const updated = { ...caseRecord };
    updated.status = 'completed';
    updated.activities.push({
      id: generateActivityId(),
      timestamp: new Date().toISOString(),
      event: 'case_created', // TODO: add 'denial_not_appealed' event type
      description: 'Denial not appealed. Case closed.',
    });
    onUpdate(updated);
  };

  // Submitted state
  if (step === 'submitted' && appealDraft?.appealStatus === 'submitted') {
    return (
      <div className="space-y-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-emerald-900 mb-1">Appeal Submitted</h2>
          <p className="text-emerald-800">
            Your appeal has been submitted to the TPA. You'll be notified when they respond.
          </p>
        </div>

        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-3">
          <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Appeal Summary</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-opd-text-muted">Submitted:</span>
              <span className="font-semibold text-opd-text-primary">
                {appealDraft.submittedAt ? new Date(appealDraft.submittedAt).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-opd-text-muted">Reasons Addressed:</span>
              <span className="font-semibold text-opd-text-primary">
                {appealDraft.reasonsAddressed}/{appealDraft.totalReasons}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-opd-text-muted">Priority Score:</span>
              <span className="font-semibold text-opd-text-primary">
                {appealDraft.priorityScore}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Review/Draft state
  return (
    <div className="space-y-6">
      {/* Denial Summary */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Denial Received
        </h3>

        <div className="p-4 bg-white border border-red-100 rounded-lg">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            TPA's Denial Reason
          </div>
          <div className="text-sm text-red-900 leading-relaxed">
            {denialReason}
          </div>
        </div>
      </div>

      {/* Appeal Draft */}
      {!appealDraft ? (
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4 text-center">
          <Scale className="w-12 h-12 text-opd-text-muted mx-auto opacity-50" />
          <div>
            <div className="text-lg font-bold text-opd-primary mb-1">Generate Appeal Letter</div>
            <p className="text-sm text-opd-text-muted mb-4">
              AI will analyze the denial reason and generate a citation-grounded appeal letter using available evidence.
            </p>
            <button
              onClick={handleGenerateAppeal}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-opd-primary text-white font-bold rounded-lg hover:opacity-95 transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Appeal…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate Appeal Draft
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-opd-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-opd-primary">Appeal Letter Draft</h3>
            {appealDraft.groundedCitations && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Citation-Grounded
              </div>
            )}
          </div>

          {/* Appeal Text */}
          <div className="p-4 bg-opd-input-bg border border-opd-border rounded-lg font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {appealDraft.appealLetterEnglish}
          </div>

          {/* Cited Evidence */}
          {appealDraft.citedEvidence.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">
                Supporting Evidence Cited
              </div>
              <div className="space-y-1">
                {appealDraft.citedEvidence.map((evidence, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-opd-text-primary p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{evidence}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs p-3 bg-opd-input-bg rounded-lg">
            <div>
              <div className="font-bold text-opd-primary">{appealDraft.reasonsAddressed}</div>
              <div className="text-opd-text-muted">of {appealDraft.totalReasons} reasons</div>
            </div>
            <div>
              <div className="font-bold text-opd-primary">{appealDraft.priorityScore}%</div>
              <div className="text-opd-text-muted">priority score</div>
            </div>
            <div>
              <div className="font-bold text-opd-primary">{appealDraft.citedEvidence.length}</div>
              <div className="text-opd-text-muted">evidence items</div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleDeclineAppeal}
          className="flex-1 px-4 py-3 border border-opd-border text-opd-text-secondary font-semibold rounded-lg hover:bg-opd-input-bg transition"
        >
          Close Case (No Appeal)
        </button>

        {appealDraft && (
          <button
            onClick={handleSubmitAppeal}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-opd-primary text-white font-semibold rounded-lg hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Appeal to TPA
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default DenialView;
