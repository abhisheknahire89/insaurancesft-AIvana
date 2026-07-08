import { generateDenialAppeal } from '../engine/denialAppealGenerator';
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

async function run() {
  const content = '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor"}],\n  "stillMissing": [{';
  setMockQuery(async () => content);
  try {
    const appeal = await generateDenialAppeal("Claim denied", recordGastro, report);
    console.log("Success! citedEvidence:", appeal.citedEvidence);
  } catch (e) {
    console.log("Threw out:", e);
  }
}
run();
