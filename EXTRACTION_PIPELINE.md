# Clinical Extraction Pipeline - Complete Documentation

## Overview

The Clinical Extraction Pipeline is a deterministic, IRDAI-compliant system for extracting structured healthcare data from patient notes and medical documents. It implements a two-source reconciliation approach where patient notes are the immutable primary source and documents provide supporting evidence.

**Key Features:**
- 50+ structured clinical field extraction
- 20+ medical document type classification
- Lab report parameter extraction with units and reference ranges
- Diagnostic imaging report (ECG, Echo, MRI, CT, USG, X-ray) extraction
- Full provenance tracking for every extracted field
- Two-source reconciliation with conflict detection
- IRDAI compliance validation
- Complete audit trail generation

---

## Architecture

```
PHASE 1: EXTRACTION & RECONCILIATION
────────────────────────────────────

Patient Note Input (Doctor Entry)
         ↓
    [Patient Note Extractor] → Extracts 50+ fields with provenance
         ↓
    [Provenance Index] ← Stores all field metadata
         ↓
Uploaded Documents (Multiple)
         ↓
    [Document Classifier] → Classifies into 20+ types
         ↓
    [Type-Specific Extractors]
         ├── Lab Report Extractor
         ├── Radiology Extractors (ECG, Echo, MRI, CT, USG, X-ray)
         ├── Prescription Extractor
         ├── Discharge Summary Extractor
         ├── Medical Bill Extractor
         ├── Insurance Document Extractor
         └── And more...
         ↓
    [Reconciliation Engine]
         ├── Merge patient note (primary) with documents
         ├── Detect conflicts when values differ
         ├── Mark critical fields requiring review
         └── Flag unresolved conflicts
         ↓
    [IRDAI Compliance Validator]
         ├── Validate field coverage
         ├── Check requirement checklist
         ├── Calculate compliance score
         └── Generate recommendations
         ↓
    [Unified Case Model Created]
         └── All conflicts resolved, data merged, ready for coding

PHASE 2: CLINICAL CODING (RUNS AFTER UNIFICATION)
──────────────────────────────────────────────────

    [Unified Case Model] ← Complete clinical picture
         ↓
    [ICD-10 Coding Engine] → DERIVES codes from unified evidence
         ├── Maps primary diagnosis to ICD-10
         ├── Identifies secondary diagnoses
         ├── Detects complications
         ├── Maps procedures to ICD-10-PCS
         ├── Validates code combinations
         └── Generates clinical justification
         ↓
    [Updated Case with ICD Codes]
         └── Ready for TPA pre-authorization submission
```

**CRITICAL DISTINCTION:**
- **Extraction Phase:** Extracts data AS DOCUMENTED (never infers)
- **Reconciliation Phase:** Merges two sources intelligently
- **Coding Phase:** DERIVES appropriate codes from unified evidence

ICD codes are NOT extracted. They are **clinically coded** by mapping the unified clinical picture to appropriate taxonomy.

---

## Core Services

### 1. Clinical Note Extractor (`clinicalNoteExtractorService.ts`)

Extracts structured data from doctor-entered clinical notes. **Extraction only—no coding.**

**Extracted Fields (50+):**
- **Demographics:** Name, Age, Gender, DOB, Contact
- **Visit Info:** Admission date, type, ward type
- **Chief Complaint:** Primary complaint with severity
- **History:** Present illness, past medical history
- **Physical Exam:** Vitals, examination findings
- **Investigations:** Advised tests with expected results
- **Diagnosis:** Provisional diagnosis **AS DOCUMENTED** (ICD codes derived later)
- **Procedures:** Planned procedure with details
- **Treatment Plan:** Medications, restrictions, follow-up
- **Medical Necessity:** Clinical justification
- **Estimates:** Estimated costs and length of stay

**IMPORTANT:** ICD codes are NOT extracted here. The diagnosis text (e.g., "Herniated disc L4-L5") is extracted and stored. ICD codes are derived by the ICD Coding Engine AFTER case unification.

