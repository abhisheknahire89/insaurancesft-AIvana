# Case Overview — Quick Fix Implementation Guide

**Target:** Production-ready by tomorrow's hospital demo  
**Status:** Ready to implement  
**Files Created:** 2 (Audit Report + Scoring Service)  
**Files to Modify:** 1 (CaseOverviewDashboard.tsx)

---

## WHAT'S WRONG (Summary)

| Issue | Impact | Fix Status |
|-------|--------|-----------|
| All buttons are dead (4) | Can't do anything | Design ready ✓ |
| Business outcomes hardcoded | Shows fake metrics | Algorithm ready ✓ |
| Health score not calculated | Misleading 45% | Algorithm ready ✓ |
| Multiple readiness scores | Confusing (95% vs 45%) | Algorithm ready ✓ |
| Missing items just listed | No context or action | Design ready ✓ |
| No intelligent recommendations | User doesn't know what to do next | Algorithm ready ✓ |
| Timeline feature missing | "View Timeline" doesn't work | Design ready ✓ |
| No audit trail | Can't verify what happened | Algorithm ready ✓ |

---

## WHAT'S FIXED (Ready to Use)

### ✅ Scoring Service (`services/caseHealthScoringService.ts`)

**4 Production-Ready Functions:**

1. **`calculateHealthScore()`**
   - Inputs: Case object
   - Returns: Score (0-100) + factors + issues + recommendations
   - 8 weighted factors (documents, diagnosis, ICD, billing, policy, signature, clinical, extraction)
   - Deterministic algorithm
   - Fully auditable

2. **`calculateSubmissionReadiness()`**
   - Inputs: Case object
   - Returns: Overall score + by-category breakdown + blockers + warnings
   - 5 categories: patient, clinical, documents, billing, policy
   - Shows what prevents submission
   - Shows what's warning-level (non-blocking)

3. **`calculateBusinessOutcomes()`**
   - Inputs: Case object
   - Returns: 6 metrics (time saved, data reduction, docs processed, etc.)
   - All calculated from actual case data
   - No hardcoded values
   - Transparent about what's calculated vs not available

4. **`generateRecommendations()`**
   - Inputs: Case object
   - Returns: Prioritized list of recommended next actions
   - Each has: title, description, why, impact, time estimate, action type
   - Intelligent: adapts to case state
   - Prioritized: critical → high → medium → low

**Usage Example:**
```typescript
import { 
  calculateHealthScore,
  calculateSubmissionReadiness,
  calculateBusinessOutcomes,
  generateRecommendations
} from '@/services/caseHealthScoringService';

// In component
const healthScoring = calculateHealthScore(caseRecord);
const readiness = calculateSubmissionReadiness(caseRecord);
const metrics = calculateBusinessOutcomes(caseRecord);
const recommendations = generateRecommendations(caseRecord);

// Use in render
<HealthScore score={healthScoring.score} factors={healthScoring.factors} issues={healthScoring.issues} />
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Critical Fixes (Must Have for Demo)

#### [ ] 1. Update CaseHealthScore Component
```typescript
import { calculateHealthScore } from '@/services/caseHealthScoringService';

const CaseHealthScore: React.FC<CaseHealthScoreProps> = ({ caseRecord }) => {
  const { score, factors, issues, recommendations } = calculateHealthScore(caseRecord);
  
  // Replace hardcoded factors with real calculation
  // Show issues and recommendations
};
```
**Time:** 30 mins  
**Files:** `CaseOverviewDashboard.tsx`

#### [ ] 2. Update ClaimReadinessProgress Component
```typescript
import { calculateSubmissionReadiness } from '@/services/caseHealthScoringService';

const ClaimReadinessProgress: React.FC<ClaimReadinessProgressProps> = ({ caseRecord }) => {
  const { overall, byCategory, blockers } = calculateSubmissionReadiness(caseRecord);
  
  // Replace hardcoded categories with real calculation
  // Show blockers if not ready
};
```
**Time:** 30 mins  
**Files:** `CaseOverviewDashboard.tsx`

#### [ ] 3. Update BusinessOutcomes Component
```typescript
import { calculateBusinessOutcomes } from '@/services/caseHealthScoringService';

const BusinessOutcomes: React.FC<BusinessOutcomesProps> = ({ caseRecord }) => {
  const outcomes = calculateBusinessOutcomes(caseRecord);
  
  // Replace all hardcoded values with calculated metrics
  // Show "Not Available Yet" when not calculated
};
```
**Time:** 30 mins  
**Files:** `CaseOverviewDashboard.tsx`

#### [ ] 4. Fix Quick Action Buttons
```typescript
const QuickActions: React.FC<QuickActionsProps> = ({ caseRecord, onNavigate, onOpenModal }) => {
  // Define workflow prerequisites for each button
  const getActionState = (actionLabel: string) => {
    // Returns: { enabled: bool, reason: string, action: () => void }
  };
  
  // Render with disabled state if prerequisites not met
  // Add tooltips explaining why disabled
};
```
**Time:** 1 hour  
**Files:** `CaseOverviewDashboard.tsx`, `CaseWorkspaceRouter.tsx`

#### [ ] 5. Add MissingItemsPanel Component
```typescript
const MissingItemsPanel: React.FC<{ caseRecord: Case; onAction?: (action: string) => void }> = ({
  caseRecord,
  onAction
}) => {
  // Show each missing item with:
  // - Why it's required
  // - Where to get it
  // - Quick action button
};
```
**Time:** 45 mins  
**Files:** `CaseOverviewDashboard.tsx`

#### [ ] 6. Add SuggestedNextSteps Component
```typescript
import { generateRecommendations } from '@/services/caseHealthScoringService';

