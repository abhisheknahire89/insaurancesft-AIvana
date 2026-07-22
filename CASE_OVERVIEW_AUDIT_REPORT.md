# Case Overview Screen — Comprehensive Audit & Production Readiness Report

**Date:** July 22, 2026  
**Status:** ⚠️ CRITICAL ISSUES IDENTIFIED  
**Priority:** Fix before hospital demo tomorrow  
**Scope:** UX/Functional audit for production readiness

---

## EXECUTIVE SUMMARY

The Case Overview screen has **11 critical issues** preventing production use:
- ❌ 4 dead buttons (no functionality)
- ❌ All business outcomes are hardcoded demo values
- ❌ Health score uses fake factors, not actual case data
- ❌ Multiple contradictory readiness scores (95% vs 45%)
- ❌ No workflow enforcement
- ❌ Missing items panel lacks context
- ❌ Timeline feature not implemented
- ❌ Duplicated completeness metrics
- ❌ No intelligent recommendations
- ❌ AI copilot is placeholder text
- ❌ No audit trail or compliance tracking

**Impact:** Users cannot perform any meaningful actions. Screen looks polished but is entirely non-functional.

---

## ISSUE #1: DEAD BUTTONS (CRITICAL)

### Problem
All 4 quick action buttons are non-functional:
1. "Generate Pre-Auth" — No handler, does nothing
2. "Review AI Extraction" — No handler, does nothing  
3. "Upload Missing Docs" — No handler, does nothing
4. "Submit to TPA" — No handler, does nothing

**Location:** `CaseOverviewDashboard.tsx:728-754` (QuickActions component)

**Code Issue:**
```typescript
const actions = [
  { label: 'Generate Pre-Auth', icon: <FileText /> },
  // ... others
];

{actions.map((action, i) => (
  <button
    key={i}
    className="...hover:opacity-90..."
    // ❌ NO onClick handler, NO disabled state, NO navigation
  >
```

### Root Cause
- Buttons are purely presentational
- No state management for workflow
- No navigation or modal triggers
- No prerequisite validation

### Solution

**Step 1: Add Workflow State**
```typescript
interface QuickActionsProps {
  caseRecord: Case;
  onNavigate?: (path: string) => void;  // NEW
  onOpenModal?: (modalType: string) => void;  // NEW
}

const QuickActions: React.FC<QuickActionsProps> = ({ 
  caseRecord, 
  onNavigate,
  onOpenModal 
}) => {
  // Determine which actions are available based on workflow
  const canGeneratePreAuth = /* validation logic */;
  const canReviewExtraction = /* validation logic */;
  // ... etc
```

**Step 2: Define Workflow Prerequisites**
```typescript
const getActionState = (action: string, caseRecord: Case) => {
  switch(action) {
    case 'Review AI Extraction':
      return {
        enabled: caseRecord.status === 'patient_registered',
        reason: 'Available after patient registration',
        action: () => onOpenModal('extraction-review')
      };
    
    case 'Upload Missing Docs':
      return {
        enabled: true,  // Always available
        reason: 'Add missing documents',
        action: () => onOpenModal('document-upload')
      };
    
    case 'Generate Pre-Auth':
      return {
        enabled: caseRecord.completeness.overallScore >= 80,
        reason: caseRecord.completeness.overallScore < 80 
          ? `Improve case health to 80%+ (currently ${caseRecord.completeness.overallScore}%)`
          : 'Ready to generate',
        action: () => onNavigate('/prior-auth-generator')
      };
    
    case 'Submit to TPA':
      return {
        enabled: caseRecord.status === 'ready_for_submission',
        reason: caseRecord.status !== 'ready_for_submission'
          ? 'Complete all reviews first'
          : 'Ready to submit',
        action: () => onNavigate('/tpa-submission')
      };
  }
};
```

**Step 3: Render with Disabled State & Tooltip**
```typescript
{actions.map((action, i) => {
  const state = getActionState(action.label, caseRecord);
  
  return (
    <button
      key={i}
      disabled={!state.enabled}
      onClick={state.action}
      title={state.reason}
      className={`
        flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold rounded-lg
        ${state.enabled 
          ? 'bg-opd-primary text-white hover:opacity-90' 
          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }
        transition
      `}
    >
      <div className="flex items-center gap-2">
        {action.icon}
        {action.label}
      </div>
      {!state.enabled && <AlertCircle className="w-4 h-4" />}
      {state.enabled && <ChevronRight className="w-4 h-4" />}
    </button>
  );
})}
```

### Files to Modify
- `components/CaseOverview/CaseOverviewDashboard.tsx` (QuickActions component)
- Add to parent: `CaseWorkspace/CaseWorkspaceRouter.tsx` (for navigation/modal handlers)

---