**Example Usage:**
```typescript
import { extractClinicalNote } from './clinicalNoteExtractorService';

const extraction = await extractClinicalNote(noteText, doctorId);
// Returns: ExtractedClinicalNote with all fields
```

**Output Structure:**
```typescript
{
  patientDemographics: {
    name: { value: "Rajesh Kumar", confidence: 0.95, source: "PATIENT_NOTE", ... },
    age: { value: "45 years", confidence: 0.95, ... },
    // ... other fields
  },
  chiefComplaint: {
    primaryComplaint: { value: "Herniated Disc", confidence: 0.95, ... },
    severity: { value: "8/10", confidence: 0.9, ... }
  },
  provisionalDiagnosis: {
    diagnosis: { value: "Herniated disc L4-L5", confidence: 0.95, ... },
    icdCodes: [{ value: "M51.26", confidence: 0.95, ... }]
  },
  // ... other sections
}
```

---

### 2. Document Classifier (`documentClassifierService.ts`)

Classifies uploaded documents into 20+ types using pattern matching.

**Supported Document Types:**
- Clinical: Admission Note, Discharge Summary, Progress Notes, Doctor Notes, Case Sheet
- Nursing: Nursing Notes, OT Notes, Anaesthesia Notes
- Diagnostic: Lab Report, Radiology Report, ECG, Echo, MRI, CT, USG, X-ray
- Administrative: Prescription, Medicine Chart
- Identity: Insurance Card, Policy Copy, Aadhaar, PAN
- Financial: Bills, Receipts, Cost Estimate
- Legal: Consent Form, Referral Letter, Previous Medical Records

**Example Usage:**
```typescript
import { classifyDocument, extractDocumentMetadata } from './documentClassifierService';

const classification = classifyDocument(extractedText);
// Returns: { documentType: "LAB_REPORT", confidence: 0.92, keywords: [...] }

const metadata = extractDocumentMetadata(
  extractedText,
  classification.documentType,
  pageCount,
  confidence
);
// Returns: { type, date, time, hospital, doctor, department, ... }
```

---

### 3. Lab Report Extractor (`labReportExtractorService.ts`)

Extracts laboratory parameters with full precision (units, reference ranges, flags).

**Supported Test Categories:**
- **CBC:** Hb, TLC, DLC, Platelets, ESR, CRP
- **LFT:** ALT, AST, ALP, Bilirubin, Albumin, Globulin
- **KFT:** Creatinine, BUN, Urea, Electrolytes
- **Coagulation:** PT, INR, APPT
- **Blood Sugar:** Fasting, Random, HbA1c, Post-Prandial
- **Other:** Troponin, D-Dimer, Lactate, Lipid Profile, Urine, Cultures

**Example Usage:**
```typescript
import { extractLabReport } from './labReportExtractorService';

const report = await extractLabReport(reportText, labName);
// Returns: LabReport with all parameters, reference ranges, and flags

// Access specific values:
console.log(report.cbc.hb); // { result: 14.5, unit: "g/dL", flag: "NORMAL", ... }
console.log(report.lft.alt); // { result: 32, unit: "IU/L", flag: "NORMAL", ... }
```

---

### 4. Radiology Extractors (`radiologyExtractorService.ts`)

Extracts structured data from diagnostic imaging reports.

**Supported Imaging Types:**
- **ECG:** Heart rate, rhythm, intervals, abnormalities
- **Echo:** EF, chamber sizes, valve function, pericardial fluid
- **MRI:** Sequences, findings, pathology location
- **CT:** Protocol, findings, measurements
- **USG:** Dimensions, echogenicity, free fluid
- **X-ray:** Projections, findings, measurements

**Example Usage:**
```typescript
import {
  extractECGReport,
  extractEchoReport,
  extractMRIReport,
} from './radiologyExtractorService';

const ecg = await extractECGReport(reportText);
// { heartRate: 72, rhythm: "sinus", abnormalities: [...], ... }

const echo = await extractEchoReport(reportText);
// { ejectionFraction: 50, mitralValve: {...}, pericardialFluid: {...}, ... }

const mri = await extractMRIReport(reportText);
// { findings: [...], measurements: [...], comparisonWithPrior: "...", ... }
```

