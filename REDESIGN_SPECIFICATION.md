# AIVANA UI Redesign Specification
## AI-Powered Hospital Insurance Pre-Authorization Workflow

**Design Team:** Principal Designer (Linear/Vercel), UX Researcher (Hospital Systems), Former Coordinator
**Document:** Complete Redesign Specification (15 Sections)
**Target:** 2-minute pre-authorization submission workflow

---

## SECTION 1: NEW INFORMATION ARCHITECTURE

### Current IA (Problematic)
```
Case → [Mixed info]
├─ Patient Summary
├─ Insurance Summary  
├─ Clinical Note (FULL)
├─ All Extracted Fields (52)
├─ Business Metrics
├─ Timeline
├─ Claim Readiness
├─ ICD Suggestions
└─ Prior Auth Form
```

**Problem:** No hierarchy. Everything has equal importance. Workflow unclear.

---

### NEW IA (Redesigned)

```
CASE SUBMISSION WORKFLOW

┌─────────────────────────────────────────┐
│ LEVEL 1: SUBMISSION STATUS (Top)        │
│ ✓ Case Loaded                           │
│ ⏳ Ready for Review                     │
│ Status Badge + Progress Bar             │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ LEVEL 2: CASE ESSENTIALS (Visible)      │
│ ├─ Patient Quick Summary                │
│ ├─ Insurance Quick Summary              │
│ ├─ Diagnosis Quick Summary              │
│ └─ Documents Checklist                  │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ LEVEL 3: NEXT ACTIONS (Primary Section) │
│ ├─ Action 1: Verify ICD                 │
│ ├─ Action 2: Upload Missing Docs        │
│ └─ Action 3: Generate Prior Auth        │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ LEVEL 4: PRIOR AUTHORIZATION (Hero)     │
│ ├─ Form Preview (filled + highlighted)  │
│ ├─ Part A / B / C Sections              │
│ ├─ Inline Edit Fields                   │
│ └─ Download Button                      │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ LEVEL 5: CLINICAL DETAILS (Collapsed)   │
│ ├─ Clinical Summary (AI)                │
│ ├─ Expand Original Note                 │
│ └─ Expand All Extracted Fields          │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ LEVEL 6: ACTIVITY (Collapsed)           │
│ ├─ Timeline                             │
│ ├─ AI Processing Log                    │
│ └─ Coordinator Actions                  │
└─────────────────────────────────────────┘
```

**Key Principle:** Information appears based on coordinator needs, not data completeness.

---

## SECTION 2: NEW COMPONENT HIERARCHY

### Priority 1: SUBMISSION PATH (Always Visible)

**Component: Submission Status Bar**
```
┌────────────────────────────────────────┐
│ ✓ AI Complete | ⏳ Ready | 2 Min Left  │
│ [████████░░] 80% Ready to Submit       │
│ 3 Items Need Review → Fix Now          │
└────────────────────────────────────────┘
```

**Size:** 60px height (compact)
**Position:** Top of center panel
**Never hides:** Critical component

---

**Component: Next Actions Section**
```
┌─ NEXT ACTIONS ─────────────────────────┐
│                                         │
│ 1️⃣  Assign ICD Code                    │
│    Impact: Improves approval 23%       │
│    Time: 1 min     [Assign →]          │
│                                         │
│ 2️⃣  Upload Admission Letter            │
│    Impact: Required for submission      │
│    Time: 30 sec    [Upload →]          │
│                                         │
│ 3️⃣  Review & Generate Prior Auth      │
│    Impact: Ready to submit              │
│    Time: 1 min     [Review →]          │
│                                         │
└────────────────────────────────────────┘
```

**Size:** 280px height
**Position:** Immediately below Status Bar
**Content:** Max 3 prioritized actions
**Principle:** AI tells coordinator exactly what to do

---

### Priority 2: CASE ESSENTIALS (Always Visible, Compact)

**Component: Patient Card (Compact)**
```
┌─ PATIENT ──────────────────────────────┐
│ Rajesh Kumar | 45 M | UHID: UH-123456  │
│ +91-9876543210                         │
└────────────────────────────────────────┘
```

**Height:** 40px
**Content:** Name, age, gender, UHID, phone only
**Design:** Single row, no padding waste

---

**Component: Insurance Card (Compact)**
```
┌─ INSURANCE ────────────────────────────┐
│ ICICI | Policy: 12345/2026 | ✓ Active │
│ Coverage: ₹5,00,000 | Remaining: 2,10,000 │
│ Room: Deluxe | TPA: ICICI Lombard      │
└────────────────────────────────────────┘
```

**Height:** 60px
**Content:** Policy, TPA, coverage, room type
**Design:** 2 rows max

---

**Component: Diagnosis Card (Compact)**
```
┌─ DIAGNOSIS ────────────────────────────┐
│ Herniated Disc L4-L5 with Radiculopathy│
│ ICD: M51.26 | LOS: 3 days | Dr. Singh  │
│ Admission: 22/07/2026 | Emergency      │
└────────────────────────────────────────┘
```

**Height:** 60px
**Content:** Diagnosis, ICD, doctor, LOS
**Design:** 2 rows, condensed

---

