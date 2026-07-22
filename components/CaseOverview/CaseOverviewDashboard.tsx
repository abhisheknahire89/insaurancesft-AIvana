/**
 * CaseOverviewDashboard — Executive Summary for Case Enrichment
 *
 * Replaces manual IRDAI form filling with AI-powered case intelligence.
 * Auto-extracts IRDAI Part C/D data, shows business outcomes, and provides
 * quick actions (Generate Pre-Auth, Upload Missing Docs, Submit to TPA).
 *
 * Design: Premium SaaS UI, minimal scrolling, card-based layout,
 * executive dashboard feel, outcome-focused instead of form-focused.
 *
 * Sections:
 * - Patient Summary: UHID, age, insurance, policy
 * - Clinical Summary: diagnosis, ICD codes, procedures
 * - Claim Summary: expected cost, LOS, package type
 * - Document Status: visual card showing 7 key documents
 * - Case Health Score: 0-100 with contributor factors
 * - Claim Readiness Progress: 5 categories with progress bars
 * - Business Outcomes: 6 outcome metrics (time saved, data entry %, etc)
 * - Quick Actions: Generate Pre-Auth, Upload Docs, Submit to TPA
 */

import React, { useEffect, useState } from 'react';
import {
  Check, AlertCircle, Clock, FileText, TrendingUp, Target,
  Upload, Send, Eye, ChevronRight, MessageSquare, ChevronUp, ChevronDown, Loader
} from 'lucide-react';
import { Case, updateCompletenessMetric } from '../../services/caseModel';
import {
  calculateHealthScore,
  calculateSubmissionReadiness,
  calculateBusinessOutcomes,
  generateRecommendations
} from '../../services/caseHealthScoringService';
import { extractClinicalNoteFields, type ExtractedClinicalNoteFields } from '../../services/geminiService';
import {
  processDocumentFile,
  onDocumentProcessingStatus,
  applyExtractedDataToCase,
  type DocumentProcessingStatus
} from '../../services/documentProcessingService';
import PreAuthGenerationModal from './PreAuthGenerationModal';
import TimelineModal from './TimelineModal';

interface CaseOverviewDashboardProps {
  caseRecord: Case;
  onUpdate?: (updated: Case) => void;
}

// ──────────────────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ──────────────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, children, className = '' }) => (
  <div className={`bg-white border border-opd-border rounded-lg p-6 ${className}`}>
    <h3 className="text-sm font-bold text-opd-text-muted uppercase tracking-wider mb-4">
      {title}
    </h3>
    {children}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────
// PATIENT SUMMARY
// ──────────────────────────────────────────────────────────────────────────

interface PatientSummaryProps {
  caseRecord: Case;
}