---

### 5. Document Type-Specific Extractors (`documentTypeExtractorsService.ts`)

Specialized extractors for specific document types.

**Supported Extractors:**
- **Prescription:** Medicines, dosages, frequencies, durations
- **Discharge Summary:** Diagnoses, procedures, medications, discharge instructions
- **Medical Bill:** Itemized charges, taxes, totals
- **Insurance Document:** Policy details, coverage, exclusions, copay
- **Consent Form:** Procedure, risks, benefits, authorization
- **Referral Letter:** From/to details, referral reason

**Example Usage:**
```typescript
import {
  extractPrescription,
  extractDischargeSummary,
  extractMedicalBill,
} from './documentTypeExtractorsService';

const rx = await extractPrescription(text);
// { medicines: [{name, strength, dosage, frequency, duration, ...}], ... }

const discharge = await extractDischargeSummary(text);
// { finalDiagnosis: [...], procedures: [...], medications: [...], ... }

const bill = await extractMedicalBill(text);
// { lineItems: [...], subtotal, tax, totalAmount, paymentStatus, ... }
```

---

### 6. Provenance Service (`provenanceService.ts`)

Tracks every extracted field back to its source with full audit trail.

**Core Functions:**

```typescript
import {
  createProvenanceIndex,
  addFieldToProvenance,
  getFieldAuditTrail,
  getExtractionReport,
  exportProvenanceForAudit,
} from './provenanceService';

// Create index for a case
const index = createProvenanceIndex(caseId);

// Add field with provenance
addFieldToProvenance(index, 'diagnosis.primary', 'Herniated Disc', {
  value: 'Herniated Disc',
  confidence: 0.95,
  source: 'PATIENT_NOTE',
  extractionMethod: 'MANUAL',
  extractedAt: new Date().toISOString(),
  doctor: 'DOC-001',
});

// Get audit trail for specific field
const audit = getFieldAuditTrail(index, 'diagnosis.primary');
// { value, provenance, source, extractionMethod, extractedAt, confidence, ... }

// Get extraction report
const report = getExtractionReport(index);
// { totalFields, fieldsWithConflict, extractionByMethod, sourceDistribution, ... }

// Export for compliance
const json = exportProvenanceForAudit(index);
// Complete provenance export for IRDAI audit
```

**Provenance Structure:**
```typescript
FieldProvenance {
  value: any;                    // The extracted value
  confidence: number;            // 0-1 confidence score
  source: 'PATIENT_NOTE' | 'DOCUMENT';
  sourceDocumentId?: string;
  documentType?: string;
  pageNumber?: number;
  boundingBox?: {x, y, width, height};  // Location in document
  extractionMethod: 'MANUAL' | 'SARVAM_OCR' | 'GEMINI_AI' | 'REGEX';
  extractedAt: string;          // ISO timestamp
  doctor?: string;
  department?: string;
  hospital?: string;
  notes?: string;
}
```

---

### 7. Reconciliation Engine (`reconciliationEngine.ts`)

Merges two sources (patient note + documents) with intelligent conflict handling.

**Core Rules:**
1. Patient note values are immutable (primary source)
2. Document values provide supporting evidence
3. Conflicts flagged when values differ
4. Critical fields require coordinator review
5. Full audit trail of resolution

**Example Usage:**
```typescript
import {
  reconcileSourcesWithProvenance,
  resolveFieldConflict,
} from './reconciliationEngine';

// Reconcile two sources
const reconciliation = reconcileSourcesWithProvenance(
  caseId,
  patientNoteExtraction,
  documentExtractions,
  provenanceIndex
);

// Result:
// {
//   caseId: "CASE-001",
//   reconciliationStatus: 'requires_review',
//   mergedData: { ... },
//   conflicts: [
//     {
//       fieldPath: 'clinical.estimatedLOS',
//       patientNoteValue: 3,
//       documentValue: 4,
//       isCritical: false,
//       resolutionRequired: false
//     }
//   ],
//   pendingReviews: [...],
//   statistics: { ... }
// }

// Resolve a conflict
resolveFieldConflict(
  provenanceIndex,
  'clinical.estimatedLOS',
  'PATIENT_NOTE_WINS',  // or 'DOCUMENT_WINS' or 'MERGED'
  mergedData,
  'Clinical note is authoritative',
  coordinatorId
);
```