**Component: Documents Checklist**
```
┌─ DOCUMENTS ────────────────────────────┐
│ ✓ Doctor Note (5 MB)                   │
│ ✓ Lab Report (2 MB)                    │
│ ⚠ Admission Letter (Missing)           │
│ ✓ Insurance Card (verified)            │
│                        [+ Upload →]    │
└────────────────────────────────────────┘
```

**Height:** 80px
**Design:** Checklist style, no red buttons
**Badges:** ✓ (done), ⚠ (missing), ! (error)

---

### Priority 3: PRIOR AUTHORIZATION FORM (Hero Section)

**Component: Form Preview**
```
┌─ PRIOR AUTHORIZATION FORM ─────────────┐
│ [Part A] [Part B] [Part C]              │
│                                         │
│ ✓ Patient Name: Rajesh Kumar           │
│ ✓ Age: 45                              │
│ ⚠ Policy Number: [________]            │
│ ✓ Diagnosis: Herniated Disc            │
│ ✓ ICD: M51.26                          │
│ ⚠ Room Type: [Select from eligible]    │
│                                         │
│ [Save & Review] [Download PDF] [Sync]  │
└────────────────────────────────────────┘
```

**Design:**
- Filled fields shown with checkmark
- Missing fields highlighted (yellow)
- Editable inline (click to edit)
- All 3 parts visible, collapsible per section
- No page switch (everything in place)

**Height:** 250-400px (depends on missing fields)

---

### Priority 4: CLINICAL DETAILS (Accordion)

**Component: Clinical Summary (Collapsed)**
```
┌─ 📋 CLINICAL DETAILS [▼ Expand] ────────┐
│ 38M | Suspected Pneumonia | LOS 5 Days  │
│ Admission: 22/07/2026 | Dr. Srinivas    │
│                                         │
│ [View Full Note] [View All Fields]      │
└────────────────────────────────────────┘
```

**Collapsed Height:** 40px
**Expanded:** Shows clinical summary, not full note

---

**Component: Clinical Note (Collapsed by Default)**
```
When expanded:

┌─ CLINICAL NOTE ────────────────────────┐
│ [🔍 Search in Note]                    │
│                                         │
│ Patient admitted with chief complaint  │
│ of lower back pain with radiculopathy.  │
│ Duration: 3 weeks. Imaging shows...     │
│ [... rest of note, searchable]         │
│                                         │
│ Source: Patient Note | Confidence: 95% │
└────────────────────────────────────────┘
```

**Design:** 
- Collapsed by default (1 line)
- Search bar visible when expanded
- Full note readable
- Never shown on initial load

---

### Priority 5: AI EXTRACTION (Drawer, Not Page)

**Component: Extraction Review Drawer**

Triggered by "Review Extraction" button

```
┌─ SIDE DRAWER ──────────────────────────┐
│ AI EXTRACTION REVIEW                   │
│                                         │
│ [Search extracted fields...]           │
│                                         │
│ CRITICAL FIELDS:                       │
│ ├─ Diagnosis: Herniated Disc           │
│ │  Value: "Herniated disc L4-L5"       │
│ │  Source: Clinical Note               │
│ │  Confidence: 98% ✓ [Approve]        │
│ │  Bounding Box: Page 1, Para 3        │
│ │                                       │
│ ├─ ICD Code: M51.26                    │
│ │  Value: "M51.26"                     │
│ │  Source: Knowledge Base              │
│ │  Confidence: 92% ⚠ [Review]         │
│ │  [Manual Entry ▼]                    │
│ │                                       │
│ └─ Doctor: Dr. Singh                   │
│    Value: "Dr. Amit Singh"             │
│    Source: Insurance Card              │
│    Confidence: 100% ✓                  │
│                                         │
│ [Show More] [All 52 Fields]            │
│                                         │
│ [Cancel] [Done]                         │
└────────────────────────────────────────┘
```

**Design:**
- Side drawer, not new page (maintains context)
- Searchable
- Shows confidence + source + bounding box
- Inline approve/reject
- Doesn't break workflow

---

### Priority 6: ICD SUGGESTION (Compact)

Instead of separate section, integrate into form:

```
┌─ ICD SUGGESTION ──────────────────────┐
│ AI Suggests: M51.26 (Herniated Disc)   │
│ Confidence: 92% - Review Recommended   │
│                                         │
│ Why: Diagnosis mentions "herniated"    │
│      + imaging confirms disc           │
│      + age/gender compatible           │
│                                         │
│ [Accept] [Search Manual] [View Evidence]
└────────────────────────────────────────┘
```

**Height:** 60px
**Position:** Inside Prior Auth Form (not separate)
**Shows:** Evidence trail

---

## SECTION 3: COMPONENT HIERARCHY SUMMARY

### Components REMOVED
- ❌ Business Metrics section
- ❌ "Health Score" card
- ❌ Timeline section (moved to Activity)
- ❌ "Claim Readiness" percentage (replaced with Submission Status)
- ❌ Separate ICD Suggestion section
- ❌ Full extracted fields display

### Components ADDED
- ✅ Submission Status Bar
- ✅ Next Actions Section
- ✅ Documents Checklist (redesigned)
- ✅ Prior Auth Form Preview (hero)
- ✅ Extraction Review Drawer
- ✅ Activity Accordion
- ✅ Inline editing in form

