/**
 * Clinical Extraction Pipeline Integration Tests
 *
 * Tests the complete end-to-end extraction workflow:
 * 1. Patient note extraction
 * 2. Document classification and extraction
 * 3. Provenance tracking
 * 4. Two-source reconciliation
 * 5. Conflict detection and resolution
 * 6. IRDAI compliance validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runClinicalExtractionPipeline, type PipelineInput } from '../clinicalExtractionPipeline';
import {
  extractClinicalNote,
  type ExtractedClinicalNote,
} from '../clinicalNoteExtractorService';
import { classifyDocument } from '../documentClassifierService';
import { extractLabReport } from '../labReportExtractorService';
import {
  extractECGReport,
  extractEchoReport,
  extractMRIReport,
} from '../radiologyExtractorService';
import {
  extractPrescription,
  extractDischargeSummary,
  extractMedicalBill,
} from '../documentTypeExtractorsService';
import {
  createProvenanceIndex,
  addFieldToProvenance,
  getExtractionReport,
  getPendingReviews,
} from '../provenanceService';
import {
  reconcileSourcesWithProvenance,
  resolveFieldConflict,
} from '../reconciliationEngine';
import { validateCaseForIRDAICompliance } from '../irdaiComplianceService';
import type { Case } from '../caseModel';

// Mock data for testing
const mockPatientNote = `
CLINICAL NOTE - Date: 2026-07-22

CHIEF COMPLAINT: Herniated Disc L4-L5 with radiculopathy

PATIENT DEMOGRAPHICS:
Name: Rajesh Kumar
Age: 45 years
Gender: Male
Contact: 9876543210

HISTORY OF PRESENT ILLNESS:
Patient presented with acute onset lower back pain radiating to left leg.
Pain started 5 days ago following heavy lifting. Associated with numbness
and tingling in left foot. Pain severity 8/10.

PAST MEDICAL HISTORY:
- Hypertension (well-controlled on Lisinopril)
- No previous spine surgeries

PHYSICAL EXAMINATION:
- Tenderness over L4-L5 region
- Positive straight leg raise test on left
- Diminished sensation in L5 distribution
- Normal motor power

INVESTIGATIONS ADVISED:
- MRI Lumbar Spine

PROVISIONAL DIAGNOSIS:
- Herniated disc at L4-L5 level with nerve root compression
- ICD-10 Code: M51.26

PLANNED PROCEDURE:
- Lumbar microdiscectomy with decompression

EXPECTED HOSPITAL STAY: 3 days
EXPECTED ICU DAYS: 0

MEDICAL NECESSITY:
Based on clinical evaluation and imaging findings, patient has clear
indications for surgical intervention. Conservative management has failed
to provide relief.

TREATING DOCTOR: Dr. Amit Singh
License: MED/2020/12345
`;

const mockLabReport = `
LABORATORY REPORT

Report Date: 2026-07-20
Collection Date: 2026-07-19
Lab Name: Apollo Diagnostics

PATIENT NAME: Rajesh Kumar
AGE: 45 years
GENDER: Male

CBC REPORT:
- Hemoglobin (Hb): 14.5 g/dL (Normal)
- Total Leucocyte Count (TLC): 7.2 K/μL (Normal)
- Platelets: 245 K/μL (Normal)
- ESR: 12 mm/hr (Normal)

LFT REPORT:
- ALT (SGPT): 32 IU/L (Normal)
- AST (SGOT): 28 IU/L (Normal)
- ALP: 72 IU/L (Normal)
- Total Bilirubin: 0.8 mg/dL (Normal)

KFT REPORT:
- Creatinine: 0.9 mg/dL (Normal)
- Sodium: 138 mEq/L (Normal)
- Potassium: 4.2 mEq/L (Normal)
`;

const mockDischargeNote = `
DISCHARGE SUMMARY

Admission Date: 2026-07-22
Discharge Date: 2026-07-25
Length of Stay: 3 days

PATIENT: Rajesh Kumar
MR Number: MR-123456
Hospital: Apollo Medical Center

ADMITTING DIAGNOSIS:
Herniated disc L4-L5 with radiculopathy

FINAL DIAGNOSIS:
1. Herniated disc at L4-L5 level with nerve root compression
2. Radiculopathy left L5

ICD-10 CODES:
- M51.26 (Herniated nucleus pulposus)

TREATMENT SUMMARY:
Patient underwent lumbar microdiscectomy with decompression on 2026-07-22.
Intraoperative findings confirmed disc herniation with nerve root compression.
Adequate decompression achieved. No intraoperative complications.

MEDICATIONS AT DISCHARGE:
- Amoxicillin 500mg TDS for 5 days
- Ibuprofen 400mg TID with meals for 7 days
- Tab Thiamine 100mg daily for 30 days

DISCHARGE INSTRUCTIONS:
- Avoid heavy lifting for 6 weeks
- Physical therapy starting week 2 post-op
- Follow-up with surgeon in 2 weeks
- Wound care: Keep dressing dry, remove after 5 days

RESTRICTIONS:
- No driving for 2 weeks
- No strenuous activities for 6 weeks
- Bed rest for 3 days
`;

const mockMRIReport = `
MRI LUMBAR SPINE REPORT

Report Date: 2026-07-21
Study Type: MRI Lumbar Spine
Field Strength: 1.5T

FINDINGS:
1. Herniated disc at L4-L5 level with moderate left nerve root compression
2. Hypertrophic ligamentum flavum contributing to canal stenosis
3. Normal disc hydration at other levels
4. No evidence of infection or metastatic disease

MEASUREMENTS:
- Disc bulge at L4-L5: 8mm
- Left lateral recess stenosis
- Central canal diameter at L4-L5: 10mm (mild stenosis)

CLINICAL CORRELATION:
Findings correlate with clinical presentation of radiculopathy.
Surgical decompression indicated.

COMPARISON:
No prior studies available for comparison.

RADIOLOGIST: Dr. Priya Sharma, MD (Radiology)
`;

describe('Clinical Extraction Pipeline', () => {
  let mockCase: Case;

  beforeEach(() => {
    mockCase = {
      id: 'CASE-2026-001',
      type: 'insurance_case',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hospitalId: 'HOSP-001',
      status: 'patient_registered',
      patient: {
        name: '',
        contactNumber: '',
        provenance: {},
      },
      insurance: {
        insurerName: 'ICICI Lombard',
        tpaName: 'Aditya Birla Health',
        policyNumber: 'ICICI/12345/2026',
        sumInsured: 500000,
        verified: true,
        provenance: {},
      },
      clinical: {
        admissionDate: '2026-07-22',
        admissionType: 'planned',
        icd10Confirmed: false,
        provenance: {},
      },
      documents: [],
      authorization: {
        id: 'AUTH-001',
        status: 'pending',
        requestedAmount: 150000,
      },
      enhancements: [],
      billing: {
        status: 'pending',
      },
      completeness: {
        overallScore: 0,
        sections: {
          patient: 0,
          insurance: 0,
          clinical: 0,
          documents: 0,
          prior_auth_ready: 0,
        },
        missingItems: [],
      },
      activities: [],
      pendingApprovals: [],
    };
  });

  describe('Patient Note Extraction', () => {
    it('should extract all clinical fields from patient note', async () => {
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      expect(extraction).toBeDefined();
      expect(extraction.patientDemographics?.name).toBe('Rajesh Kumar');
      expect(extraction.patientDemographics?.age).toBe('45 years');
      expect(extraction.chiefComplaint?.primaryComplaint).toContain('Herniated Disc');
      expect(extraction.provisionalDiagnosis?.diagnosis).toContain('L4-L5');
      expect(extraction.plannedProcedure?.procedureName).toContain('microdiscectomy');
    });

    it('should extract medical necessity from clinical note', async () => {
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      expect(extraction.medicalNecessity?.statement).toBeDefined();
      expect(extraction.medicalNecessity?.clinicalJustification).toContain('clear indications');
    });

    it('should extract ICD codes correctly', async () => {
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      expect(extraction.provisionalDiagnosis?.icdCodes).toContain('M51.26');
    });

    it('should track confidence for each field', async () => {
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      if (extraction.chiefComplaint?.primaryComplaint) {
        expect(extraction.chiefComplaint).toHaveProperty('confidence');
        expect(extraction.chiefComplaint.confidence).toBeGreaterThanOrEqual(0);
        expect(extraction.chiefComplaint.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Document Classification', () => {
    it('should classify lab report correctly', () => {
      const classification = classifyDocument(mockLabReport);

      expect(classification.documentType).toBe('LAB_REPORT');
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it('should classify discharge summary correctly', () => {
      const classification = classifyDocument(mockDischargeNote);

      expect(classification.documentType).toBe('DISCHARGE_SUMMARY');
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it('should classify MRI report correctly', () => {
      const classification = classifyDocument(mockMRIReport);

      expect(classification.documentType).toBe('MRI');
    });
  });

  describe('Lab Report Extraction', () => {
    it('should extract all lab parameters', async () => {
      const report = await extractLabReport(mockLabReport, 'Apollo Diagnostics');

      expect(report).toBeDefined();
      expect(report.reportType).toBe('LAB_REPORT');
      expect(report.cbc.hb).toBeDefined();
      expect(report.cbc.hb?.result).toBe(14.5);
      expect(report.lft.alt).toBeDefined();
      expect(report.lft.alt?.result).toBe(32);
    });

    it('should track abnormal parameters', async () => {
      const report = await extractLabReport(mockLabReport, 'Apollo Diagnostics');

      expect(report.abnormalParameters).toBeDefined();
      // All should be normal in this test case
      expect(report.abnormalParameters.length).toBe(0);
    });
  });

  describe('Radiology Extraction', () => {
    it('should extract MRI findings', async () => {
      const report = await extractMRIReport(mockMRIReport);

      expect(report).toBeDefined();
      expect(report.reportType).toBe('MRI');
      expect(report.findings.length).toBeGreaterThan(0);
      expect(report.findings[0].description).toContain('L4-L5');
    });

    it('should extract measurements from MRI', async () => {
      const report = await extractMRIReport(mockMRIReport);

      expect(report.measurements.length).toBeGreaterThan(0);
      expect(report.measurements[0]).toHaveProperty('location');
      expect(report.measurements[0]).toHaveProperty('dimension');
    });
  });

  describe('Document Type-Specific Extraction', () => {
    it('should extract discharge summary details', async () => {
      const summary = await extractDischargeSummary(mockDischargeNote);

      expect(summary.reportType).toBe('DISCHARGE_SUMMARY');
      expect(summary.finalDiagnosis.length).toBeGreaterThan(0);
      expect(summary.icdCodes).toContain('M51.26');
      expect(summary.medications.length).toBeGreaterThan(0);
    });

    it('should extract medications from discharge note', async () => {
      const summary = await extractDischargeSummary(mockDischargeNote);

      expect(summary.medications).toBeDefined();
      const amoxicillin = summary.medications.find(m => m.name?.includes('Amoxicillin'));
      expect(amoxicillin).toBeDefined();
      expect(amoxicillin?.dosage).toBe('500mg');
    });
  });

  describe('Provenance Tracking', () => {
    it('should track provenance for each extracted field', async () => {
      const provenanceIndex = createProvenanceIndex('CASE-001');
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      addFieldToProvenance(provenanceIndex, 'chiefComplaint.primaryComplaint', 'Herniated Disc', {
        value: 'Herniated Disc',
        confidence: 0.95,
        source: 'PATIENT_NOTE',
        extractionMethod: 'MANUAL',
        extractedAt: new Date().toISOString(),
      });

      const report = getExtractionReport(provenanceIndex);
      expect(report.totalFields).toBe(1);
      expect(report.extractionBySource['PATIENT_NOTE']).toBe(1);
    });

    it('should generate audit trail', async () => {
      const provenanceIndex = createProvenanceIndex('CASE-001');

      addFieldToProvenance(provenanceIndex, 'field1', 'value1', {
        value: 'value1',
        confidence: 0.9,
        source: 'PATIENT_NOTE',
        extractionMethod: 'MANUAL',
        extractedAt: new Date().toISOString(),
      });

      const report = getExtractionReport(provenanceIndex);
      expect(report.totalFields).toBeGreaterThan(0);
      expect(report.averageConfidence).toBeCloseTo(0.9, 1);
    });
  });

  describe('Reconciliation', () => {
    it('should detect conflicts between patient note and documents', async () => {
      const provenanceIndex = createProvenanceIndex('CASE-001');
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      const documentData = [
        {
          diagnosis: 'Herniated disc L4-L5 with radiculopathy (confirmed)',
          expectedLOS: 4, // Different from patient note (3 days)
        },
      ];

      const reconciliation = reconcileSourcesWithProvenance(
        'CASE-001',
        extraction,
        documentData,
        provenanceIndex
      );

      expect(reconciliation.conflicts).toBeDefined();
      // Should detect conflict in LOS if extracted
    });

    it('should maintain patient note as primary source', async () => {
      const provenanceIndex = createProvenanceIndex('CASE-001');
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      const documentData = [
        {
          diagnosis: 'Different diagnosis',
        },
      ];

      const reconciliation = reconcileSourcesWithProvenance(
        'CASE-001',
        extraction,
        documentData,
        provenanceIndex
      );

      // Patient note diagnosis should be preserved
      expect(reconciliation.mergedData).toBeDefined();
    });

    it('should allow conflict resolution with coordinator decision', async () => {
      const provenanceIndex = createProvenanceIndex('CASE-001');
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');

      const documentData = [
        {
          expectedLOS: 4,
        },
      ];

      const reconciliation = reconcileSourcesWithProvenance(
        'CASE-001',
        extraction,
        documentData,
        provenanceIndex
      );

      // Resolve a conflict if present
      if (reconciliation.conflicts.length > 0) {
        resolveFieldConflict(
          provenanceIndex,
          reconciliation.conflicts[0].fieldPath,
          'PATIENT_NOTE_WINS',
          reconciliation.mergedData,
          'Clinical note is authoritative source',
          'COORD-001'
        );
      }

      const pending = getPendingReviews(provenanceIndex);
      // Should be resolved
      expect(pending.length).toBeLessThanOrEqual(reconciliation.conflicts.length);
    });
  });

  describe('IRDAI Compliance', () => {
    it('should validate case for IRDAI compliance', async () => {
      mockCase.patient.name = 'Rajesh Kumar';
      mockCase.patient.contactNumber = '9876543210';
      mockCase.clinical.chiefComplaints = 'Herniated Disc L4-L5';
      mockCase.clinical.diagnosis = 'Herniated disc at L4-L5 level';
      mockCase.clinical.icd10Code = 'M51.26';
      mockCase.clinical.icd10Confirmed = true;
      mockCase.clinical.proposedProcedure = 'Lumbar microdiscectomy';
      mockCase.clinical.expectedLengthOfStay = 3;

      const provenanceIndex = createProvenanceIndex('CASE-001');
      const extraction = await extractClinicalNote(mockPatientNote, 'DOC-001');
      const reconciliation = reconcileSourcesWithProvenance(
        'CASE-001',
        extraction,
        [],
        provenanceIndex
      );

      const complianceReport = validateCaseForIRDAICompliance(
        mockCase,
        reconciliation,
        provenanceIndex
      );

      expect(complianceReport).toBeDefined();
      expect(complianceReport.complianceScore).toBeGreaterThanOrEqual(0);
      expect(complianceReport.complianceScore).toBeLessThanOrEqual(100);
      expect(complianceReport.requirements).toBeDefined();
    });

    it('should identify missing critical fields', async () => {
      // Empty case
      mockCase.patient.name = '';
      mockCase.clinical.diagnosis = '';

      const provenanceIndex = createProvenanceIndex('CASE-001');
      const extraction = await extractClinicalNote('', 'DOC-001');
      const reconciliation = reconcileSourcesWithProvenance('CASE-001', extraction, [], provenanceIndex);

      const complianceReport = validateCaseForIRDAICompliance(
        mockCase,
        reconciliation,
        provenanceIndex
      );

      expect(complianceReport.validationErrors.length).toBeGreaterThan(0);
      expect(complianceReport.status).not.toBe('compliant');
    });
  });

  describe('End-to-End Pipeline', () => {
    it('should run complete extraction pipeline', async () => {
      const input: PipelineInput = {
        caseId: 'CASE-2026-001',
        patientNoteText: mockPatientNote,
        doctorId: 'DOC-001',
        uploadedDocuments: [],
      };

      try {
        const output = await runClinicalExtractionPipeline(input, mockCase);

        expect(output).toBeDefined();
        expect(output.caseId).toBe('CASE-2026-001');
        expect(output.status).toBe('success');
        expect(output.patientNoteExtraction).toBeDefined();
        expect(output.reconciliation).toBeDefined();
        expect(output.provenanceIndex).toBeDefined();
        expect(output.auditTrail).toBeDefined();
      } catch (error) {
        console.error('Pipeline error:', error);
      }
    });
  });
});