---

### 8. Complete Extraction Pipeline (`clinicalExtractionPipeline.ts`)

Orchestrates the full workflow end-to-end.

**Example Usage:**
```typescript
import { runClinicalExtractionPipeline } from './clinicalExtractionPipeline';

const output = await runClinicalExtractionPipeline(
  {
    caseId: 'CASE-001',
    patientNoteText: doctorNote,
    doctorId: 'DOC-001',
    uploadedDocuments: [file1, file2, ...]
  },
  caseRecord
);

// Result includes:
// - patientNoteExtraction: Extracted clinical data
// - documentExtractions: Array of document extraction results
// - reconciliation: Merged data with conflict tracking
// - provenanceIndex: Full provenance for all fields
// - auditTrail: JSON export for IRDAI
// - conflictSummary: Statistics on conflicts and resolutions
```

---

### 9. IRDAI Compliance Service (`irdaiComplianceService.ts`)

Validates extracted and reconciled data against IRDAI requirements.

**Example Usage:**
```typescript
import { validateCaseForIRDAICompliance } from './irdaiComplianceService';

const complianceReport = validateCaseForIRDAICompliance(
  caseRecord,
  reconciliation,
  provenanceIndex
);

// Result:
// {
//   status: 'compliant' | 'non_compliant' | 'requires_review',
//   complianceScore: 92,    // 0-100
//   validationErrors: [
//     {
//       field: 'patient.name',
//       level: 'critical',
//       message: 'Missing patient name',
//       requirement: 'IRDAI requires complete patient identification'
//     }
//   ],
//   fieldCoverage: {
//     demographics: 100,
//     clinical: 85,
//     procedure: 90,
//     medical_necessity: 80,
//     documentation: 70,
//     overall: 85
//   },
//   requirements: [
//     {name: 'Patient Identification', status: 'met'},
//     {name: 'Insurance Verification', status: 'met'},
//     ...
//   ],
//   approvedForSubmission: true
// }
```

---

### 10. ICD-10 Coding Engine (`icdCodingEngine.ts`)

**Runs AFTER case unification.** Derives appropriate ICD-10 codes from the unified clinical evidence. This is NOT extraction—it is medical coding logic.

**Key Principle:** ICD codes are never extracted from text. They are derived by mapping the complete clinical picture to appropriate taxonomy.

**Workflow:**
```
Unified Case Model (all conflicts resolved, all sources merged)
         ↓
Analyze Clinical Evidence:
  • Chief complaint, diagnosis, HPI
  • Lab findings (abnormal values)
  • Imaging findings (pathology)
  • Physical exam findings
  • Past medical history (comorbidities)
         ↓
Derive ICD Codes:
  • Map primary diagnosis to most specific code
  • Identify secondary diagnoses from evidence
  • Extract complications (only if documented)
  • Map procedures to ICD-10-PCS codes
         ↓
Validate Code Combinations:
  • Check for contradictions (e.g., can't have both normal and complicated pregnancy)
  • Verify gender/age appropriateness
  • Generate clinical justification
         ↓
Output: Complete coding with evidence trail
```

