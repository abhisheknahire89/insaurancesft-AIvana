import { generateDenialAppeal } from '../engine/denialAppealGenerator';

const recordMock: any = {
  id: 'CASE-STEP3',
  admission: { admissionType: 'Emergency' },
  costEstimate: { amountClaimedFromInsurer: 10000 },
  clinical: {
    diagnoses: [{ diagnosis: 'Mock Disease', isPrimary: true, icd10Code: 'X99' }],
    chiefComplaints: 'Patient arrived complaining of severe headache, nausea, and blurry vision for 3 days.',
    historyOfPresentIllness: 'The patient has a known history of hypertension and diabetes. The symptoms started abruptly while at work.',
    relevantClinicalFindings: 'Patient is conscious but disoriented. BP 180/110. Pulse 90. Temperature 98.6F.'
  }
};

const reportMock: any = {
  status: 'insufficient',
  requiredEvidence: [
    { item: "BP 180/110", present: true, source: "anchor" },
    { item: "Severe headache", present: true, source: "anchor" },
    { item: "CT Scan showing hemorrhage", present: false, source: "discriminator", forChallenge: "is the stated diagnosis supported by documented findings?" },
    { item: "Consultation note from neurologist", present: false, source: "discriminator", forChallenge: "is the stated diagnosis supported by documented findings?" }
  ],
  insufficientEvidence: [
    "CT Scan showing hemorrhage",
    "Consultation note from neurologist"
  ],
  anticipatedQueries: []
};

// Provide a denial reason that explicitly mentions both a present and a missing aspect to give the LLM a chance to match
const reasonText = "Claim denied. Hypertension alone does not justify emergency admission without proof of hemorrhage on CT or a neurologist consultation.";

async function runTestLive() {
  console.log(`\n--- TESTING: STEP 3 CONTROLLED COMPARISON ---`);
  try {
    const appeal = await generateDenialAppeal(reasonText, recordMock, reportMock);
    console.log(`citedEvidence:\n${JSON.stringify(appeal.citedEvidence, null, 2)}`);
    console.log(`stillMissing:\n${JSON.stringify(appeal.stillMissing, null, 2)}`);
  } catch (e: any) {
    console.log(`Threw Error: ${e.message}`);
  }
}

runTestLive().catch(console.error);
