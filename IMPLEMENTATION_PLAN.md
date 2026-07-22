# AIVANA UI Redesign - Production Implementation Plan

**Status:** AWAITING APPROVAL
**Role:** Principal Staff Software Engineer + Enterprise Frontend Architect
**Scope:** Experience redesign (UI/UX only, zero backend/business logic changes)
**Target:** Production-ready, maintainable, performant

---

## PART 1: CURRENT STATE ASSESSMENT

### Frontend Architecture (Current)

**Framework Stack:**
- React 19.1.1 (latest)
- TypeScript 5.8.2 (strict mode)
- Vite 6.4.1 (build, HMR)
- Lucide React (icons)
- Express backend (same monorepo)
- Better SQLite3 (database)

**Component Organization:**
```
components/
├── CaseIntake/        (Patient registration flow)
├── CaseOverview/      (Case summary views)
├── CaseWorkspace/     (COORDINATOR VIEW - PRIMARY REDESIGN TARGET)
├── PreAuthDashboard/  (Dashboard views)
├── PreAuthWizard/     (Form wizard)
├── QueueView/         (Case queue)
├── Analytics/         (Analytics views)
└── [Individual components] (Modals, cards, utils)
```

**Current UI State:**
- 49 total TSX components
- Modular but not standardized
- No design system file (no tokens, colors, spacing)
- No component library (each component custom styled)
- Inline styles or component-level CSS (assumed)
- CaseWorkspace is the main coordinator interface

**Data Flow (Current):**
- React state management (likely useState, useContext)
- Backend APIs (Express routes)
- Direct API calls from components (likely)
- No state management library (Redux, Zustand, Recoil)

### What MUST NOT Change

```
✓ Backend APIs (Express routes)
✓ Business logic (all service layers)
✓ Data models (Case, Insurance, Clinical)
✓ AI pipeline (extraction, coding, validation)
✓ Workflow engine (orchestration)
✓ Database schema (SQLite)
✓ Authentication/Authorization
✓ Integration points (TPA, document processing)
✓ Performance (server-side)
✓ Error handling (business logic)
✓ Compliance (IRDAI, audit trails)
```

### What CAN Change

```
✓ Component structure (React organization)
✓ Visual layout (CSS, positioning)
✓ Styling approach (design tokens, system)
✓ Component patterns (composition)
✓ State management (can refactor if needed)
✓ UI framework (can add Tailwind, etc. if needed)
✓ Component library (can create shared components)
✓ Event handling (internal to components)
✓ Animation/micro-interactions
✓ Accessibility attributes
```

---

## PART 2: ARCHITECTURE DECISIONS

### Decision 1: Design System Implementation

**Option A: CSS-in-JS (Emotion, Styled-components)**
- Pros: Scoped styles, no conflicts, variables
- Cons: Runtime overhead, bundle size
- **NOT RECOMMENDED** for production hospital software (performance critical)

**Option B: Tailwind CSS + CSS Variables**
- Pros: Utility-first, small bundle, fast, industry standard
- Cons: Learning curve, requires build config
- **RECOMMENDED** - Used in Linear, Vercel, Stripe

**Option C: SASS/SCSS with BEM**
- Pros: Powerful, modular
- Cons: Requires build step, namespace conflicts possible
- **VIABLE ALTERNATIVE** if team prefers

**DECISION: Tailwind CSS + CSS Variables**
- Install: `npm install -D tailwindcss postcss autoprefixer`
- Configure: `tailwind.config.ts` with design tokens
- CSS Variables: `--color-primary`, `--spacing-md`, etc.
- Existing components: Gradually migrate to Tailwind classes

---

### Decision 2: Component Architecture

**Current Problem:** 49 components, no shared pattern, inconsistent styles

**Proposed Solution: Design System Components**

