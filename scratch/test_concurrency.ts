import { generateDenialAppeal } from '../engine/denialAppealGenerator';

const recordGastro: any = {
  id: 'CASE-GASTRO',
  admission: { admissionType: 'Emergency' },
  costEstimate: { amountClaimedFromInsurer: 50000 },
  clinical: {
    diagnoses: [{ diagnosis: 'Acute Gastroenteritis with Severe Dehydration', isPrimary: true, icd10Code: 'A09.9' }],
    chiefComplaints: 'Patient presented with severe "watery diarrhea" for 3 days and recurrent vomiting. States "I cannot keep any fluids down" since yesterday.',
    historyOfPresentIllness: 'Multiple episodes of non-bloody diarrhea. Patient appears visibly lethargic. Skin turgor is decreased and mucous membranes are dry.',
    relevantClinicalFindings: 'BP 80/50 mmHg (Shock), Pulse 120 bpm (Thready). Labs reveal AKI with creatinine 2.1. 15+ episodes of profuse watery diarrhea. Sunken eyes, dry tongue.'
  }
};

const recordTyphoid: any = {
  id: 'CASE-TYPHOID',
  admission: { admissionType: 'Emergency' },
  costEstimate: { amountClaimedFromInsurer: 45000 },
  clinical: {
    diagnoses: [{ diagnosis: 'Typhoid Fever / Enteric Fever', isPrimary: true, icd10Code: 'A01.0' }],
    chiefComplaints: 'Patient presented with high-grade fever (103F) for 5 days, severe abdominal pain, and extreme weakness.',
    historyOfPresentIllness: 'Fever is continuous, not relieved by paracetamol. Patient has severe headache and loss of appetite. Started vomiting yesterday.',
    relevantClinicalFindings: 'Widal O: 1:320, H: 1:320. TyphiDot: IgM Positive. CBC: Leukopenia (WBC 3,500). Mild splenomegaly on USG.'
  }
};

const report: any = {
  status: 'insufficient',
  requiredEvidence: [
    { item: 'Clinical documentation details', present: true, source: 'anchor' }
  ],
  insufficientEvidence: [],
  anticipatedQueries: []
};

async function runTest(id: number, record: any, denialReasonText: string) {
  console.log(`[Request ${id}] Started...`);
  try {
    const appeal = await generateDenialAppeal(denialReasonText, record, report);
    console.log(`[Request ${id}] Completed. Cited: ${appeal.citedEvidence.length}, Missing: ${appeal.stillMissing.length}, Boilerplate: ${appeal.appealText.includes("No denial reasons could be matched to existing clinical evidence")}`);
    if (appeal.citedEvidence.length === 0 && appeal.stillMissing.length === 0) {
      console.log(`[Request ${id}] FULLY EMPTY SIGNATURE DETECTED! []/[]`);
    }
  } catch (err: any) {
    console.log(`[Request ${id}] Errored: ${err.message}`);
  }
}

async function main() {
  const promises: Promise<void>[] = [];
  
  for (let i = 1; i <= 6; i++) {
    promises.push(runTest(i, recordGastro, "Claim denied as hospitalization is under 24 hours and patient could have been managed on an OPD basis with ORS."));
  }
  for (let i = 7; i <= 12; i++) {
    promises.push(runTest(i, recordTyphoid, "Widal test is non-specific and lacks diagnostic accuracy for inpatient admission. Fever could be viral."));
  }

  await Promise.all(promises);
  console.log("All requests completed.");
}

main().catch(console.error);
