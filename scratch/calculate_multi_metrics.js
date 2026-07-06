import * as fs from 'fs';

const rawLogPath = '/Users/abhishekpravinnahire/V1 tpa insaurance/logs/multi_module_raw.jsonl';
if (!fs.existsSync(rawLogPath)) {
  console.log('No raw logs file found.');
  process.exit(0);
}

const fileContent = fs.readFileSync(rawLogPath, 'utf8').trim();
const lines = fileContent.split('\n').filter(Boolean);

console.log(`Total lines in multi_module_raw: ${lines.length}`);

// We want to filter lines from the current run (caseId >= 24698)
const currentRunCases = lines.map(line => {
  try {
    return JSON.parse(line);
  } catch (e) {
    return null;
  }
}).filter(item => item && item.caseId >= 24698);

console.log(`Cases in current run: ${currentRunCases.length}`);

if (currentRunCases.length === 0) {
  console.log('No cases recorded yet for current run.');
  process.exit(0);
}

// Check the three questions:
// (a) Does the ICD module still return the J18.9/N39.0/T14.8 triple, or any other unrelated code, for any ophthalmic, obstetric, or gynecological case?
// (b) Does the appeal module still fail to cite comorbidity evidence (hypertension, prior stent, bleeding history) that is present in the case's own extraction?
// (c) Does enhancement review still misfire on stays under the relevant minimum duration, or drift generated dates away from the real admission year?

let questionAFailed = false;
let questionBFailed = false;
let questionCFailed = false;

const detailsA = [];
const detailsB = [];
const detailsC = [];

currentRunCases.forEach((item) => {
  const caseId = item.caseId;
  const tc = item.caseDetails || {};
  const diagnosis = (tc.diagnosis || '').toLowerCase();
  const outputs = item.outputs || {};
  const coding = outputs.coding || [];
  const appeal = outputs.appeal || {};
  const enhancement = outputs.enhancement || {};

  // Check Q(a):
  const isEye = diagnosis.includes('cataract') || diagnosis.includes('eye') || diagnosis.includes('phaco') || diagnosis.includes('ophthal');
  const isObstetric = diagnosis.includes('pregnancy') || diagnosis.includes('lscs') || diagnosis.includes('delivery') || diagnosis.includes('maternity');
  const isGyne = diagnosis.includes('fibroid') || diagnosis.includes('hysterectomy') || diagnosis.includes('uterus') || diagnosis.includes('myomectomy');

  if (Array.isArray(coding) && coding.length > 0) {
    const code = coding[0].code.toUpperCase();
    if (isEye && !code.startsWith('H') && code !== 'PENDING ICD-10') {
      questionAFailed = true;
      detailsA.push(`Case ${caseId} (${tc.diagnosis}): Eye matched ${code}`);
    }
    if (isObstetric && !code.startsWith('O') && !code.startsWith('Z') && code !== 'PENDING ICD-10') {
      questionAFailed = true;
      detailsA.push(`Case ${caseId} (${tc.diagnosis}): Obstetric matched ${code}`);
    }
    if (isGyne && !code.startsWith('D') && !code.startsWith('N') && !code.startsWith('Z') && code !== 'PENDING ICD-10') {
      questionAFailed = true;
      detailsA.push(`Case ${caseId} (${tc.diagnosis}): Gynecology matched ${code}`);
    }
  }

  // Check Q(b):
  // Check if case is an appeal needing comorbidity citations
  const hasComorbidities = tc.pastMedicalHistory && (
    tc.pastMedicalHistory.hypertension ||
    tc.pastMedicalHistory.diabetes ||
    tc.pastMedicalHistory.heartDisease ||
    tc.pastMedicalHistory.kidney
  );
  if (item.simulatedDenialReason && hasComorbidities) {
    // Check if appeal letter text cites the comorbidity
    const appealLetter = (appeal.appealLetter || '').toLowerCase();
    const citedHypertension = appealLetter.includes('hypertension') || appealLetter.includes('bp') || appealLetter.includes('blood pressure');
    const citedDiabetes = appealLetter.includes('diabetes') || appealLetter.includes('sugar') || appealLetter.includes('dm');
    const citedHeart = appealLetter.includes('stent') || appealLetter.includes('cad') || appealLetter.includes('heart') || appealLetter.includes('coronary') || appealLetter.includes('angina');
    const citedKidney = appealLetter.includes('kidney') || appealLetter.includes('renal') || appealLetter.includes('nephro') || appealLetter.includes('ckd');

    const expectedCiting = (tc.pastMedicalHistory.hypertension && citedHypertension) ||
                           (tc.pastMedicalHistory.diabetes && citedDiabetes) ||
                           (tc.pastMedicalHistory.heartDisease && citedHeart) ||
                           (tc.pastMedicalHistory.kidney && citedKidney);

    if (!expectedCiting) {
      questionBFailed = true;
      detailsB.push(`Case ${caseId} (${tc.diagnosis}): Appeal failed to cite present comorbidity history.`);
    }
  }

  // Check Q(c):
  // Check stays under minimum duration or date year drift in enhancement review
  const clinicalText = `${tc.diagnosis || ''} ${tc.chiefComplaints || ''} ${tc.hpi || ''}`.toLowerCase();
  const isShortStay = clinicalText.includes('18 hours') || clinicalText.includes('12 hours') || clinicalText.includes('under 24');
  if (isShortStay && enhancement.anticipatedQueries && enhancement.anticipatedQueries.length > 0) {
    questionCFailed = true;
    detailsC.push(`Case ${caseId} (${tc.diagnosis}): Short stay triggered extension queries.`);
  }

  // Check date drift
  if (enhancement.gaps) {
    const hasDriftGap = enhancement.gaps.some(g => g.includes('out of reasonable range') || g.includes('inconsistent with the admission year'));
    if (hasDriftGap) {
      questionCFailed = true;
      detailsC.push(`Case ${caseId} (${tc.diagnosis}): Stay dates triggered date drift gaps.`);
    }
  }
});

console.log('\n--- Task 5 Explicit Questions Validation ---');
console.log(`Q(a) Failed? ${questionAFailed}`);
if (detailsA.length > 0) console.log('Details:', detailsA);

console.log(`Q(b) Failed? ${questionBFailed}`);
if (detailsB.length > 0) console.log('Details:', detailsB);

console.log(`Q(c) Failed? ${questionCFailed}`);
if (detailsC.length > 0) console.log('Details:', detailsC);
