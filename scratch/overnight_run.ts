import * as fs from 'fs';
import * as path from 'path';
import { getGoogleGenAIClient } from '../services/apiKeys';
import { MODEL_TEXT } from '../config/modelConfig';
import { assignICDViaModel } from '../services/icdService';
import { reviewEvidence } from '../engine/evidenceReview';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';

const ai = getGoogleGenAIClient();
const LOG_DIR = path.join(process.cwd(), 'logs/overnight_run');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Load ICD codes for validation
const icd10CodesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/icd10Codes.json'), 'utf8'));
const validIcdCodes = new Set(icd10CodesData.codes.map((c: any) => c.code));

const manifest: any[] = [];
const maxRunTimeMs = 3 * 60 * 60 * 1000;
const startTimeMs = Date.now();

// Utility to write batch data and update manifest
function startBatch(batchName: string, batchNumber: number, cases: any[], blindMode: boolean, batchStartTimeMs: number) {
  const batchFile = path.join(LOG_DIR, `batch_${batchNumber}_raw.jsonl`);
  // Clear file and write inputs
  fs.writeFileSync(batchFile, '');
  for (const c of cases) {
    fs.appendFileSync(batchFile, JSON.stringify(c) + '\n');
  }
}

function endBatch(batchName: string, batchNumber: number, cases: any[], blindMode: boolean, batchStartTimeMs: number) {
  const batchFile = path.join(LOG_DIR, `batch_${batchNumber}_raw.jsonl`);
  // Overwrite with inputs + outputs
  fs.writeFileSync(batchFile, '');
  for (const c of cases) {
    fs.appendFileSync(batchFile, JSON.stringify(c) + '\n');
  }
  
  // Remove existing manifest entry if restarting/overwriting
  const existingIdx = manifest.findIndex(m => m.batchNumber === batchNumber);
  if (existingIdx !== -1) manifest.splice(existingIdx, 1);
  
  manifest.push({
    batchNumber,
    batchName,
    caseCount: cases.length,
    startTime: new Date(batchStartTimeMs).toISOString(),
    endTime: new Date().toISOString(),
    blindMode
  });
  fs.writeFileSync(path.join(LOG_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function checkTimeBudget() {
  if (Date.now() - startTimeMs > maxRunTimeMs) {
    console.log("TIME BUDGET EXCEEDED. Stopping overnight run.");
    process.exit(0);
  }
}

// ----------------------------------------------------
// GENERATION HELPERS
// ----------------------------------------------------
async function generateCases(prompt: string, expectedCount: number, maxRetries = 3): Promise<any[]> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: { temperature: 0.7, responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(response.text || '[]');
      if (Array.isArray(parsed) && parsed.length >= expectedCount / 2) return parsed;
    } catch (e) {
      console.log(`Generation failed, retry ${i + 1}/${maxRetries}...`);
    }
  }
  return [];
}


  async function runBatch1and2() {
  const batchStart = Date.now();
  console.log("Starting Batch 1 & 2: Taiga 10 categories");
  const categories = [
    { name: 'ophthalmology', gated: true },
    { name: 'maternity', gated: true },
    { name: 'gynecology', gated: false },
    { name: 'orthopedics', gated: false },
    { name: 'ckd', gated: false },
    { name: 'dengue', gated: false },
    { name: 'typhoid', gated: false },
    { name: 'appendicitis', gated: false },
    { name: 'gastroenteritis', gated: false },
    { name: 'cardiac', gated: false }
  ];

  let casesForBatch: any[] = [];
  for (const cat of categories) {
    checkTimeBudget();
    console.log(`Generating 10 cases for ${cat.name}...`);
    const prompt = `Generate an array of 10 highly realistic, fictional patient inpatient cases for Indian hospitals, strictly representing the category: ${cat.name}.
Each case must have:
- "id": a unique string ID
- "clinical": { "diagnosis": "...", "chiefComplaints": "...", "hpi": "..." }
- "expectedAnswer": { "primaryICD10": "exact code", "category": "${cat.name}", "isGated": ${cat.gated} }

Return JSON array.`;
    
    let genCases = await generateCases(prompt, 10);
    // Validate ICDs
    genCases = genCases.filter(c => {
      const code = c.expectedAnswer?.primaryICD10;
      if (!code || !validIcdCodes.has(code)) {
        console.log(`[Batch 1/2] Discarding case due to invalid ICD: ${code}`);
        return false;
      }
      return true;
    });

    
    for (const c of genCases) {
      const input = { diagnosis: c.clinical.diagnosis, clinicalText: c.clinical.chiefComplaints + " " + c.clinical.hpi };
      c.runInput = input;
      casesForBatch.push(c);
    }
  }
  
  // Safe to disk before running
  startBatch("Taiga 10 Categories", 1, casesForBatch, true, batchStart);
  
  for (const c of casesForBatch) {
      try {
        process.env.BLIND_MODE = 'true';
        const result = await assignICDViaModel(c.runInput.diagnosis, c.runInput.clinicalText);
        c.runOutput = result;
        c.pass = result.some((r: any) => r.code === c.expectedAnswer.primaryICD10);
      } catch (err: any) {
        c.error = err.message;
        c.pass = false;
      }
  }
    endBatch("Taiga 10 Categories", 1, casesForBatch, true, batchStart);
}


  async function runBatch3() {
  const batchStart = Date.now();
  console.log("Starting Batch 3: Taiga Stress Test (Ambiguous/Generic)");
  checkTimeBudget();
  const prompt = `Generate an array of 15 fictional patient inpatient cases with ambiguous diagnoses or generic symptoms (like 'body pain', 'dehydration', 'fever', 'unknown condition') that don't easily fit a strict category, or could fit multiple.
Each case must have:
- "id": a unique string ID
- "clinical": { "diagnosis": "...", "chiefComplaints": "...", "hpi": "..." }
- "expectedAnswer": { "primaryICD10": "valid code from WHO ICD-10" }

Return JSON array.`;
  
  let genCases = await generateCases(prompt, 15);
  genCases = genCases.filter(c => validIcdCodes.has(c.expectedAnswer?.primaryICD10));

  for (const c of genCases) {
    const input = { diagnosis: c.clinical.diagnosis, clinicalText: c.clinical.chiefComplaints + " " + c.clinical.hpi };
    c.runInput = input;
  }
  
  startBatch("Taiga Stress Test Ambiguous", 3, genCases, true, batchStart);
  
  for (const c of genCases) {
    try {
      process.env.BLIND_MODE = 'true';
      const result = await assignICDViaModel(c.runInput.diagnosis, c.runInput.clinicalText);
      c.runOutput = result;
    } catch (err: any) {
      c.error = err.message;
    }
  }
    endBatch("Taiga Stress Test Ambiguous", 3, genCases, true, batchStart);
}


  async function runBatch4() {
  const batchStart = Date.now();
  console.log("Starting Batch 4: Taiga Quote-Escaping Stress Test");
  checkTimeBudget();
  const prompt = `Generate 10 fictional patient inpatient cases where the clinical narrative (chiefComplaints or hpi) explicitly contains patient statements wrapped in DOUBLE QUOTES. (e.g. Patient stated "I can't breathe").
Each case must have:
- "id": a unique string ID
- "clinical": { "diagnosis": "...", "chiefComplaints": "...", "hpi": "..." }
- "expectedAnswer": { "primaryICD10": "valid WHO code" }

Return JSON array.`;
  
  let genCases = await generateCases(prompt, 10);
  genCases = genCases.filter(c => validIcdCodes.has(c.expectedAnswer?.primaryICD10));

  for (const c of genCases) {
    const input = { diagnosis: c.clinical.diagnosis, clinicalText: c.clinical.chiefComplaints + " " + c.clinical.hpi };
    c.runInput = input;
  }
  
  startBatch("Taiga Quote Escaping", 4, genCases, true, batchStart);
  
  for (const c of genCases) {
    try {
      process.env.BLIND_MODE = 'true';
      const result = await assignICDViaModel(c.runInput.diagnosis, c.runInput.clinicalText);
      c.runOutput = result;
    } catch (err: any) {
      c.error = err.message;
    }
  }
    endBatch("Taiga Quote Escaping", 4, genCases, true, batchStart);
}


  async function runBatch5and6() {
  const batchStart = Date.now();
  console.log("Starting Batch 5 & 6: Fairway Controls");
  checkTimeBudget();
  const prompt = `Generate 20 inpatient cases (10 with completely perfect/sufficient medical documentation, and 10 intentionally missing ONE crucial specific piece of evidence for the diagnosis).
For the missing evidence ones, state EXACTLY what is missing in expectedAnswer.missingItem.
Return JSON array matching:
[
  {
    "id": "...",
    "type": "sufficient" | "incomplete",
    "clinical": {
       "diagnoses": [{ "diagnosis": "...", "icd10Code": "...", "isPrimary": true }],
       "patient": { "patientName": "Ramesh", "age": 40, "gender": "Male" },
       "insurance": { "tpaName": "Medi Assist", "insurerName": "Star Health", "policyNumber": "POL-123" },
       "reasonForHospitalisation": "...",
       "lineOfTreatment": ["..."],
       "chiefComplaints": "...",
       "hpi": "...",
       "pastHistory": "...",
       "relevantClinicalFindings": "...",
       "proposedSurgicalProcedure": "...",
       "roomCategory": "...",
       "expectedLos": 3
    },
    "expectedAnswer": { "missingItem": "..." } // null if sufficient
  }
]`;
  const genCases = await generateCases(prompt, 20);
  for (const c of genCases) {
    c.runInput = c.clinical;
  }
  
  startBatch("Fairway Controls", 5, genCases, true, batchStart);
  
  for (const c of genCases) {
    try {
      process.env.BLIND_MODE = 'true';
      const result = await reviewEvidence(c.runInput as any);
      c.runOutput = result;
      if (c.type === 'sufficient') {
        c.pass = result.status === 'sufficient';
      } else {
        c.pass = result.status === 'insufficient';
      }
    } catch (err: any) {
      c.error = err.message;
      c.pass = false;
    }
  }
    endBatch("Fairway Controls", 5, genCases, true, batchStart);
}


  async function runBatch7() {
  const batchStart = Date.now();
  console.log("Starting Batch 7: Aegis Quote-Escaping");
  checkTimeBudget();
  const prompt = `Generate 5 fictional patient cases where clinical narrative has DOUBLE QUOTES (e.g. Patient said "severe pain").
Return JSON:
[
  {
    "id": "...",
    "denialReason": "Claim denied due to short stay",
    "record": {
      "clinical": {
        "chiefComplaints": "Patient stated \\\"severe pain\\\"",
        "hpi": "Admitted with \\\"crushing\\\" chest pain.",
        "relevantClinicalFindings": "...",
        "diagnoses": [{ "diagnosis": "...", "icd10Code": "...", "isPrimary": true }]
      },
      "patient": { "patientName": "John Doe", "age": 45, "gender": "Male" },
      "insurance": { "tpaName": "Medi Assist", "insurerName": "Star Health", "policyNumber": "POL-123" }
    }
  }
]`;
  const genCases = await generateCases(prompt, 5);
  for (const c of genCases) {
    c.runInput = { denialReason: c.denialReason, record: c.record };
  }
  
  startBatch("Aegis Quotes (Unfixed)", 7, genCases, true, batchStart);
  
  for (const c of genCases) {
    try {
      process.env.BLIND_MODE = 'true';
      // Run through unfixed denialAppealGenerator
      const result = await generateDenialAppeal(c.runInput.denialReason, c.runInput.record as any, { requiredEvidence: [] } as any);
      c.runOutput = result;
      c.pass = (result.citedEvidence && result.citedEvidence.length > 0) || (result.stillMissing && result.stillMissing.length > 0);
    } catch (err: any) {
      c.error = err.message;
      c.pass = false;
    }
  }
    endBatch("Aegis Quotes (Unfixed)", 7, genCases, true, batchStart);
}


  async function runBatch8() {
  const batchStart = Date.now();
  console.log("Starting Batch 8: Taiga Insurer Edge Cases");
  checkTimeBudget();
  const prompt = `Generate 10 inpatient cases specifically using obscure or unlisted Insurers (e.g., 'Navi General', 'Zuno General', 'Cholamandalam MS').
Return JSON:
[
  {
    "id": "...",
    "insurance": { "insurerName": "Navi General", "tpaName": "HealthIndia TPA" },
    "clinical": { "diagnosis": "...", "chiefComplaints": "...", "hpi": "..." },
    "expectedAnswer": { "primaryICD10": "valid WHO code" }
  }
]`;
  let genCases = await generateCases(prompt, 10);
  genCases = genCases.filter(c => validIcdCodes.has(c.expectedAnswer?.primaryICD10));

  for (const c of genCases) {
    const input = { diagnosis: c.clinical.diagnosis, clinicalText: c.clinical.chiefComplaints + " " + c.clinical.hpi };
    c.runInput = input;
  }
  
  startBatch("Taiga Insurer Edge Cases", 8, genCases, true, batchStart);
  
  for (const c of genCases) {
    try {
      process.env.BLIND_MODE = 'true';
      const result = await assignICDViaModel(c.runInput.diagnosis, c.runInput.clinicalText);
      c.runOutput = result;
    } catch (err: any) {
      c.error = err.message;
    }
  }
    endBatch("Taiga Insurer Edge Cases", 8, genCases, true, batchStart);
}

async function main() {
  console.log("Starting overnight run...");
  await runBatch1and2();
  await runBatch3();
  await runBatch4();
  await runBatch5and6();
  await runBatch7();
  await runBatch8();
  console.log("Overnight run completed.");
}

main().catch(console.error);