### Components REDESIGNED
- ✅ Patient Card (compact)
- ✅ Insurance Card (compact)
- ✅ Diagnosis Card (compact)
- ✅ Clinical Note (accordion)
- ✅ ICD Suggestion (integrated)
- ✅ Submit Button (sticky, prominent)

### Components UNCHANGED
- ✅ Left sidebar (with badges)
- ✅ Right sidebar (simplified)

---

## SECTION 4: WIREFRAME STRUCTURE

### Desktop Layout (1920px)

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER (Logo, Search, User)                                      │
├─────────────┬──────────────────────────────────┬─────────────────┤
│             │                                  │                 │
│ LEFT        │ CENTER PANEL                     │ RIGHT SIDEBAR   │
│ SIDEBAR     │                                  │                 │
│ (160px)     │ (1000px)                         │ (300px)         │
│             │                                  │                 │
│ Case List   │ ┌────────────────────────────┐  │ Missing Items   │
│             │ │ Status Bar (60px)          │  │ • Policy #      │
│ Cases       │ ├────────────────────────────┤  │ • Admission Ltr │
│ ✓ Patient   │ │ Next Actions (280px)       │  │                 │
│ ✓ Clinical  │ ├────────────────────────────┤  │ Submission      │
│ ⚠ Insurance │ │ Patient Card (40px)        │  │ Progress        │
│ ⚠ Documents │ ├────────────────────────────┤  │ [▓▓▓▓░░░] 80%  │
│ ✓ Billing   │ │ Insurance Card (60px)      │  │                 │
│             │ ├────────────────────────────┤  │ Next Best       │
│ Other Cases │ │ Diagnosis Card (60px)      │  │ Action          │
│             │ ├────────────────────────────┤  │ → Review ICD    │
│             │ │ Documents (80px)           │  │                 │
│             │ ├────────────────────────────┤  │ AI              │
│             │ │ Prior Auth Form (300px)    │  │ Recommendations │
│             │ │ • Part A                   │  │ • Admission may │
│             │ │ • Part B                   │  │   be denied     │
│             │ │ • Part C                   │  │   (policy caps) │
│             │ │ [Download] [Sync]          │  │                 │
│             │ ├────────────────────────────┤  │                 │
│             │ │ Clinical Details [▼]       │  │                 │
│             │ │ (collapsed, 1 line)        │  │                 │
│             │ ├────────────────────────────┤  │                 │
│             │ │ Activity Log [▼]           │  │                 │
│             │ │ (collapsed, 1 line)        │  │                 │
│             │                              │  │                 │
│ [Submit Case]                              │  │                 │
│ (sticky bottom)                            │  │                 │
│                                              │  │                 │
└─────────────┴──────────────────────────────┴─────────────────────┘
```

**Key Metrics:**
- Center panel vertical scroll: ~800px (vs. current 3500px+)
- Initial viewport shows: Status + Next Actions + Essentials
- Prior Auth form visible without scroll
- Hero section (Prior Auth) is always visible

---

### Mobile Layout (375px)

```
┌─────────────────────────────────┐
│ HEADER (Logo, Menu)             │
├─────────────────────────────────┤
│ Status Bar                      │
├─────────────────────────────────┤
│ Next Actions (Stack)            │
├─────────────────────────────────┤
│ Patient (Compact)               │
├─────────────────────────────────┤
│ Insurance (Compact)             │
├─────────────────────────────────┤
│ Diagnosis (Compact)             │
├─────────────────────────────────┤
│ Documents Checklist             │
├─────────────────────────────────┤
│ Prior Auth (Accordion)          │
├─────────────────────────────────┤
│ Clinical Details [▼]            │
├─────────────────────────────────┤
│ Activity [▼]                    │
├─────────────────────────────────┤
│ [Submit Case] (Sticky)          │
└─────────────────────────────────┘
```

**Mobile Strategy:**
- Full width cards
- Accordions stack vertically
- Bottom sticky submit button
- No side drawers (use bottom sheets instead)

---

## SECTION 5: REDESIGNED LAYOUT (Detailed)

### Layer 1: Header
```
┌──────────────────────────────────────────────────────────────────┐
│ AIVANA    [Search Case...] [☎️ Support] [⚙️ Settings] [👤 User]  │
└──────────────────────────────────────────────────────────────────┘
```

**Height:** 56px
**Sticky:** Yes
**Design:** Minimal, professional

---

### Layer 2: Submission Status Bar

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ ⏳ READY FOR REVIEW    [████████░░░░░░░░░░] 85% Ready to Submit  │
│                                                                  │
│ 🟢 AI Extraction Complete | 🟢 Policy Verified | 🟡 ICD Review  │
│                                                                  │
│ 3 items need your attention → [Fix Now ↗]                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Height:** 80px
**Sticky:** Yes (stays visible while scrolling)
**Content:** Status badge + progress bar + blockers

---

### Layer 3: Next Actions Section

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ ✨ NEXT ACTIONS                                                  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 1️⃣  ASSIGN ICD CODE                                        │  │
│ │                                                             │  │
│ │ Diagnosis: Herniated Disc L4-L5                            │  │
│ │ AI Suggests: M51.26 (92% Confidence)                       │  │
│ │                                                             │  │
│ │ Why: Diagnosis + imaging + age compatible                  │  │
│ │ Impact: ↑ 23% approval chance                              │  │
│ │ Time: 1 min                                                │  │
│ │                                                             │  │
│ │                                          [Assign ICD ↗]    │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 2️⃣  UPLOAD ADMISSION LETTER                                │  │
│ │                                                             │  │
│ │ Status: MISSING                                            │  │
│ │ Impact: REQUIRED for submission                            │  │
│ │ Time: 30 sec                                               │  │
│ │                                                             │  │
│ │                                        [Upload Document ↗]  │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 3️⃣  GENERATE PRIOR AUTHORIZATION                           │  │
│ │                                                             │  │
│ │ Status: All checks pass - ready to generate                │  │
│ │ Impact: Complete submission in 1 click                      │  │
│ │ Time: Instant                                              │  │
│ │                                                             │  │
│ │                                  [Review & Generate ↗]     │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Height:** 300px
**Principle:** Coordinator reads 3 sentences, takes 1 action
**Design:** Cards, icons, CTAs prominent

---

### Layer 4: Case Essentials (Compact Summary)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ 👤 PATIENT              Rajesh Kumar | 45 M | UHID: UH-123456   │
│                         +91-9876543210                           │
│                                                                  │
│ 🏥 INSURANCE            ICICI | Policy 12345/2026 | ✓ Active   │
│                         Coverage: ₹5L | Remaining: ₹2.1L        │
│                         Room: Deluxe | TPA: ICICI Lombard       │
│                                                                  │
│ 📋 DIAGNOSIS            Herniated Disc L4-L5 with Radiculopathy │
│                         ICD: M51.26 | LOS: 3 days | Dr. Singh   │
│                         Admission: 22/07/2026 | Emergency       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Total Height:** 120px
**Design:** Compact, single-row cards
**Principle:** See essentials without scrolling

---

### Layer 5: Documents Checklist

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ 📎 DOCUMENTS                                                     │
│                                                                  │
│   ✓ Doctor Note                        (verified)  5 MB         │
│   ✓ Lab Report                         (verified)  2 MB         │
│   ⚠ Admission Letter                   (missing)                │
│   ✓ Insurance Card                     (verified)  1 MB         │
│   ✓ Consent Form                       (verified)  0.5 MB       │
│                                                                  │
│                                        [+ Upload More ↗]        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Height:** 140px
**Design:** Checklist, status badges, no red buttons
**Drag-drop:** Support drag-drop for upload

---

### Layer 6: Prior Authorization Form (HERO)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ 📝 PRIOR AUTHORIZATION FORM                                     │
│                                                                  │
│    [Part A] [Part B] [Part C]         [ℹ️ Form Help]            │
│                                                                  │
│ ✅ PATIENT DETAILS                                               │
│                                                                  │
│    Name:        Rajesh Kumar                        ✓ Verified   │
│    Age:         45 years                           ✓ Verified   │
│    Gender:      Male                               ✓ Verified   │
│    DOB:         15/05/1980                         ✓ Verified   │
│                                                                  │
│ ⚠️  INSURANCE DETAILS                                            │
│                                                                  │
│    Policy:      [_________________] ← EDIT (Missing)            │
│    TPA:         ICICI Lombard                      ✓ Verified   │
│    Coverage:    ₹5,00,000                         ✓ Verified   │
│                                                                  │
│ ✅ CLINICAL DETAILS                                              │
│                                                                  │
│    Diagnosis:   Herniated Disc L4-L5              ✓ Verified   │
│    ICD:         M51.26                            ✓ AI Verified │
│    Procedure:   Lumbar Microdiscectomy            ✓ Verified   │
│    LOS:         3 days                            ✓ Verified   │
│    Doctor:      Dr. Amit Singh                    ✓ Verified   │
│                                                                  │
│ ✅ COST BREAKDOWN                                                │
│                                                                  │
│    Est. Cost:   ₹1,50,000                         ✓ Calculated │
│    Deduction:   ₹5,000 (Co-pay)                   ✓ Applied    │
│    Auth. Amt:   ₹1,45,000                         ✓ Approved   │
│                                                                  │
│                        [Edit Form] [Save Draft] [Download PDF]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Height:** 450px
**Design:**
- All parts visible at once (no page switches)
- ✓ = verified/AI approved
- ⚠️ = needs attention
- Inline editing
- Color: Green checkmarks, yellow warnings

**Principle:** WYSIWYG - What they see is what submits

---

### Layer 7: Clinical Details (Collapsed)

```
┌──────────────────────────────────────────────────────────────────┐
│ 📋 CLINICAL DETAILS [▼ Expand All]                               │
│                                                                  │
│    38 years | Suspected Pneumonia | LOS 5 days | Dr. Srinivas   │
│                                                                  │
│    [View Full Clinical Note] [View All Extracted Fields (52)]   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Collapsed Height:** 50px
**Expanded:** Shows full note (searchable)
**Principle:** Hidden by default, available on demand

