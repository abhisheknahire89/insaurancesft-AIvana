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
          <div className="text-opd-text-primary text-sm">{clinical.chiefComplaint || '—'}</div>
        </div>
        <div>
          <div className="text-opd-text-muted text-xs mb-1">Diagnosis</div>
          <div className="text-opd-text-primary text-sm">{clinical.diagnosis || '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">ICD-10</div>
            <div className="font-mono text-opd-text-primary text-sm">{clinical.icdCode || '—'}</div>
          </div>
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Planned Procedure</div>
            <div className="text-opd-text-primary text-sm">{clinical.proposedProcedure || '—'}</div>
          </div>
        </div>
        {clinical.icdPcsCode && (
          <div>
            <div className="text-opd-text-muted text-xs mb-1">ICD PCS</div>
            <div className="font-mono text-opd-text-primary text-sm">{clinical.icdPcsCode}</div>
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

  return (
    <SummaryCard title="Claim">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Expected Cost</div>
            <div className="text-lg font-bold text-opd-text-primary">
              ₹{billing.expectedCost?.toLocaleString('en-IN') || '0'}
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
            <div className="text-opd-text-muted text-xs mb-1">LOS (Expected)</div>
            <div className="text-opd-text-primary text-sm">{billing.expectedLOS} days</div>
          </div>
          <div>
            <div className="text-opd-text-muted text-xs mb-1">ICU Days</div>
            <div className="text-opd-text-primary text-sm">{billing.icuDays || 0} days</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Package Type</div>
            <div className="text-opd-text-primary text-sm capitalize">{auth.packageType || '—'}</div>
          </div>
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Enhancement Required</div>
            <div className={`text-sm font-semibold ${auth.enhancementRequired ? 'text-amber-600' : 'text-green-600'}`}>
              {auth.enhancementRequired ? 'Yes' : 'No'}
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
    const doc = caseRecord.documents.find(d => d.documentType === key);
    if (!doc) return 'missing';
    if (doc.extractionStatus === 'verified') return 'verified';
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
      value: businessMetrics.timeSavedMinutes ? `${Math.round(businessMetrics.timeSavedMinutes)} min` : 'Pending AI Processing', 
      icon: <Clock className="w-5 h-5" />, 
      color: 'text-blue-600' 
    },
    { 
      label: 'Data Entry Reduced', 
      value: `${Math.round(businessMetrics.dataReductionPercent)}%`, 
      icon: <TrendingUp className="w-5 h-5" />, 
      color: 'text-green-600' 
    },
    { 
      label: 'Form Auto-filled', 
      value: businessMetrics.fieldsExtracted > 0 ? `${Math.round((businessMetrics.fieldsExtracted / 12) * 100)}%` : '0%', 
      icon: <Check className="w-5 h-5" />, 
      color: 'text-green-600' 
    },
    { 
      label: 'Docs Processed', 
      value: `${businessMetrics.documentsProcessed}`, 
      icon: <FileText className="w-5 h-5" />, 
      color: 'text-purple-600' 
    },
    { 
      label: 'Fields Extracted', 
      value: `${businessMetrics.fieldsExtracted}`, 
      icon: <TrendingUp className="w-5 h-5" />, 
      color: 'text-indigo-600' 
    },
    { 
      label: 'Submission Ready', 
      value: `${Math.round(businessMetrics.submissionReadinessPercent)}%`, 
      icon: <Target className="w-5 h-5" />, 
      color: businessMetrics.submissionReadinessPercent >= 80 ? 'text-green-600' : 'text-amber-600' 
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
        <button
          onClick={() => setShowCoordinatorNotes(!showCoordinatorNotes)}
          className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Coordinator Notes & Refinements
            </span>
          </div>
          {showCoordinatorNotes ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </button>

        {showCoordinatorNotes && (
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
        )}
      </div>
    </SummaryCard>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// SUGGESTED NEXT STEPS (AI-POWERED RECOMMENDATIONS)
// ──────────────────────────────────────────────────────────────────────────

interface SuggestedNextStepsProps {
  caseRecord: Case;
}

const SuggestedNextSteps: React.FC<SuggestedNextStepsProps> = ({ caseRecord }) => {
  const scoreResult = calculateHealthScore(caseRecord);
  const recommendations = generateRecommendations(caseRecord);

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
                <p className={`text-sm mb-2 ${
                  rec.priority === 'critical' ? 'text-red-800' : 
                  rec.priority === 'high' ? 'text-amber-800' : 
                  'text-blue-800'
                }`}>
                  {rec.description}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <div className="text-gray-600">
                    <strong>Impact:</strong> +{rec.impactOnScore}% score
                  </div>
                  <div className="text-gray-600">
                    <strong>Time:</strong> ~{rec.estimatedTimeMinutes} min
                  </div>
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
// QUICK ACTIONS
// ──────────────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  caseRecord: Case;
  onUpdate?: (updated: Case) => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ caseRecord, onUpdate }) => {
  const [showPreAuthModal, setShowPreAuthModal] = React.useState(false);
  const [showExtractionModal, setShowExtractionModal] = React.useState(false);
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  
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
      onClick: () => setShowPreAuthModal(true)
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
      onClick: () => setShowUploadModal(true)
    },
    { 
      label: 'Submit to TPA', 
      icon: <Send className="w-4 h-4" />,
      enabled: canSubmitToTPA,
      disabledReason: canSubmitToTPA ? '' : 'Case must be ready (100%) and have diagnosis + ICD',
      onClick: () => alert('Submission workflow not yet implemented')
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

export const CaseOverviewDashboard: React.FC<CaseOverviewDashboardProps> = ({ caseRecord, onUpdate }) => {
  return (
    <div className="flex-1 overflow-y-auto bg-opd-bg p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-opd-text-primary mb-2">Case Overview</h1>
          <p className="text-opd-text-muted">AI-enriched case summary with business outcomes and quick actions</p>
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
        <SuggestedNextSteps caseRecord={caseRecord} />
        <QuickActions caseRecord={caseRecord} onUpdate={onUpdate} />

        {/* Footer Note */}
        <div className="text-center text-xs text-opd-text-muted">
          All fields automatically extracted from uploaded documents and AI analysis. No manual form filling required.
        </div>
      </div>
    </div>
  );
};

export default CaseOverviewDashboard;