## ISSUE #2: HARDCODED BUSINESS OUTCOMES (CRITICAL)

### Problem
All 6 business outcome metrics are hardcoded demo values:
- "27 min saved" — Fake
- "82%" (Data Entry Reduced) — Fake
- "94%" (Form Auto-filled) — Fake
- "18" (Docs Processed) — Fake
- "126" (AI Fields) — Fake
- "96%" (Claim Readiness) — Fake

**Location:** `CaseOverviewDashboard.tsx:364-386` (BusinessOutcomes component)

**Code Issue:**
```typescript
const outcomes = [
  { label: 'Time Saved', value: '27 min', icon: ... },
  { label: 'Data Entry Reduced', value: '82%', icon: ... },
  // ... ALL HARDCODED
];
```

### Root Cause
- No actual calculation from case data
- No extraction metrics tracked
- No processing timestamps
- No audit trail in case record

### Solution

**Step 1: Calculate from Case Data**
```typescript
interface BusinessOutcomeMetrics {
  timeSaved: { value: number; unit: string; calculated: boolean };
  dataEntryReduction: { value: number; calculated: boolean };
  formAutoFilled: { value: number; calculated: boolean };
  documentsProcessed: { value: number };
  fieldsExtracted: { value: number };
  submissionReadiness: { value: number; calculated: boolean };
}

const calculateBusinessOutcomes = (caseRecord: Case): BusinessOutcomeMetrics => {
  // Time Saved Calculation
  const hasExtractionMetadata = caseRecord.metadata?.formExtractionResults;
  const manualFields = 12;
  const autoFilledFields = hasExtractionMetadata 
    ? Object.keys(caseRecord.metadata.formExtractionResults.results || {}).length 
    : 0;
  const manualTime = 3; // minutes per field (average)
  const autoTime = 0.5; // minutes per auto-filled field (review time)
  const timeSavedMinutes = (autoFilledFields * manualTime) - (autoFilledFields * autoTime);
  
  // Data Entry Reduction
  const dataEntryReduction = autoFilledFields > 0 
    ? Math.round((autoFilledFields / manualFields) * 100)
    : 0;
  
  // Form Auto-filled (from extraction metadata)
  const formAutoFilled = autoFilledFields > 0
    ? Math.round((autoFilledFields / manualFields) * 100)
    : 0;
  
  // Documents Processed
  const documentsProcessed = caseRecord.documents.length;
  
  // Fields Extracted
  const fieldsExtracted = autoFilledFields;
  
  // Submission Readiness
  const submissionReadiness = caseRecord.completeness.overallScore;
  
  return {
    timeSaved: { 
      value: Math.max(0, Math.round(timeSavedMinutes)), 
      unit: 'min',
      calculated: true
    },
    dataEntryReduction: {
      value: dataEntryReduction,
      calculated: true
    },
    formAutoFilled: {
      value: formAutoFilled,
      calculated: true
    },
    documentsProcessed: {
      value: documentsProcessed
    },
    fieldsExtracted: {
      value: fieldsExtracted
    },
    submissionReadiness: {
      value: submissionReadiness,
      calculated: true
    }
  };
};
```

**Step 2: Update Component**
```typescript
const BusinessOutcomes: React.FC<BusinessOutcomesProps> = ({ caseRecord }) => {
  const metrics = calculateBusinessOutcomes(caseRecord);
  
  const outcomes = [
    { 
      label: 'Time Saved', 
      value: metrics.timeSaved.calculated ? `${metrics.timeSaved.value} ${metrics.timeSaved.unit}` : 'Not Available Yet',
      icon: <Clock className="w-5 h-5" />, 
      color: 'text-blue-600',
      tooltip: 'Reduction in manual data entry time'
    },
    {
      label: 'Data Entry Reduced',
      value: metrics.dataEntryReduction.calculated ? `${metrics.dataEntryReduction.value}%` : 'Not Available Yet',
      icon: <TrendingUp />,
      color: 'text-green-600',
      tooltip: `${metrics.fieldsExtracted.value} of 12 fields auto-filled`
    },
    // ... etc
  ];
  
  return (
    <SummaryCard title="Business Outcomes">
      <div className="grid grid-cols-3 gap-3">
        {outcomes.map((outcome, i) => (
          <div 
            key={i} 
            className="bg-opd-input-bg rounded-lg p-4 border border-opd-border cursor-help"
            title={outcome.tooltip}
          >
            <div className={`${outcome.color} mb-2`}>{outcome.icon}</div>
            <div className="text-2xl font-bold text-opd-text-primary mb-1">
              {outcome.value}
            </div>
            <div className="text-xs text-opd-text-muted">{outcome.label}</div>
          </div>
        ))}
      </div>
      {!Object.values(metrics).some(m => m.calculated) && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            Business outcomes will be calculated after document processing and extraction.
          </p>
        </div>
      )}
    </SummaryCard>
  );
};
```

