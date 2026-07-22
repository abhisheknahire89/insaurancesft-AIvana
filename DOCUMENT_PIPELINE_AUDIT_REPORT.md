# Document Upload & Extraction Pipeline — Complete Audit Report

**Date:** July 22, 2026  
**Status:** 🚨 CRITICAL GAPS IDENTIFIED  
**Audit Scope:** Complete flow from PDF upload to case usage  
**Finding:** Pipeline extracts data but **fails to populate case model and downstream workflows**

---

## EXECUTIVE SUMMARY

The document upload pipeline has **three fatal gaps**:

1. **Extraction → Storage Disconnect** — Extracted data is stored in `metadata.formExtractionResults` but never used to populate `case.clinical`, `case.insurance`, or `case.patient` fields
2. **Lab Results Not Extracted** — PDFs containing CBC, LFT, KFT, troponin, ECG, imaging are NOT being parsed for structured lab values
3. **AI Reasoning Ignores Uploads** — The reasoning engine uses only the clinical note, NOT the uploaded documents or their extracted data

**Impact:** Hospital documents are uploaded, processed, and extracted, but the extracted information is immediately abandoned. The case model remains as entered during registration—nothing from uploaded PDFs is automatically populated.

---

## PART 1: THE UPLOAD WORKFLOW

### Entry Point: CaseIntakeFlow.tsx

**When a user uploads Government ID or other documents:**

```
File Upload
    ↓
handleFileUpload() → detectDocumentType() 
    ↓
extractFromDocument(file)  [documentExtractionService.ts]
    ↓
setExtractionResults(results)  [state update]
    ↓
setExtractionError() [if fails]
    ↓
Form displays extraction metadata (confidence badges, source)
    ↓
User clicks "Create Case"
    ↓
handleSubmit() → Store in metadata.formExtractionResults
```

**What Actually Happens:**
- ✅ File is received
- ✅ OCR is executed  
- ✅ Extraction happens
- ✅ Results stored in `metadata.formExtractionResults`
- ❌ **Form fields NOT auto-populated from extraction**
- ❌ **Case model fields NOT updated**
- ❌ **Extracted data marked for "future use"**

### Code Evidence

```typescript
// CaseIntakeFlow.tsx line ~880
if (extractionResults) {
  newCaseRecord.metadata = newCaseRecord.metadata || {};
  newCaseRecord.metadata.formExtractionResults = {
    extractedAt: new Date().toISOString(),
    documentName: govtIdFile?.name || 'unknown',
    results: extractionResults,  // ← STORED HERE
  };
}

// ❌ But extracted data is NEVER used to populate:
// newCaseRecord.patient.name
// newCaseRecord.patient.age  
// newCaseRecord.insurance.policyNumber
// newCaseRecord.clinical.diagnosis
// etc.
```

---

## PART 2: OCR & EXTRACTION PIPELINE

### OCR Engine: Dual-Source Strategy

**Primary:** Sarvam AI Vision (Indian-optimized multimodal)
```
Document Upload
    ↓
extractFromDocument()
    ↓
extractPagesFromScannedPdf() [for PDFs]
    ├─ Try: Sarvam AI API
    │   ├─ Endpoint: https://api.sarvam.ai/v1/vision/document
    │   ├─ Supports: PDF + images
    │   ├─ Language: en-IN
    │   └─ extract_structured: true
    │
    └─ Fallback: Gemini Multimodal Vision (if Sarvam fails)
```

**Secondary:** Google Gemini Multimodal Vision  
```
Gemini API
├─ Model: gemini-2.0-flash
├─ Handles: PDFs as base64
├─ Instruction: Page-by-page text extraction
└─ Fallback for: Sarvam failures, image OCR
```

### Page-by-Page Processing

**Each PDF page is:**
1. ✅ Extracted (Sarvam or Gemini)
2. ✅ Classified (lab report, discharge summary, prescription, etc.)
3. ✅ Tables extracted (if present)
4. ❌ **Structural data NOT preserved** (lab values, reference ranges separate)
5. ❌ **Clinical context NOT linked** (diagnosis separate from findings)

### Code Flow

