/**
 * Clinical Coding Engine - Integration Tests
 *
 * Tests complete end-to-end ICD coding workflow:
 * 1. Case data → Evidence extraction
 * 2. Evidence → ICD candidate generation
 * 3. Candidates → Deterministic validation
 * 4. Valid candidates → AI ranking with confidence
 * 5. Output → Coordinator review format
 */

import { ClinicalCodingEngine } from '../clinicalCodingEngine';
import { ICDKnowledgeBase, KaggleICDBackend } from '../icdKnowledgeBase';
import { ICDDeterministicValidator } from '../icdDeterministicValidator';
import type { Case } from '../caseModel';
import type { ReconciliationResult } from '../reconciliationEngine';

/**
 * Test: Complete ICD coding workflow
 */
export async function testCompleteCodingWorkflow() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   TESTING: COMPLETE CLINICAL CODING WORKFLOW            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Setup
  const knowledgeBase = new ICDKnowledgeBase('2024', 'Test Dataset');
  const backend = new KaggleICDBackend();
  await knowledgeBase.loadCodes(backend);

  const codingEngine = new ClinicalCodingEngine(knowledgeBase);

  // Test Case 1: Herniated Disc (M51.26)
  console.log('📋 TEST CASE 1: Herniated Disc with Radiculopathy\n');

  const case1: Case = {
    id: 'CASE-001',
    patient: {
      name: 'Rajesh Kumar',
      gender: 'Male',
      age: '45',
      dateOfBirth: '1980-05-15',
      contactNumber: '9876543210',
    },
    clinical: {
      diagnosis: 'Herniated disc L4-L5 with radiculopathy',
      chiefComplaints: 'Lower back pain with leg pain radiating to foot',
      admissionDate: '2026-07-22',
      admissionType: 'planned',
      treatingDoctor: 'Dr. Amit Singh',
      proposedProcedure: 'Lumbar microdiscectomy',
      expectedLengthOfStay: 3,
      expectedDaysInICU: 0,
      relevantClinicalFindings: 'MRI shows L4-L5 disc herniation with nerve compression',
      imaging: [
        {
          type: 'MRI',
          findings: 'Herniated nucleus pulposus at L4-L5 level compressing nerve root',
        },
      ],
      labResults: [],
    },
    insurance: {
      policyNumber: 'ICICI/12345/2026',
      copay: 5000,
      deductible: 10000,
    },
    billing: {
      estimatedAmount: 150000,
    },
    authorization: {
      tpaReceiptId: 'TPA-2026-001',
    },
    documents: [],
  };

  const reconciliation1: ReconciliationResult = {
    status: 'completed',
    mergedData: case1.clinical,
    conflictsDetected: 0,
  };

  try {
    console.log('⏳ Generating ICD suggestions...\n');
    const result1 = await codingEngine.generateSuggestions(case1, reconciliation1);

    console.log('✅ RESULTS:\n');
    console.log(`Status: ${result1.codingStatus}`);
    console.log(`Total Suggestions: ${result1.totalSuggestions}`);
    console.log(`High Confidence: ${result1.highConfidenceSuggestions}`);
    console.log(`Review Recommended: ${result1.reviewRecommendedSuggestions}`);
    console.log(`Manual Review Required: ${result1.manualReviewRequiredSuggestions}\n`);

    if (result1.primaryDiagnosis) {
      console.log('PRIMARY DIAGNOSIS:');
      console.log(`  Code: ${result1.primaryDiagnosis.code}`);
      console.log(`  Description: ${result1.primaryDiagnosis.description}`);
      console.log(`  Confidence: ${(result1.primaryDiagnosis.confidence * 100).toFixed(1)}%`);
      console.log(`  Category: ${result1.primaryDiagnosis.confidenceCategory}`);
      console.log(`  Evidence: ${result1.primaryDiagnosis.supportingEvidence.join(', ')}\n`);
    } else {
      console.log('⚠️  No primary diagnosis generated\n');
    }

    if (result1.secondaryDiagnoses.length > 0) {
      console.log('SECONDARY DIAGNOSES:');
      for (const diag of result1.secondaryDiagnoses) {
        console.log(`  • ${diag.code}: ${diag.description}`);
        console.log(`    Confidence: ${(diag.confidence * 100).toFixed(1)}%\n`);
      }
    }

    console.log('COORDINATOR ACTIONS:');
    result1.coordinatorActions.forEach(action => console.log(`  ${action}`));
  } catch (error) {
    console.error('❌ Error in test case 1:', error);
  }

  // Test Case 2: Type 2 Diabetes
  console.log('\n' + '='.repeat(60) + '\n');
  console.log('📋 TEST CASE 2: Type 2 Diabetes with Complications\n');

  const case2: Case = {
    id: 'CASE-002',
    patient: {
      name: 'Priya Sharma',
      gender: 'Female',
      age: '62',
      dateOfBirth: '1962-03-10',
      contactNumber: '9876543211',
    },
    clinical: {
      diagnosis: 'Type 2 diabetes mellitus with diabetic foot ulcer',
      chiefComplaints: 'Non-healing foot ulcer',
      admissionDate: '2026-07-22',
      admissionType: 'emergency',
      treatingDoctor: 'Dr. Neha Patel',
      pastMedicalHistory: 'Diabetes for 15 years, hypertension, coronary artery disease',
      expectedLengthOfStay: 5,
      expectedDaysInICU: 0,
      imaging: [
        {
          type: 'X-ray foot',
          findings: 'No bone involvement, soft tissue infection present',
        },
      ],
      labResults: [
        {
          testName: 'Blood glucose',
          value: '280',
          unit: 'mg/dL',
          status: 'ABNORMAL',
          referenceRange: '70-100',
        },
        {
          testName: 'HbA1c',
          value: '10.2',
          unit: '%',
          status: 'ABNORMAL',
          referenceRange: '<5.7',
        },
      ],
    },
    insurance: {
      policyNumber: 'HDFC/98765/2026',
      copay: 3000,
      deductible: 5000,
    },
    billing: {
      estimatedAmount: 200000,
    },
    authorization: {
      tpaReceiptId: 'TPA-2026-002',
    },
    documents: [],
  };

  const reconciliation2: ReconciliationResult = {
    status: 'completed',
    mergedData: case2.clinical,
    conflictsDetected: 0,
  };

  try {
    console.log('⏳ Generating ICD suggestions...\n');
    const result2 = await codingEngine.generateSuggestions(case2, reconciliation2);

    console.log('✅ RESULTS:\n');
    console.log(`Status: ${result2.codingStatus}`);
    console.log(`Total Suggestions: ${result2.totalSuggestions}`);
    console.log(`High Confidence: ${result2.highConfidenceSuggestions}`);
    console.log(`Review Recommended: ${result2.reviewRecommendedSuggestions}`);
    console.log(`Manual Review Required: ${result2.manualReviewRequiredSuggestions}\n`);

    if (result2.primaryDiagnosis) {
      console.log('PRIMARY DIAGNOSIS:');
      console.log(`  Code: ${result2.primaryDiagnosis.code}`);
      console.log(`  Description: ${result2.primaryDiagnosis.description}`);
      console.log(`  Confidence: ${(result2.primaryDiagnosis.confidence * 100).toFixed(1)}%\n`);
    }

    if (result2.comorbidities.length > 0) {
      console.log('COMORBIDITIES:');
      for (const comorbid of result2.comorbidities) {
        console.log(`  • ${comorbid.code}: ${comorbid.description}`);
        console.log(`    Confidence: ${(comorbid.confidence * 100).toFixed(1)}%\n`);
      }
    }

    console.log('EXTRACTED DETAILS:');
    console.log(`  Primary Diagnosis: ${result2.extractedDetails.primaryDiagnosisText}`);
    console.log(`  Comorbidities: ${result2.extractedDetails.comorbidititesText.join(', ')}`);
  } catch (error) {
    console.error('❌ Error in test case 2:', error);
  }

  // Test Case 3: Hypertension Only (Simple case)
  console.log('\n' + '='.repeat(60) + '\n');
  console.log('📋 TEST CASE 3: Essential Hypertension\n');

  const case3: Case = {
    id: 'CASE-003',
    patient: {
      name: 'Arjun Gupta',
      gender: 'Male',
      age: '58',
      dateOfBirth: '1968-01-20',
      contactNumber: '9876543212',
    },
    clinical: {
      diagnosis: 'Essential hypertension, uncontrolled',
      chiefComplaints: 'High blood pressure, headache',
      admissionDate: '2026-07-22',
      admissionType: 'planned',
      treatingDoctor: 'Dr. Rajesh Reddy',
      pastMedicalHistory: 'HTN for 10 years on antihypertensives',
      expectedLengthOfStay: 2,
      expectedDaysInICU: 0,
      labResults: [
        {
          testName: 'Blood pressure',
          value: '180/110',
          unit: 'mmHg',
          status: 'ABNORMAL',
          referenceRange: '<120/80',
        },
      ],
    },
    insurance: {
      policyNumber: 'ADITYA/54321/2026',
      copay: 2000,
      deductible: 0,
    },
    billing: {
      estimatedAmount: 50000,
    },
    authorization: {
      tpaReceiptId: 'TPA-2026-003',
    },
    documents: [],
  };

  const reconciliation3: ReconciliationResult = {
    status: 'completed',
    mergedData: case3.clinical,
    conflictsDetected: 0,
  };

  try {
    console.log('⏳ Generating ICD suggestions...\n');
    const result3 = await codingEngine.generateSuggestions(case3, reconciliation3);

    console.log('✅ RESULTS:\n');
    console.log(`Status: ${result3.codingStatus}`);
    console.log(`Total Suggestions: ${result3.totalSuggestions}\n`);

    if (result3.primaryDiagnosis) {
      console.log('PRIMARY DIAGNOSIS:');
      console.log(`  Code: ${result3.primaryDiagnosis.code}`);
      console.log(`  Description: ${result3.primaryDiagnosis.description}`);
      console.log(`  Confidence: ${(result3.primaryDiagnosis.confidence * 100).toFixed(1)}%`);
      console.log(`  Ready for approval: ${result3.primaryDiagnosis.confidenceCategory === 'high'}\n`);
    }
  } catch (error) {
    console.error('❌ Error in test case 3:', error);
  }

  console.log('='.repeat(60));
  console.log('✅ ALL TESTS COMPLETED\n');
}

/**
 * Run tests
 */
if (require.main === module) {
  testCompleteCodingWorkflow().catch(console.error);
}

export { testCompleteCodingWorkflow };
