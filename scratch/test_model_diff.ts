import { generateDenialAppeal } from '../engine/denialAppealGenerator';
import { PreAuthRecord } from '../components/PreAuthWizard/types';
import { EvidenceReviewReport } from '../engine/evidenceReview';

const record: PreAuthRecord = {
  id: 'CASE-20984',
  admission: { admissionType: 'Emergency' },
  clinical: {
    diagnoses: [{ diagnosis: 'Typhoid Fever / Enteric Fever', isPrimary: true, icd10Code: 'A01.0' }],
    chiefComplaints: 'Patient presented with high-grade fever (103F) for 5 days, severe abdominal pain, and extreme weakness.',
    historyOfPresentIllness: 'Fever is continuous, not relieved by paracetamol. Patient has severe headache and loss of appetite. Started vomiting yesterday.',
    relevantClinicalFindings: 'Widal O: 1:320, H: 1:320. TyphiDot: IgM Positive. CBC: Leukopenia (WBC 3,500). Mild splenomegaly on USG.'
  }
} as any;

const report: EvidenceReviewReport = {
  status: 'insufficient',
  requiredEvidence: [
    { item: 'Clinical documentation details', present: true, source: 'anchor' }
  ],
  insufficientEvidence: [],
  anticipatedQueries: []
};

async function run() {
  const appeal = await generateDenialAppeal(
    "Widal test is non-specific and lacks diagnostic accuracy for inpatient admission. Fever could be viral.",
    record,
    report
  );
  console.log("Appeal output citedEvidence length:", appeal.citedEvidence.length);
  console.log("citedEvidence:", JSON.stringify(appeal.citedEvidence, null, 2));
  console.log("stillMissing:", JSON.stringify(appeal.stillMissing, null, 2));
  if (appeal.appealText.includes("No denial reasons could be matched to existing clinical evidence")) {
    console.log("BOILERPLATE DETECTED!");
  } else {
    console.log("NO BOILERPLATE.");
  }
}

run().catch(console.error);
