# ICD-10 Coding Architecture - Critical Distinction

## The Fundamental Principle

**ICD-10 coding is NOT extraction. It is clinical coding logic.**

- ❌ **Wrong:** Extract ICD codes from text using pattern matching
- ✅ **Right:** Derive ICD codes by mapping unified clinical evidence to taxonomy

---

## Why Separation Matters

### The Problem with Extraction-Based Coding

If you try to extract ICD codes directly from text:

```
Doctor writes: "Herniated disc L4-L5"
Pattern matcher tries: regex for "M51.26"
Result: ❌ Fragile, unreliable, context-blind
```

**Issues:**
1. **Doctor may not write ICD codes** - they write clinical descriptions
2. **Multiple descriptions map to same code** - "slipped disc", "prolapsed disc", "disc protrusion" all → M51.26
3. **Single description maps to multiple codes** - need clinical context to pick the right one
4. **Codes change** - ICD codes are updated yearly, requiring constant pattern maintenance
5. **Code selection requires clinical judgment** - can't be pure text extraction

### Why Unified Case Model is Required

ICD coding requires the **complete clinical picture**:

```
Diagnosis (from doctor note):        "Severe back pain with radiculopathy"
Plus lab findings (from records):    Normal blood work
Plus imaging findings (from MRI):    Herniated disc L4-L5 with nerve compression
Plus severity (from assessment):     Severe
Plus complications (from discharge): None

ONLY WITH ALL THIS TOGETHER can you derive:
Primary diagnosis:     M51.26 (Herniated disc)
Secondary diagnosis:   M54.1  (Radiculopathy)
Complication status:   None documented
Confidence:            0.95
Evidence trail:        [Complete mapping to clinical facts]
```

---

## Correct Architecture: Two Phases

### Phase 1: Extraction & Reconciliation

**What happens:**
1. Extract clinical data AS DOCUMENTED (never interpret)
2. Classify documents by type
3. Extract structured data from each type
4. Track provenance for every field
5. Reconcile patient note + documents
6. Resolve conflicts
7. Validate IRDAI compliance

**What does NOT happen:**
- ❌ ICD codes NOT assigned
- ❌ No inference or interpretation
- ❌ Only data as explicitly written

**Input:** Raw clinical note + uploaded documents
**Output:** Unified Case model with all fields, all sources merged

---

### Phase 2: ICD Coding (AFTER Unification)

**What happens:**
1. Take the unified case model (everything merged)
2. Extract all clinical evidence:
   - Chief complaint, diagnosis, HPI
   - Physical exam findings
   - Lab abnormalities
   - Imaging pathology
   - Past medical history
   - Current medications
3. Analyze evidence for each ICD code
4. Map diagnosis text to most specific code
5. Identify secondary diagnoses from evidence
6. Map procedure to ICD-10-PCS
7. Validate code combinations:
   - Check for contradictions
   - Verify gender/age appropriateness
   - Ensure clinical logic consistency
8. Generate evidence trail for each code
9. Output: Complete coding with justification

**Why it must be separate:**
- ✅ Access to complete clinical picture
- ✅ Can validate across multiple fields
- ✅ Can apply medical logic rules
- ✅ Can handle complex cases with multiple diagnoses
- ✅ Can explain reasoning with evidence trail
- ✅ Can flag cases requiring clinical review

---

## Data Flow