---

### Layer 8: Activity Log (Collapsed)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🕐 ACTIVITY [▼ Expand]                                           │
│                                                                  │
│    Case loaded • AI Extraction complete (0.85s) • ICD assigned  │
│    Documents verified (5 files) • Form generated • Ready         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Collapsed Height:** 50px
**Principle:** Timeline not needed during submission

---

### Layer 9: Submit Button (Sticky)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                    [✓ Submit to TPA]     [Save Draft]           │
│                                                                  │
│              Estimated Review Time: 3 minutes                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Position:** Sticky bottom
**Design:** Green, prominent, large (60px height)
**State:** Enabled when ready, shows blockers if not

---

## SECTION 6: COMPONENT CHANGES (Before & After)

### Component 1: Status Display

**BEFORE:**
```
Claim Readiness: 72%
Health Score: 85/100
(Confusing - what do these mean?)
```

**AFTER:**
```
⏳ READY FOR REVIEW
[████████░░░░░░░░░░] 85% Ready to Submit

3 items need your attention
```

**Why:** Clear status, clear blockers, clear next step

---

### Component 2: Clinical Note Display

**BEFORE:**
```
Clinical Note (3 pages, full text displayed)
[Patient admitted with lower back pain... continues for 300+ lines...]
```

**AFTER:**
```
📋 CLINICAL DETAILS [▼ Expand]
38 years | Suspected Pneumonia | LOS 5 days | Dr. Srinivas

[View Full Clinical Note]
(Expands on demand, searchable)
```

