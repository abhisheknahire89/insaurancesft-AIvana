import { generateDenialAppeal } from '../engine/denialAppealGenerator';

const recordFibroids: any = {
  id: 'CASE-24936',
  admission: { admissionType: 'Planned' },
  costEstimate: { amountClaimedFromInsurer: 80000 },
  clinical: {
    diagnoses: [{ diagnosis: 'Uterine Fibroids', isPrimary: true, icd10Code: 'D25.9' }],
    chiefComplaints: 'heavy menstrual bleeding, severe abdominal pain',
    historyOfPresentIllness: 'Patient has had a history of menorrhagia. Failed medical management with Tranexamic acid and Hormonal pills over the last few months. Uterus enlarged to 14 weeks size.',
    relevantClinicalFindings: 'Large intramural fibroid measuring 6x5 cm on USG. Hemoglobin: 8.2 g/dL.'
  }
};

const report: any = {
  status: 'insufficient',
  requiredEvidence: [
    { item: "Proposed surgical procedure name (e.g., Myomectomy or Hysterectomy)", present: true, source: "anchor" },
    { item: "Historical ultrasound reports prior to the last 6 months", present: false, source: "anchor" },
    { item: "Pre-operative anesthetic clearance and iron-correction plan", present: false, source: "anchor" },
    { item: "Specific operative plan and intended surgical technique (Laparoscopic vs. Open)", present: true, source: "discriminator", forChallenge: "could this be managed as OPD?" },
    { item: "First consultation note or imaging report that established the presence of fibroids", present: true, source: "discriminator", forChallenge: "could this be a pre-existing condition?" },
    { item: "Menstrual flow quantification (e.g., clot passage or pad count)", present: false, source: "discriminator", forChallenge: "is the stated diagnosis supported by documented findings?" }
  ],
  insufficientEvidence: [
    "Historical ultrasound reports prior to the last 6 months",
    "Pre-operative anesthetic clearance and iron-correction plan",
    "Menstrual flow quantification (e.g., clot passage or pad count)"
  ],
  anticipatedQueries: []
};
const reasonText = "Pre-auth denied as conservative management trial documentation is insufficient for a surgical claim.";

async function runTestLive() {
  console.log(`\n--- TESTING: CASE-24936 ---`);
  try {
    const appeal = await generateDenialAppeal(reasonText, recordFibroids, report);
    console.log(`citedEvidence:\n${JSON.stringify(appeal.citedEvidence, null, 2)}`);
    console.log(`stillMissing:\n${JSON.stringify(appeal.stillMissing, null, 2)}`);
  } catch (e: any) {
    console.log(`Threw Error: ${e.message}`);
  }
}

runTestLive().catch(console.error);