```
┌─────────────────────────────────────────────────┐
│ PHASE 1: EXTRACTION & RECONCILIATION            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Doctor Note: "Herniated disc L4-L5"            │
│                   ↓                             │
│ Extract: diagnosis = "Herniated disc L4-L5"    │
│ (Store as text, NOT code)                      │
│                   ↓                             │
│ Document: MRI report showing disc herniation   │
│                   ↓                             │
│ Extract: imaging = "Disc herniation L4-L5"     │
│                   ↓                             │
│ Reconcile: Both agree on herniated disc        │
│                   ↓                             │
│ Result: Unified Case with diagnosis text       │
│         (ready for clinical coding)             │
│                                                 │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ PHASE 2: ICD CODING (After Unification)        │
├─────────────────────────────────────────────────┤
│                                                 │
│ Input: Unified case with:                      │
│   • diagnosis = "Herniated disc L4-L5"         │
│   • imaging = "Disc herniation with compression"
│   • labs = "Normal"                             │
│   • severity = "High"                           │
│   • procedure = "Lumbar microdiscectomy"       │
│                   ↓                             │
│ ICD Coding Engine:                             │
│   1. Map diagnosis → M51.26                    │
│   2. Evidence: "Documented diagnosis" +        │
│      "Imaging confirms: disc herniation"       │
│   3. Confidence: 0.95                          │
│   4. Validate: No contradictions               │
│      (Single diagnosis, no complications)      │
│   5. Output: Complete code with trail          │
│                   ↓                             │
│ Result: ICD code M51.26 with:                  │
│   • Primary source: Clinical note              │
│   • Supporting source: MRI imaging             │
│   • Evidence trail: [list of supports]         │
│   • Confidence: 0.95                           │
│   • Validation: No issues                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Implementation Rules

### During Extraction (Phase 1)

✅ **DO:**
- Extract diagnosis text exactly as written: "Herniated disc L4-L5"
- Extract findings from documents: "MRI shows disc bulge at L4-L5"
- Track provenance: source, confidence, method
- Reconcile conflicting values
- Store everything for later coding

❌ **DON'T:**
- Try to assign ICD codes
- Interpret what the doctor meant
- Infer diagnoses beyond what's documented
- Use pattern matching for codes

### During Coding (Phase 2)

✅ **DO:**
- Map unified diagnosis to most specific code
- Use evidence from multiple sources
- Validate code combinations
- Explain with evidence trail
- Flag cases needing clinical review

❌ **DON'T:**
- Use only diagnosis text (use full clinical picture)
- Skip validation of code combinations
- Accept contradictory codes
- Forget evidence trail

---

## Example: Complex Case

### Patient: Diabetic with Infection

**Phase 1 (Extraction):**

```typescript
// Doctor note
Note: "60-year-old diabetic with post-surgical wound infection"

// Extract (don't code yet)
diagnosis: "post-surgical wound infection"
pastMedicalHistory: "diabetes"
admittingDiagnosis: "post-operative infection"

// MRI report
imaging: "Surgical wound with inflammatory changes"

// Lab report
labs: [
  {testName: "WBC", value: 18000, status: "HIGH"},
  {testName: "Glucose", value: 280, status: "HIGH"}
]

// Result of Phase 1:
// Unified case with all these facts, no codes yet
```

**Phase 2 (Coding):**

```typescript
// ICD Coding Engine now runs with complete picture
// Can identify:
// - Primary: Post-operative infection (T81.4)
// - Secondary: Type 2 diabetes (E11.9)
// - Secondary: Hyperglycemia (R73.9)
// - Evidence trail for each code

// Why can't extract this?
// 1. Multiple secondary diagnoses identified from labs
// 2. Post-operative status requires knowledge of procedure
// 3. Infection severity inferred from WBC + clinical context
// 4. Diabetes confirmed from past history + elevated glucose
// 5. Code selection depends on clinical judgment
```

---

## Validation in Coding Engine

The ICD Coding Engine validates clinical logic:

```typescript
// Check 1: Gender-specific codes
if (code === "O26" && patient.gender !== "Female") {
  warning: "Pregnancy code for non-female patient"
}

// Check 2: Contradictory codes
if (has("Z34") && has("O26")) {
  warning: "Cannot have both normal and complicated pregnancy"
}

// Check 3: Age-specific codes
if (code === "Z13" && patient.age > 28) {
  warning: "Newborn screening code for adult patient"
}

// Check 4: Procedure-diagnosis consistency
if (procedure === "Cesarean" && !diagnosis.includes("Pregnancy")) {
  warning: "Procedure inconsistent with diagnosis"
}
```

---

## Summary

| Aspect | Phase 1 (Extraction) | Phase 2 (Coding) |
|--------|---------------------|-----------------|
| **Input** | Raw note + docs | Unified case model |
| **Task** | Extract as written | Derive from evidence |
| **Process** | Text extraction | Clinical logic mapping |
| **Output** | Extracted fields | ICD codes + evidence |
| **Runs** | First | AFTER unification |
| **Inference** | None | Medical judgment only |
| **Source** | Each document | Complete unified picture |
| **Validation** | Field completeness | Code medical logic |

---

## IRDAI Compliance

This two-phase approach ensures IRDAI compliance:

1. **Phase 1 proves:** Data extracted accurately with full provenance
2. **Phase 2 proves:** ICD codes properly derived with evidence trail
3. **Together they prove:** Complete, auditable clinical documentation

Both phases export for regulatory review:
- Phase 1: Extraction report + provenance export
- Phase 2: Coding report + evidence trail

---

## Next Steps

1. Use `clinicalExtractionPipeline.ts` for Phase 1
2. Build unified case model
3. Call `icdCodingEngine.ts` for Phase 2
4. Export complete submission package

Never try to extract ICD codes in Phase 1. Always derive them in Phase 2 with full clinical context.