**Why:** Summary visible, full note available, not overwhelming

---

### Component 3: Extracted Fields

**BEFORE:**
```
AI Extraction: 52 Fields Extracted

Patient Name: ... (from Clinical Note)
Patient DOB: ... (from Insurance Card)
Patient Contact: ... (from Clinical Note)
[continues for 50+ fields]
```

**AFTER:**
```
✨ AI EXTRACTED
52 Fields | 96% Confidence

[Review Extraction →]
(Opens side drawer with all fields + confidence + source)
```

**Why:** Summary visible, details in drawer (not overwhelming)

---

### Component 4: Documents

**BEFORE:**
```
DOCUMENTS

[+ Add Document] [+ Add Document] [+ Add Document]
(Red buttons, unclear what's needed)
```

**AFTER:**
```
📎 DOCUMENTS

✓ Doctor Note (verified) 5 MB
✓ Lab Report (verified) 2 MB
⚠ Admission Letter (missing)
✓ Insurance Card (verified) 1 MB

[+ Upload More ↗]
```

**Why:** Checklist style, status clear, upload prominent

---

### Component 5: ICD Suggestion

**BEFORE:**
```
ICD SUGGESTIONS

M51.26 - Unspecified internal displacement of lumbar intervertebral disc
Confidence: 92%
```

**AFTER:**
```
(Integrated into Prior Auth Form)

Diagnosis: Herniated Disc L4-L5
ICD: M51.26
[AI Suggests: M51.26 (92%) - Evidence: diagnosis match + imaging]
[Accept] [Search Manual] [View Evidence]
```

**Why:** Integrated, not separate. Evidence shown inline.

---

### Component 6: Prior Auth Form

**BEFORE:**
```
[View Prior Auth Form]
(Separate page, AI-filled but not shown until generated)
```

**AFTER:**
```
📝 PRIOR AUTHORIZATION FORM

✅ Patient Name: Rajesh Kumar
✅ Age: 45
⚠️  Policy: [_________] ← Edit
✅ Diagnosis: Herniated Disc
✅ ICD: M51.26
[... all fields visible, editable inline]

[Download PDF] [Generate Final] [Submit]
```

**Why:** Hero section, WYSIWYG, magical experience

---

## SECTION 7: USER JOURNEY (Redesigned)

### Coordinator Arriving at Case

**Old Journey (15-20 minutes):**
```
1. Load case
2. Confused by amount of info
3. Scroll through patient summary
4. Scroll through insurance
5. Scroll through full 3-page clinical note (don't need)
6. Scroll through all 52 fields (don't need)
7. Scroll through metrics (irrelevant)
8. Find ICD suggestion
9. Not sure if can submit
10. Scroll back up to verify something
11. Click "Review Extraction" (page loads, context lost)
12. Review fields
13. Go back to case (scroll up)
14. Scroll back down to prior auth form
15. Click "Generate Form" (page loads again)
16. Form loads
17. Review form
18. Download PDF
[Total: 15-20 minutes, frustration high]
```

**New Journey (2-3 minutes):**
```
1. Load case → See status bar + next actions immediately
2. Read 3 prioritized actions (1 min reading)
3. Case essentials visible: Patient, Insurance, Diagnosis
4. Documents checklist shows what's missing
5. Prior Auth form visible below, ready to review
6. All fields filled + highlighted
7. Edit missing fields inline (30 sec)
8. Click "Download PDF" + "Submit" (1 click each)
[Total: 2-3 minutes, satisfaction high]
```

---

## SECTION 8: CLICK-BY-CLICK COORDINATOR FLOW

### SCENARIO: Coordinator processes case with 1 missing document + 1 missing form field

**Step 1: Load Case**
```
Action: Click case in list
Result: Center panel loads
Visible: Status bar + Next Actions + Essentials
Feeling: "OK, 3 things to do. Let me get started."
Time: 1s (load) + 0s (read headings)
```