```typescript
// documentExtractionService.ts line 512-529
if (isPdf && pageTexts.length === 0) {
    try {
        const pdfText = await extractTextFromPdf(fileArrayBuffer);
        // Native PDF.js text extraction
        if (pdfText.replace(/\s+/g, '').length >= 50) {
            // ✅ Parse into pages
            pageTexts = pageMatches.map(match => match[2].trim());
        } else {
            // Fallback: OCR via Sarvam
            pageTexts = await extractPagesFromScannedPdf(fileArrayBuffer);
        }
    } catch (err) {
        // Fallback: Gemini multimodal OCR
        pageTexts = await extractPagesFromScannedPdf(fileArrayBuffer);
    }
}

// Page-by-page classification (line 551-612)
const classificationPromises = nodes.map(async (node) => {
    // ✅ For EACH page:
    // 1. Classify document type (Lab report, Discharge summary, etc.)
    // 2. Extract tables
    // Store in node.metadata.documentTypeClassification & node.metadata.tables
});
```

---

## PART 3: DATA EXTRACTION BREAKDOWN

### What IS Being Extracted

**Patient Demographics**
- ✅ Name (from Aadhaar, form, discharge summary)
- ✅ Age/DOB
- ✅ Gender
- ✅ Address

**Insurance Details**
- ✅ Policy number (pattern matching: alphanumeric)
- ✅ Insurance company (normalized against 15 known insurers)
- ✅ TPA name (normalized against 5 known TPAs)
- ✅ Sum insured (amounts)

**Clinical Information (Limited)**
- ✅ Diagnosis/Impression (free text)
- ✅ Doctor name
- ✅ Hospital name
- ✅ Consultation date
- ⚠️ Vitals (BP, pulse, temp, SpO2, RR) — extracted but NOT from lab reports
- ⚠️ Drugs prescribed (list) — extracted but NOT with dosage/frequency

### What IS NOT Being Extracted

**Lab Results — CRITICAL**
- ❌ CBC values (RBC, WBC, Hemoglobin, Hematocrit, Platelets)
- ❌ Reference ranges for lab values
- ❌ Interpretation/Flag status (HIGH, LOW, NORMAL)
- ❌ LFT values (AST, ALT, ALP, Bilirubin, Albumin, Globulin)
- ❌ KFT values (Creatinine, BUN, Potassium, Sodium)
- ❌ Blood sugar (fasting, random, post-prandial)
- ❌ CRP (C-Reactive Protein)
- ❌ Troponin
- ❌ D-Dimer
- ❌ Lipid profile (cholesterol, triglycerides, LDL, HDL)
- ❌ Lab test units (mg/dL, mmol/L, etc.)
- ❌ Test collection date/time
- ❌ Lab name/standard ranges

**Radiology & Imaging — NOT EXTRACTED**
- ❌ ECG findings
- ❌ CT scan impressions
- ❌ MRI findings
- ❌ X-ray reports
- ❌ Ultrasound findings
- ❌ Imaging interpretation text

**Document Structure — NOT PRESERVED**
- ❌ Table headers (what columns mean)
- ❌ Table structure relationships
- ❌ Page layout significance
- ❌ Section headers and organization
- ❌ Clinical narrative flow

**Clinical Content — PARTIALLY EXTRACTED**
- ❌ Chief complaint (only from patient note)
- ❌ History of present illness (only if in note)
- ❌ Past medical history (not from discharge)
- ❌ Comorbidities (not parsed from text)
- ❌ Allergy information (not extracted)
- ❌ Current medications (not with full details)
- ❌ Procedures performed (not from discharge)
- ❌ Treatment course (not extracted)
- ❌ Follow-up instructions (not extracted)

**Medical Necessity Evidence — NOT EXTRACTED**
- ❌ Severity indicators
- ❌ Clinical justification for procedures
- ❌ Evidence linking diagnosis to treatment
- ❌ Cost justification elements

### Code Evidence: Lab Extraction Failure

```typescript
// documentExtractionService.ts line 569-580
// PAGE-BY-PAGE CLASSIFICATION PROMPT
{
  "classification": "Specific document type classification",
  "tables": [
    {
      "tableName": "Table Name",
      "rows": [
        { 
          "testName": "Name of test",
          "result": "result value",
          "units": "units",
          "normalRange": "normal range reference"
        }
      ]
    }
  ]
}

// ✅ Extraction ATTEMPTS to get lab tables
// ❌ But extracted tables are NEVER USED:
// - Not stored in case.clinical.labResults
// - Not shown in UI
// - Not passed to reasoning engine
// - Not linked to case
```

---

## PART 4: DATA FLOW ANALYSIS

### Where Extracted Data Goes (Actual vs. Intended)

**Current Reality:**
```
extractFromDocument()
    ↓
ExtractedPatientData object
    ↓
setExtractionResults(results)  [UI state only]
    ↓
Form displays badges + confidence
    ↓
User sees "Patient Name extracted with 99% confidence"
    ↓
Click "Create Case"
    ↓
Store in case.metadata.formExtractionResults
    ↓
✅ Stored forever (audit trail)
❌ NEVER USED after that
```