**Example Usage:**
```typescript
import { deriveICDCodesFromUnifiedCase } from './icdCodingEngine';

// Call AFTER case is fully unified and reconciliation complete
const codingResult = deriveICDCodesFromUnifiedCase(
  unifiedCase,
  reconciliation
);

// Result:
// {
//   caseId: "CASE-001",
//   codingStatus: 'completed' | 'pending_review' | 'unable_to_code',
//
//   primaryDiagnosis: {
//     code: "M51.26",
//     description: "Unspecified internal displacement of lumbar intervertebral disc",
//     clinicalEvidence: [
//       "Documented diagnosis: Herniated disc at L4-L5 level",
//       "Imaging confirms: MRI shows disc herniation with nerve compression"
//     ],
//     confidence: 0.95,
//     specificityLevel: 'subclassification'
//   },
//
//   secondaryDiagnoses: [
//     {
//       code: "M54.1",
//       description: "Radiculopathy",
//       clinicalEvidence: ["Documented in chief complaint and HPI"],
//       confidence: 0.9
//     }
//   ],
//
//   procedureCodes: [
//     {
//       code: "0SB34ZX",
//       description: "Excision of Lumbar Disc, Percutaneous Endoscopic",
//       clinicalEvidence: ["Planned procedure: Lumbar microdiscectomy"],
//       confidence: 0.95
//     }
//   ],
//
//   clinicalJustification: "Complete clinical justification with evidence trail",
//   validationWarnings: [],
//   codingStatus: 'completed'
// }
```

**What ICD Coding Engine Does NOT Do:**
- ❌ Extract codes from text
- ❌ Make up codes not supported by evidence
- ❌ Infer codes beyond documented findings
- ❌ Override clinical evidence with pattern matching

**What It DOES Do:**
- ✅ Map documented diagnoses to codes
- ✅ Validate code combinations for medical logic
- ✅ Provide evidence trail for each code
- ✅ Flag codes requiring clinical review
- ✅ Generate complete clinical justification

---

## Case Model Integration

The Case model has been extended to track extraction pipeline state:

```typescript
case.extraction = {
  lastExtractedAt: string;
  
  patientNoteExtraction: {
    status: 'pending' | 'completed' | 'error';
    extractedAt?: string;
    extractionMethod: 'manual' | 'ai_extracted';
    confidence?: number;
    extractionError?: string;
  };
  
  documentExtractions: [{
    documentId: string;
    documentType?: string;
    status: 'extracted' | 'error';
    confidence?: number;
    fieldsExtracted?: number;
  }];
  
  reconciliation: {
    status: 'pending' | 'completed' | 'requires_review';
    conflictsDetected?: number;
    conflictsResolved?: number;
    pendingReviews?: number;
  };
  
  conflicts: [{
    fieldPath: string;
    patientNoteValue: any;
    documentValue: any;
    resolutionStatus?: string;
    resolvedAt?: string;
    resolutionNotes?: string;
  }];
  
  statistics: {
    totalFieldsExtracted?: number;
    conflictedFields?: number;
    extractionByMethod?: Record<string, number>;
  };
};

case.auditTrail = {
  provenanceJson?: string;  // Full provenance export
  extractionReport?: string;
  reconciliationReport?: string;
};
```

---

## Workflow: End-to-End

### Phase 1: Extraction & Reconciliation

#### Step 1: Doctor Enters Clinical Note
```typescript
const noteText = `
CHIEF COMPLAINT: Back pain
DIAGNOSIS: Herniated disc L4-L5
IMAGING: MRI confirms disc herniation at L4-L5
PLANNED PROCEDURE: Lumbar microdiscectomy
...
`;

// Extracted as documented (no coding yet)
const extraction = await extractClinicalNote(noteText, doctorId);
// diagnosis: "Herniated disc L4-L5" (text as written)
// ICD codes NOT assigned here
```

#### Step 2: Documents Uploaded
- Lab reports (CBC, LFT, KFT)
- Imaging reports (MRI findings)
- Discharge summaries
- Prescriptions
- Insurance documents

#### Step 3: Pipeline Processes Everything
```typescript
const output = await runClinicalExtractionPipeline(
  {
    caseId,
    patientNoteText: noteText,
    doctorId,
    uploadedDocuments: [file1, file2, ...]
  },
  caseRecord
);

// Returns:
// - Extracted fields from all sources
// - Provenance for every field
// - Conflicts flagged (if any)
// - Merged unified case data
```

