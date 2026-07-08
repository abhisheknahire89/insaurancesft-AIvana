import { generateDenialAppeal } from '../engine/denialAppealGenerator';
import { PreAuthRecord } from '../components/PreAuthWizard/types';
import { EvidenceReviewReport } from '../engine/evidenceReview';

const realisticCases = [
  {
    id: 'CASE-20984-SIM',
    denialReasonText: `Claim is denied due to lack of medical necessity for acute inpatient admission. The submitted clinical documentation, including the emergency department records, does not substantiate the need for hospital level of care. Specifically, the patient presented with "mild abdominal pain" and "nausea" which could have been managed in an observation or outpatient setting. Additionally, the submitted labs do not show significant derangement.`,
    record: {
      id: '20984',
      admission: { admissionType: 'Emergency' },
      clinical: {
        diagnoses: [{ diagnosis: 'Acute Gastroenteritis with Severe Dehydration', isPrimary: true, icd10Code: 'A09' }],
        chiefComplaints: 'Patient presented with severe "watery diarrhea" for 3 days and recurrent vomiting. States "I cannot keep any fluids down" since yesterday.',
        historyOfPresentIllness: 'Multiple episodes of non-bloody diarrhea. Patient appears visibly lethargic. Skin turgor is decreased and mucous membranes are dry.',
        relevantClinicalFindings: 'Tachycardia (HR 120), Hypotension (BP 90/60). Labs reveal AKI with creatinine 2.1.'
      }
    } as PreAuthRecord,
    evidenceReport: {
      status: 'SUFFICIENT',
      requiredEvidence: [
        { item: 'Heart rate of 120 and Blood Pressure of 90/60 documented in vital signs', present: true, source: 'anchor' },
        { item: 'Creatinine of 2.1 indicating Acute Kidney Injury', present: true, source: 'discriminator', forChallenge: 'Is inpatient admission necessary for fluid resuscitation?' },
        { item: 'Decreased skin turgor and dry mucous membranes documented in physical exam', present: true, source: 'anchor' },
        { item: 'Patient statement "I cannot keep any fluids down"', present: true, source: 'anchor' }
      ],
      insufficientEvidence: [],
      anticipatedQueries: []
    } as EvidenceReviewReport
  },
  {
    id: 'CASE-20988-SIM',
    denialReasonText: `Admission is not justified. The patient's presentation of "chest discomfort" was evaluated and troponins were negative. ECG did not show acute ischemic changes. The admission for rule out myocardial infarction is denied as it does not meet InterQual criteria for inpatient care. Patient was hemodynamically stable.`,
    record: {
      id: '20988',
      admission: { admissionType: 'Emergency' },
      clinical: {
        diagnoses: [{ diagnosis: 'Unstable Angina', isPrimary: true, icd10Code: 'I20.0' }],
        chiefComplaints: 'Crushing "elephant on chest" pain radiating to left arm.',
        historyOfPresentIllness: 'Pain started while climbing stairs. Patient states "it felt like a heart attack". Nitroglycerin given in ER relieved pain partially.',
        relevantClinicalFindings: 'ECG shows T-wave inversions in V1-V4. Patient has history of CAD with previous stent.'
      }
    } as PreAuthRecord,
    evidenceReport: {
      status: 'SUFFICIENT',
      requiredEvidence: [
        { item: 'ECG demonstrating T-wave inversions in leads V1-V4', present: true, source: 'anchor' },
        { item: 'History of CAD with prior stent placement', present: true, source: 'discriminator', forChallenge: 'High risk feature requiring monitoring?' },
        { item: 'Nitroglycerin administration in ED with partial relief', present: true, source: 'anchor' }
      ],
      insufficientEvidence: [],
      anticipatedQueries: []
    } as EvidenceReviewReport
  },
  {
    id: 'CASE-20989-SIM',
    denialReasonText: `The request for hospitalization is denied. There is no evidence of a complication that warrants inpatient admission for this routine surgical procedure. The surgery could have been performed on a day-care basis as per the policy guidelines. No "intra-operative complications" are documented in the surgical notes.`,
    record: {
      id: '20989',
      admission: { admissionType: 'Emergency' },
      clinical: {
        diagnoses: [{ diagnosis: 'Acute Appendicitis', isPrimary: true, icd10Code: 'K35.80' }],
        chiefComplaints: 'Severe right lower quadrant pain. Patient yelled "don\'t touch me there" during palpation.',
        historyOfPresentIllness: 'Progressive pain over 24h. Rebound tenderness positive. Fever of 101F.',
        relevantClinicalFindings: 'USG shows inflamed appendix 9mm with peri-appendiceal fluid collection. WBC count elevated at 15,000.'
      }
    } as PreAuthRecord,
    evidenceReport: {
      status: 'SUFFICIENT',
      requiredEvidence: [
        { item: 'USG confirming inflamed appendix (9mm) with peri-appendiceal fluid', present: true, source: 'anchor' },
        { item: 'Elevated WBC count of 15,000', present: true, source: 'discriminator', forChallenge: 'Objective evidence of acute infection' },
        { item: 'Documented fever of 101F and rebound tenderness', present: true, source: 'anchor' }
      ],
      insufficientEvidence: [],
      anticipatedQueries: []
    } as EvidenceReviewReport
  },
  {
    id: 'CASE-24936-SIM',
    denialReasonText: `Denied as Pre-Existing Disease (PED). The patient's history states "hypertension for 5 years" which is a risk factor for the current condition. Since the policy is in its second year, PED waiting period of 36 months applies. Therefore, this claim for ischemic stroke is repudiated under clause 4.1.`,
    record: {
      id: '24936',
      admission: { admissionType: 'Emergency' },
      clinical: {
        diagnoses: [{ diagnosis: 'Acute Ischemic Stroke', isPrimary: true, icd10Code: 'I63.9' }],
        chiefComplaints: 'Sudden onset left-sided weakness and slurred speech.',
        historyOfPresentIllness: 'Symptoms started 2 hours prior to arrival. No history of "previous strokes or TIAs". Known case of HTN on amlodipine.',
        relevantClinicalFindings: 'MRI Brain shows acute infarct in right MCA territory. NIHSS score is 12.'
      }
    } as PreAuthRecord,
    evidenceReport: {
      status: 'SUFFICIENT',
      requiredEvidence: [
        { item: 'MRI Brain confirming acute infarct in right MCA territory', present: true, source: 'anchor' },
        { item: 'Neurological deficit with NIHSS score of 12', present: true, source: 'discriminator', forChallenge: 'Severity of stroke requiring inpatient care' },
        { item: 'No history of previous strokes or TIAs explicitly documented', present: true, source: 'anchor' }
      ],
      insufficientEvidence: [],
      anticipatedQueries: []
    } as EvidenceReviewReport
  },
  {
    id: 'CASE-24943-SIM',
    denialReasonText: `Treatment could be managed on an outpatient basis. Patient admitted for "fever and generalized weakness". Dengue NS1 was positive, but platelets were 120,000 which does not meet the criteria for admission. There were no warning signs like bleeding or severe abdominal pain documented to justify inpatient management.`,
    record: {
      id: '24943',
      admission: { admissionType: 'Emergency' },
      clinical: {
        diagnoses: [{ diagnosis: 'Dengue Fever with Warning Signs', isPrimary: true, icd10Code: 'A97.1' }],
        chiefComplaints: 'High grade fever for 4 days. Patient stated "I feel dizzy when I stand up".',
        historyOfPresentIllness: 'Associated with severe retro-orbital pain and myalgia. Positive Dengue NS1.',
        relevantClinicalFindings: 'Postural hypotension noted. Hematocrit increased by 20%. Platelets 120,000 but dropping from 200,000 yesterday.'
      }
    } as PreAuthRecord,
    evidenceReport: {
      status: 'SUFFICIENT',
      requiredEvidence: [
        { item: 'Postural hypotension and dizziness on standing', present: true, source: 'anchor' },
        { item: 'Hematocrit increased by 20% indicating plasma leakage', present: true, source: 'discriminator', forChallenge: 'Presence of dengue warning signs' },
        { item: 'Dengue NS1 positive result', present: true, source: 'anchor' }
      ],
      insufficientEvidence: [],
      anticipatedQueries: []
    } as EvidenceReviewReport
  }
];

async function run() {
  console.log('--- Generating Appeals ---');
  for (const c of realisticCases) {
    const appeal = await generateDenialAppeal(c.denialReasonText, c.record, c.evidenceReport);
    const hasBoilerplateEmpty = appeal.citedEvidence.length === 0 && appeal.stillMissing.length === 0;
    
    console.log(`Case ${c.id}: ${hasBoilerplateEmpty ? 'EMPTY BOILERPLATE (FAILED)' : 'SUCCESS (' + appeal.citedEvidence.length + ' cited)'}`);
    if (hasBoilerplateEmpty) {
        console.log(`  - Addressed Count: ${appeal.addressedCount} / ${appeal.totalReasons}`);
    } else {
        console.log(`  - Cited: ${JSON.stringify(appeal.citedEvidence)}`);
    }
  }
}

run().catch(console.error);