**What Should Happen:**
```
extractFromDocument()
    ↓
ExtractedPatientData object
    ↓
Match extracted fields to case model:
├─ patient.name → from extraction
├─ patient.age → from extraction
├─ insurance.policyNumber → from extraction
├─ clinical.diagnosis → from extraction
├─ clinical.vitals → from extraction
└─ clinical.labResults → from extraction ❌ MISSING
    ↓
Auto-populate form OR case model
    ↓
Store results in case.clinical, not just metadata
    ↓
Pass to reasoning engine
    ↓
Use in medical necessity, prior auth, etc.
```

### Storage Mapping

| Extracted Field | Current Storage | Should Store | Used By | Status |
|---|---|---|---|---|
| Patient Name | metadata.formExtractionResults | patient.name | Case display, authorization | ❌ Not linked |
| Age | metadata.formExtractionResults | patient.age | Medical necessity, dosing | ❌ Not linked |
| Diagnosis | metadata.formExtractionResults | clinical.diagnosis | Prior auth, medical necessity | ❌ Not linked |
| Vitals | metadata.formExtractionResults | clinical.vitals | Clinical severity, risk | ❌ Not linked |
| Lab Results | metadata.formExtractionResults.tables | clinical.labResults | Medical necessity, diagnosis | ❌ NOT EXTRACTED |
| Doctor Name | metadata.formExtractionResults | clinical.treatingDoctor | Signature verification | ❌ Not linked |
| Insurance | metadata.formExtractionResults | insurance.* | Policy validation | ❌ Not linked |

---

## PART 5: LAB RESULT EXTRACTION CAPABILITY — ZERO

### What We Attempted

The extraction prompt at line 569-580 ASKs Gemini to extract lab tables:
```json
"tables": [
  {
    "tableName": "CBC Results",
    "rows": [
      { "testName": "Hemoglobin", "result": "12.5", "units": "g/dL", "normalRange": "12-16" }
    ]
  }
]
```

### What Actually Happens

1. **OCR text extraction:** ✅ Page text extracted via Sarvam/Gemini
2. **Table detection:** ✅ Gemini *attempts* to detect tables
3. **Table data extraction:** ⚠️ Partial (lab value text extracted but not structured)
4. **Validation:** ❌ No validation of numeric values
5. **Storage:** ❌ Tables stored in `node.metadata.tables` but never transferred to case model
6. **Usage:** ❌ Never passed to reasoning engine or medical necessity calculation

### The Gap

```typescript
// documentExtractionService.ts line 598
node.metadata.tables = parsed.tables || [];  // ← STORED HERE

// But then... NOWHERE else in the codebase:
// - case.clinical.labResults does not exist
// - No code reads node.metadata.tables
// - UI does not display extracted lab values
// - Reasoning engine does not access extracted labs
// - Medical necessity does not consume lab tables
```

---

## PART 6: AI REASONING IGNORES UPLOADS

### What the Reasoning Engine Uses

**Current (geminiService.ts):**
```typescript
// Uses ONLY:
1. case.clinical.clinicalNote (from patient registration)
2. case.clinical.diagnosis (manually entered)
3. case.clinical.proposedProcedure (manually entered)
4. case.authorization.requestedAmount (manually entered)

// IGNORES:
❌ case.metadata.formExtractionResults
❌ Extracted lab results
❌ Extracted radiology findings
❌ Extracted discharge summaries
❌ Uploaded documents
❌ Evidence from PDFs
```

**Result:** When generating prior auth or medical necessity, the engine only uses the minimal information manually entered during registration—not the complete clinical picture from uploaded documents.

### Code Evidence

```typescript
// services/geminiService.ts
// Medical Necessity Generation
export async function generateMedicalNecessity(caseRecord: Case): Promise<MedicalNecessityAnalysis> {
    const prompt = `...
Case Information:
- Patient: ${caseRecord.patient.name}, Age: ${caseRecord.patient.age}
- Diagnosis: ${caseRecord.clinical.diagnosis}
- Procedure: ${caseRecord.clinical.proposedProcedure}
- LOS: ${caseRecord.clinical.expectedLengthOfStay}

Clinical Note:
${caseRecord.clinical.clinicalNote?.originalText}

Generate Medical Necessity...`;
    
    // ❌ NO MENTION OF:
    // - caseRecord.metadata.formExtractionResults
    // - caseRecord.documents
    // - Uploaded lab results
    // - Discharge summaries
    // - Imaging findings
}
```