const SuggestedNextSteps: React.FC<{ caseRecord: Case; onAction?: (action: string) => void }> = ({
  caseRecord,
  onAction
}) => {
  const recommendations = generateRecommendations(caseRecord);
  
  // Render prioritized list with impact and time estimates
  // Wire each action to actual workflow
};
```
**Time:** 45 mins  
**Files:** `CaseOverviewDashboard.tsx`

#### [ ] 7. Add CaseTimeline Component
```typescript
const CaseTimeline: React.FC<{ caseRecord: Case }> = ({ caseRecord }) => {
  // Create timeline from case activities/events
  // Show: Case Created → Docs Uploaded → Extraction → Review → Approval
  // Include timestamps and descriptions
};
```
**Time:** 45 mins  
**Files:** `CaseOverviewDashboard.tsx`

#### [ ] 8. Wire Navigation & Modals
```typescript
// In parent component (CaseWorkspaceRouter)
const handleQuickAction = (actionType: string) => {
  switch(actionType) {
    case 'review-note':
      onOpenModal('clinical-note-review');
      break;
    case 'assign-icd':
      onOpenModal('icd-assignment');
      break;
    case 'upload-docs':
      onOpenModal('document-upload');
      break;
    case 'generate-preauth':
      navigate('/prior-auth-generator', { state: { caseId } });
      break;
    // ... etc
  }
};
```
**Time:** 1 hour  
**Files:** `CaseWorkspaceRouter.tsx`

**Total Phase 1 Time:** 5-6 hours

### Phase 2: Polish & Testing

#### [ ] 9. Remove Hardcoded Demo Values
- Search for: `'27 min'`, `'82%'`, `'94%'`, `'126'`, `'96%'`
- Replace with calculated values or "Not Available Yet"
- Verify no hardcoded numbers remain

**Time:** 30 mins

#### [ ] 10. Test All Workflows
- [ ] Create new patient case
- [ ] Verify scores update as data added
- [ ] Test all button actions
- [ ] Verify workflow enforcement (can't skip steps)
- [ ] Confirm timeline shows events
- [ ] Check recommendations change with case state

**Time:** 1-2 hours

#### [ ] 11. Demo Walkthrough
- Create case → Score: 20%
- Add diagnosis → Score: 35%
- Assign ICD → Score: 50%
- Upload docs → Score: 75%
- Verify dates/timestamps → Score: 85%
- Generate Pre-Auth enabled ✓

**Time:** 30 mins

---

## FILE CHANGES NEEDED

### Primary File: `components/CaseOverview/CaseOverviewDashboard.tsx`

**Changes Summary:**
- Import scoring service
- Update 4 main components (CaseHealthScore, ClaimReadinessProgress, BusinessOutcomes, QuickActions)
- Add 3 new components (MissingItemsPanel, SuggestedNextSteps, CaseTimeline)
- Remove hardcoded values
- Add context and actions to buttons

**Estimated size increase:** +300 lines

### Secondary File: `components/CaseWorkspace/CaseWorkspaceRouter.tsx`

**Changes Summary:**
- Import scoring service
- Add navigation/modal handlers
- Pass handlers to CaseOverviewDashboard
- Add workflow state management

**Estimated size increase:** +50 lines

### New File: `services/caseHealthScoringService.ts` ✅

**Already created!** 400+ lines, production-ready

---

## COPY-PASTE READY CODE

### Quick Actions Handler
```typescript
const getQuickActionState = (
  label: string,
  caseRecord: Case,
  { onNavigate, onOpenModal }: { onNavigate?: (path: string) => void; onOpenModal?: (type: string) => void }
) => {
  const { score: healthScore } = calculateHealthScore(caseRecord);
  const { readyToSubmit } = calculateSubmissionReadiness(caseRecord);

  switch (label) {
    case 'Review AI Extraction':
      return {
        enabled: caseRecord.status === 'patient_registered',
        reason: 'Available after patient registration',
        action: () => onOpenModal?.('extraction-review'),
      };

    case 'Upload Missing Docs':
      return {
        enabled: true,
        reason: 'Add missing required documents',
        action: () => onOpenModal?.('document-upload'),
      };

    case 'Generate Pre-Auth':
      return {
        enabled: healthScore >= 80,
        reason: healthScore < 80 
          ? `Case health must be 80%+ (currently ${healthScore}%)`
          : 'Ready to generate prior auth packet',
        action: () => onNavigate?.('/prior-auth-generator'),
      };

    case 'Submit to TPA':
      return {
        enabled: readyToSubmit,
        reason: readyToSubmit
          ? 'Ready for TPA submission'
          : 'Complete all reviews first',
        action: () => onNavigate?.('/tpa-submission'),
      };

    default:
      return { enabled: false, reason: 'Unknown action', action: () => {} };
  }
};
```

### Score Display With Breakdown
```typescript
const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
const statusText = score >= 80 ? "✓ Healthy" : score >= 60 ? "⚠ Attention needed" : "❌ Needs work";