**Step 2: Review Next Actions**
```
Visible: 
  1. Assign ICD (AI suggests M51.26, 92%)
  2. Upload Admission Letter (missing)
  3. Review & Generate Prior Auth

Decision: "I need to upload the letter first"
Click: [Upload Document ↗] on Action 2
Result: Upload dialog opens (modal overlay, stays in context)
Time: 30s (upload)
```

**Step 3: Verify ICD**
```
After upload, coordinator looks at Action 1
Reads: "AI suggests M51.26, why: diagnosis + imaging + age compatible"
Thinks: "That's right, herniated disc"
Click: [Assign ICD ↗]
Result: Drawer opens with ICD details
Shows: Evidence trail, confidence, related codes
Action: Click [Accept]
Time: 1m (verification)
```

**Step 4: Review Prior Auth Form**
```
Now all actions are complete
Coordinator scrolls to Prior Auth Form (visible, no new page)
Sees: All fields filled + verified
Notices: Policy Number field is yellow (missing)
Clicks: Policy Number field
Types: Value from case file
System: Auto-completes, field turns green
Time: 30s (edit)
```

**Step 5: Download & Submit**
```
Coordinator sees form is now complete
All fields green ✓
Clicks: [Download PDF]
Result: PDF downloads (no modal, just download)
Clicks: [Submit to TPA]
Result: Confirmation modal
"Form submitted to ICICI Lombard. Ref: PRE-20260722-001"
Time: 15s
```

**Total Flow: 3 minutes**

---

## SECTION 9: MOBILE RESPONSIVENESS STRATEGY

### Mobile (375px Width)

**Design Principles:**
- Full-width cards
- Accordions stack vertically
- Buttons stack vertically
- Bottom sheet instead of side drawer
- No horizontal scrolling

**Layout:**
```
┌─────────────────┐
│ Header (56px)   │
├─────────────────┤
│ Status Bar      │
│ (Sticky top)    │
├─────────────────┤
│ Next Actions    │
│ (Card-based)    │
├─────────────────┤
│ Patient Card    │
├─────────────────┤
│ Insurance Card  │
├─────────────────┤
│ Diagnosis Card  │
├─────────────────┤
│ Documents       │
├─────────────────┤
│ Prior Auth Form │
│ (Accordion)     │
├─────────────────┤
│ Clinical [▼]    │
├─────────────────┤
│ Activity [▼]    │
├─────────────────┤
│ [Submit] Button │
│ (Sticky bottom) │
└─────────────────┘
```

**Interactions:**
- Tap action → Bottom sheet opens
- Swipe to dismiss
- Buttons full-width
- Forms scroll vertically

---

### Tablet (768px Width)

**Changes from mobile:**
- 2-column layout possible
- Left sidebar visible
- Right sidebar visible (simplified)
- Side drawer instead of bottom sheet

---

### Desktop (1440px+)

**Full layout:**
- 3-column: Left sidebar | Center panel | Right sidebar
- All sections visible at once
- No drawers unless needed
- Sticky header + status bar

---

## SECTION 10: DESIGN SYSTEM IMPROVEMENTS

### Typography

**Current:** Inconsistent
**New:**
```
H1: 32px, 600 weight, -0.5px letter spacing (case title)
H2: 24px, 600 weight (section headers)
H3: 18px, 600 weight (subsections)
Body: 14px, 400 weight, 1.5 line height
Label: 12px, 500 weight, 0.5px letter spacing
```

---

### Color Palette

**Status Colors:**
```
✓ Green (#10B981): Verified, Complete, Ready
⚠️  Yellow (#F59E0B): Needs Review, Warning
❌ Red (#EF4444): Error, Blocked, Missing
⏳ Blue (#3B82F6): Processing, In Progress
```

**Text Colors:**
```
Primary: #1F2937 (dark gray)
Secondary: #6B7280 (medium gray)
Tertiary: #9CA3AF (light gray)
```

**Background:**
```
Page: #FFFFFF
Card: #FFFFFF with 1px border #E5E7EB
Hover: #F9FAFB
Selected: #F3F4F6
```

---

### Spacing Scale

**Consistent spacing (8px base):**
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
```

**All components use this scale**

---

### Shadow Hierarchy

```
Elevated (card hover): 0 4px 6px rgba(0,0,0,0.07)
Modal: 0 20px 25px rgba(0,0,0,0.15)
Sticky header: 0 1px 3px rgba(0,0,0,0.1)
No: Shadows on bottom navigation
```

---

### Border & Radius

```
Button: 6px border radius
Card: 8px border radius
Modal: 12px border radius
Pill (badge): 20px border radius
Border thickness: 1px everywhere
```

---

### Icons

**Principles:**
- 20px for labels (LLM icons)
- 24px for buttons
- 32px for hero sections
- Consistent stroke weight (1.5px)
- Source: Heroicons

**Adoption:**
- Status: ✓ ⚠️ ❌ ⏳
- Navigation: 📋 📝 📎 🕐
- Actions: ↗ ↙ ▼ ✗

---

## SECTION 11: ANIMATION PLAN

### Micro-interactions (Fast, Subtle)

**Page Load:**
```
1. Status bar slides in from top (200ms ease-out)
2. Next actions fade in (300ms ease-out, staggered)
3. Case essentials fade in (400ms ease-out, staggered)
4. Prior Auth form appears (500ms ease-out)
```

**Accordion Open/Close:**
```
Click → Rotate chevron icon (200ms ease-out)
        Content slides down (300ms ease-out)