---

## PART 7: COMPLETENESS SCORING IS DECOUPLED

### Current State

**Case Health Score calculation (caseHealthScoringService.ts):**
```typescript
// Checks IF diagnosis exists: ✅
// Checks IF ICD exists: ✅
// Checks IF documents uploaded: ✅
// Checks IF lab results linked: ❌ MISSING

// Never checks:
// - Was data extracted from documents?
// - Is extracted data used in case model?
// - Are lab values actually stored?
```

**Result:** A case can show 85% health score while the uploaded PDFs with actual lab results are never processed for clinical data.

---

## PART 8: THE VERIFICATION FAILURE

### What We Should Be Able to Do

```
Upload multi-page PDF
    ↓
Extract patient info, diagnosis, labs, imaging, billing
    ↓
Populate entire case model:
├─ patient.* (name, age, gender, address)
├─ insurance.* (policy, insurer, TPA)
├─ clinical.* (diagnosis, vitals, labResults, imaging)
└─ billing.* (cost estimates, approved amounts)
    ↓
Verify extracted data quality & completeness
    ↓
Show which fields came from documents vs. manual entry
    ↓
Use extracted data in medical necessity, prior auth, etc.
    ↓
Case is enriched with full clinical picture
```

### What Actually Happens

```
Upload multi-page PDF
    ↓
Extract information → Store in metadata.formExtractionResults
    ↓
Display extraction badges ("97% confidence")
    ↓
Create case WITHOUT using extracted data
    ↓
Case model remains with only manually-entered registration data
    ↓
Extracted clinical information is never used
    ↓
Reasoning engine works with incomplete data
    ↓
Case lacks full clinical context
```

---

## PART 9: MISSING INTEGRATIONS

### Gap 1: No Extraction → Case Mapping

**Missing Code:**
```typescript
// This function DOES NOT EXIST:
function populateCaseFromExtraction(
  caseRecord: Case,
  extractedData: ExtractedPatientData
): Case {
  // Map extracted fields to case model
  if (extractedData.patient.name) caseRecord.patient.name = ...;
  if (extractedData.patient.age) caseRecord.patient.age = ...;
  if (extractedData.clinical?.vitals) caseRecord.clinical.vitals = ...;
  if (extractedData.clinical?.diagnosis_impression) caseRecord.clinical.diagnosis = ...;
  // ... etc
  return caseRecord;
}
```

### Gap 2: No Lab Result Storage

**Missing Model Field:**
```typescript
// Case model does NOT have:
clinical: {
  // ...existing fields...
  labResults?: Array<{
    testName: string;
    value: number;
    units: string;
    normalRange: string;
    timestamp: string;
    labName: string;
  }>;
  // ← THIS IS MISSING
}
```

### Gap 3: No Extraction Validation

**Missing Code:**
```typescript
// No validation that extracted data matches expected types:
// - Lab values should be numeric
// - Dates should be valid ISO strings
// - Policy numbers should match pattern
// - Diagnosis should not be empty
// → ALL MISSING
```

### Gap 4: No Traceability UI

**Missing Display:**
```
Case Overview should show:
✅ Which fields came from: Manual Entry / Aadhaar / Discharge Summary / Lab Report
❌ Currently shows: Just values, no source tracking
❌ Even though extractionResults stores sourceTraceability
```

---

## PART 10: RECOMMENDATIONS FOR PRODUCTION

### Critical Fixes (Must Have)

**1. Create Extraction → Case Mapping Function**
```typescript
// services/caseModel.ts
export function enrichCaseFromExtraction(
  caseRecord: Case,
  extraction: ExtractedPatientData
): Case {
  // Auto-populate from extraction with confidence tracking
  // Skip fields already manually entered
  // Track source of each field
  return enrichedCase;
}
```

**2. Add Lab Result Storage**
```typescript
// Update Case model
clinical: {
  // existing...
  labResults: Array<{
    testName: string;
    value: number;
    units: string;
    normalRange: { min: number; max: number };
    status: 'normal' | 'high' | 'low';
    timestamp: string;
    sourceDocument: string;
  }>;
}
```

**3. Implement Lab Extraction**
```typescript
// services/documentExtractionService.ts
function parseLabTables(tables: Table[]): LabResult[] {
  // For each table:
  // - Identify lab test columns
  // - Parse numeric values
  // - Extract units & reference ranges
  // - Validate data types
  return parsedResults;
}
```