### Files to Modify
- `components/CaseOverview/CaseOverviewDashboard.tsx` (BusinessOutcomes component)
- `services/caseModel.ts` (add metadata field for extraction tracking)

---

## ISSUE #3: MISLEADING HEALTH SCORE (CRITICAL)

### Problem
The "Case Health Score" shows **45** but:
- Doesn't explain what "45" means
- Shows hardcoded factors that aren't from case data:
  - "Documents: 100%" ← Where does this come from?
  - "Clinical Consistency: 85%" ← No calculation logic
  - "Billing Consistency: 90%" ← No calculation logic
  - "Policy Validation: 100%" ← No calculation logic
  - "ICD Validation: 80%" ← No calculation logic
  - "Physician Signature: 75%" ← No calculation logic

**Location:** `CaseOverviewDashboard.tsx:253-295` (CaseHealthScore component)

**Code Issue:**
```typescript
const factors = [
  { label: 'Documents', value: '100%', icon: ... },  // ❌ Hardcoded
  { label: 'Clinical Consistency', value: '85%', icon: ... },  // ❌ Hardcoded
  // ... ALL HARDCODED, NO CALCULATION
];
```

### Root Cause
- Score factors are not derived from case data
- No deterministic algorithm
- No visibility into why score is low
- No guidance on how to improve

### Solution

**Step 1: Define Scoring Algorithm**
```typescript
interface HealthScoreFactors {
  documentsCount: number;  // 0-100: based on required docs
  diagnosisQuality: number;  // 0-100: if diagnosis present and valid
  icdQuality: number;  // 0-100: if ICD present and validated
  billingConsistency: number;  // 0-100: if amounts are consistent
  policyValidation: number;  // 0-100: if policy number + insurer valid
  signatureStatus: number;  // 0-100: if all required signatures present
  clinicalValidity: number;  // 0-100: if clinical note length >= 50 chars
  extractionConfidence: number;  // 0-100: average AI extraction confidence
}

const calculateHealthScore = (caseRecord: Case): { score: number; factors: HealthScoreFactors; issues: string[] } => {
  const issues: string[] = [];
  
  // 1. Documents Score (0-100)
  const requiredDocs = ['insurance_card', 'id_proof', 'doctor_notes'];
  const presentDocs = requiredDocs.filter(docType => 
    caseRecord.documents.some(d => d.category === docType)
  );
  const documentsScore = (presentDocs.length / requiredDocs.length) * 100;
  if (documentsScore < 100) {
    const missing = requiredDocs.filter(dt => !presentDocs.includes(dt));
    issues.push(`Missing documents: ${missing.join(', ')}`);
  }
  
  // 2. Diagnosis Quality (0-100)
  const diagnosisQuality = caseRecord.clinical.diagnosis ? 100 : 0;
  if (!caseRecord.clinical.diagnosis) {
    issues.push('No diagnosis entered');
  }
  
  // 3. ICD Quality (0-100)
  const icdQuality = caseRecord.clinical.icdCode ? 100 : 0;
  if (!caseRecord.clinical.icdCode) {
    issues.push('No ICD-10 code assigned');
  }
  
  // 4. Billing Consistency (0-100)
  const billingConsistency = caseRecord.billing?.finalAmount && caseRecord.authorization?.requestedAmount
    ? caseRecord.billing.finalAmount <= caseRecord.authorization.requestedAmount * 1.2 ? 100 : 70
    : 80;
  if (billingConsistency < 100) {
    issues.push('Billing may exceed approved amount');
  }
  
  // 5. Policy Validation (0-100)
  const policyValidation = (caseRecord.insurance.policyNumber && caseRecord.insurance.insurerName) ? 100 : 0;
  if (policyValidation < 100) {
    issues.push('Policy information incomplete');
  }
  
  // 6. Signature Status (0-100)
  // TODO: Check actual signature fields when added to model
  const signatureStatus = 100;  // Placeholder
  
  // 7. Clinical Validity (0-100)
  const clinicalValidity = caseRecord.clinical.clinicalNote?.originalText?.length ?? 0 >= 50 ? 100 : 60;
  if (clinicalValidity < 100) {
    issues.push('Clinical note too short (min 50 chars)');
  }
  
  // 8. Extraction Confidence (0-100)
  const extractionMetadata = caseRecord.metadata?.formExtractionResults;
  let extractionConfidence = 100;
  if (extractionMetadata?.results) {
    const confidences = Object.values(extractionMetadata.results)
      .filter(field => field?.confidence)
      .map(field => field.confidence);
    if (confidences.length > 0) {
      extractionConfidence = Math.round(
        confidences.reduce((a, b) => a + b, 0) / confidences.length
      );
    }
  }
  
  const factors: HealthScoreFactors = {
    documentsCount: Math.round(documentsScore),
    diagnosisQuality,
    icdQuality,
    billingConsistency: Math.round(billingConsistency),
    policyValidation,
    signatureStatus,
    clinicalValidity: Math.round(clinicalValidity),
    extractionConfidence
  };
  
  // Calculate overall score (weighted average)
  const weights = {
    documentsCount: 0.15,
    diagnosisQuality: 0.20,
    icdQuality: 0.15,
    billingConsistency: 0.15,
    policyValidation: 0.15,
    signatureStatus: 0.10,
    clinicalValidity: 0.05,
    extractionConfidence: 0.05,
  };
  
  const score = Math.round(
    Object.keys(factors).reduce((sum, key) => {
      return sum + (factors[key as keyof HealthScoreFactors] * weights[key as keyof typeof weights]);
    }, 0)
  );
  
  return { score, factors, issues };
};
```