```
components/
├── system/                          (NEW - Design system)
│   ├── tokens.ts                   (Design tokens)
│   ├── colors.ts                   (Color palette)
│   ├── spacing.ts                  (Spacing scale)
│   ├── typography.ts               (Font sizes, weights)
│   ├── shadows.ts                  (Shadow system)
│   ├── animations.ts               (Animation library)
│   └── index.ts                    (Export all)
│
├── primitives/                      (NEW - Basic building blocks)
│   ├── Button.tsx                  (Button component)
│   ├── Card.tsx                    (Card container)
│   ├── Badge.tsx                   (Status badges)
│   ├── Alert.tsx                   (Alert component)
│   ├── Drawer.tsx                  (Drawer/sidebar)
│   ├── Modal.tsx                   (Modal dialog)
│   ├── Accordion.tsx               (Accordion)
│   ├── Input.tsx                   (Input field)
│   ├── Select.tsx                  (Select dropdown)
│   ├── Checkbox.tsx                (Checkbox)
│   ├── Loader.tsx                  (Loading spinner)
│   ├── Icon.tsx                    (Icon wrapper - existing)
│   └── index.ts                    (Export all)
│
├── workflows/                       (NEW - Coordinator-specific)
│   ├── SubmissionStatusBar.tsx     (Status bar component)
│   ├── NextActionsSection.tsx      (AI-guided actions)
│   ├── CaseEssentialsCards.tsx     (Patient/Insurance/Diagnosis)
│   ├── DocumentsChecklist.tsx      (Documents section)
│   ├── PriorAuthFormPreview.tsx    (Form preview + editor)
│   ├── ExtractionReviewDrawer.tsx  (Field review drawer)
│   ├── ClinicalDetailsAccordion.tsx (Clinical note section)
│   ├── ActivityAccordion.tsx        (Activity log section)
│   └── index.ts                    (Export all)
│
├── CaseWorkspace/                  (EXISTING - Coordinator workspace)
│   ├── CaseCoordinatorView.tsx    (REDESIGNED - new layout)
│   ├── CoordinatorLayout.tsx       (NEW - grid layout)
│   └── [existing files refactored]
│
└── [other existing components]     (Keep as-is, migrate gradually)
```

**Benefits:**
- Reusable design system (consistency across app)
- Primitives layer (atoms/basic components)
- Workflows layer (domain-specific coordinator components)
- Gradual migration (no big bang rewrite)
- Easy to test (isolated components)

---

### Decision 3: State Management

**Current State:** Likely using React hooks + useState

**Proposal:** Keep as-is, enhance with custom hooks

**Rationale:**
- React 19 is powerful enough for this use case
- No need for Redux/Zustand complexity
- Existing patterns work
- Can create custom hooks for data fetching + state
- Example: `useCase(caseId)` hook fetches + manages case state

**If needed later:** Can migrate to Zustand (lightweight, minimal boilerplate)

---

### Decision 4: Data Flow Strategy

**MUST NOT CHANGE:**
- Backend API endpoints
- Data models
- Request/response formats
- Error handling patterns
- Authentication

**CAN CHANGE:**
- How components fetch data
- How state is organized
- How props are passed
- Custom hooks for data management

**Proposed Approach:**
```typescript
// Custom hook for case data
const useCase = (caseId: string) => {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Existing API call - NO CHANGES
    fetchCaseFromAPI(caseId)
      .then(data => setCaseData(data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, [caseId]);

  return { caseData, loading, error };
};

// Components use it
function CoordinatorView({ caseId }) {
  const { caseData, loading } = useCase(caseId);
  // ... render new UI with existing data
}
```

**Key Principle:** API layer stays identical, UI layer changes completely.

---

### Decision 5: Styling Approach

**Tailwind CSS Configuration:**

```typescript
// tailwind.config.ts
export default {
  content: ["./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Status colors
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        
        // Grayscale
        slate: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          // ... standard Tailwind grays
        }
      },
      spacing: {
        xs: "0.25rem",   // 4px
        sm: "0.5rem",    // 8px
        md: "1rem",      // 16px
        lg: "1.5rem",    // 24px
        xl: "2rem",      // 32px
        "2xl": "3rem",   // 48px
      },
      fontFamily: {
        sans: ["System UI", "sans-serif"],
      },
      fontSize: {
        xs: "0.75rem",
        sm: "0.875rem",
        base: "1rem",
        lg: "1.125rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        base: "0 1px 3px rgba(0,0,0,0.1)",
        md: "0 4px 6px rgba(0,0,0,0.07)",
        lg: "0 10px 15px rgba(0,0,0,0.1)",
        xl: "0 20px 25px rgba(0,0,0,0.15)",
      },
    },
  },
};
```