**4. Wire Extraction to Case Creation**
```typescript
// components/CaseIntake/CaseIntakeFlow.tsx
if (extractionResults) {
  newCaseRecord = enrichCaseFromExtraction(newCaseRecord, extractionResults);
}
```

**5. Pass Extracted Data to Reasoning**
```typescript
// services/geminiService.ts
export async function generateMedicalNecessity(caseRecord: Case) {
  const prompt = `...
  // INCLUDE extracted lab results, imaging, discharge summary
  Lab Results: ${JSON.stringify(caseRecord.clinical.labResults)}
  Radiology: ${JSON.stringify(caseRecord.clinical.imaging)}
  ...`;
}
```

### High Priority (Should Have)

**6. Add Field-Level Provenance**
```typescript
// Case model
patient: {
  name: { value: string; source: 'manual' | 'aadhaar' | 'discharge' };
  age: { value: number; source: 'manual' | 'aadhaar' };
  // ... for all fields
}
```

**7. UI: Show Extraction Status**
```typescript
// CaseOverview should display:
"Extraction Complete"
├─ Patient Info: ✅ 100% (from Aadhaar)
├─ Insurance: ✅ 100% (from policy document)
├─ Clinical: ✅ 95% (from discharge summary)
├─ Lab Results: ✅ 100% (from lab report)
└─ Missing: None
```

**8. Validation Layer**
```typescript
// Validate extracted data before storage
- Lab values are numeric
- Dates are valid ISO
- Policy numbers match pattern
- Diagnosis is non-empty
- Units are recognized
```

**9. Extraction Retry Logic**
```typescript
// If extraction fails:
1. Retry with different OCR (Sarvam → Gemini)
2. Log confidence score
3. Flag for manual review if < 70%
4. Notify user of extraction status
```

**10. Medical Necessity Enhancement**
```typescript
// Medical necessity generation should use:
- Extracted lab results (evidence)
- Discharge summary (clinical course)
- Imaging findings (clinical justification)
- Medications (treatment plan)
// Not just clinical note
```

---

## AUDIT FINDINGS SUMMARY

### What Works ✅

- PDF upload mechanism
- OCR (Sarvam with Gemini fallback)
- Page-by-page text extraction
- Basic document type classification
- Table detection (attempted)
- Patient demographics extraction
- Insurance normalization
- Insurer/TPA database
- Extraction result storage in metadata
- Confidence scoring for extractions

### What's Broken ❌

- **Extraction → Case Model mapping (CRITICAL)**
- **Lab result parsing & storage (CRITICAL)**
- **AI reasoning uses extracted data (HIGH)**
- **Traceability/provenance tracking (HIGH)**
- **Validation of extracted values (HIGH)**
- **Radiology/imaging extraction (MEDIUM)**
- **Medication details extraction (MEDIUM)**
- **Clinical narrative parsing (MEDIUM)**
- **Evidence compilation for medical necessity (MEDIUM)**

### Data Loss Points

| Step | Status | Data Loss |
|------|--------|-----------|
| Upload | ✅ Works | None |
| OCR | ✅ Works | OCR confidence not checked |
| Extraction | ✅ Partial | Lab values, imaging not extracted |
| Storage | ✅ Works | Only stored in metadata, not case model |
| Validation | ❌ Missing | No validation of extracted data |
| Population | ❌ Missing | Case fields not auto-populated |
| Reasoning | ❌ Missing | Extracted data not used |
| Display | ❌ Missing | No source tracking in UI |

---

## PRODUCTION READINESS VERDICT

### Current State: 30% Production Ready

**What's Ready:**
- Upload mechanism
- OCR infrastructure
- Metadata storage

**What's Not Ready:**
- No extraction → case mapping
- No lab result handling
- AI ignores extracted data
- No validation
- No traceability

### To Ship: Add 70% More

1. Extraction → Case population (3-4 hours)
2. Lab result handling (4-5 hours)
3. AI reasoning integration (3-4 hours)
4. Validation layer (2-3 hours)
5. UI enhancements (3-4 hours)
6. Testing (4-5 hours)

**Estimated Total: 25-30 hours to production**

---

## NEXT STEPS

1. **Implement extraction mapping** — Wire extracted data to case model
2. **Add lab storage** — Create labResults field in Case
3. **Parse lab tables** — Extract structured values from tables
4. **Update reasoning** — Pass extracted data to AI engine
5. **Add validation** — Verify extracted data types and ranges
6. **Test end-to-end** — Upload PDF → Case enriched with data

**This pipeline needs structural work before it can be production-ready.**