Principle: Smooth but fast
```

**Drawer Open (Side):**
```
Click → Overlay fades in (150ms ease-out)
        Drawer slides in from right (300ms ease-out)
        Focus moves to drawer
```

**Field Verification:**
```
Type value → Field shows loading state (50ms)
            AI verifies (0.5-2s actual)
            Field shows checkmark (200ms fade-in)
Principle: Feedback for every action
```

**Submit Animation:**
```
Click Submit → Button shows loading spinner (300ms)
              Form uploads (1-3s)
              Confirmation modal slides in (300ms)
              Success animation (checkmark, 500ms)
```

**Form Auto-fill:**
```
When AI fills field → Field background pulses green (500ms)
                      Text animates in (300ms)
Principle: Show that AI did the work
```

---

## SECTION 12: ACCESSIBILITY IMPROVEMENTS

### Keyboard Navigation

**New Features:**
```
Tab: Navigate through action items
Enter: Activate action
Escape: Close drawer/modal
Ctrl+S: Save draft
Ctrl+Enter: Submit
Ctrl+F: Search in clinical note
```

**Focus States:**
```
All buttons: 2px outline, 2px offset
Links: Underline on focus
Cards: Border highlight on focus
```

---

### Screen Reader Support

**ARIA Labels:**
```
<button aria-label="Upload Admission Letter">
<div role="status" aria-live="polite">
  3 items need review
</div>
<section aria-label="Clinical Details" aria-expanded="false">
```

**Landmark Regions:**
```
<header> - Page header
<nav> - Left sidebar
<main> - Center panel
<aside> - Right sidebar
```

---

### Color Contrast

**Current:** May be insufficient
**New:**
```
Text on white: #1F2937 (WCAG AAA ✓)
Labels on colored: 7:1+ contrast ratio
Status badges: Text + icon for clarity
```

---

### Text Size

```
Minimum: 12px (labels)
Default: 14px (body)
Large: 16px (for readability)
No magic sizes
```

---

## SECTION 13: PERFORMANCE IMPROVEMENTS

### Load Time Targets

```
Initial load: < 2s
Page switch: 0s (drawers, no new pages)
Form generation: < 1s
PDF download: Instant
Submit: < 3s total
```

### Implementation

**Code Splitting:**
- Extraction drawer (lazy load on click)
- Activity log (lazy load on click)
- PDF generator (lazy load on "download")

**Caching:**
- Case data cached
- Form template cached
- ICD knowledge base cached (browser)

**Images:**
- No large images in workflow
- Icons: SVG (vector)
- No photography

---

## SECTION 14: ENTERPRISE SaaS UI RECOMMENDATIONS

### Learned from Linear, Vercel, Stripe, Notion

**1. Minimal by Default**
```
Show: What user needs now
Hide: What can be revealed on demand
Principle: Reduce cognitive load
```

**2. Status Clarity**
```
Every section shows status
✓ Complete
⚠️ Attention needed
❌ Blocked
⏳ Processing
User immediately knows state
```

**3. Action-First**
```
No information page
Everything leads to action
Every section has a button
"Review →" "Upload →" "Assign →"
```

**4. Consistent Interactions**
```
Click card → Same response every time
Drawer opens from right
Modals center on screen
Bottom sheet on mobile
No surprises
```

**5. Premium Feel**
```
Generous spacing (40px margins)
Minimal borders (1px only)
Consistent typography (max 3 sizes)
High-quality icons
Smooth animations (never jarring)
```

**6. Keyboard Power User Support**
```
Shortcuts: Ctrl+S, Ctrl+Enter
Command palette: Cmd+K
Workflows: Power users 10x faster
```

**7. Progressive Disclosure**
```
Essential → Secondary → Tertiary
Accordions hide complexity
Drawers for details
Full note searchable but collapsed
```

**8. Clear Feedback**
```
Every action shows result
Upload → Shows file
Edit → Shows checkmark
Submit → Shows confirmation
No silent operations
```

---

## SECTION 15: FINAL SCREEN-BY-SCREEN REDESIGN PLAN

### Screen 1: Case List (Left Sidebar)

**Current:** Simple list
**New:**
```
┌─ CASE SEARCH ──────────┐
│ [🔍 Search cases...]   │
└────────────────────────┘