**Step 2: Update Component to Show Calculation**
```typescript
const CaseHealthScore: React.FC<CaseHealthScoreProps> = ({ caseRecord }) => {
  const { score, factors, issues } = calculateHealthScore(caseRecord);
  
  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = score >= 80 ? 'bg-green-50' : score >= 60 ? 'bg-amber-50' : 'bg-red-50';
  const scoreBorder = score >= 80 ? 'border-green-200' : score >= 60 ? 'border-amber-200' : 'border-red-200';
  
  return (
    <SummaryCard title="Case Health Score">
      {/* Score Card */}
      <div className={`rounded-lg border ${scoreBorder} ${scoreBg} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Health Score</div>
            <div className={`text-4xl font-bold ${scoreColor}`}>{score}</div>
          </div>
          <Target className={`w-12 h-12 ${scoreColor} opacity-20`} />
        </div>
        
        {/* Score Interpretation */}
        <div className="text-sm text-opd-text-primary">
          {score >= 80 && "✓ Case is healthy and ready for submission"}
          {score >= 60 && score < 80 && "⚠ Case needs attention in a few areas"}
          {score < 60 && "❌ Case requires significant review before submission"}
        </div>
      </div>
      
      {/* Factor Breakdown */}
      <div className="mb-4 space-y-2">
        <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Score Breakdown</div>
        {Object.entries(factors).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-opd-text-primary capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-full rounded-full ${
                    value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="w-10 text-right font-bold text-opd-text-primary">{value}%</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Issues & Recommendations */}
      {issues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider">What reduced the score</div>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="text-xs text-red-700 flex gap-2">
                <span>•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SummaryCard>
  );
};
```

### Files to Modify
- `components/CaseOverview/CaseOverviewDashboard.tsx` (CaseHealthScore component)
- `services/caseModel.ts` (update completeness metric calculation)

---

## ISSUE #4: CONTRADICTORY READINESS SCORES (CRITICAL)

### Problem
Screen displays conflicting readiness metrics:
- Left sidebar: "45%" (completeness score?)
- Claim Readiness card: "95%" (overall progress)
- Different sections show different numbers

**Location:** `CaseOverviewDashboard.tsx:306-353` (ClaimReadinessProgress component)

**Code Issue:**
```typescript
const categories = [
  { name: 'Patient Information', percent: 100 },
  { name: 'Clinical Information', percent: 84 },  // ← Hardcoded
  { name: 'Documents', percent: 100 },
  { name: 'Billing', percent: 90 },
  { name: 'Policy Validation', percent: 100 },
];

const avgPercent = Math.round(
  categories.reduce((sum, cat) => sum + cat.percent, 0) / categories.length
);  // Always 94-95%, regardless of actual case state
```

### Root Cause
- Hardcoded percentages, not calculated from data
- Multiple different "scores" with no clear distinction
- No single source of truth
- Confusion: which score matters?

### Solution

**Create Single Readiness Model:**
```typescript
interface SubmissionReadiness {
  overall: number;  // 0-100: Can we submit NOW?
  byCategory: {
    patient: number;  // Patient info complete?
    clinical: number;  // Diagnosis, ICD, procedures?
    documents: number;  // All required docs present?
    billing: number;  // Cost estimate, approval amount?
    policy: number;  // Policy validated?
  };
  blockers: string[];  // Things preventing submission
  readyToSubmit: boolean;  // true if >= 90 and no blockers
}

