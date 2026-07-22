/**
 * Workflow Orchestrator
 * Manages transitions between all phases (1-8) with state management
 */

import React, { useState } from 'react';
import { Case } from '../../services/caseModel';
import { ClinicalDetailsAccordion } from './ClinicalDetailsAccordion';
import { ExtractionProgressView } from './ExtractionProgressView';
import { ExtractionReviewDrawer } from './ExtractionReviewDrawer';
import { ICDSelectionView } from './ICDSelectionView';
import { PriorAuthPreviewView } from './PriorAuthPreviewView';
import { SubmissionView } from './SubmissionView';

type WorkflowPhase = 'clinical' | 'extraction' | 'review' | 'icd' | 'priorauth' | 'submission' | 'complete';

interface WorkflowOrchestratorProps {
  caseRecord: Case;
  onComplete: () => void;
}

export function WorkflowOrchestrator({
  caseRecord,
  onComplete,
}: WorkflowOrchestratorProps) {
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>('clinical');
  const [extractedFields, setExtractedFields] = useState<Record<string, any>>({});
  const [selectedICD, setSelectedICD] = useState('');
  const [submittedData, setSubmittedData] = useState<Record<string, any>>({});

  const handleExtractionComplete = (fields: Record<string, any>) => {
    setExtractedFields(fields);
    setCurrentPhase('review');
  };

  const handleReviewComplete = (approvedFields: Record<string, any>) => {
    setExtractedFields(approvedFields);
    setCurrentPhase('icd');
  };

  const handleICDSelect = (code: string) => {
    setSelectedICD(code);
    setCurrentPhase('priorauth');
  };

  const handlePriorAuthSubmit = (data: Record<string, any>) => {
    setSubmittedData(data);
    setCurrentPhase('submission');
  };

  const handleSubmissionComplete = () => {
    setCurrentPhase('complete');
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Phase Indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                AIVANA Pre-Authorization Workflow
              </h2>
              <p className="text-xs text-gray-600 mt-1 uppercase tracking-wide">
                Case {caseRecord.id} · {caseRecord.patient.name}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Phase:
              </div>
              <div className="text-sm font-bold text-blue-600 mt-1">
                {currentPhase.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {currentPhase === 'clinical' && (
          <div className="py-8 px-6">
            <ClinicalDetailsAccordion
              diagnosis={caseRecord.clinical.diagnosis || ''}
              chiefComplaints={caseRecord.clinical.chiefComplaints || ''}
              treatingDoctor={caseRecord.clinical.treatingDoctor || ''}
              expectedLengthOfStay={caseRecord.clinical.expectedLengthOfStay || 0}
              admissionDate={caseRecord.clinical.admissionDate || ''}
              clinicalNote={caseRecord.clinical.clinicalNote?.originalText || ''}
              patientAge={caseRecord.patient.age || 0}
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setCurrentPhase('extraction')}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Proceed to Extraction →
              </button>
            </div>
          </div>
        )}

        {currentPhase === 'extraction' && (
          <ExtractionProgressView
            documentName={caseRecord.documents[0]?.name || 'document.pdf'}
            totalFields={10}
            onComplete={handleExtractionComplete}
          />
        )}

        {currentPhase === 'review' && (
          <ExtractionReviewDrawer
            fields={[
              { label: 'Patient Name', value: caseRecord.patient.name, confidence: 95, source: 'document.pdf, page 1' },
              { label: 'Age', value: String(caseRecord.patient.age || 42), confidence: 100, source: 'page 1, lines 2-3' },
              { label: 'Date of Birth', value: caseRecord.patient.dateOfBirth || '', confidence: 88, source: 'page 1, line 5' },
              { label: 'Diagnosis', value: caseRecord.clinical.diagnosis || '', confidence: 92, source: 'page 2, clinical section' },
              { label: 'Treatment Plan', value: 'Surgical intervention', confidence: 85, source: 'page 3' },
              { label: 'Hospital', value: caseRecord.hospital?.name || 'Hospital', confidence: 100, source: 'header' },
            ]}
            onApprove={handleReviewComplete}
            onBack={() => setCurrentPhase('clinical')}
          />
        )}

        {currentPhase === 'icd' && (
          <ICDSelectionView
            diagnosis={caseRecord.clinical.diagnosis || 'Herniated Disc L4-L5'}
            onSelect={handleICDSelect}
            onBack={() => setCurrentPhase('review')}
          />
        )}

        {currentPhase === 'priorauth' && (
          <PriorAuthPreviewView
            patientData={{
              patientName: caseRecord.patient.name,
              age: caseRecord.patient.age,
              dob: caseRecord.patient.dateOfBirth,
              diagnosis: caseRecord.clinical.diagnosis,
              icdCode: selectedICD,
              doctor: caseRecord.clinical.treatingDoctor,
              los: caseRecord.clinical.expectedLengthOfStay,
            }}
            onSubmit={handlePriorAuthSubmit}
            onBack={() => setCurrentPhase('icd')}
          />
        )}

        {currentPhase === 'submission' && (
          <SubmissionView
            formData={submittedData}
            onComplete={handleSubmissionComplete}
          />
        )}

        {currentPhase === 'complete' && (
          <div className="py-12 px-6 text-center">
            <div className="inline-block p-6 bg-green-50 border border-green-200 rounded-lg">
              <h2 className="text-2xl font-bold text-green-900 mb-2">
                ✓ Workflow Complete
              </h2>
              <p className="text-green-800 mb-4">
                Pre-authorization submitted successfully
              </p>
              <button
                onClick={onComplete}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Return to Inbox
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