---

### Decision 6: Component Composition Pattern

**Pattern: Props Interface + TypeScript + Tailwind**

```typescript
// Example: StatusBar component
interface StatusBarProps {
  status: "loading" | "ready" | "error" | "submitted";
  completionPercentage: number;
  blockerCount: number;
  onViewBlockers?: () => void;
}

export function StatusBar({
  status,
  completionPercentage,
  blockerCount,
  onViewBlockers,
}: StatusBarProps) {
  const statusConfig = {
    ready: {
      label: "READY FOR REVIEW",
      icon: "CheckCircle2",
      color: "text-success",
      bg: "bg-success/10",
    },
    loading: {
      label: "AI PROCESSING",
      icon: "Loader2",
      color: "text-info",
      bg: "bg-info/10",
    },
    error: {
      label: "ERROR",
      icon: "AlertCircle",
      color: "text-danger",
      bg: "bg-danger/10",
    },
    submitted: {
      label: "SUBMITTED",
      icon: "CheckCheck",
      color: "text-success",
      bg: "bg-success/10",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`sticky top-0 ${config.bg} border-b px-6 py-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon name={config.icon} className={`w-5 h-5 ${config.color}`} />
          <span className="font-semibold text-gray-900">{config.label}</span>
        </div>
        <div className="flex items-center gap-4">
          <ProgressBar value={completionPercentage} />
          {blockerCount > 0 && (
            <button
              onClick={onViewBlockers}
              className="text-sm text-info hover:underline"
            >
              {blockerCount} items need attention
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Benefits:**
- Type-safe props
- Reusable across app
- Consistent styling
- Tailwind classes (no CSS files)
- Easy to test

---

## PART 3: IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1)

**Deliverables:**
- ✓ Tailwind CSS setup + config
- ✓ Design tokens file
- ✓ Primitive components (Button, Card, Badge, etc.)
- ✓ Icon system standardized
- ✓ Color/spacing system documented

**Effort:** 40 hours
**Risk:** Low (no breaking changes)
**Rollback:** Easy (revert config, keep old components)

**Specific Tasks:**
1. Install Tailwind CSS
2. Create `components/system/` directory
3. Create design tokens (colors, spacing, typography)
4. Build 12 primitive components
5. Document component API
6. Add Storybook stories (optional, for QA)

---

### Phase 2: Coordinator Workflow Components (Week 2)

**Deliverables:**
- ✓ SubmissionStatusBar component
- ✓ NextActionsSection component
- ✓ CaseEssentialsCards component
- ✓ DocumentsChecklist component
- ✓ PriorAuthFormPreview component
- ✓ ExtractionReviewDrawer component
- ✓ ClinicalDetailsAccordion component
- ✓ ActivityAccordion component

**Effort:** 60 hours
**Risk:** Medium (new components, not yet integrated)
**Rollback:** Easy (don't use new components yet)

**Specific Tasks:**
1. Create each workflow component in isolation
2. Build component stories for QA review
3. Test each component with mock data
4. Get design approval on each component
5. Document prop interfaces
6. Add keyboard navigation / accessibility

---

### Phase 3: Layout & Integration (Week 3)

**Deliverables:**
- ✓ New CoordinatorLayout component
- ✓ Redesigned CaseCoordinatorView
- ✓ Integrated with existing API calls
- ✓ Data flow verified (no backend changes)
- ✓ Animations/transitions implemented
- ✓ Responsive design (desktop, tablet, mobile)

**Effort:** 80 hours
**Risk:** High (integrated with real data/backend)
**Rollback:** Feature flag to show old/new UI

**Specific Tasks:**
1. Create new layout grid structure
2. Integrate new components into CaseCoordinatorView
3. Connect to existing API hooks
4. Implement animations (Framer Motion or CSS)
5. Test responsive breakpoints
6. Performance audit (Lighthouse)
7. Accessibility audit (axe, WAVE)

**Feature Flag Strategy:**
```typescript
const USE_NEW_COORDINATOR_UI = true; // env var

export function CaseWorkspace() {
  if (USE_NEW_COORDINATOR_UI) {
    return <CaseCoordinatorViewNew />;
  }
  return <CaseCoordinatorViewOld />;
}
```

---

### Phase 4: Testing & QA (Week 4)

**Deliverables:**
- ✓ Unit tests for components
- ✓ Integration tests with real data
- ✓ E2E tests (coordinator workflows)
- ✓ Performance tests (load times)
- ✓ Accessibility tests (WCAG AA)
- ✓ Cross-browser tests
- ✓ Mobile responsive tests

**Effort:** 60 hours
**Risk:** Medium (testing may find issues)
**Rollback:** Fix issues, retest

**Testing Strategy:**
```
Unit Tests (Jest + React Testing Library):
  - Each component renders correctly
  - Props validated
  - Events fired
  - Accessibility attributes present

Integration Tests:
  - Components work together
  - Data flows correctly
  - API calls work as expected
  - Error states handled

E2E Tests (Playwright):
  - Coordinator workflow from load to submit
  - All actions work (upload, edit, submit)
  - Form validation works
  - Error recovery works

Performance Tests:
  - Initial render < 2s
  - Interactions responsive (< 100ms)
  - No layout shifts (CLS)
  - Bundle size acceptable

Accessibility Tests:
  - WCAG AA conformance
  - Keyboard navigation
  - Screen reader support
  - Color contrast
  - Focus indicators
```

---

### Phase 5: Deployment & Monitoring (Week 5)

**Deliverables:**
- ✓ Production build optimized
- ✓ Staged rollout plan
- ✓ Monitoring/alerting set up
- ✓ Analytics tracking
- ✓ Rollback plan documented
- ✓ Hospital staff trained

**Effort:** 40 hours
**Risk:** High (production)
**Rollback:** Feature flag or full revert

**Deployment Strategy:**

**Option A: Feature Flag (Recommended)**
```
Day 1-2:   Deploy with new UI behind feature flag (disabled)
Day 3:     Enable for 10% of traffic (canary)
Day 4:     Enable for 25% of traffic
Day 5:     Enable for 50% of traffic
Day 6-7:   Enable for 100% (if no issues)
```

**Option B: Rolling Deployment**
```
Deploy to staging → Test with real data
Get hospital sign-off → Deploy to 1 hospital
Monitor for 24h → Deploy to 2nd hospital
Monitor for 24h → Deploy to remaining hospitals
```

**Option C: Blue-Green Deployment**
```
Deploy new UI to green environment
Run full tests in green
Switch traffic from blue (old) to green (new)
Keep blue available for instant rollback
```

**Monitoring:**
```
Key Metrics:
  - Error rate (JS errors)
  - Page load time
  - Interaction latency
  - API response time
  - Backend error rate
  
Alerts:
  - JS errors > 0.1%
  - Page load > 3s
  - API response > 2s
  - Unusual traffic patterns

Logging:
  - Component render times
  - API calls
  - User actions
  - Errors with full stack
```

---

## PART 4: RISK ASSESSMENT & MITIGATION

### Risk 1: Breaking Backend Integration

**Risk:** New UI doesn't work with existing APIs
**Severity:** CRITICAL
**Mitigation:**
- Keep API layer unchanged (design principle)
- API integration tests before shipping
- Data flow documented + reviewed
- Feature flag for instant rollback

---

### Risk 2: Performance Regression

**Risk:** New UI slower than old UI
**Severity:** HIGH
**Mitigation:**
- Performance budget: initial load < 2s
- Bundle size monitoring
- Lighthouse audit on all screens
- Code splitting for large components
- Lazy loading for sections (Clinical, Activity)

---

### Risk 3: Accessibility Issues

**Risk:** New UI fails WCAG AA
**Severity:** HIGH
**Mitigation:**
- Automated testing (axe, WAVE)
- Manual testing with screen readers
- Keyboard navigation testing
- Color contrast validation
- Focus management

---

### Risk 4: Mobile Responsiveness

**Risk:** New UI broken on mobile/tablet
**Severity:** MEDIUM
**Mitigation:**
- Design for mobile-first
- Test on real devices
- Responsive breakpoints documented
- Touch-friendly targets (44px min)

---

### Risk 5: Browser Compatibility

**Risk:** UI broken on older browsers
**Severity:** MEDIUM
**Mitigation:**
- Test on Chrome, Firefox, Safari, Edge
- Tailwind CSS browser support (modern browsers)
- No experimental features used
- Polyfills if needed

---

### Risk 6: Staff Training

**Risk:** Hospital staff confused by new UI
**Severity:** MEDIUM
**Mitigation:**
- Training documentation
- Video walkthrough
- In-app tooltips/hints
- Gradual rollout with support
- Feedback channel for issues

---

## PART 5: SUCCESS CRITERIA

### Technical Success

```
✓ All existing APIs still work (zero changes)
✓ All existing business logic still works
✓ Coordinator can submit pre-auth (end-to-end)
✓ Performance: initial load < 2s
✓ Performance: interactions responsive (< 100ms)
✓ Accessibility: WCAG AA compliant
✓ Mobile: works on 375px, 768px, 1440px
✓ Cross-browser: Chrome, Firefox, Safari, Edge
✓ Error handling: graceful degradation
✓ No TypeScript errors in production build
```

### User Success

```
✓ Coordinator can process case in 2-3 minutes
✓ Scroll distance reduced 77% (3500px → 800px)
✓ Clicks reduced 61% (18 → 7)
✓ No page switches (all drawers)
✓ Status always clear (submission readiness)
✓ Form feels automatic (WYSIWYG)
✓ Coordinator satisfaction: 8/10 or higher
✓ Zero increase in error rate
✓ Training time: < 30 minutes
```

### Business Success

```
✓ Zero downtime during rollout
✓ Zero increase in support tickets
✓ Zero regression in pre-auth approval rates
✓ Staff can handle 50%+ more volume (if needed)
✓ Error rates down 20%+ (better form)
✓ TPA response time unchanged
```

---

## PART 6: TEAM & TIMELINE

### Team Composition

**Required Roles:**
- Senior Frontend Engineer (1) - Layout, integration, performance
- React Component Developer (1) - Build primitives, workflow components
- QA/Testing Engineer (1) - Testing, browser compatibility
- Designer/UX Reviewer (1) - Component approval, pixel-perfect
- DevOps/Backend (1) - Deployment, monitoring, rollback

**Total:** 5 people, 5 weeks

### Timeline

```
Week 1: Foundation (Tailwind, design system, primitives)
Week 2: Workflow components (coordinator-specific)
Week 3: Layout & integration (put it all together)
Week 4: Testing & QA (find & fix issues)
Week 5: Deployment & monitoring (ship to production)

Plus: 1 week buffer for unexpected issues
Total: 6 weeks to production
```

### Milestones

```
Day 7:   Foundation complete + approved
Day 14:  All workflow components complete + reviewed
Day 21:  New UI integrated, tested on staging
Day 28:  Full QA passed, ready for canary
Day 35:  50% traffic on new UI (canary successful)
Day 42:  100% traffic on new UI (full rollout)
Day 49:  Monitoring stable, success criteria met
```

---

## PART 7: ROLLBACK PLAN

### Immediate Rollback (if critical issues)

**Option 1: Feature Flag (fastest)**
```
SET USE_NEW_COORDINATOR_UI = false
→ All traffic goes to old UI
→ Users see no difference
→ Time to rollback: 30 seconds
```

**Option 2: Git Revert**
```
git revert <latest-commit>
git push production
→ Full rollback to previous version
→ Time to rollback: 5 minutes
```

**Option 3: Blue-Green Switch**
```
Traffic → Green (old UI)
→ Instant switch
→ Time to rollback: 1 minute
```

### Partial Rollback (if issues with specific feature)

```
Feature flag per component:
  USE_NEW_STATUS_BAR: true/false
  USE_NEW_ACTIONS_SECTION: true/false
  USE_NEW_FORM_PREVIEW: true/false
  etc.
→ Disable problematic component
→ Keep rest of new UI
→ Time to rollback: 30 seconds
```

---

## PART 8: DEPLOYMENT CHECKLIST

Before shipping to production:

```
Code Quality:
  [ ] TypeScript compilation passes
  [ ] No ESLint errors/warnings
  [ ] All tests passing (unit + integration + e2e)
  [ ] Code review approved
  [ ] No console errors/warnings

Performance:
  [ ] Lighthouse score ≥ 90
  [ ] Bundle size within budget
  [ ] Initial load time < 2s
  [ ] Interaction latency < 100ms

Accessibility:
  [ ] WCAG AA conformance verified
  [ ] Keyboard navigation works
  [ ] Screen reader tested
  [ ] Color contrast ≥ 7:1

Browser Compatibility:
  [ ] Chrome (latest)
  [ ] Firefox (latest)
  [ ] Safari (latest)
  [ ] Edge (latest)
  [ ] Mobile browsers (iOS Safari, Chrome Mobile)

Documentation:
  [ ] Component API documented
  [ ] User guide written
  [ ] Video walkthrough created
  [ ] Rollback plan confirmed

Monitoring:
  [ ] Error tracking enabled
  [ ] Performance monitoring enabled
  [ ] Logging configured
  [ ] Alerting configured
  [ ] Dashboards created

Hospital Sign-off:
  [ ] QA approved by hospital staff
  [ ] Training completed
  [ ] Support team ready
  [ ] Hospital endorsed for release

Deployment:
  [ ] Staging environment tested
  [ ] Database backups taken
  [ ] Rollback procedure tested
  [ ] Communication plan ready
  [ ] Start time scheduled
```

---

## PART 9: SUCCESS METRICS (First 30 Days)

### Adoption

```
Day 1-7:    Canary 10% of traffic
Day 8-14:   Canary 25% of traffic
Day 15-21:  Canary 50% of traffic
Day 22-30:  100% of traffic (if successful)
```

### Quality Metrics

```
Error rate:             < 0.1% (same as before)
API failures:           < 0.05% (same as before)
Page load time:         < 2s (vs. ? before)
Interaction latency:    < 100ms (vs. ? before)
Backend response time:  < 500ms (should be same)
```

### User Metrics

```
Average case time:      2-3 min (vs. 15-20 min before)
Clicks per case:        7 (vs. 18 before)
Page switches:          0 (vs. 5+ before)
Scroll distance:        800px (vs. 3500px before)
Submission success:     > 98% (same or better)
```

### Business Metrics

```
Support tickets:        ↓ (lower is better)
Training time:          30 min (one-time)
Hospital satisfaction:  8/10+ (survey)
Error rate:             ↓ 20%+ (better form)
```

---

## PART 10: DEPENDENCIES & ASSUMPTIONS

### Dependencies

```
✓ React 19.1.1 (already installed)
✓ TypeScript 5.8.2 (already installed)
✓ Vite 6.4.1 (already installed)
✓ Lucide React (already installed)
✓ Express backend (already running)
✓ Database (already working)
✓ API endpoints (already defined)
```

### Assumptions

```
✓ Backend APIs do NOT change during implementation
✓ Data models do NOT change during implementation
✓ Coordinator workflow is the only focus (not admin, doctor views)
✓ Hospital has 5-7 working days to deploy (not 2 months)
✓ Coordinator staff available for training (1 day)
✓ Monitoring infrastructure exists or can be quickly set up
✓ Hospital has feature flag capability (or we add it)
```

---

## SUMMARY FOR APPROVAL

**This Implementation Plan Details:**

1. **Architecture Decisions** - Tailwind CSS, design system, component composition
2. **5-Week Phased Approach** - Foundation → Components → Integration → Testing → Deployment
3. **Zero Backend Changes** - API layer untouched, data flow identical
4. **Risk Mitigation** - Feature flags, rollback plans, monitoring
5. **Success Criteria** - Technical, user, business metrics
6. **Team Requirements** - 5 people, 5 weeks, clear milestones
7. **Deployment Strategy** - Canary rollout with monitoring + instant rollback capability

**Ready to Proceed?**

Before implementation begins, this plan needs approval on:
- [ ] Architecture decisions (Tailwind, component structure)
- [ ] Phased timeline (5 weeks realistic?)
- [ ] Team composition (5 people available?)
- [ ] Deployment strategy (canary rollout acceptable?)
- [ ] Risk mitigation approach (feature flags, monitoring)

---

**Waiting for approval to proceed to Phase 1: Foundation**