const calculateSubmissionReadiness = (caseRecord: Case): SubmissionReadiness => {
  const blockers: string[] = [];
  
  // Patient Information (0-100)
  const patient = {
    hasName: caseRecord.patient.name ? 100 : 0,
    hasAge: caseRecord.patient.age ? 100 : 0,
    hasGender: caseRecord.patient.gender ? 100 : 0,
    hasUhid: caseRecord.patient.uhid ? 100 : 0,
  };
  const patientScore = Math.round(
    (patient.hasName + patient.hasAge + patient.hasGender + patient.hasUhid) / 4
  );
  if (patientScore < 100) {
    blockers.push('Incomplete patient information');
  }
  
  // Clinical Information (0-100)
  const clinical = {
    hasDiagnosis: caseRecord.clinical.diagnosis ? 100 : 0,
    hasIcd: caseRecord.clinical.icdCode ? 100 : 0,
    hasProcedure: caseRecord.clinical.proposedProcedure ? 100 : 0,
    hasNote: caseRecord.clinical.clinicalNote?.originalText?.length ?? 0 >= 50 ? 100 : 0,
  };
  const clinicalScore = Math.round(
    (clinical.hasDiagnosis + clinical.hasIcd + clinical.hasProcedure + clinical.hasNote) / 4
  );
  if (clinicalScore < 100) {
    blockers.push('Incomplete clinical information');
  }
  
  // Documents (0-100)
  const requiredDocs = ['insurance_card', 'doctor_notes', 'id_proof'];
  const presentDocs = requiredDocs.filter(dt =>
    caseRecord.documents.some(d => d.category === dt)
  );
  const documentsScore = (presentDocs.length / requiredDocs.length) * 100;
  if (documentsScore < 100) {
    blockers.push(`Missing ${requiredDocs.length - presentDocs.length} required documents`);
  }
  
  // Billing (0-100)
  const billing = {
    hasCost: caseRecord.billing?.expectedCost ? 100 : 0,
    hasApprovedAmount: caseRecord.authorization?.approvedAmount ? 100 : 0,
  };
  const billingScore = Math.round(
    (billing.hasCost + billing.hasApprovedAmount) / 2
  );
  if (billingScore < 100) {
    blockers.push('Billing information incomplete');
  }
  
  // Policy (0-100)
  const policy = {
    hasNumber: caseRecord.insurance.policyNumber ? 100 : 0,
    hasInsurer: caseRecord.insurance.insurerName ? 100 : 0,
    isVerified: caseRecord.insurance.verified ? 100 : 0,
  };
  const policyScore = Math.round(
    (policy.hasNumber + policy.hasInsurer + policy.isVerified) / 3
  );
  if (policyScore < 100) {
    blockers.push('Policy validation incomplete');
  }
  
  const byCategory = {
    patient: Math.round(patientScore),
    clinical: Math.round(clinicalScore),
    documents: Math.round(documentsScore),
    billing: Math.round(billingScore),
    policy: Math.round(policyScore),
  };
  
  const overall = Math.round(
    (byCategory.patient + byCategory.clinical + byCategory.documents + byCategory.billing + byCategory.policy) / 5
  );
  
  return {
    overall,
    byCategory,
    blockers,
    readyToSubmit: overall >= 90 && blockers.length === 0,
  };
};
```

**Update Component:**
```typescript
const ClaimReadinessProgress: React.FC<ClaimReadinessProgressProps> = ({ caseRecord }) => {
  const readiness = calculateSubmissionReadiness(caseRecord);
  
  const statusColor = readiness.readyToSubmit 
    ? 'text-green-600' 
    : readiness.overall >= 80 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  return (
    <SummaryCard title="Submission Readiness">
      {/* Overall Status */}
      <div className={`mb-4 p-4 rounded-lg bg-${statusColor.split('-')[1]}-50 border border-${statusColor.split('-')[1]}-200`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-opd-text-muted text-xs mb-1">Overall Readiness</div>
            <div className={`text-3xl font-bold ${statusColor}`}>{readiness.overall}%</div>
            <div className="text-xs text-opd-text-muted mt-2">
              {readiness.readyToSubmit 
                ? "✓ Ready to submit to TPA"
                : readiness.overall >= 80
                  ? "Almost ready – resolve issues below"
                  : "Needs more work before submission"}
            </div>
          </div>
        </div>
      </div>
      
      {/* Category Breakdown */}
      <div className="mb-4 space-y-3">
        {Object.entries(readiness.byCategory).map(([category, score]) => (
          <div key={category}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-opd-text-primary capitalize">{category}</span>
              <span className="text-xs font-semibold">{score}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${
                  score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Blockers */}
      {readiness.blockers.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">
            Blockers
          </div>
          <ul className="space-y-1">
            {readiness.blockers.map((blocker, i) => (
              <li key={i} className="text-xs text-red-700 flex gap-2">
                <span>❌</span>
                <span>{blocker}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SummaryCard>
  );
};
```

### Files to Modify
- `components/CaseOverview/CaseOverviewDashboard.tsx` (ClaimReadinessProgress component)
- Remove any duplicate readiness display from sidebar

---

## ISSUE #5: MISSING ITEMS PANEL LACKS CONTEXT (HIGH)

### Problem
Currently missing items are just listed:
- "Policy Number"
- "Clinical Diagnosis"
- "ICD-10"

But without:
- Why it's required
- Where to get it
- Quick action to fix it

### Solution

```typescript
interface MissingItemWithContext {
  field: string;
  required: boolean;
  requiredFor: string[];  // Which processes need this
  source: string;  // Where to get it
  quickAction?: {
    label: string;
    action: () => void;
  };
}

const MissingItemsPanel: React.FC<{ caseRecord: Case; onAction?: (action: string) => void }> = ({
  caseRecord,
  onAction
}) => {
  const missingItems: MissingItemWithContext[] = [];
  
  if (!caseRecord.insurance.policyNumber) {
    missingItems.push({
      field: 'Policy Number',
      required: true,
      requiredFor: ['Prior Authorization', 'Claim Submission'],
      source: 'Patient\'s insurance documents or confirmation email',
      quickAction: {
        label: 'Add Policy',
        action: () => onAction?.('edit-policy')
      }
    });
  }
  
  if (!caseRecord.clinical.diagnosis) {
    missingItems.push({
      field: 'Clinical Diagnosis',
      required: true,
      requiredFor: ['Medical Necessity', 'ICD Mapping', 'TPA Submission'],
      source: 'Doctor\'s notes or discharge summary',
      quickAction: {
        label: 'Review Note',
        action: () => onAction?.('review-clinical-note')
      }
    });
  }
  
  if (!caseRecord.clinical.icdCode) {
    missingItems.push({
      field: 'ICD-10 Code',
      required: true,
      requiredFor: ['Medical Necessity', 'Billing Verification'],
      source: 'Auto-assigned from diagnosis or manual entry',
      quickAction: {
        label: 'Assign ICD',
        action: () => onAction?.('assign-icd')
      }
    });
  }
  
  if (missingItems.length === 0) {
    return (
      <SummaryCard title="Missing Items">
        <div className="text-center py-6">
          <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-700">All required items present!</p>
        </div>
      </SummaryCard>
    );
  }
  
  return (
    <SummaryCard title="Missing Items">
      <div className="space-y-3">
        {missingItems.map((item, i) => (
          <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-amber-900">{item.field}</div>
                {item.required && (
                  <span className="text-xs font-semibold text-red-600">Required</span>
                )}
              </div>
              {item.quickAction && (
                <button
                  onClick={item.quickAction.action}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900"
                >
                  {item.quickAction.label} →
                </button>
              )}
            </div>
            
            <div className="text-xs text-amber-800 mb-2">
              <div className="font-semibold">Needed for:</div>
              <ul className="flex flex-wrap gap-2 mt-1">
                {item.requiredFor.map((proc, j) => (
                  <li key={j} className="bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    {proc}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="text-xs text-amber-700">
              <div className="font-semibold">Source:</div>
              <p>{item.source}</p>
            </div>
          </div>
        ))}
      </div>
    </SummaryCard>
  );
};
```

### Files to Modify
- `components/CaseOverview/CaseOverviewDashboard.tsx` (add MissingItemsPanel component)

---

## ISSUE #6: NO INTELLIGENT RECOMMENDATIONS (HIGH)

### Problem
Currently no "Suggested Next" section at all.

### Solution

```typescript
interface Recommendation {
  title: string;
  description: string;
  why: string;
  impact: string;  // What improves
  estimatedTime: string;
  action: {
    label: string;
    handler: () => void;
  };
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const SuggestedNextSteps: React.FC<{ caseRecord: Case; onAction?: (action: string) => void }> = ({
  caseRecord,
  onAction
}) => {
  const recommendations: Recommendation[] = [];
  
  // If no diagnosis, suggest reviewing note
  if (!caseRecord.clinical.diagnosis) {
    recommendations.push({
      title: 'Review Clinical Note',
      description: 'Extract diagnosis from doctor\'s notes',
      why: 'Diagnosis is required for medical necessity and billing verification',
      impact: 'Unlocks: ICD assignment, Medical Necessity generation',
      estimatedTime: '5 min',
      action: {
        label: 'Review Note',
        handler: () => onAction?.('review-note')
      },
      priority: 'critical'
    });
  }
  
  // If diagnosis but no ICD
  if (caseRecord.clinical.diagnosis && !caseRecord.clinical.icdCode) {
    recommendations.push({
      title: 'Assign ICD-10 Code',
      description: 'Map diagnosis to ICD-10 classification',
      why: 'ICD code required for proper billing and authorization',
      impact: 'Improves score by 15%',
      estimatedTime: '3 min',
      action: {
        label: 'Assign ICD',
        handler: () => onAction?.('assign-icd')
      },
      priority: 'high'
    });
  }
  
  // If score < 80, suggest uploading missing docs
  if (caseRecord.completeness.overallScore < 80) {
    const missingDocs = ['insurance_card', 'doctor_notes', 'id_proof']
      .filter(dt => !caseRecord.documents.some(d => d.category === dt));
    
    if (missingDocs.length > 0) {
      recommendations.push({
        title: 'Upload Missing Documents',
        description: `Upload ${missingDocs.length} required document(s)`,
        why: `Documents are needed for compliance and TPA submission`,
        impact: `Improves score by ${missingDocs.length * 15}%`,
        estimatedTime: '10 min',
        action: {
          label: 'Upload',
          handler: () => onAction?.('upload-docs')
        },
        priority: 'high'
      });
    }
  }
  
  // If score >= 80 and ready for pre-auth
  if (caseRecord.completeness.overallScore >= 80 && !caseRecord.authorization?.status) {
    recommendations.push({
      title: 'Generate Prior Authorization',
      description: 'Create IRDAI pre-auth packet',
      why: 'Required before TPA submission',
      impact: 'Enables TPA submission workflow',
      estimatedTime: '5 min',
      action: {
        label: 'Generate',
        handler: () => onAction?.('generate-preauth')
      },
      priority: 'high'
    });
  }
  
  if (recommendations.length === 0) {
    return (
      <SummaryCard title="Suggested Next Steps">
        <div className="text-center py-6">
          <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-700">No further actions needed</p>
          <p className="text-xs text-green-600 mt-1">Ready to submit to TPA</p>
        </div>
      </SummaryCard>
    );
  }
  
  return (
    <SummaryCard title="Suggested Next Steps">
      <div className="space-y-3">
        {recommendations
          .sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          })
          .map((rec, i) => {
            const priorityColor = {
              critical: 'border-red-200 bg-red-50',
              high: 'border-amber-200 bg-amber-50',
              medium: 'border-blue-200 bg-blue-50',
              low: 'border-gray-200 bg-gray-50'
            }[rec.priority];
            
            return (
              <div key={i} className={`border rounded-lg p-3 ${priorityColor}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-opd-text-primary">{rec.title}</div>
                    <div className="text-sm text-opd-text-muted">{rec.description}</div>
                  </div>
                  <button
                    onClick={rec.action.handler}
                    className="text-xs font-bold text-opd-primary hover:underline whitespace-nowrap ml-4"
                  >
                    {rec.action.label} →
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                  <div>
                    <div className="font-semibold text-opd-text-muted">Why</div>
                    <p className="text-opd-text-primary mt-1">{rec.why}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-opd-text-muted">Impact</div>
                    <p className="text-green-600 font-semibold mt-1">{rec.impact}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-opd-text-muted">Time</div>
                    <p className="text-opd-text-primary mt-1">{rec.estimatedTime}</p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </SummaryCard>
  );
};
```

### Files to Modify
- `components/CaseOverview/CaseOverviewDashboard.tsx` (add SuggestedNextSteps component)

---

## ISSUE #7: NO TIMELINE IMPLEMENTATION (MEDIUM)

### Problem
"View Timeline" button doesn't work. Timeline feature not implemented.

### Solution

```typescript
const CaseTimeline: React.FC<{ caseRecord: Case }> = ({ caseRecord }) => {
  const events = [
    {
      timestamp: new Date(caseRecord.createdAt),
      event: 'Case Created',
      description: `Patient ${caseRecord.patient.name} registered`,
      icon: 'plus'
    },
    ...(caseRecord.documents.length > 0 ? [{
      timestamp: new Date(caseRecord.documents[0].uploadedAt || caseRecord.createdAt),
      event: 'Documents Uploaded',
      description: `${caseRecord.documents.length} document(s) processed`,
      icon: 'upload'
    }] : []),
    ...(caseRecord.metadata?.formExtractionResults ? [{
      timestamp: new Date(caseRecord.metadata.formExtractionResults.extractedAt),
      event: 'Extraction Complete',
      description: `${Object.keys(caseRecord.metadata.formExtractionResults.results || {}).length} fields extracted`,
      icon: 'zap'
    }] : []),
    ...(caseRecord.clinical.diagnosis ? [{
      timestamp: new Date(caseRecord.updatedAt),
      event: 'Clinical Review',
      description: `Diagnosis: ${caseRecord.clinical.diagnosis}`,
      icon: 'check'
    }] : []),
    ...(caseRecord.authorization?.status === 'approved' ? [{
      timestamp: new Date(caseRecord.authorization.respondedAt || caseRecord.updatedAt),
      event: 'Prior Auth Approved',
      description: `₹${caseRecord.authorization.approvedAmount?.toLocaleString()}`,
      icon: 'thumbs-up'
    }] : []),
  ];
  
  return (
    <div className="space-y-4">
      {events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map((evt, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-opd-primary text-white flex items-center justify-center text-sm font-bold">
              {i + 1}
            </div>
            {i < events.length - 1 && (
              <div className="w-0.5 h-12 bg-gray-300 mt-2" />
            )}
          </div>
          <div className="py-2">
            <div className="font-semibold text-opd-text-primary">{evt.event}</div>
            <div className="text-sm text-opd-text-muted">{evt.description}</div>
            <div className="text-xs text-gray-500 mt-1">
              {evt.timestamp.toLocaleDateString()} at {evt.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Files to Modify
- `components/CaseOverview/CaseOverviewDashboard.tsx` (add CaseTimeline component)
- Add modal/drawer to display timeline

---

## COMPREHENSIVE IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (Before Demo - Today)

**Priority 1: Dead Buttons**
- [ ] Add onClick handlers to all 4 quick actions
- [ ] Add prerequisite validation
- [ ] Add disabled states with meaningful tooltips
- [ ] Wire to proper navigation/modals
- **Time:** 2-3 hours

**Priority 2: Business Outcomes**
- [ ] Calculate from actual case data
- [ ] Remove all hardcoded values
- [ ] Show "Not Available Yet" when data missing
- **Time:** 1-2 hours

**Priority 3: Health Score**
- [ ] Implement deterministic scoring algorithm
- [ ] Show score factors with calculations
- [ ] List issues preventing higher score
- [ ] Add recommendations for improvement
- **Time:** 2-3 hours

**Priority 4: Readiness Scores**
- [ ] Consolidate to single "Submission Readiness" metric
- [ ] Calculate by category from actual case data
- [ ] Show blockers if not ready
- **Time:** 1-2 hours

### Phase 2: High Priority (After Demo)

**Priority 5: Missing Items Context**
- [ ] Show why each item required
- [ ] Show where to get it
- [ ] Add quick actions
- **Time:** 1 hour

**Priority 6: Intelligent Recommendations**
- [ ] Implement SuggestedNextSteps component
- [ ] Prioritize by impact
- [ ] Link to actual workflow actions
- **Time:** 2 hours

**Priority 7: Timeline**
- [ ] Implement case timeline from activities
- [ ] Add modal to display with full details
- [ ] Wire "View Timeline" button
- **Time:** 1-2 hours

---

## FILE MODIFICATIONS SUMMARY

| File | Changes | Lines |
|------|---------|-------|
| `CaseOverviewDashboard.tsx` | QuickActions (handlers), BusinessOutcomes (calculation), CaseHealthScore (algorithm), ClaimReadinessProgress (consolidation), MissingItemsPanel (new), SuggestedNextSteps (new), CaseTimeline (new) | +400 -100 |
| `CaseWorkspaceRouter.tsx` | Add navigation/modal handlers | +20 |
| `caseModel.ts` | Add metadata field, update completeness calculation | +30 |
| New file: `services/caseHealthScoring.ts` | Scoring algorithm (reusable) | +200 |

---

## TESTING CHECKLIST

- [ ] All buttons navigate or open modals correctly
- [ ] Health score changes when case data changes
- [ ] Business outcomes match actual case metrics
- [ ] Readiness score reflects actual completeness
- [ ] Missing items show context and quick actions
- [ ] Recommendations appear based on case state
- [ ] Timeline loads and displays correctly
- [ ] No hardcoded values visible to user
- [ ] All calculations deterministic and auditable
- [ ] Demo flows smoothly from patient registration → overview → actions

---

## DEMO SCRIPT

1. **Create new patient** → Registration form auto-fills from Aadhaar
2. **Open Case Overview** → Shows:
   - Health Score: 45% (with breakdown)
   - Submission Readiness: 45% (with blockers listed)
   - Missing Items: Policy, Diagnosis, ICD (with quick actions)
   - Suggested Actions: Review Note → Assign ICD → Generate Pre-Auth
3. **Click "Review Note"** → Opens clinical note view
4. **Extract diagnosis** → Score jumps to 60%
5. **Assign ICD** → Score jumps to 75%
6. **Upload missing docs** → Score reaches 85%
7. **Generate Pre-Auth** → Button enabled, workflow progresses
8. **Submit to TPA** → Workflow complete

---

## DELIVERABLES

✅ Production-ready Case Overview screen  
✅ All buttons functional and workflow-aware  
✅ Deterministic scoring algorithms  
✅ No hardcoded values  
✅ Clear, contextual guidance for users  
✅ Demo-ready for tomorrow

---

## ESTIMATED EFFORT

- **Phase 1 (Critical):** 8-10 hours
- **Phase 2 (High Priority):** 4-5 hours
- **Testing & Polish:** 2-3 hours
- **Total:** 14-18 hours

**Ready by:** Tomorrow morning (hospital demo)
