import * as fs from 'fs';
import * as path from 'path';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';
import { setMockQuery } from '../services/llmClient';

// 9 Malformed-Input Parser Cases from Aegis Work
const parserTestCases = [
  {
    name: 'Truncated mid-array',
    content: '{\n  "citedEvidence": [\n    {\n      "denialReason": "Claim denied",\n      "evidenceItem": "Shock",\n      "source": "anchor"'
  },
  {
    name: 'Missing closing bracket',
    content: '{\n  "citedEvidence": [],\n  "stillMissing": []'
  },
  {
    name: 'Prose before JSON',
    content: 'Here is the JSON:\n```json\n{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor", "forChallenge": null}],\n  "stillMissing": [],\n  "appealTextBody": "Dear Sir, ..." \n}\n```'
  },
  {
    name: 'Prose after JSON',
    content: '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor", "forChallenge": null}],\n  "stillMissing": [],\n  "appealTextBody": "Dear Sir, ..." \n}\nThis was a hard case.'
  },
  {
    name: 'Unescaped quote in string',
    content: '{\n  "citedEvidence": [{"denialReason": "Claim denied as \\"hospitalization\\" is short", "evidenceItem": "Shock", "source": "anchor", "forChallenge": null}],\n  "stillMissing": [],\n  "appealTextBody": "Dear Sir, ..." \n}'
  },
  {
    name: 'Unescaped quote at start of string',
    content: '{\n  "citedEvidence": [{"denialReason": "\\"Claim denied\\"", "evidenceItem": "Shock", "source": "anchor", "forChallenge": null}],\n  "stillMissing": [],\n  "appealTextBody": "Dear Sir, ..." \n}'
  },
  {
    name: 'Valid citedEvidence, truncated stillMissing',
    content: '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor", "forChallenge": null}],\n  "stillMissing": [{'
  },
  {
    name: 'Plain prose (no JSON)',
    content: 'The patient was admitted for gastroenteritis. There is no evidence.'
  },
  {
    name: 'Trailing Text (Original task)',
    content: '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor", "forChallenge": null}],\n  "stillMissing": [],\n  "appealTextBody": "Dear Sir, ..."\n}\nThis was a hard case.'
  }
];

const recordGastro: any = {
  id: 'CASE-GASTRO-TEST',
  admission: { admissionType: 'Emergency' },
  costEstimate: { amountClaimedFromInsurer: 50000 },
  clinical: {
    diagnoses: [{ diagnosis: 'Acute Gastroenteritis', isPrimary: true, icd10Code: 'A09.9' }],
    chiefComplaints: 'watery diarrhea',
    historyOfPresentIllness: 'lethargic',
    relevantClinicalFindings: 'Shock'
  }
};

const reportGastro: any = {
  status: 'insufficient',
  requiredEvidence: [
    { item: 'watery diarrhea', present: true, source: 'anchor' },
    { item: 'Shock', present: true, source: 'discriminator' }
  ],
  insufficientEvidence: [],
  anticipatedQueries: []
};

const case24936 = {
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
  } as any,
  evidenceReport: {
    status: 'SUFFICIENT',
    requiredEvidence: [
      { item: 'MRI Brain confirming acute infarct in right MCA territory', present: true, source: 'anchor' },
      { item: 'Neurological deficit with NIHSS score of 12', present: true, source: 'discriminator', forChallenge: 'Severity of stroke requiring inpatient care' },
      { item: 'No history of previous strokes or TIAs explicitly documented', present: true, source: 'anchor' }
    ],
    insufficientEvidence: [],
    anticipatedQueries: []
  } as any
};

const case20984 = {
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
  } as any,
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
  } as any
};

async function testMockParsers() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING 9 MALFORMED-INPUT PARSER TESTS (MOCKED)');
  console.log('======================================================');
  
  for (const tc of parserTestCases) {
    console.log(`\n--- Test Case: "${tc.name}" ---`);
    setMockQuery(async () => tc.content);
    try {
      const appeal = await generateDenialAppeal("Pre-auth denied", recordGastro, reportGastro);
      console.log(`Result: SUCCESS (cited: ${appeal.citedEvidence.length}, missing: ${appeal.stillMissing.length})`);
    } catch (err: any) {
      console.log(`Result: THREW ERROR: ${err.message}`);
    }
  }
}

async function runLiveTest(isLocal: boolean) {
  const modeName = isLocal ? 'LOCAL MEDGEMMA' : 'LIVE GEMINI FALLBACK';
  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING LIVE COMPLEX CASES ON ${modeName}`);
  console.log(`======================================================`);

  if (isLocal) {
    process.env.VITE_MEDGEMMA_ENDPOINT_URL = 'http://127.0.0.1:11434/v1/chat/completions';
  } else {
    delete process.env.VITE_MEDGEMMA_ENDPOINT_URL;
  }

  // Bypass cache
  const cachePath = path.join(process.cwd(), 'scripts', 'llm_cache.json');
  const tempCachePath = path.join(process.cwd(), 'scripts', 'llm_cache_temp.json');
  let cacheFileRenamed = false;
  if (fs.existsSync(cachePath)) {
    fs.renameSync(cachePath, tempCachePath);
    cacheFileRenamed = true;
  }

  try {
    setMockQuery(null); // Clear mock

    // 1. Run Case 24936
    console.log('\n--- Running Case 24936 (Stroke / PED) ---');
    const start1 = Date.now();
    const appeal1 = await generateDenialAppeal(case24936.denialReasonText, case24936.record, case24936.evidenceReport);
    const latency1 = Date.now() - start1;
    console.log(`Latency: ${(latency1 / 1000).toFixed(2)}s`);
    console.log(`Cited Evidence: ${JSON.stringify(appeal1.citedEvidence, null, 2)}`);
    console.log(`Still Missing: ${JSON.stringify(appeal1.stillMissing, null, 2)}`);
    console.log(`Appeal Letter Body Length: ${appeal1.appealText?.length || 0} characters`);

    // 2. Run Case 20984
    console.log('\n--- Running Case 20984 (Gastroenteritis / Resuscitation) ---');
    const start2 = Date.now();
    const appeal2 = await generateDenialAppeal(case20984.denialReasonText, case20984.record, case20984.evidenceReport);
    const latency2 = Date.now() - start2;
    console.log(`Latency: ${(latency2 / 1000).toFixed(2)}s`);
    console.log(`Cited Evidence: ${JSON.stringify(appeal2.citedEvidence, null, 2)}`);
    console.log(`Still Missing: ${JSON.stringify(appeal2.stillMissing, null, 2)}`);
    console.log(`Appeal Letter Body Length: ${appeal2.appealText?.length || 0} characters`);

  } finally {
    if (cacheFileRenamed && fs.existsSync(tempCachePath)) {
      fs.renameSync(tempCachePath, cachePath);
    }
  }
}

async function runAll() {
  // Test mock parser compatibility to ensure fallback parser works
  await testMockParsers();

  // Test live Gemini path (Step 4)
  await runLiveTest(false);

  // Test local path (Step 5)
  await runLiveTest(true);
}

runAll().catch(console.error);