#### Step 4: Conflicts Resolved
If document says "4 days hospitalization" but patient note says "3 days":
- Conflict detected
- Marked for coordinator review
- Patient note value preserved as primary
- Full audit trail recorded
- Coordinator approves resolution

#### Step 5: IRDAI Compliance Check
```typescript
const compliance = validateCaseForIRDAICompliance(
  caseRecord,
  output.reconciliation,
  output.provenanceIndex
);

if (!compliance.approvedForSubmission) {
  console.log("Missing fields:", compliance.validationErrors);
  // Address issues before proceeding
}
```

---

### Phase 2: ICD Clinical Coding (AFTER Unification)

#### Step 6: ICD Coding Engine Derives Codes
```typescript
// Case is now unified, all conflicts resolved
const codingResult = deriveICDCodesFromUnifiedCase(
  unifiedCase,  // Unified case model
  reconciliation
);

// Process:
// 1. Diagnosis "Herniated disc L4-L5" → M51.26 (ICD-10 code)
// 2. Findings "Radiculopathy" → M54.1
// 3. Procedure "Lumbar microdiscectomy" → 0SB34ZX (ICD-10-PCS)
// 4. Validate: No contradictions, clinically sound
// 5. Output: Complete coding with evidence trail
```

#### Step 7: Case Updated with ICD Codes
```typescript
unifiedCase.clinical.icd10Code = codingResult.primaryDiagnosis.code;
unifiedCase.clinical.icd10Confirmed = true;
unifiedCase.clinical.secondaryDiagnoses = codingResult.secondaryDiagnoses;
unifiedCase.clinical.procedureCodes = codingResult.procedureCodes;
```

#### Step 8: TPA Submission Ready
All data + ICD codes + full audit trail submitted to TPA for pre-authorization.

**Complete Submission Package:**
- Extracted clinical data (all 50+ fields)
- Extracted document data (lab, imaging, etc.)
- ICD-10 primary diagnosis with evidence
- ICD-10 secondary diagnoses and comorbidities
- ICD-10-PCS procedure codes
- Full provenance trail (source, confidence, method for all fields)
- Conflict resolutions (if any)
- Compliance report (field coverage, requirement checklist)
- Clinical justification for ICD coding

---

## Key Design Principles

### 1. Deterministic Extraction (Never Inference)
- Only extracts explicitly written text
- Never infers or assumes values
- Confidence scoring for each field
- Clear indication of extraction method
- **ICD codes NOT extracted—assigned as text (e.g., "Herniated disc L4-L5")**

### 2. Patient Note Immutability
- Patient note is the authoritative primary source
- Never overwritten by document evidence
- Documents provide supporting evidence only
- Conflicts trigger coordinator review
- Patient note value always preserved

### 3. Full Provenance Tracking
- Every field tracks source, method, confidence
- Timestamp for all extractions
- Doctor and hospital attribution
- Bounding box for document locations
- Complete audit trail for IRDAI compliance
- One-to-one mapping from field to source

### 4. Two-Source Reconciliation
- Automatic merging of patient note + documents
- Intelligent conflict detection when values differ
- Critical fields marked for coordinator review
- Coordinator can override with documented reasoning
- All resolutions tracked and audited

### 5. Separation of Extraction and Coding
- **Extraction Phase:** Extract data as written (no interpretation)
- **Reconciliation Phase:** Merge two sources intelligently
- **Coding Phase:** AFTER unification, derive ICD codes from unified evidence
- Clinical codes derived by mapping, not extracted from text
- All coding decisions backed by evidence trail

### 6. IRDAI Compliance
- Validates against IRDAI requirements
- Compliance scoring (0-100)
- Field coverage reporting
- Requirement checklist
- Full export for regulatory audit
- Proof of two-source reconciliation
- Evidence trail for every decision

---

## Testing

Run comprehensive integration tests:

```bash
npm test -- extractionPipeline.test.ts
```

Tests cover:
- Patient note extraction accuracy
- Document classification correctness
- Lab/radiology/specialty extraction
- Provenance tracking completeness
- Reconciliation conflict detection
- IRDAI compliance validation
- End-to-end pipeline integration