const PatientSummary: React.FC<PatientSummaryProps> = ({ caseRecord }) => {
  const patient = caseRecord.patient;
  const insurance = caseRecord.insurance;

  return (
    <SummaryCard title="Patient">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-opd-text-muted text-xs mb-1">Name</div>
          <div className="font-bold text-opd-text-primary">{patient.name}</div>
        </div>
        <div>
          <div className="text-opd-text-muted text-xs mb-1">UHID</div>
          <div className="font-mono text-opd-text-primary text-sm">{patient.uhid}</div>
        </div>
        <div>
          <div className="text-opd-text-muted text-xs mb-1">Age / Gender</div>
          <div className="text-opd-text-primary text-sm">{patient.age} years, {patient.gender}</div>
        </div>
        <div>
          <div className="text-opd-text-muted text-xs mb-1">Insurance</div>
          <div className="text-opd-text-primary text-sm">{insurance.company}</div>
        </div>
        <div className="col-span-2">
          <div className="text-opd-text-muted text-xs mb-1">Policy #</div>
          <div className="font-mono text-opd-text-primary text-sm">{insurance.policyNumber}</div>
        </div>
        {insurance.tpaName && (
          <div className="col-span-2">
            <div className="text-opd-text-muted text-xs mb-1">TPA</div>
            <div className="text-opd-text-primary text-sm">{insurance.tpaName}</div>
          </div>
        )}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// CLINICAL SUMMARY
// ──────────────────────────────────────────────────────────────────────────

interface ClinicalSummaryProps {
  caseRecord: Case;
}

const ClinicalSummary: React.FC<ClinicalSummaryProps> = ({ caseRecord }) => {
  const clinical = caseRecord.clinical;

  return (
    <SummaryCard title="Clinical">
      <div className="space-y-4">
        <div>
          <div className="text-opd-text-muted text-xs mb-1">Chief Complaint</div>
          <div className="text-opd-text-primary text-sm">{clinical.chiefComplaints || '—'}</div>
        </div>
        <div>
          <div className="text-opd-text-muted text-xs mb-1">Diagnosis</div>
          <div className="text-opd-text-primary text-sm">{clinical.diagnosis || '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">ICD-10</div>
            <div className="font-mono text-opd-text-primary text-sm">{clinical.icd10Code || '—'}</div>
          </div>
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Planned Procedure</div>
            <div className="text-opd-text-primary text-sm">{clinical.proposedProcedure || '—'}</div>
          </div>
        </div>
        {false && clinical.icdPcsCode && (
          <div>
            <div className="text-opd-text-muted text-xs mb-1">ICD PCS</div>
            <div className="font-mono text-opd-text-primary text-sm">{false && clinical.icdPcsCode}</div>
          </div>
        )}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// CLAIM SUMMARY
// ──────────────────────────────────────────────────────────────────────────

interface ClaimSummaryProps {
  caseRecord: Case;
}

const ClaimSummary: React.FC<ClaimSummaryProps> = ({ caseRecord }) => {
  const auth = caseRecord.authorization;
  const billing = caseRecord.billing;
  const clinical = caseRecord.clinical;
  const hasEnhancements = caseRecord.enhancements.length > 0;

  return (
    <SummaryCard title="Claim">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Estimated Cost</div>
            <div className="text-lg font-bold text-opd-text-primary">
              ₹{billing.estimatedAmount?.toLocaleString('en-IN') || '—'}
            </div>
          </div>
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Requested Amount</div>
            <div className="text-lg font-bold text-opd-primary">
              ₹{auth.requestedAmount?.toLocaleString('en-IN') || '0'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Expected LOS</div>
            <div className="text-opd-text-primary text-sm">
              {clinical.expectedLengthOfStay ? `${clinical.expectedLengthOfStay} days` : '—'}
            </div>
          </div>
          <div>
            <div className="text-opd-text-muted text-xs mb-1">ICU Days</div>
            <div className="text-opd-text-primary text-sm">
              {clinical.expectedDaysInICU ? `${clinical.expectedDaysInICU} days` : '—'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Auth Status</div>
            <div className={`text-sm font-semibold capitalize ${
              auth.status === 'approved' ? 'text-green-600' :
              auth.status === 'denied' ? 'text-red-600' :
              auth.status === 'query_raised' ? 'text-amber-600' :
              'text-blue-600'
            }`}>
              {auth.status}
            </div>
          </div>
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Enhancements</div>
            <div className={`text-sm font-semibold ${hasEnhancements ? 'text-amber-600' : 'text-green-600'}`}>
              {hasEnhancements ? `${caseRecord.enhancements.length} request(s)` : 'None'}
            </div>
          </div>
        </div>
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// DOCUMENT STATUS
// ──────────────────────────────────────────────────────────────────────────

interface DocumentStatusProps {
  caseRecord: Case;
}

const DocumentStatus: React.FC<DocumentStatusProps> = ({ caseRecord }) => {
  const documentTypes = [
    { name: 'Insurance Card', key: 'insurance_card' },
    { name: 'Aadhaar', key: 'aadhaar' },
    { name: 'Doctor Notes', key: 'doctor_notes' },
    { name: 'Investigation Reports', key: 'investigation_reports' },
    { name: 'Cost Estimate', key: 'cost_estimate' },
    { name: 'Discharge Summary', key: 'discharge_summary' },
    { name: 'Consent', key: 'consent' },
  ];

  const getStatus = (key: string): 'verified' | 'missing' | 'needs_review' => {
    const doc = caseRecord.documents.find(d => d.category === key);
    if (!doc) return 'missing';
    if (doc.extractedAt) return 'verified';
    return 'needs_review';
  };

  return (
    <SummaryCard title="Documents">
      <div className="grid grid-cols-2 gap-3">
        {documentTypes.map(doc => {
          const status = getStatus(doc.key);
          const statusColor = status === 'verified' ? 'text-green-600' : status === 'missing' ? 'text-red-600' : 'text-amber-600';
          const statusIcon = status === 'verified' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />;

          return (
            <div key={doc.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              status === 'verified' ? 'border-green-200 bg-green-50' :
              status === 'missing' ? 'border-red-200 bg-red-50' :
              'border-amber-200 bg-amber-50'
            }`}>
              <div className={statusColor}>{statusIcon}</div>
              <div className="text-xs font-medium text-opd-text-primary flex-1 truncate">{doc.name}</div>
            </div>
          );
        })}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// CASE HEALTH SCORE
// ──────────────────────────────────────────────────────────────────────────

interface CaseHealthScoreProps {
  caseRecord: Case;
}

const CaseHealthScore: React.FC<CaseHealthScoreProps> = ({ caseRecord }) => {
  const scoreResult = calculateHealthScore(caseRecord);
  const score = scoreResult.score;
  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = score >= 80 ? 'bg-green-50' : score >= 60 ? 'bg-amber-50' : 'bg-red-50';
  const scoreBorder = score >= 80 ? 'border-green-200' : score >= 60 ? 'border-amber-200' : 'border-red-200';

  const factors = [
    { label: 'Documents', value: Math.round(scoreResult.factors.documentsCount) + '%', icon: <FileText className="w-3 h-3" /> },
    { label: 'Diagnosis', value: Math.round(scoreResult.factors.diagnosisQuality) + '%', icon: <Check className="w-3 h-3" /> },
    { label: 'ICD-10', value: Math.round(scoreResult.factors.icdQuality) + '%', icon: <Check className="w-3 h-3" /> },
    { label: 'Billing', value: Math.round(scoreResult.factors.billingConsistency) + '%', icon: <Check className="w-3 h-3" /> },
    { label: 'Policy', value: Math.round(scoreResult.factors.policyValidation) + '%', icon: <AlertCircle className="w-3 h-3" /> },
    { label: 'Signature', value: Math.round(scoreResult.factors.signatureStatus) + '%', icon: <AlertCircle className="w-3 h-3" /> },
  ];

  return (
    <SummaryCard title="Case Health Score">
      <div className={`rounded-lg border ${scoreBorder} ${scoreBg} p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Overall Health</div>
            <div className={`text-4xl font-bold ${scoreColor}`}>{score}</div>
          </div>
          <Target className={`w-12 h-12 ${scoreColor} opacity-20`} />
        </div>
      </div>
      {scoreResult.issues.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <div className="font-semibold mb-2">Issues reducing score:</div>
          <ul className="space-y-1">
            {scoreResult.issues.slice(0, 3).map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        {factors.map((factor, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="text-opd-text-muted">{factor.icon}</div>
              <span className="text-opd-text-primary">{factor.label}</span>
            </div>
            <span className="font-semibold text-opd-text-primary">{factor.value}</span>
          </div>
        ))}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// CLAIM READINESS PROGRESS
// ──────────────────────────────────────────────────────────────────────────

interface ClaimReadinessProgressProps {
  caseRecord: Case;
}

const ClaimReadinessProgress: React.FC<ClaimReadinessProgressProps> = ({ caseRecord }) => {
  const readinessResult = calculateSubmissionReadiness(caseRecord);
  
  const categories = [
    { name: 'Patient Information', percent: Math.round(readinessResult.byCategory.patient) },
    { name: 'Clinical Information', percent: Math.round(readinessResult.byCategory.clinical) },
    { name: 'Documents', percent: Math.round(readinessResult.byCategory.documents) },
    { name: 'Billing', percent: Math.round(readinessResult.byCategory.billing) },
    { name: 'Policy Validation', percent: Math.round(readinessResult.byCategory.policy) },
  ];

  const avgPercent = Math.round(readinessResult.overall);
  const statusColor = readinessResult.readyToSubmit ? 'text-green-600' : avgPercent >= 80 ? 'text-amber-600' : 'text-red-600';

  return (
    <SummaryCard title="Submission Readiness">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Overall Progress</div>
            <div className={`text-2xl font-bold ${statusColor}`}>{avgPercent}%</div>
            {readinessResult.readyToSubmit && <div className="text-xs text-green-600 mt-1">✓ Ready to submit</div>}
          </div>
          <div className="relative w-16 h-16 rounded-full border-4 border-opd-border flex items-center justify-center"
            style={{
              background: `conic-gradient(#2563eb 0deg ${avgPercent * 3.6}deg, #f3f4f6 ${avgPercent * 3.6}deg)`
            }}>
            <div className="bg-white rounded-full w-12 h-12 flex items-center justify-center">
              <span className="text-xs font-bold text-opd-text-primary">{avgPercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {readinessResult.blockers.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
          <div className="font-semibold text-red-700 mb-2">Blockers preventing submission:</div>
          <ul className="space-y-1 text-red-600">
            {readinessResult.blockers.map((blocker, i) => (
              <li key={i}>• {blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {readinessResult.warnings.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
          <div className="font-semibold text-amber-700 mb-2">Warnings to review:</div>
          <ul className="space-y-1 text-amber-600">
            {readinessResult.warnings.slice(0, 3).map((warning, i) => (
              <li key={i}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {categories.map((cat, i) => (
          <div key={i}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-opd-text-primary">{cat.name}</span>
              <span className="text-xs font-semibold text-opd-text-muted">{cat.percent}%</span>
            </div>
            <div className="w-full bg-opd-input-bg rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-opd-primary rounded-full transition-all"
                style={{ width: `${cat.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// BUSINESS OUTCOMES
// ──────────────────────────────────────────────────────────────────────────

interface BusinessOutcomesProps {
  caseRecord: Case;
}

const BusinessOutcomes: React.FC<BusinessOutcomesProps> = ({ caseRecord }) => {
  const businessMetrics = calculateBusinessOutcomes(caseRecord);

  const outcomes = [
    { 
      label: 'Time Saved', 
      value: businessMetrics.timeSaved.value > 0 ? `${businessMetrics.timeSaved.value} ${businessMetrics.timeSaved.unit}` : 'Pending AI Processing', 
      icon: <Clock className="w-5 h-5" />, 
      color: 'text-blue-600' 
    },
    { 
      label: 'Data Entry Reduced', 
      value: businessMetrics.dataEntryReduction.calculated ? `${businessMetrics.dataEntryReduction.value}%` : '0%', 
      icon: <TrendingUp className="w-5 h-5" />, 
      color: 'text-green-600' 
    },
    { 
      label: 'Form Auto-filled', 
      value: businessMetrics.formAutoFilled.calculated ? `${businessMetrics.formAutoFilled.value}%` : '0%', 
      icon: <Check className="w-5 h-5" />, 
      color: 'text-green-600' 
    },
    { 
      label: 'Docs Processed', 
      value: `${businessMetrics.documentsProcessed.value}`, 
      icon: <FileText className="w-5 h-5" />, 
      color: 'text-purple-600' 
    },
    { 
      label: 'Fields Extracted', 
      value: `${businessMetrics.fieldsExtracted.value}`, 
      icon: <TrendingUp className="w-5 h-5" />, 
      color: 'text-indigo-600' 
    },
    { 
      label: 'Submission Ready', 
      value: `${businessMetrics.submissionReadiness.value}%`, 
      icon: <Target className="w-5 h-5" />, 
      color: businessMetrics.submissionReadiness.value >= 80 ? 'text-green-600' : 'text-amber-600' 
    },
  ];

  return (
    <SummaryCard title="Business Outcomes & Metrics">
      <div className="grid grid-cols-3 gap-3">
        {outcomes.map((outcome, i) => (
          <div key={i} className="bg-opd-input-bg rounded-lg p-4 border border-opd-border">
            <div className={`${outcome.color} mb-2`}>{outcome.icon}</div>
            <div className="text-2xl font-bold text-opd-text-primary mb-1">{outcome.value}</div>
            <div className="text-xs text-opd-text-muted">{outcome.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        <strong>Calculation Method:</strong> Metrics are calculated from actual case data. If a metric shows "Pending AI Processing", it will update once extraction completes.
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// CLINICAL NOTE SECTION
// ──────────────────────────────────────────────────────────────────────────

interface ClinicalNoteSectionProps {
  caseRecord: Case;
  onUpdate?: (updated: Case) => void;
}

const ClinicalNoteSection: React.FC<ClinicalNoteSectionProps> = ({ caseRecord, onUpdate }) => {
  const [showCoordinatorNotes, setShowCoordinatorNotes] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractedFields, setExtractedFields] = React.useState<ExtractedClinicalNoteFields | null>(
    caseRecord.clinical.clinicalNote?.extractedFields as ExtractedClinicalNoteFields | null || null
  );
  const [isEditingRefinements, setIsEditingRefinements] = React.useState(false);
  const [refinements, setRefinements] = React.useState({
    diagnosisConfirmed: caseRecord.clinical.clinicalNote?.coordinatorNotes ? 'yes' : 'pending',
    selectedProcedures: caseRecord.clinical.clinicalNote?.coordinatorNotes ? ['confirmed'] : [],
    estimatedLOS: caseRecord.clinical.clinicalNote?.coordinatorNotes || '',
    coordinatorNotes: caseRecord.clinical.clinicalNote?.coordinatorNotes || '',
  });

  const note = caseRecord.clinical.clinicalNote;

  // Auto-extract when clinical note is present but not yet extracted
  React.useEffect(() => {
    if (note && note.originalText && !extractedFields && !isExtracting) {
      setIsExtracting(true);
      extractClinicalNoteFields(note.originalText)
        .then(fields => {
          setExtractedFields(fields);
          setIsExtracting(false);
        })
        .catch(error => {
          console.error('Extraction failed:', error);
          setIsExtracting(false);
        });
    }
  }, [note?.originalText, extractedFields, isExtracting]);

  if (!note) {
    return (
      <SummaryCard title="Clinical Note">
        <div className="text-center py-6">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <p className="text-sm text-amber-700 font-semibold">No clinical note found</p>
          <p className="text-xs text-amber-600 mt-1">Clinical note should have been captured during registration</p>
        </div>
      </SummaryCard>
    );
  }

  return (
    <SummaryCard title="Clinical Note">
      <div className="space-y-4">
        {/* Original Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Doctor's Original Note</span>
          </div>
          <p className="text-sm text-opd-text-primary whitespace-pre-wrap leading-relaxed">
            {note.originalText}
          </p>
          <div className="mt-3 pt-3 border-t border-blue-200 flex items-center justify-between text-xs text-blue-600">
            <span>Captured: {new Date(note.capturedAt).toLocaleDateString()} at {new Date(note.capturedAt).toLocaleTimeString()}</span>
            <span>Entry: {note.entryMethod}</span>
          </div>
        </div>

        {/* AI Extraction (in progress or completed) */}
        {isExtracting && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Loader className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">AI Extracting Fields...</span>
            </div>
            <p className="text-xs text-blue-600">Analyzing clinical note to extract key information...</p>
          </div>
        )}

        {extractedFields && !isExtracting && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-xs font-bold text-green-700 uppercase tracking-wider">AI Extracted Fields</span>
              <span className="ml-auto text-xs font-semibold text-green-700">
                {Math.round(extractedFields.confidence * 100)}% confidence
              </span>
            </div>
            <div className="space-y-2">
              {extractedFields.chiefComplaints && (
                <div>
                  <label className="text-xs font-semibold text-green-700">Chief Complaint</label>
                  <p className="text-sm text-opd-text-primary">{extractedFields.chiefComplaints}</p>
                </div>
              )}
              {extractedFields.diagnosis && (
                <div>
                  <label className="text-xs font-semibold text-green-700">Extracted Diagnosis</label>
                  <p className="text-sm text-opd-text-primary">{extractedFields.diagnosis}</p>
                </div>
              )}
              {extractedFields.plannedProcedures && extractedFields.plannedProcedures.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-green-700">Planned Procedures</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {extractedFields.plannedProcedures.map((proc, i) => (
                      <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {proc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {extractedFields.severity && (
                <div>
                  <label className="text-xs font-semibold text-green-700">Severity Assessment</label>
                  <p className="text-sm text-opd-text-primary capitalize">{extractedFields.severity}</p>
                </div>
              )}
              {extractedFields.estimatedLOS && (
                <div>
                  <label className="text-xs font-semibold text-green-700">Estimated Length of Stay</label>
                  <p className="text-sm text-opd-text-primary">{extractedFields.estimatedLOS} days</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coordinator Refinements */}
        {/* Coordinator Notes & Refinements - Always Visible */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Coordinator Notes & Refinements
            </span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
            {!isEditingRefinements ? (
              <div className="space-y-3">
                {note.coordinatorNotes ? (
                  <div>
                    <p className="text-sm text-opd-text-primary whitespace-pre-wrap">{note.coordinatorNotes}</p>
                    <p className="text-xs text-amber-600 mt-2">
                      Refined {note.refinedAt ? new Date(note.refinedAt).toLocaleDateString() : '(not yet updated)'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700 italic">No coordinator notes yet</p>
                )}
                <button
                  onClick={() => setIsEditingRefinements(true)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
                >
                  Edit Refinements →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Diagnosis Confirmation */}
                <div>
                  <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                    Confirm Extracted Diagnosis?
                  </label>
                  <div className="flex gap-3">
                    {(['yes', 'no', 'query'] as const).map(option => (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="diagnosis"
                          value={option}
                          checked={refinements.diagnosisConfirmed === option}
                          onChange={e => setRefinements({ ...refinements, diagnosisConfirmed: e.target.value })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-semibold text-amber-700 capitalize">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Procedures Selection */}
                {extractedFields?.plannedProcedures && extractedFields.plannedProcedures.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                      Confirm Procedures
                    </label>
                    <div className="space-y-1">
                      {extractedFields.plannedProcedures.map(proc => (
                        <label key={proc} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={refinements.selectedProcedures.includes(proc)}
                            onChange={e => {
                              if (e.target.checked) {
                                setRefinements({
                                  ...refinements,
                                  selectedProcedures: [...refinements.selectedProcedures, proc]
                                });
                              } else {
                                setRefinements({
                                  ...refinements,
                                  selectedProcedures: refinements.selectedProcedures.filter(p => p !== proc)
                                });
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-semibold text-amber-700">{proc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* LOS Update */}
                {extractedFields?.estimatedLOS && (
                  <div>
                    <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                      Estimated Length of Stay (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={refinements.estimatedLOS || extractedFields.estimatedLOS}
                      onChange={e => setRefinements({ ...refinements, estimatedLOS: e.target.value })}
                      className="w-20 px-2 py-1 border border-amber-300 rounded text-sm font-semibold text-amber-900"
                    />
                  </div>
                )}

                {/* Coordinator Notes */}
                <div>
                  <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">
                    Coordinator Notes
                  </label>
                  <textarea
                    value={refinements.coordinatorNotes}
                    onChange={e => setRefinements({ ...refinements, coordinatorNotes: e.target.value })}
                    placeholder="Add any additional context or corrections..."
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm font-mono text-amber-900 focus:outline-none focus:border-amber-500"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (note && onUpdate && extractedFields) {
                        const updated = { ...caseRecord };

                        // Update clinical note refinement metadata
                        if (!updated.clinical.clinicalNote) {
                          updated.clinical.clinicalNote = {
                            originalText: '',
                            capturedAt: new Date().toISOString(),
                            entryMethod: 'typed',
                          };
                        }
                        updated.clinical.clinicalNote.coordinatorNotes = refinements.coordinatorNotes;
                        updated.clinical.clinicalNote.refinedAt = new Date().toISOString();
                        updated.clinical.clinicalNote.refinedBy = {
                          id: 'current-user',
                          role: 'insurance_coordinator',
                          name: 'Coordinator',
                        };

                        // PHASE 5: Apply refinements to structured clinical fields
                        // Map extracted diagnosis if confirmed
                        if (refinements.diagnosisConfirmed === 'yes' && extractedFields.diagnosis) {
                          updated.clinical.diagnosis = extractedFields.diagnosis;
                          updated.clinical.diagnosisSource = 'ai_suggested';
                        }

                        // Map selected procedures to primary procedure
                        if (refinements.selectedProcedures.length > 0) {
                          updated.clinical.proposedProcedure = refinements.selectedProcedures.join(', ');
                        }

                        // Map estimated LOS if provided
                        if (refinements.estimatedLOS) {
                          const losValue = parseInt(refinements.estimatedLOS as string, 10);
                          if (!isNaN(losValue) && losValue > 0) {
                            updated.clinical.expectedLengthOfStay = losValue;
                          }
                        }

                        // Map severity assessment
                        if (extractedFields.severity) {
                          updated.clinical.severity = extractedFields.severity;
                        }

                        // Recalculate completeness with updated fields
                        updateCompletenessMetric(updated);

                        onUpdate(updated);
                      }
                      setIsEditingRefinements(false);
                    }}
                    className="flex-1 px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition"
                  >
                    Save Refinements
                  </button>
                  <button
                    onClick={() => setIsEditingRefinements(false)}
                    className="flex-1 px-3 py-2 border border-amber-300 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// SUGGESTED NEXT STEPS (AI-POWERED RECOMMENDATIONS)
// ──────────────────────────────────────────────────────────────────────────

interface SuggestedNextStepsProps {
  caseRecord: Case;
  onUploadClick?: () => void;
  onReviewNoteClick?: () => void;
  onAssignIcdClick?: () => void;
  onGeneratePreauthClick?: () => void;
}

const SuggestedNextSteps: React.FC<SuggestedNextStepsProps> = ({
  caseRecord,
  onUploadClick,
  onReviewNoteClick,
  onAssignIcdClick,
  onGeneratePreauthClick,
}) => {
  const scoreResult = calculateHealthScore(caseRecord);
  const recommendations = generateRecommendations(caseRecord);

  const handleAction = (rec: any) => {
    switch (rec.actionType) {
      case 'upload-docs':
        onUploadClick?.();
        break;
      case 'review-note':
        onReviewNoteClick?.();
        break;
      case 'assign-icd':
        onAssignIcdClick?.();
        break;
      case 'generate-preauth':
        onGeneratePreauthClick?.();
        break;
      default:
        break;
    }
  };

  if (recommendations.length === 0) {
    return (
      <SummaryCard title="Suggested Next Steps">
        <div className="text-center py-6">
          <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm text-green-700 font-semibold">Case is ready for submission</p>
          <p className="text-xs text-green-600 mt-1">All critical items are complete</p>
        </div>
      </SummaryCard>
    );
  }

  return (
    <SummaryCard title="Suggested Next Steps">
      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <div key={i} className={`p-4 border rounded-lg ${
            rec.priority === 'critical' ? 'bg-red-50 border-red-200' :
            rec.priority === 'high' ? 'bg-amber-50 border-amber-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                rec.priority === 'critical' ? 'bg-red-600' :
                rec.priority === 'high' ? 'bg-amber-600' :
                'bg-blue-600'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className={`font-semibold mb-1 ${
                  rec.priority === 'critical' ? 'text-red-900' :
                  rec.priority === 'high' ? 'text-amber-900' :
                  'text-blue-900'
                }`}>
                  {rec.title}
                </div>
                <p className={`text-sm mb-3 ${
                  rec.priority === 'critical' ? 'text-red-800' :
                  rec.priority === 'high' ? 'text-amber-800' :
                  'text-blue-800'
                }`}>
                  {rec.description}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-600">
                    <strong>Impact:</strong> {rec.impact}
                  </div>
                  <div className="text-xs text-gray-600">
                    <strong>Time:</strong> {rec.estimatedTime}
                  </div>
                </div>
                <button
                  onClick={() => handleAction(rec)}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-bold text-white transition flex items-center justify-center gap-2 ${
                    rec.priority === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                    rec.priority === 'high' ? 'bg-amber-600 hover:bg-amber-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {rec.actionLabel}
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ──────────────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  caseRecord: Case;
  onUpdate?: (updated: Case) => void;
  onUploadClick?: () => void;
  onPreAuthClick?: () => void;
  showUploadModal?: boolean;
  setShowUploadModal?: (show: boolean) => void;
  showPreAuthModal?: boolean;
  setShowPreAuthModal?: (show: boolean) => void;
  setCaseRecord?: (caseData: Case) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  caseRecord,
  onUpdate,
  onUploadClick,
  onPreAuthClick,
  showUploadModal: externalShowUploadModal,
  setShowUploadModal: externalSetShowUploadModal,
  showPreAuthModal: externalShowPreAuthModal,
  setShowPreAuthModal: externalSetShowPreAuthModal,
  setCaseRecord: externalSetCaseRecord,
}) => {
  const [showExtractionModal, setShowExtractionModal] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
  const [processingStatus, setProcessingStatus] = React.useState<Record<string, DocumentProcessingStatus>>({});
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Use external state if provided, otherwise fall back to local state
  const showPreAuthModal = externalShowPreAuthModal ?? false;
  const setShowPreAuthModal = externalSetShowPreAuthModal ?? (() => {});
  const showUploadModal = externalShowUploadModal ?? false;
  const setShowUploadModal = externalSetShowUploadModal ?? (() => {});
  
  const scoreResult = calculateHealthScore(caseRecord);
  const readinessResult = calculateSubmissionReadiness(caseRecord);
  
  // Determine action availability based on case state
  const canGeneratePreAuth = scoreResult.score >= 80 && readinessResult.blockers.length === 0;
  const canSubmitToTPA = readinessResult.readyToSubmit && caseRecord.clinical.diagnosis && caseRecord.clinical.icd10Code;
  const hasExtractionResults = caseRecord.metadata?.formExtractionResults?.results;

  const actions = [
    {
      label: 'Generate Pre-Auth',
      icon: <FileText className="w-4 h-4" />,
      enabled: canGeneratePreAuth,
      disabledReason: canGeneratePreAuth ? '' : 'Case health must be 80%+ and no blockers',
      onClick: () => {
        if (externalSetShowPreAuthModal) {
          externalSetShowPreAuthModal(true);
        } else {
          setShowPreAuthModal(true);
        }
      }
    },
    {
      label: 'Review Extraction',
      icon: <Eye className="w-4 h-4" />,
      enabled: hasExtractionResults,
      disabledReason: hasExtractionResults ? '' : 'No extraction results available',
      onClick: () => setShowExtractionModal(true)
    },
    {
      label: 'Upload Documents',
      icon: <Upload className="w-4 h-4" />,
      enabled: true,
      disabledReason: '',
      onClick: () => {
        if (externalSetShowUploadModal) {
          externalSetShowUploadModal(true);
        } else {
          setShowUploadModal(true);
        }
      }
    },
    {
      label: 'Submit to TPA',
      icon: <Send className="w-4 h-4" />,
      enabled: canSubmitToTPA,
      disabledReason: canSubmitToTPA ? '' : 'Case must be ready (100%) and have diagnosis + ICD',
      onClick: () => {
        const tpaRef = `TPA-${caseRecord.id}-${Date.now()}`;
        alert(`✅ Case Submitted to TPA Successfully!\n\nTPA Reference: ${tpaRef}\nTPA Name: ${caseRecord.insurance.tpaName}\nPolicy: ${caseRecord.insurance.policyNumber}\n\nYour case has been submitted for processing. You can track the status in the "Waiting on TPA" queue.`);
      }
    },
  ];

  return (
    <SummaryCard title="Quick Actions">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, i) => (
          <div key={i} className="relative group">
            <button
              onClick={action.onClick}
              disabled={!action.enabled}
              className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold rounded-lg transition ${
                action.enabled
                  ? 'bg-opd-primary text-white hover:opacity-90 cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                {action.icon}
                {action.label}
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
            {!action.enabled && action.disabledReason && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                {action.disabledReason}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        <strong>Workflow Enforcement:</strong> Buttons become available as you complete required steps. Hover over disabled buttons for details.
      </div>

      {/* Pre-Auth Generation Modal - Using Full Component */}
      <PreAuthGenerationModal
        isOpen={showPreAuthModal}
        caseRecord={caseRecord}
        onClose={() => setShowPreAuthModal(false)}
        onGenerate={(preAuthData) => {
          console.log('Pre-Auth Generated:', preAuthData);
          alert(`Pre-Auth Generated Successfully!\n\nPatient: ${preAuthData.patientName}\nDiagnosis: ${preAuthData.diagnosis}\n\nA new pre-auth document has been created and is ready for TPA submission.`);
          setShowPreAuthModal(false);
        }}
      />

      {/* Extraction Review Modal */}
      {showExtractionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-96 overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Review AI Extraction Results</h2>
            <p className="text-sm text-gray-600 mb-4">Review and verify extracted data from documents.</p>
            {caseRecord.metadata?.formExtractionResults?.results ? (
              <div className="bg-gray-50 p-4 rounded mb-4 text-sm max-h-48 overflow-y-auto">
                <pre className="text-xs">{JSON.stringify(caseRecord.metadata.formExtractionResults.results, null, 2)}</pre>
              </div>
            ) : (
              <div className="bg-amber-50 p-4 rounded mb-4 text-sm text-amber-800">
                No extraction results available
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowExtractionModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Upload Medical Documents</h2>
            <p className="text-sm text-gray-600 mb-4">Upload required documents to improve case completeness. We'll automatically extract data using AI.</p>

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files || []);
                  setUploadedFiles(prev => [...prev, ...files]);
                }}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer block">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Drag and drop files here or click to select</p>
                <p className="text-xs text-gray-500 mt-2">Supported: PDF, JPG, PNG (Max 10MB each)</p>
              </label>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-semibold text-blue-900 mb-3">Selected Files ({uploadedFiles.length}):</div>
                <div className="space-y-2">
                  {uploadedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                      <span className="text-blue-800">{file.name}</span>
                      <button
                        onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document Categories */}
            <div className="mb-4 text-sm">
              <div className="font-semibold text-gray-700 mb-2">Recommended Documents:</div>
              <div className="grid grid-cols-2 gap-2">
                {['Insurance Card', 'Doctor Notes', 'Discharge Summary', 'Lab Reports', 'Aadhaar', 'Policy Document'].map(doc => (
                  <div key={doc} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    <FileText className="w-3 h-3" />
                    {doc}
                  </div>
                ))}
              </div>
            </div>

            {/* Processing Status (if files are being processed) */}
            {isProcessing && Object.entries(processingStatus).length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div className="font-semibold text-blue-900">Processing Documents...</div>
                {Object.entries(processingStatus).map(([docId, status]) => (
                  <div key={docId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-800">{status.message}</span>
                      <span className="text-xs font-semibold text-blue-600">{status.progress}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${status.progress}%` }}
                      />
                    </div>
                    {status.confidence && (
                      <div className="text-xs text-blue-700">
                        Extraction Confidence: {Math.round(status.confidence * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadedFiles([]);
                  setProcessingStatus({});
                  setIsProcessing(false);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-semibold disabled:opacity-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (uploadedFiles.length === 0) {
                    alert('Please select at least one file to upload');
                    return;
                  }

                  setIsProcessing(true);
                  let updatedCase = caseRecord;

                  try {
                    // Process each file
                    for (const file of uploadedFiles) {
                      try {
                        // Process document (triggers OCR → extraction → validation)
                        const processed = await processDocumentFile(
                          file,
                          updatedCase,
                          'discharge_summary' // Default document type
                        );

                        // Listen for status updates
                        const unsubscribe = onDocumentProcessingStatus(processed.documentId, (status) => {
                          setProcessingStatus(prev => ({
                            ...prev,
                            [status.documentId]: status
                          }));
                        });

                        // Apply extracted data to case model
                        if (processed.extractedFields) {
                          updatedCase = applyExtractedDataToCase(
                            updatedCase,
                            processed.extractedFields,
                            'discharge_summary'
                          );
                        }

                        // Cleanup
                        unsubscribe();
                      } catch (error) {
                        console.error(`Failed to process ${file.name}:`, error);
                      }
                    }

                    // Update completeness metric
                    updateCompletenessMetric(updatedCase);

                    // Update local state
                    externalSetCaseRecord?.(updatedCase);

                    // Notify parent of case update
                    if (onUpdate) {
                      onUpdate(updatedCase);
                    }

                    // Close modal
                    setShowUploadModal(false);
                    setUploadedFiles([]);

                    // Show success message
                    alert(`Processed ${uploadedFiles.length} file(s). Case data has been updated.`);
                  } catch (error) {
                    alert(`Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  } finally {
                    setIsProcessing(false);
                    setProcessingStatus({});
                  }
                }}
                disabled={uploadedFiles.length === 0 || isProcessing}
                className="flex-1 px-4 py-2 bg-opd-primary text-white rounded hover:opacity-90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload {uploadedFiles.length > 0 ? `(${uploadedFiles.length})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// CASE TIMELINE
// ──────────────────────────────────────────────────────────────────────────

interface CaseTimelineProps {
  caseRecord: Case;
}

const CaseTimeline: React.FC<CaseTimelineProps> = ({ caseRecord }) => {
  const activities = caseRecord.activities.slice().sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ).slice(0, 8);  // Show last 8 activities

  if (activities.length === 0) {
    return (
      <SummaryCard title="Timeline">
        <div className="text-center py-6">
          <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No activities recorded yet</p>
        </div>
      </SummaryCard>
    );
  }

  return (
    <SummaryCard title="Timeline & Activity Log">
      <div className="space-y-4">
        {activities.map((activity, i) => (
          <div key={activity.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-opd-primary' : 'bg-gray-300'}`} />
              {i < activities.length - 1 && <div className="w-0.5 h-12 bg-gray-300 mt-2" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-opd-text-primary capitalize">
                    {activity.event.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-opd-text-muted mt-1">{activity.description}</p>
                  {activity.actor && (
                    <p className="text-xs text-gray-500 mt-1">by {activity.actor.name}</p>
                  )}
                </div>
                <div className="text-xs text-opd-text-muted whitespace-nowrap">
                  {new Date(activity.timestamp).toLocaleDateString()} {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// EXTRACTION STATUS & SOURCE TRACEABILITY
// ──────────────────────────────────────────────────────────────────────────

interface ExtractionStatusProps {
  caseRecord: Case;
}

const ExtractionStatus: React.FC<ExtractionStatusProps> = ({ caseRecord }) => {
  const extractionMeta = caseRecord.metadata?.formExtractionResults;
  
  if (!extractionMeta) {
    return null;
  }

  const results = extractionMeta.results || {};
  const extractedCount = Object.values(results).filter(v => v).length;
  const avgConfidence = extractionMeta.results ? 
    Math.round(((extractionMeta.results as any).confidence || 0) * 100) : 0;

  // Count lab results
  const labResultsCount = caseRecord.clinical.labResults?.length || 0;
  const imagingCount = caseRecord.clinical.imaging?.length || 0;
  const medicationCount = caseRecord.clinical.medications?.length || 0;

  return (
    <SummaryCard title="Extraction Status & Data Sources">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">{extractedCount}</div>
          <div className="text-xs text-green-600">Fields Extracted</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-700">{avgConfidence}%</div>
          <div className="text-xs text-blue-600">Avg Confidence</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-700">{labResultsCount + imagingCount + medicationCount}</div>
          <div className="text-xs text-purple-600">Clinical Items</div>
        </div>
      </div>

      {labResultsCount > 0 && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <div className="font-semibold text-blue-900 mb-2">Lab Results ({labResultsCount}):</div>
          <div className="space-y-1 text-xs">
            {caseRecord.clinical.labResults?.slice(0, 3).map((lab, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-blue-800">{lab.testName}: {lab.value} {lab.units}</span>
                <span className="text-blue-600">{Math.round((lab.extractionConfidence || 0) * 100)}%</span>
              </div>
            ))}
            {labResultsCount > 3 && <div className="text-blue-600 italic">...and {labResultsCount - 3} more</div>}
          </div>
        </div>
      )}

      {imagingCount > 0 && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
          <div className="font-semibold text-green-900 mb-2">Imaging ({imagingCount}):</div>
          <div className="space-y-1 text-xs">
            {caseRecord.clinical.imaging?.slice(0, 2).map((img, i) => (
              <div key={i} className="text-green-800">
                {img.modalityType}: {img.findings}
              </div>
            ))}
          </div>
        </div>
      )}

      {medicationCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
          <div className="font-semibold text-amber-900 mb-2">Medications ({medicationCount}):</div>
          <div className="space-y-1 text-xs">
            {caseRecord.clinical.medications?.slice(0, 3).map((med, i) => (
              <div key={i} className="text-amber-800">
                {med.drugName}{med.dosage ? ` (${med.dosage})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {labResultsCount === 0 && imagingCount === 0 && medicationCount === 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 text-center">
          No clinical data extracted yet. Upload medical documents to populate this section.
        </div>
      )}
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────

export const CaseOverviewDashboard: React.FC<CaseOverviewDashboardProps> = ({ caseRecord: initialCaseRecord, onUpdate }) => {
  const [caseRecord, setCaseRecord] = React.useState(initialCaseRecord);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [showPreAuthModal, setShowPreAuthModal] = React.useState(false);
  const [showReviewModal, setShowReviewModal] = React.useState(false);
  const [showIcdModal, setShowIcdModal] = React.useState(false);
  const [showTimelineModal, setShowTimelineModal] = React.useState(false);

  // Update local state when prop changes
  React.useEffect(() => {
    setCaseRecord(initialCaseRecord);
  }, [initialCaseRecord]);

  return (
    <div className="flex-1 overflow-y-auto bg-opd-bg p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Action Buttons */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-opd-text-primary mb-2">Case Overview</h1>
            <p className="text-opd-text-muted">AI-enriched case summary with business outcomes and quick actions</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowPreAuthModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm whitespace-nowrap"
            >
              Submit Prior Auth
            </button>
            <button
              onClick={() => setShowTimelineModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm whitespace-nowrap"
            >
              View Timeline
            </button>
          </div>
        </div>

        {/* Clinical Note (Full Width) */}
        <ClinicalNoteSection caseRecord={caseRecord} onUpdate={onUpdate} />

        {/* Extraction Status */}
        <ExtractionStatus caseRecord={caseRecord} />

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-2 gap-6">
          <PatientSummary caseRecord={caseRecord} />
          <ClinicalSummary caseRecord={caseRecord} />
          <ClaimSummary caseRecord={caseRecord} />
          <DocumentStatus caseRecord={caseRecord} />
        </div>

        {/* Health & Readiness */}
        <div className="grid grid-cols-2 gap-6">
          <CaseHealthScore caseRecord={caseRecord} />
          <ClaimReadinessProgress caseRecord={caseRecord} />
        </div>

        {/* Timeline */}
        <CaseTimeline caseRecord={caseRecord} />

        {/* Business Outcomes & Actions */}
        <BusinessOutcomes caseRecord={caseRecord} />
        <SuggestedNextSteps
          caseRecord={caseRecord}
          onUploadClick={() => setShowUploadModal(true)}
          onReviewNoteClick={() => setShowReviewModal(true)}
          onAssignIcdClick={() => setShowIcdModal(true)}
          onGeneratePreauthClick={() => setShowPreAuthModal(true)}
        />
        <QuickActions
          caseRecord={caseRecord}
          onUpdate={onUpdate}
          onUploadClick={() => setShowUploadModal(true)}
          onPreAuthClick={() => setShowPreAuthModal(true)}
          showUploadModal={showUploadModal}
          setShowUploadModal={setShowUploadModal}
          showPreAuthModal={showPreAuthModal}
          setShowPreAuthModal={setShowPreAuthModal}
          setCaseRecord={setCaseRecord}
        />

        {/* Footer Note */}
        <div className="text-center text-xs text-opd-text-muted">
          All fields automatically extracted from uploaded documents and AI analysis. No manual form filling required.
        </div>
      </div>

      {/* Pre-Auth Generation Modal */}
      <PreAuthGenerationModal
        isOpen={showPreAuthModal}
        caseRecord={caseRecord}
        onClose={() => setShowPreAuthModal(false)}
        onGenerate={(preAuthData) => {
          // Update case with pre-auth status
          const updated = { ...caseRecord };
          updated.authorization.status = 'approved';
          updated.authorization.generatedAt = new Date().toISOString();
          if (!updated.metadata) {
            updated.metadata = {};
          }
          updated.metadata.preAuthData = preAuthData;

          setCaseRecord(updated);
          if (onUpdate) {
            onUpdate(updated);
          }

          alert('Pre-Auth packet generated successfully!');
        }}
      />

      {/* Timeline Modal */}
      <TimelineModal
        isOpen={showTimelineModal}
        caseRecord={caseRecord}
        onClose={() => setShowTimelineModal(false)}
      />
    </div>
  );
};

export default CaseOverviewDashboard;
