# PHASE 3: DOCUMENT UPLOAD UX

**Objective**: Transform Step4Documents into a professional, enterprise-grade document management experience with real-time progress, retry logic, and inline file previews.

**Timeline**: 2 hours
**Status**: ⏳ In Development

---

## Current State (Phase 1 Output)

```
UPLOAD DOCUMENTS [Step 4 of 5]

┌─ Drag-drop zone
│  └─ Upload, Processing, Processed statuses
├─ Document list
│  └─ File name + status icon
└─ Skip or Continue buttons
```

**Issues**:
- No file size validation
- No retry on failed uploads
- No visual progress indicators
- No file previews
- No document type detection feedback
- No success rate metrics
- No batch upload progress (multifile)

---

## Desired State (Phase 3 Output)

```
UPLOAD DOCUMENTS [Step 4 of 5]

┌─────────────────────────────────────────────┐
│ Drag-drop zone with animated icon          │
│ "Drag files or click to browse"             │
│ Supported: PDF, JPG, PNG (max 10MB each)   │
└─────────────────────────────────────────────┘

Documents (2/3 uploaded, 67% complete)
┌──────────────────────────────────────┐
│ ✅ discharge_summary.pdf             │
│    Processed ✓ · 2.3 MB · 3s ago     │
│    Type: Discharge Summary           │
│    Fields extracted: 12              │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ⏳ medical_bills.pdf                 │
│    Uploading 85% · 1.8 MB / 2.1 MB   │
│    ⟳ Retry | ✕ Remove               │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ✕ aadhaar.jpg                        │
│    Failed: Network timeout (2 tries)  │
│    ⟳ Retry | ✕ Remove               │
│    Tip: Check connection & try again  │
└──────────────────────────────────────┘

┌─ Batch progress
│  Overall: ████████░ 67% (2/3 ready to proceed)
└─

[← Back] [Continue →]
```

---

## Features to Implement

### 1. Enhanced Drag-Drop Zone

```tsx
Features:
  ✓ Animated upload icon (pulse on drag)
  ✓ File type icons (PDF, JPG, PNG)
  ✓ Visual feedback on drag-over
  ✓ File count badge (0/5 selected)
  ✓ Total size indicator
  ✓ Max file size warning
  ✓ Accepted formats displayed
```

### 2. Document Card with Rich Metadata

Each uploaded file shows:
```
┌─────────────────────────────────────┐
│ [Icon] File Name                    │
│        Metadata Row                 │
│        ─────────────────            │
│        Type Badge | Size | Time ago │
│        Fields extracted: N          │
│                                     │
│  [Progress bar] [Actions]           │
│  ✅ Processed / ⏳ Uploading / ✕ Error
│  Remove | Retry | Preview          │
└─────────────────────────────────────┘
```

### 3. File Status Tracking

```
Statuses:
  pending      → Queued, not started
  uploading    → Upload in progress (show %)
  processing   → OCR/extraction running
  processed    → Success + fields extracted
  error        → Failed (show reason, retry button)
  retrying     → User clicked retry
```

### 4. Batch Progress Meter

```
Visual representation of upload progress:
  ████████░░ 67%  (2/3 documents ready)
  
Color coded:
  - ✅ Green: Fully processed
  - ⏳ Blue: Uploading/processing
  - ✕ Red: Error (needs retry)
  - ⚪ Gray: Pending
```

### 5. Retry Logic

```
On upload/extraction failure:
  1. Show error message with reason
  2. Display "Retry" button
  3. Track retry count (max 3)
  4. Auto-backoff: 2s, 5s, 10s delays
  5. After 3 retries: show "Contact support"
  6. Allow manual removal
```

### 6. File Previews (Optional)

```
On hover/click document card:
  - PDF: Show page count + first page thumbnail
  - JPG/PNG: Show inline thumbnail (150px)
  - Loader while generating preview
  - Cache in IndexedDB for offline
```

### 7. Document Type Detection Feedback

```
After OCR, show detected type:
  ✓ Discharge Summary (8 fields extracted)
  ✓ Insurance Card (6 fields extracted)
  ⚠ Unknown Document (0 fields extracted)
```

### 8. Validation Before Continue

```
✅ All files processed → Enable "Continue" button
⏳ Some files uploading → Disable "Continue" + show "Wait..."
✕ Some files errored → Disable "Continue" + show "Fix errors"
```

---

## Data Model Updates