┌─ ACTIVE CASES ─────────┐
│ □ Case 2026-001        │
│   Rajesh K. | ⏳       │
│                        │
│ □ Case 2026-002        │
│   Priya S. | ✓         │
│                        │
│ □ Case 2026-003        │
│   Arjun G. | ⚠️        │
└────────────────────────┘
```

**Features:**
- Search bar
- Case list with status
- Mini preview on hover
- Quick status badge

---

### Screen 2: Case Review (Main)

**See Layout Sections 1-9 above**

---

### Screen 3: Extraction Review (Drawer)

**Current:** Full page
**New:** Right-side drawer (300px fixed width)

```
┌─ SIDE DRAWER ──────────┐
│ AI EXTRACTION REVIEW   │
│ ✕ (close)              │
│                        │
│ [Search fields...]     │
│                        │
│ Diagnosis              │
│ • Herniated Disc       │
│ • Source: Note         │
│ • 98% ✓ [Approve]      │
│                        │
│ ICD                    │
│ • M51.26               │
│ • Source: AI           │
│ • 92% ⚠️ [Review]      │
│                        │
│ [Show More (40)]       │
│                        │
│ [Cancel] [Done]        │
└────────────────────────┘
```

**Features:**
- Searchable
- Confidence badges
- Approve/Reject buttons
- Source shown
- Bounding box (on click)

---

### Screen 4: Upload Dialog (Modal)

**Current:** Separate page
**New:** Modal overlay

```
┌─ UPLOAD DOCUMENT ──────────┐
│ ✕ Close                     │
│                             │
│ Upload Admission Letter     │
│                             │
│ ┌─────────────────────────┐ │
│ │ Drop file here or       │ │
│ │ [Browse Files]          │ │
│ └─────────────────────────┘ │
│                             │
│ Supported: PDF, JPEG, PNG   │
│ Max size: 10 MB             │
│                             │
│ [Cancel] [Upload]           │
└─────────────────────────────┘
```

**Features:**
- Drag-drop support
- File browser
- Format validation
- Upload progress

---

### Screen 5: ICD Assignment (Drawer)

**Current:** Separate section
**New:** Right-side drawer (triggered from Next Actions)

```
┌─ ASSIGN ICD CODE ──────────┐
│ ✕ Close                     │
│                             │
│ Diagnosis: Herniated Disc   │
│ L4-L5 with Radiculopathy    │
│                             │
│ AI SUGGESTION               │
│ M51.26 (92% Confident)      │
│ • Exact diagnosis match     │
│ • Imaging confirms          │
│ • Age 45, Gender M OK       │
│ • No contradictions         │
│                             │
│ [Accept] [Search Manual]    │
│                             │
│ Manual search:              │
│ [Search...]                 │
│ Results:                    │
│ • M51.26 (92%) ← AI chose   │
│ • M51.1 (75%)              │
│ • M54.1 (68%)              │
│                             │
│ [Cancel] [Confirm]          │
└─────────────────────────────┘
```

**Features:**
- AI suggestion prominent
- Evidence trail
- Manual search option
- Confidence scores

---

### Screen 6: Prior Auth Form Preview

**See Section 5, Layer 6 above**

---

### Screen 7: Confirmation Modal

**After clicking Submit:**

```
┌─────────────────────────────┐
│ ✅ SUBMITTED SUCCESSFULLY    │
│                              │
│ Prior Authorization Form     │
│ has been submitted to        │
│ ICICI Lombard               │
│                              │
│ Reference: PRE-20260722-001  │
│ Submitted at: 14:35          │
│ Estimated Review: 3 minutes  │
│                              │
│ Next Steps:                  │
│ • TPA will review within 3m  │
│ • You'll be notified         │
│ • Check case status below    │
│                              │
│ [View Case] [New Case →]     │
└─────────────────────────────┘
```

**Features:**
- Success confirmation
- Reference number
- Estimated review time
- Next steps
- Navigation options

---

### Screen 8: Mobile Case Review

**See Section 9 (Mobile Layout)**

---

## IMPLEMENTATION CHECKLIST

**Phase 1: Components (Week 1)**
- [ ] Status bar component
- [ ] Next actions cards
- [ ] Compact info cards
- [ ] Documents checklist
- [ ] Form preview
- [ ] Drawer component

**Phase 2: Layout (Week 2)**
- [ ] Center panel redesign
- [ ] Sticky header
- [ ] Sticky footer
- [ ] Responsive grid
- [ ] Mobile layout

**Phase 3: Interactions (Week 3)**
- [ ] Accordion animations
- [ ] Drawer open/close
- [ ] Modal animations
- [ ] Smooth transitions
- [ ] Loading states

**Phase 4: Integration (Week 4)**
- [ ] Connect to API
- [ ] Form submission
- [ ] PDF generation
- [ ] Error handling
- [ ] Loading states

**Phase 5: Polish (Week 5)**
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] Mobile testing
- [ ] User testing with coordinators

---

## EXPECTED OUTCOMES

**Before Redesign:**
- 15-20 minutes per case
- High scroll burden
- Unclear submission status
- Multiple page switches
- Coordinator frustration
- Error-prone workflows

**After Redesign:**
- 2-3 minutes per case
- Minimal scroll (80% reduction)
- Clear submission status
- No page switches (drawers only)
- Coordinator satisfaction
- Error prevention (validation inline)

**Business Impact:**
- 100 cases/day × 15 minutes saved = 1,500 minutes = 25 hours/day
- 25 hours × 250 working days = 6,250 hours/year
- 6,250 hours ÷ 8 hours = ~780 FTE hours/year saved

**Hospital Impact:**
- Faster pre-authorizations to TPA
- Higher approval rates (better form)
- Better coordinator experience
- Fewer data entry errors
- Scalability (process 200 cases/day with same staff)

---

## END OF REDESIGN SPECIFICATION

This completes all 15 sections of the redesign. No code has been written.

**Ready for implementation when approved.**