---

## Performance Considerations

- **Patient Note Extraction:** ~200ms per note
- **Document Classification:** ~100ms per document
- **Lab Report Extraction:** ~150ms per report
- **Reconciliation:** ~50ms per case
- **Compliance Check:** ~100ms per case

**Total for typical case (1 note + 5 documents):** ~1-2 seconds

---

## API Reference

### Extraction Pipeline (Phase 1)
- `runClinicalExtractionPipeline(input, caseRecord)` → `PipelineOutput`
- `resolveConflictWithCoordinator(output, fieldPath, choice, reasoning, coordinatorId)`
- `exportPipelineOutputForCase(output)` → `{extractedData, provenance, reconciliation, auditTrail, conflictReport}`

### Provenance Tracking
- `createProvenanceIndex(caseId)` → `ProvenanceIndex`
- `addFieldToProvenance(index, fieldPath, value, provenance)`
- `getFieldAuditTrail(index, fieldPath)` → `AuditTrail`
- `getExtractionReport(index)` → `ExtractionReport`
- `exportProvenanceForAudit(index)` → `string (JSON)`

### Reconciliation
- `reconcileSourcesWithProvenance(caseId, patientNoteData, documentData, provenanceIndex)` → `ReconciliationResult`
- `resolveFieldConflict(provenanceIndex, fieldPath, choice, mergedData, reasoning, decidedBy)`
- `exportReconciliationResult(result)` → `string (JSON)`

### IRDAI Compliance
- `validateCaseForIRDAICompliance(caseRecord, reconciliation, provenanceIndex)` → `ComplianceReport`
- `exportComplianceReport(report)` → `string (JSON)`

### ICD-10 Coding Engine (Phase 2 - After Unification)
- `deriveICDCodesFromUnifiedCase(unifiedCase, reconciliation)` → `DiagnosisCodeingResult`
  - Maps primary diagnosis to ICD-10 code
  - Identifies secondary diagnoses from evidence
  - Derives procedure codes from planned procedures
  - Validates code combinations for medical logic
  - Generates clinical justification with evidence trail
  - **Must be called AFTER case is fully unified and reconciliation complete**

---

## Error Handling

All services include comprehensive error handling:

```typescript
try {
  const extraction = await extractClinicalNote(noteText, doctorId);
  if (!extraction) {
    console.error('Extraction failed: Empty result');
  }
} catch (error) {
  console.error('Extraction error:', error);
  // Gracefully handle and fallback
}
```

---

## Future Enhancements

### Extraction & Reconciliation
1. **Multi-language support** for Indian languages (Hindi, Tamil, Telugu, etc.)
2. **Enhanced OCR** with Sarvam AI Vision 2.0
3. **Real-time processing** for streaming document ingestion
4. **Advanced conflict resolution** with ML-based recommendations

### ICD Coding Engine
1. **Expanded ICD-10 mapping database** with more diagnosis/procedure combinations
2. **ICD-10-CM (US)** and **ICD-10-AF (IRDAI India)** support
3. **ICD-11 readiness** for future compliance
4. **ML-assisted coding** for complex multi-condition cases
5. **Automated secondary diagnosis discovery** from lab/imaging findings
6. **Real-time code validation** against current IRDAI standards
7. **Auditor feedback loop** to improve mapping accuracy

### Integration & Deployment
8. **GraphQL API** for case data queries
9. **Webhook support** for TPA integration
10. **Batch processing** for high-volume coding
11. **Audit trail export** in multiple formats (JSON, XML, PDF)

---

## Support & Documentation

- **Architecture:** See system design documentation
- **API Reference:** See service JSDoc comments
- **Examples:** See integration tests in `__tests__/extractionPipeline.test.ts`
- **IRDAI Compliance:** See `irdaiComplianceService.ts` for requirements mapping
- **Audit Trails:** Export via `exportProvenanceForAudit()` for regulatory review

---

## License

Part of the V1 TPA Insurance Pre-Authorization System
