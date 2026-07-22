# Clinical Coding System - Complete Architecture

## Overview

The Clinical Coding System is an **AI-assisted, hospital-coordinator-driven** ICD-10 coding solution optimized for Indian hospital insurance operations (pre-authorization workflows).

**Key Principle:** AI is an ASSISTANT only. The Hospital Insurance Coordinator (or Billing Executive) is the final authority.

---

## Components

### 1. ICD Knowledge Base (`icdKnowledgeBase.ts`)

**Purpose:** Abstracted, backend-agnostic lookup service for ICD codes.

**Capabilities:**
- Search by diagnosis description
- Search by clinical abbreviations/keywords
- Search by medical synonyms
- Autocomplete suggestions
- Hierarchy lookups
- Code validation
- Demographic compatibility checks (age/gender)

**Backend Flexibility:**
- Kaggle India Hospital Readmission Dataset (current)
- WHO ICD-10 (future)
- ICD-11 (future)
- Hospital custom dictionaries
- Government coding updates

**No implementation is tightly coupled to the backend.**

### 2. Deterministic Validator (`icdDeterministicValidator.ts`)

**Purpose:** Rule-based validation that runs BEFORE AI ranking.

**Validates:**
- ✓ Age compatibility (e.g., newborn-only codes for adults → reject)
- ✓ Gender compatibility (e.g., pregnancy codes for males → reject)
- ✓ Evidence support (e.g., herniated disc without imaging evidence → flag)
- ✓ Lab contradictions (e.g., diabetes code with normal glucose → reject)
- ✓ Imaging contradictions (e.g., disc herniation code but imaging normal → reject)
- ✓ Clinical logic (e.g., can't have both normal and complicated pregnancy → reject)
- ✓ Procedure compatibility (e.g., spinal code but no spinal procedure → warn)
- ✓ Symptom vs diagnosis (e.g., don't code back pain when herniated disc exists → reject)

**Process:**
```
Candidate Code
    ↓
Deterministic Validation (Rule-based)
    ├─ Reject: Invalid (error)
    ├─ Flag: Review needed (warning)
    └─ Pass: Valid (proceed to AI)
    ↓
Valid Candidates
    ↓
AI Ranking (only for valid candidates)
```

**Critical:** Invalid codes are REJECTED before they reach AI.

### 3. Clinical Coding Engine (`clinicalCodingEngine.ts`)

**Purpose:** AI-assisted recommendation system for ICD coding.

**Workflow:**
```
Unified Case Model (all sources merged, conflicts resolved)
    ↓
Extract Clinical Evidence
    ├─ Primary diagnosis
    ├─ Secondary diagnoses
    ├─ Comorbidities (from past medical history)
    ├─ Complications
    ├─ Lab findings
    └─ Imaging findings
    ↓
Normalize Medical Terminology
    • Expand abbreviations (HTN → hypertension)
    • Standardize terms (gall bladder stone → cholelithiasis)
    ↓
Generate ICD Candidates
    • Search knowledge base with normalized terms
    • Get candidate codes (multiple matches possible)
    ↓
Validate Candidates (Deterministic Validator)
    • Reject invalid candidates
    • Keep only valid candidates
    ↓
Rank Valid Candidates (AI)
    • Calculate confidence for each valid code
    • Score based on: evidence match, lab support, imaging support, documentation
    • Sort by confidence (highest first)
    ↓
Build Detailed Suggestions
    • For each suggested code: evidence trail, supporting docs, page numbers, reasoning
    • Assign confidence category: High (>95%), Review (75-95%), Manual (<75%)
    ↓
Output: ClinicalCodingResult
```

**Output Structure:**
```typescript
{
  primaryDiagnosis: ICDSuggestion,
  secondaryDiagnoses: ICDSuggestion[],
  comorbidities: ICDSuggestion[],
  complications: ICDSuggestion[],
  
  // For each suggestion:
  {
    code: "M51.26",
    description: "Unspecified internal displacement of lumbar intervertebral disc",
    confidence: 0.92,                    // 0-1
    confidenceCategory: "review_recommended",
    supportingDiagnosis: "Herniated disc L4-L5",
    supportingEvidence: [
      "Documented diagnosis: Herniated disc at L4-L5",
      "Imaging support: MRI shows disc herniation L4-L5 with nerve compression"
    ],
    supportingDocuments: ["MRI Report"],
    supportingPageNumbers: [1],
    clinicalReasoning: "Based on documented diagnosis...",
    validationIssues: [],
    validationWarnings: [],
    evidenceStrength: "strong"
  }
}
```

### 4. Coding Review Workflow (`codingReviewWorkflow.ts`)

**Purpose:** Hospital coordinator interface for reviewing and approving/modifying AI suggestions.

**Coordinator Actions:**

| Action | Description | Authority | Tracking |
|--------|-------------|-----------|----------|
| **Accept** | Approve engine suggestion as-is | ✓ Can do | Full audit |
| **Search** | Look up alternative codes in knowledge base | ✓ Can do | Logged |
| **Replace** | Override engine suggestion with different code | ✓ Can do | Must provide reason |
| **Add** | Manually add code not suggested by engine | ✓ Can do | Requires evidence + guideline |
| **Remove** | Reject code (engine or manual) | ✓ Can do | Must provide reason |
| **View Evidence** | See supporting documents, page numbers, evidence trail | ✓ Can do | Logged |

**Workflow:**
```
Engine Suggestions Ready
    ↓
Assign to Coordinator
    • Insurance Coordinator (default)
    • Billing Executive (configurable)
    ↓
Coordinator Starts Review
    • Views engine suggestions with confidence levels
    • Reads supporting evidence
    • Sees validation issues/warnings
    ↓
For Each Suggestion
    ├─ Accept → Move to approved
    ├─ Replace → Search alternatives → Select new code → Record reason
    ├─ Add → Search knowledge base → Select code → Provide evidence + guideline
    └─ Remove → Record reason
    ↓
Review Complete
    • Primary diagnosis confirmed
    • Secondary diagnoses approved
    • Comorbidities approved
    • Complications approved
    ↓
Case Ready for TPA Submission
```

**Every Action Recorded:** timestamp, coordinator, code, reason, evidence, guideline.

### 5. Coding Audit Trail (`codingAuditTrail.ts`)

**Purpose:** Complete traceability of every ICD coding decision for IRDAI compliance.

**Tracks:**
```
Event Timeline:
├─ Engine Suggestion
│  ├─ Code suggested
│  ├─ Confidence level
│  ├─ Reasoning
│  └─ Evidence
├─ Coordinator Review Started
├─ Coordinator Actions (for each code)
│  ├─ Accept/Replace/Add/Remove
│  ├─ Timestamp
│  ├─ Coordinator name & role
│  ├─ Reason
│  └─ Evidence/Guideline
├─ Review Completed
│  └─ Final codes approved
├─ Compliance Audit (optional)
│  ├─ Auditor checks
│  ├─ Issues found (if any)
│  └─ Compliance status
└─ Export for IRDAI
   └─ Complete JSON audit trail
```

**Compliance Export Includes:**
- All suggestions from engine
- All coordinator decisions
- Reasons for each decision
- Evidence trail for each code
- Timeline of actions
- Coordinator signatures
- Audit status

---

## Confidence Thresholds

| Confidence | Category | Action |
|-----------|----------|--------|
| **>95%** | High Confidence | ✓ Ready for approval |
| **75-95%** | Review Recommended | ⚠ Coordinator should verify |
| **<75%** | Manual Review Required | ❌ Coordinator must decide |

---

## Complete Workflow: End-to-End

### Step 1: Extraction & Reconciliation Complete
```
Unified Case Model has:
✓ Patient note (primary source)
✓ Document extractions (secondary sources)
✓ Conflicts resolved
✓ All fields extracted with provenance
```

### Step 2: Clinical Coding Engine Runs
```
clinicalCodingEngine.generateSuggestions(unifiedCase, reconciliation)
    ↓
Returns: ClinicalCodingResult with:
• Primary diagnosis suggestion (if available)
• Secondary diagnosis suggestions
• Comorbidity suggestions
• Complication suggestions
• Each with: code, description, confidence, evidence, reasoning
```

### Step 3: Assign to Coordinator
```
codingReviewWorkflow.createReviewTask(
  caseId,
  engineSuggestions,
  coordinatorId,
  coordinatorName,
  coordinatorRole  // "insurance_coordinator" or "billing_executive"
)
    ↓
Returns: CodingReviewTask assigned to coordinator
```

### Step 4: Coordinator Reviews & Decides
```
coordinatorReviewsCase()
    ├─ Views primary diagnosis suggestion (e.g., M51.26 at 92% confidence)
    ├─ Reads evidence: "Documented diagnosis + MRI confirms"
    ├─ May:
    │  ├─ Accept M51.26 → recorded
    │  ├─ Search alternatives → find M51.20 (more specific) → replace → recorded
    │  └─ Add secondary: M54.1 (radiculopathy) with evidence → recorded
    ├─ Views comorbidities (e.g., I10 - Hypertension at 88%)
    ├─ May accept/replace/remove each one
    └─ Completes review
    ↓
All decisions logged to audit trail
```

### Step 5: Complete Review
```
codingReviewWorkflow.completeReview(taskId, coordinatorId)
    ↓
Sets status to "completed"
Records duration
Returns: CodingReviewTask with approved codes
```

### Step 6: Export for IRDAI
```
codingAuditTrail.exportForCompliance(caseId)
    ↓
Returns: Complete JSON with:
  • Every engine suggestion
  • Every coordinator decision
  • Timeline of actions
  • Reasons for changes
  • Evidence trail
  • Compliance status
  ↓
Submitted to TPA with pre-authorization request
```

---

## Hospital Configuration

The system is designed to be configurable per hospital:

```typescript
interface HospitalCodingConfig {
  defaultReviewerRole: 'insurance_coordinator' | 'billing_executive';
  requireAuditTrail: boolean;
  requireCompleteEvidence: boolean;
  escalationThreshold: 'high_confidence' | 'review_recommended' | 'none';
  medicalCoderOptional: boolean;  // True (coordinator is default)
  knowledgeBaseBackend: 'kaggle' | 'who' | 'hospital_custom';
  complianceFramework: 'irdai' | 'ndhm' | 'other';
}
```

---

## Authority Chain

```
1. Clinical Evidence
   └─ What's actually documented

2. Unified Case Model
   └─ All sources merged, conflicts resolved

3. Deterministic Validation Rules
   └─ Age, gender, diagnosis compatibility, etc.

4. ICD Knowledge Base
   └─ Official classification

5. AI Ranking
   └─ Confidence scoring

6. HOSPITAL COORDINATOR (Human Authority)
   └─ Final decision, can override everything
```

**The coordinator can:**
- ✓ Accept suggestions
- ✓ Reject suggestions
- ✓ Replace codes
- ✓ Add codes
- ✓ Override confidence

**The coordinator cannot:**
- ✗ Avoid audit trail
- ✗ Skip evidence documentation
- ✗ Code without coordinator role assignment

---

## IRDAI Compliance

Every decision is:
- ✓ Timestamped
- ✓ Attributed to coordinator
- ✓ Justified with reason
- ✓ Backed by evidence
- ✓ Tracked for audit
- ✓ Exportable for regulatory review

**Audit Trail Includes:**
```
{
  engine_suggestion: { code, confidence, reasoning, evidence },
  coordinator_decision: { action, code, reason, evidence, guideline },
  timestamp: "2026-07-22T14:30:00Z",
  actor: { coordinator_id, coordinator_name, coordinator_role },
  impact: "major" | "minor",
  status: "approved" | "escalated",
  compliance_verified: true | false
}
```

---

## Integration with Extraction Pipeline

```
Extraction & Reconciliation Pipeline
    ├─ Patient Note Extraction
    ├─ Document Classification
    ├─ Document Extraction
    ├─ Provenance Tracking
    ├─ Two-Source Reconciliation
    ├─ IRDAI Compliance Check
    └─ Unified Case Model Created
                    ↓
        Clinical Coding System
            ├─ ICD Knowledge Base
            ├─ Deterministic Validator
            ├─ Clinical Coding Engine
            ├─ Coding Review Workflow
            └─ Audit Trail
                    ↓
        Hospital Coordinator Reviews
            ├─ Approves suggestions
            ├─ Makes modifications
            └─ Completes review
                    ↓
        Case Ready for TPA Submission
            └─ With complete ICD codes & audit trail
```

---

## API Reference

### ICD Knowledge Base
```typescript
knowledgeBase.search(term, limit)          → ICDSearchResult[]
knowledgeBase.searchByDiagnosis(text)      → ICDSearchResult[]
knowledgeBase.searchByKeyword(abbr)        → ICDSearchResult[]
knowledgeBase.searchBySynonym(synonym)     → ICDSearchResult[]
knowledgeBase.getCode(code)                → ICDCode | null
knowledgeBase.getDescription(code)         → string | null
knowledgeBase.validateCode(code)           → ICDValidationResult
knowledgeBase.isValidForDemographics(code, age, gender) → {valid, reason}
```

### Deterministic Validator
```typescript
validator.validateCandidate(code)          → ValidatedICDCandidate
validator.validateCandidates(codes)        → ValidatedICDCandidate[]
```

### Clinical Coding Engine
```typescript
engine.generateSuggestions(case, reconciliation) → ClinicalCodingResult
```

### Coding Review Workflow
```typescript
workflow.createReviewTask(...)             → CodingReviewTask
workflow.startReview(taskId)               → CodingReviewTask
workflow.acceptSuggestion(...)             → CoordinatorDecision
workflow.searchICDCodes(query)             → ICDSearchResult[]
workflow.replaceCode(...)                  → CoordinatorDecision
workflow.addManualCode(...)                → CoordinatorDecision
workflow.rejectCode(...)                   → CoordinatorDecision
workflow.completeReview(taskId)            → CodingReviewTask
workflow.getAuditTrail(taskId)             → AuditTrailSummary
workflow.exportReviewForAudit(taskId)      → string (JSON)
```

### Coding Audit Trail
```typescript
auditTrail.recordEngineSuggestion(...)     → CodingAuditEntry
auditTrail.recordReviewStart(...)          → CodingAuditEntry
auditTrail.recordCodeAccepted(...)         → CodingAuditEntry
auditTrail.recordCodeReplaced(...)         → CodingAuditEntry
auditTrail.recordCodeAdded(...)            → CodingAuditEntry
auditTrail.recordCodeRejected(...)         → CodingAuditEntry
auditTrail.recordReviewCompleted(...)      → CodingAuditEntry
auditTrail.performComplianceAudit(...)     → CodingAuditEntry
auditTrail.exportForCompliance(caseId)     → string (JSON)
auditTrail.generateComplianceSummary(caseId) → string (report)
```

---

## Example: Complete Coding Workflow

```typescript
// 1. Extract and reconcile case
const extractionOutput = await runClinicalExtractionPipeline(input, caseRecord);
const validatedCase = validateCaseForIRDAICompliance(caseRecord, extractionOutput.reconciliation);

// 2. Initialize ICD knowledge base
const knowledgeBase = new ICDKnowledgeBase();
await knowledgeBase.loadCodes(new KaggleICDBackend());

// 3. Generate AI suggestions
const codingEngine = new ClinicalCodingEngine(knowledgeBase);
const suggestions = await codingEngine.generateSuggestions(caseRecord, extractionOutput.reconciliation);

// 4. Create review task for coordinator
const codingReview = new CodingReviewWorkflow(knowledgeBase);
const reviewTask = codingReview.createReviewTask(
  caseRecord.id,
  suggestions,
  coordinatorId,
  coordinatorName,
  'insurance_coordinator'
);

// 5. Coordinator reviews
codingReview.startReview(reviewTask.taskId);

// Accept primary diagnosis
codingReview.acceptSuggestion(
  reviewTask.taskId,
  suggestions.primaryDiagnosis,
  coordinatorId,
  coordinatorName,
  `Approved: Documented diagnosis with imaging confirmation`
);

// Replace secondary diagnosis
codingReview.replaceCode(
  reviewTask.taskId,
  'I10.0',  // Original
  'I10',    // New (less specific but accurate)
  'secondary',
  coordinatorId,
  coordinatorName,
  'Hypertension without complications',
  'ICD-10-CM 2024'
);

// Add manual code for comorbidity
codingReview.addManualCode(
  reviewTask.taskId,
  'E11.9',
  'comorbidity',
  coordinatorId,
  coordinatorName,
  'Type 2 diabetes noted in past medical history',
  'Documented in clinical note section'
);

// 6. Complete review
const completedTask = codingReview.completeReview(reviewTask.taskId, coordinatorId);

// 7. Export for compliance
const auditTrail = new CodingAuditTrail();
auditTrail.recordEngineSuggestion(...);  // All decisions already logged
const complianceExport = auditTrail.exportForCompliance(caseRecord.id);

// 8. Submit to TPA
submitToTPA({
  caseId: caseRecord.id,
  approvedCodes: completedTask.approvedCodes,
  auditTrail: complianceExport,
  complianceStatus: 'compliant'
});
```

---

## Summary

The Clinical Coding System is:
- ✅ **AI-Assisted** - Recommendations only, not authority
- ✅ **Coordinator-Driven** - Hospital coordinator makes final decisions
- ✅ **Rule-Based First** - Deterministic validation before AI
- ✅ **Evidence-Backed** - Every code justified with evidence
- ✅ **Fully Auditable** - Complete trail for IRDAI compliance
- ✅ **Configurable** - Per-hospital configuration
- ✅ **Future-Ready** - Pluggable knowledge base backends
- ✅ **Enterprise-Grade** - Production-ready implementation

The system is optimized for Indian hospital insurance pre-authorization workflows where hospital coordinators (not medical coders) are the default reviewers.