```tsx
interface DocumentRecord {
  id: string;
  name: string;
  size?: number;                    // NEW
  mimeType?: string;                // NEW
  uploadedAt?: string;              // NEW
  startedAt?: string;               // NEW - for upload timing
  completedAt?: string;             // NEW
  status: 'pending' | 'uploading' | 'processing' | 'processed' | 'error' | 'retrying';
  progress?: number;                // NEW - 0-100 for upload %
  retryCount?: number;              // NEW
  error?: string;
  ocrText?: string;
  fields?: Record<string, any>;
  detectedType?: string;            // NEW - discharge, insurance, aadhaar, etc
  extractedFieldCount?: number;     // NEW
}
```

---

## Component Updates

### Step4Documents.tsx (Redesigned)

**Key Functions**:
- `handleDragEnter()` - Show active state
- `handleDragLeave()` - Clear active state
- `handleDrop()` - Extract files and queue uploads
- `handleFileSelect()` - File browser fallback
- `uploadFile(file)` - NEW: With progress tracking
- `retryUpload(docId)` - NEW: Retry failed upload
- `removeDocument(docId)` - NEW: Remove from list
- `computeBatchProgress()` - NEW: Calculate overall %

**New Hooks**:
- Track upload queue separately
- Use FormData for streaming upload
- Listen to XMLHttpRequest.upload.onprogress

---

## Backend Integration Points

```
POST /api/documents/upload
  Input:  FormData with file + metadata
  Output: {
    id: string,
    ocrText: string,
    detectedType: string,
    fieldCount: number,
    processingTimeMs: number
  }
```

**Progress tracking**:
- Use XMLHttpRequest for upload progress events
- Show real upload % (not fake progress bar)

---

## Quality Gates

✅ **Upload Progress**: 
  - Real upload % (0-100), not fake
  - Show bytes uploaded / total
  - Display upload speed (MB/s)

✅ **Retry Logic**:
  - Max 3 retries per file
  - Exponential backoff (2s, 5s, 10s)
  - Manual remove always available

✅ **File Validation**:
  - Max 10MB per file
  - PDF, JPG, PNG only
  - Show validation errors before upload

✅ **UX Polish**:
  - Smooth transitions
  - Accessibility (keyboard, screen readers)
  - Mobile responsive (touch-friendly)
  - Dark mode support

✅ **Performance**:
  - Batch upload (don't serialize)
  - IndexedDB caching for offline
  - Cancel upload on unmount

---

## Implementation Checklist

### Part 1: Data Model & State
- [ ] Extend DocumentRecord interface
- [ ] Add upload progress tracking
- [ ] Add retry counter + timestamp

### Part 2: Enhanced Drag-Drop
- [ ] Animated upload icon
- [ ] File count badge
- [ ] Total size indicator
- [ ] Accepted formats display

### Part 3: Document Cards
- [ ] Status-specific rendering
- [ ] Metadata row (type, size, time)
- [ ] Fields extracted display
- [ ] Progress bar for uploading

### Part 4: Upload Logic
- [ ] XMLHttpRequest progress events
- [ ] Real % calculation
- [ ] Retry with backoff
- [ ] Remove document

### Part 5: Batch Progress
- [ ] Calculate % complete
- [ ] Color coding (green/blue/red/gray)
- [ ] Update on each file change

### Part 6: Polish
- [ ] Smooth animations
- [ ] Error messages (user-friendly)
- [ ] Loading states
- [ ] Mobile responsiveness

---

## Estimated Effort

| Part | Effort | Status |
|------|--------|--------|
| 1    | 20 min | ⏳    |
| 2    | 25 min | ⏳    |
| 3    | 30 min | ⏳    |
| 4    | 35 min | ⏳    |
| 5    | 20 min | ⏳    |
| 6    | 30 min | ⏳    |
| QA   | 20 min | ⏳    |
| **Total** | **180 min** | **⏳** |

---

## Next Phases

**Phase 4**: AI Processing Display
- Extraction progress (real-time from backend)
- Field-by-field extraction display
- Confidence scores per field

**Phase 5**: Extraction Review
- Drawer showing extracted fields
- Confidence badges
- Document page reference
- Inline edit capability

**Phase 6**: ICD-10 Selection
- Knowledge base integration
- Reasoning display
- Manual search fallback

**Phase 7**: Prior Authorization Preview
- Generated form display
- WYSIWYG editing
- PDF preview

**Phase 8**: Submission
- PDF generation
- TPA submission
- Status tracking