return (
  <div className="bg-white border border-opd-border rounded-lg p-6">
    <h3 className="text-sm font-bold text-opd-text-muted uppercase tracking-wider mb-4">
      Case Health Score
    </h3>
    
    <div className="flex items-center justify-between mb-4">
      <div>
        <div className={`text-4xl font-bold ${scoreColor}`}>{score}</div>
        <div className="text-sm text-opd-text-muted">{statusText}</div>
      </div>
    </div>
    
    {/* Factors */}
    <div className="space-y-2 mb-4">
      {Object.entries(factors).map(([key, value]) => (
        <div key={key} className="flex justify-between text-sm">
          <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          <span className="font-bold">{value}%</span>
        </div>
      ))}
    </div>
    
    {/* Issues */}
    {issues.length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded p-3">
        <div className="text-xs font-bold text-red-700 mb-2">What reduced the score:</div>
        <ul className="text-xs text-red-700 space-y-1">
          {issues.map((issue, i) => (
            <li key={i}>• {issue}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);
```

---

## DEMO SCRIPT (Updated)

```
1. Patient Registration Complete
   - Name: D Shivaram
   - Age: 48
   - Insurance: Star Health
   - Policy: CPG 2026 13000 0961872
   → Score: 45% (missing clinical info)

2. Open Case Overview
   → Health Score: 45%
      - Documents: 100% ✓
      - Diagnosis: 0% ❌
      - ICD: 0% ❌
      - Policy: 100% ✓
   → Submission Readiness: 40%
   → Suggested: Review Clinical Note

3. Review AI Extraction
   → "Acute Coronary Syndrome with STEMI"
   → Click "Confirm & Assign"
   → Score jumps to 60%

4. Assign ICD
   → Select: I21.09 (STEMI of LAD)
   → Score jumps to 75%

5. Upload Missing Documents
   → Add Discharge Summary
   → Score jumps to 85%

6. Generate Prior Authorization
   → Button now enabled (score >= 80)
   → Click "Generate Pre-Auth"
   → Takes to Pre-Auth generator

Result: Score 85%, Readiness 85%, Ready for TPA ✓
```

---

## VERIFICATION CHECKLIST

After implementation, verify:

- [ ] No hardcoded values visible (search for '27', '82', '94', '126', '96')
- [ ] All buttons have click handlers
- [ ] Disabled buttons show tooltip explaining why
- [ ] Score updates when case data changes
- [ ] Health score matches formula (weighted average)
- [ ] Submission readiness shows blockers
- [ ] Missing items show context and quick actions
- [ ] Recommendations are intelligent and prioritized
- [ ] Timeline shows case events with timestamps
- [ ] All navigation links work
- [ ] All modal triggers work
- [ ] Demo script works end-to-end

---

## ROLLBACK PLAN

If something breaks during implementation:

1. **Git revert:** `git revert <commit>`
2. **Quick restore:** Keep original `CaseOverviewDashboard.tsx` in a `.backup` file
3. **Test first:** Use a feature branch before merging to main

---

## TIME ESTIMATE

| Task | Hours | By |
|------|-------|-----|
| Phase 1: Critical Fixes | 5-6 | Morning |
| Phase 2: Testing & Polish | 1-2 | Afternoon |
| Demo Walkthrough | 0.5 | Before demo |
| **Total** | **6.5-8.5** | **Today** |

**Ready for demo:** By tomorrow morning ✓

---

## NEXT STEPS

1. ✅ Read audit report: `CASE_OVERVIEW_AUDIT_REPORT.md`
2. ✅ Review scoring service: `services/caseHealthScoringService.ts`
3. 👉 **Start implementation using checklist above**
4. Test each component as you go
5. Run demo script end-to-end
6. Deploy 1 hour before demo

---

## SUPPORT

**Questions?**
- Audit Report → Full details and root causes
- Scoring Service → Copy-paste ready algorithms
- Code examples → Above in "COPY-PASTE READY CODE" section
- Demo Script → Clear walkthrough of expected behavior

**Need help?** Every function in scoring service has JSDoc comments explaining inputs/outputs/logic.

---

## SUCCESS CRITERIA

✅ All buttons functional  
✅ No hardcoded values  
✅ Scores calculate deterministically  
✅ Users guided with intelligent recommendations  
✅ Workflow enforced (can't skip steps)  
✅ Demo script works perfectly  
✅ Hospital impressed by polish & intelligence
