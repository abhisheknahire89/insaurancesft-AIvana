/**
 * Pre-Auth Generation Modal - Workflow for generating prior authorization packets
 */

import React, { useState } from 'react';
import { Case } from '../../services/caseModel';
import { Check, AlertCircle, ChevronRight, ChevronLeft, FileText, Loader } from 'lucide-react';
import { calculateHealthScore, calculateSubmissionReadiness } from '../../services/caseHealthScoringService';

interface PreAuthGenerationModalProps {
  isOpen: boolean;
  caseRecord: Case;
  onClose: () => void;
  onGenerate?: (preAuthData: any) => void;
}

type Step = 'validation' | 'questions' | 'preview' | 'approval';

export const PreAuthGenerationModal: React.FC<PreAuthGenerationModalProps> = ({
  isOpen,
  caseRecord,
  onClose,
  onGenerate
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('validation');
  const [preAuthData, setPreAuthData] = useState<Record<string, any>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const healthScore = calculateHealthScore(caseRecord);
  const readinessScore = calculateSubmissionReadiness(caseRecord);

  if (!isOpen) return null;

  const validationChecks = {
    hasPatientName: !!caseRecord.patient.name,
    hasDiagnosis: !!caseRecord.clinical.diagnosis,
    hasIcd10: !!caseRecord.clinical.icd10Code,
    hasProcedure: !!caseRecord.clinical.proposedProcedure,
    hasLos: !!caseRecord.clinical.expectedLengthOfStay,
    hasDocuments: caseRecord.documents.length > 0,
    healthScoreOk: healthScore.score >= 80,
  };

  const allChecksPass = Object.values(validationChecks).every(Boolean);
  const blockers = readinessScore.blockers;

  const stepOrder: Step[] = ['validation', 'questions', 'preview', 'approval'];
  const currentStepIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-opd-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-opd-text-primary">Generate Prior Authorization</h2>
            <div className="text-xs text-opd-text-muted mt-1">
              Step {currentStepIndex + 1} of {stepOrder.length}
            </div>
          </div>
          <FileText className="w-6 h-6 text-opd-primary" />
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-opd-input-bg">
          <div className="flex gap-2">
            {stepOrder.map((step, i) => (
              <div key={step} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    i <= currentStepIndex ? 'bg-opd-primary' : 'bg-gray-300'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {currentStep === 'validation' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-opd-text-primary">Validation Checklist</h3>
              <div className="space-y-3">
                {[
                  { key: 'hasPatientName', label: 'Patient Name' },
                  { key: 'hasDiagnosis', label: 'Diagnosis' },
                  { key: 'hasIcd10', label: 'ICD-10 Code' },
                  { key: 'hasProcedure', label: 'Proposed Procedure' },
                  { key: 'hasLos', label: 'Expected Length of Stay' },
                  { key: 'hasDocuments', label: 'Supporting Documents' },
                  { key: 'healthScoreOk', label: 'Health Score >= 80%' },
                ].map(check => (
                  <div
                    key={check.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      validationChecks[check.key as keyof typeof validationChecks]
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    {validationChecks[check.key as keyof typeof validationChecks] ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="font-semibold">
                      {validationChecks[check.key as keyof typeof validationChecks] ? '✓' : '✗'} {check.label}
                    </span>
                  </div>
                ))}
              </div>
              {blockers.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="font-semibold text-red-900 mb-2">Blockers:</div>
                  <ul className="space-y-1 text-sm text-red-800">
                    {blockers.map((b, i) => (
                      <li key={i}>• {b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {currentStep === 'questions' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-opd-text-primary">Questions</h3>
              {['inpatientPackage', 'enhancementNeeded', 'concurrentProcedures', 'specialAuthRequired'].map(id => (
                <label key={id} className="flex items-center gap-3 p-3 border border-opd-border rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preAuthData[id] || false}
                    onChange={(e) => setPreAuthData(prev => ({ ...prev, [id]: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold capitalize">{id.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-opd-text-primary">Preview</h3>
              <div className="bg-gray-50 border border-opd-border rounded-lg p-4 max-h-48 overflow-y-auto text-xs">
                <pre>{`IRDAI Pre-Authorization Packet\n\nPatient: ${caseRecord.patient.name}\nDiagnosis: ${caseRecord.clinical.diagnosis}\nICD-10: ${caseRecord.clinical.icd10Code}\nHealth Score: ${healthScore.score}%\nReadiness: ${readinessScore.overall}%`}</pre>
              </div>
            </div>
          )}

          {currentStep === 'approval' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-opd-text-primary">Approval</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" defaultChecked />
                  <span className="text-sm">All information is accurate</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4" defaultChecked />
                  <span className="text-sm">Authorize generation and submission</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-opd-border flex items-center justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-opd-border rounded-lg font-semibold">
            Cancel
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => {
                const idx = Math.max(0, currentStepIndex - 1);
                setCurrentStep(stepOrder[idx]);
              }}
              disabled={currentStepIndex === 0}
              className="px-4 py-2 border border-opd-border rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {currentStepIndex < stepOrder.length - 1 ? (
              <button
                onClick={() => {
                  if (currentStepIndex === 0 && !allChecksPass) {
                    alert('Please address validation issues');
                    return;
                  }
                  const idx = Math.min(stepOrder.length - 1, currentStepIndex + 1);
                  setCurrentStep(stepOrder[idx]);
                }}
                className="px-4 py-2 bg-opd-primary text-white rounded-lg font-semibold flex items-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsGenerating(true);
                  setTimeout(() => {
                    onGenerate?.({ ...preAuthData, generatedAt: new Date().toISOString() });
                    setIsGenerating(false);
                    onClose();
                  }, 1000);
                }}
                disabled={isGenerating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Generate
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreAuthGenerationModal;
