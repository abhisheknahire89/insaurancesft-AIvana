# PHASE 1: PATIENT REGISTRATION - Complete Redesign

**Status:** Ready to implement
**Scope:** Complete redesign of patient registration UI + verify all data flows
**Effort:** 2-3 days
**Outcome:** Production-ready patient registration experience

---

## DATA LINEAGE VERIFICATION (Before any code changes)

### Complete Data Flow

```
User Input (Form)
  ↓
React State (useState)
  ↓
Component State Management
  ↓
POST /api/patients
  ↓
Backend: server.ts line 64
  ↓
insertPatientStmt.run() → SQLite
  ↓
Database: patients table
  ↓
Response: { success: true, id: record.id }
  ↓
React: onCaseCreated() callback
  ↓
UI: Case Workspace opened with patient data
```

---

## REDESIGNED WORKFLOW (5 Steps)

### Step 1: Welcome
- Patient name input
- Document upload option (optional)

### Step 2: Patient Essentials
- Mobile number (validation: 10 digits)
- Date of Birth (validation: DD/MM/YYYY)
- Gender (M/F/Other)

### Step 3: Insurance Details
- TPA Name
- Policy Number
- Corporate/Retail toggle

### Step 4: Documents
- Drag-drop upload zone
- Real OCR processing (NO MOCKS)
- Real document classification
- Real field extraction

### Step 5: Review & Create
- Summary of all data
- Missing fields indicator
- Create Case button

---

## CRITICAL REQUIREMENTS

✓ NO mock data in document processing
✓ REAL OCR service called
✓ REAL document classification
✓ REAL field extraction
✓ REAL progress bars (not faked)
✓ Every button works end-to-end
✓ Database persistence verified
✓ API integration verified

---

## IMPLEMENTATION TIMELINE

**Day 1:** Steps 1-2 (4 hours each)
**Day 2:** Steps 3-5 (2-4 hours each, Step 4 is CRITICAL)
**Day 3:** Orchestrator + testing + QA

**Total: 2-3 days to production**

---

## 6 QUALITY GATES

Before shipping to coordinators:

1. **UI Verification** - All screens render, navigation works, data persists
2. **API Verification** - All endpoints working, no mocks, real data flows
3. **Data Flow Verification** - Input → API → Backend → Database → Response → UI
4. **Functional Verification** - Create case, upload docs, error recovery
5. **Accessibility Verification** - Keyboard, screen reader, color contrast
6. **Performance Verification** - < 1s render, smooth transitions, no memory leaks

---

## READY TO IMPLEMENT?

Phase 1 is fully specified and ready to code immediately.

No waiting for design system.
No waiting for component library.
No waiting for architecture planning.

Start building Step 1 now.

Ship value continuously.

