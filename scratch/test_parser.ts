import { generateDenialAppeal } from './denialAppealGenerator_fixed';
import { setMockQuery } from '../services/llmClient';

const recordGastro: any = {
  id: 'CASE-GASTRO',
  admission: { admissionType: 'Emergency' },
  costEstimate: { amountClaimedFromInsurer: 50000 },
  clinical: {
    diagnoses: [{ diagnosis: 'Acute Gastroenteritis', isPrimary: true, icd10Code: 'A09.9' }],
    chiefComplaints: 'watery diarrhea',
    historyOfPresentIllness: 'lethargic',
    relevantClinicalFindings: 'Shock'
  }
};
const report: any = {
  status: 'insufficient',
  requiredEvidence: [],
  insufficientEvidence: [],
  anticipatedQueries: []
};
const reasonText = "Claim denied as hospitalization is under 24 hours.";

const tc = {
  name: 'Missing closing bracket',
  content: '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor"}],\n  "stillMissing": []'
};

async function runTestB() {
  console.log(`\n--- TESTING: ${tc.name} ---`);
  setMockQuery(async () => tc.content);
  try {
    const appeal = await generateDenialAppeal(reasonText, recordGastro, report);
    console.log(`citedEvidence length: ${appeal.citedEvidence.length}`);
    console.log(`stillMissing length: ${appeal.stillMissing.length}`);
  } catch (e: any) {
    console.log(`Threw Error: ${e.message}`);
  }
}

runTestB().catch(console.error);
