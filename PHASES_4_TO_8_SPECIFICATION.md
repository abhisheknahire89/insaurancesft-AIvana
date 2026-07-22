# PHASES 4-8: COMPREHENSIVE SPECIFICATION

**Objective**: Complete AI workflow from extraction through submission with real-time feedback.

## PHASE 4: AI PROCESSING DISPLAY

**UX**: Show extraction progress with real-time field updates

```
EXTRACTING FIELDS FROM: discharge_summary.pdf

Progress: ████████░░ 60% (6/10 fields)

EXTRACTED SO FAR:
  ✓ Patient Name: John Doe (95%)
  ✓ Age: 42 (100%)
  ✓ Diagnosis: Herniated Disc L4-L5 (88%)
  ⏳ Treatment Plan: [extracting...]
  ⏳ Hospital: [pending...]
  ✕ Length of Stay: [failed - retry]

Status: Processing document 1 of 3
Time elapsed: 12s
Estimated: 8s remaining
```

**Implementation**: ExtractionProgressView.tsx

---

## PHASE 5: EXTRACTION REVIEW

**UX**: Drawer with confidence badges, bounding boxes, inline edit

```
EXTRACTION REVIEW

Patient Information
  ├─ Patient Name: John Doe [95% ✓] [Edit]
  │  └─ Source: discharge_summary.pdf, page 1
  ├─ Age: 42 [100% ✓] [Edit]
  │  └─ Source: page 1, lines 2-3
  └─ DOB: 15/05/1981 [88% ⚠] [Edit]
     └─ Source: page 1, line 5

Medical Information
  ├─ Diagnosis: Herniated Disc L4-L5 [92% ✓]
  ├─ Treatment: Surgical intervention [85% ⚠]
  └─ LOS: 3 days [100% ✓]

[← Back] [Approve All] [Next →]
```

**Implementation**: ExtractionReviewDrawer.tsx

---

## PHASE 6: ICD-10 SELECTION

**UX**: Knowledge base search with reasoning display

```
ICD-10 CODE SELECTION

Diagnosis: Herniated Disc L4-L5

AI Recommended (Top 3):
  1. M51.26 - Intervertebral disc displacement, thoracic/lumbar [92% ✓]
     Evidence: "L4-L5" explicitly stated, "herniated" in note
     
  2. M51.9 - Unspecified thoracic/lumbar disc disorder [78%]
     Evidence: Clinical presentation matches
     
  3. M54.5 - Low back pain [65%]
     Evidence: Pain symptoms mentioned

Manual Search:
  [Search ICD-10 codes...]
  
Selected: M51.26

[← Back] [Confirm] [Next →]
```

**Implementation**: ICDSelectionView.tsx

---

## PHASE 7: PRIOR AUTHORIZATION PREVIEW

**UX**: Hero screen with generated form, WYSIWYG editing, PDF preview

```
PRIOR AUTHORIZATION FORM PREVIEW

Insurance Company: ICICI Lombard
Policy Number: POL-2026-12345

[PART A - PATIENT INFORMATION]
  Patient Name: John Doe
  Age: 42
  DOB: 15/05/1981
  Hospital: Sri Amrutha Hospital
  Admission Date: 22/07/2026

[PART B - CLINICAL INFORMATION]  
  Diagnosis: Herniated Disc L4-L5
  ICD-10: M51.26
  Treating Doctor: Dr. Singh
  Expected LOS: 3 days
  
[PART C - COST ESTIMATE]
  Ward Charges: ₹2,500 x 3 = ₹7,500
  Doctor Consultation: ₹1,000
  Procedures: ₹8,000
  Estimated Total: ₹16,500

Missing Fields (Edit to add):
  ⚠ Authorization Amount
  ⚠ Urgency Flag

[← Back] [Edit Inline] [Generate PDF] [Next →]
```

**Implementation**: PriorAuthPreviewView.tsx

---

## PHASE 8: SUBMISSION

**UX**: PDF generation, TPA submission, timeline tracking

```
SUBMISSION

1. Generate PDF
   ✓ Pre-auth form generated (2.3 MB)
   ✓ Download PDF
   
2. Submit to TPA
   Sending to: ICICI Lombard
   Status: In Progress (35%)
   
3. Confirmation
   ✓ Submitted at 10:35 AM on 22/07/2026
   Reference: PAR-20260722-4521
   TPA Status: Received, Processing

Timeline:
  22/07/2026 10:35 AM - Submitted to TPA
  22/07/2026 02:00 PM - TPA Acknowledged receipt
  (Waiting for approval...)

[Download PDF] [View Details] [Continue to Inbox]
```

**Implementation**: SubmissionView.tsx

---

## INTEGRATION FLOW

```
PatientRegistrationFlow (Phase 1)
  ↓ Case created
  
CaseWorkspaceNew (Phase 2)
  ├─ ClinicalDetailsAccordion (Phase 2)
  ├─ ExtractionProgressView (Phase 4)
  ├─ ExtractionReviewDrawer (Phase 5)
  ├─ ICDSelectionView (Phase 6)
  ├─ PriorAuthPreviewView (Phase 7)
  └─ SubmissionView (Phase 8)
```

## TIMELINE

- Phase 4: 1 hour
- Phase 5: 1 hour
- Phase 6: 1.5 hours
- Phase 7: 1.5 hours
- Phase 8: 1 hour
- Integration & Testing: 1 hour
- **Total: ~7 hours**

---

## STATUS

Ready to implement in sequence. Each phase builds on the previous one.

