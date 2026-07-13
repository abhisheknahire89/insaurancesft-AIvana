import { queryMedGemma } from '../services/llmClient';
import { Type } from '@google/genai';

// STEP 1a — Build a real, structured evidence-requirement reference
// Real clinical guidelines for these specific conditions.
const CLINICAL_REFERENCE: Record<string, { id: string; text: string; source: string }[]> = {
  "Cholelithiasis": [
    { id: "EVID_CHOL_01", text: "Ultrasound Abdomen showing gallstones/sludge", source: "ACOG / General Surgery Guidelines" },
    { id: "EVID_CHOL_02", text: "Liver Function Tests (Bilirubin, AST, ALT)", source: "Standard Pre-operative Protocol" },
    { id: "EVID_CHOL_03", text: "Surgical / Operative Plan (Laparoscopic vs Open)", source: "TPA Billing Requirement" }
  ],
  "BPH": [
    { id: "EVID_BPH_01", text: "Ultrasound KUB showing Prostate Volume > 30cc or PVR > 50ml", source: "AUA Guidelines" },
    { id: "EVID_BPH_02", text: "Serum PSA Levels", source: "AUA Guidelines for >50 yrs" },
    { id: "EVID_BPH_03", text: "Uroflowmetry report", source: "Standard Urology requirement" },
    { id: "EVID_BPH_04", text: "Documentation of failure of medical management (Alpha-blockers)", source: "TPA Policy Guidelines" }
  ],
  "Appendicitis": [
    { id: "EVID_APP_01", text: "Ultrasound or CT Abdomen showing inflamed appendix", source: "SAGES Guidelines" },
    { id: "EVID_APP_02", text: "Complete Blood Count (CBC) showing leukocytosis (high WBC)", source: "Standard Clinical Protocol" },
    { id: "EVID_APP_03", text: "Clinical presentation (Alvarado score parameters like RLQ pain, fever, nausea)", source: "Clinical documentation standard" }
  ]
};

// STEP 1b — Constrain the reasoning call to select from this reference
async function constrainedReasoningGemma(diagnosisGroup: string, fullNarrative: string) {
  const references = CLINICAL_REFERENCE[diagnosisGroup];
  if (!references) throw new Error("No reference found for " + diagnosisGroup);

  const allowedIds = references.map(r => r.id);
  const refString = references.map(r => `[${r.id}] ${r.text}`).join('\n');

  const prompt = `You are a clinical auditor reviewing an insurance pre-auth request.
Diagnosis Category: ${diagnosisGroup}
Clinical Narrative: "${fullNarrative}"

Your task is to identify which of the following pre-validated standard evidence requirements are present in the narrative, and which are missing.
You MUST ONLY select from the following valid IDs:
${refString}
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      present_evidence_ids: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: allowedIds },
        description: "IDs of the evidence requirements that are explicitly documented in the narrative."
      },
      missing_evidence_ids: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: allowedIds },
        description: "IDs of the evidence requirements that are NOT documented in the narrative."
      }
    },
    required: ["present_evidence_ids", "missing_evidence_ids"]
  };

  const systemPrompt = "You are a clinical selection tool. You may only return valid chunk IDs from the provided reference list.";

  try {
    const rawOut = await queryMedGemma(prompt, systemPrompt, schema);
    const result = JSON.parse(rawOut);
    
    // Map IDs back to readable text for output
    const present = result.present_evidence_ids.map((id: string) => references.find(r => r.id === id)?.text || id);
    const missing = result.missing_evidence_ids.map((id: string) => references.find(r => r.id === id)?.text || id);
    
    return { present, missing };
  } catch (err: any) {
    return { error: err.message };
  }
}

// Unconstrained baseline for comparison
async function unconstrainedReasoningGemma(diagnosis: string, narrative: string) {
    const prompt = `You are a clinical auditor reviewing an insurance pre-auth request.
Diagnosis: ${diagnosis}
Clinical Narrative: "${narrative}"

List exactly what clinical evidence is present, and what standard clinical evidence is missing (e.g. labs, imaging, history) to fully justify this diagnosis and treatment plan for insurance approval.
`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            present: { type: Type.ARRAY, items: { type: Type.STRING } },
            missing: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["present", "missing"]
    };

    const rawOut = await queryMedGemma(prompt, "You are a clinical reasoning AI.", schema);
    return JSON.parse(rawOut);
}

// STEP 1c — Test against the known CASE-001-pattern cases
async function runPilot1() {
  console.log("=== PILOT 1: FAIRWAY RETRIEVAL-CONSTRAINED EVIDENCE ===\n");
  
  const cases = [
    {
      group: "Cholelithiasis",
      diagnosis: "Symptomatic Cholelithiasis",
      narrative: "45F presenting with right upper quadrant pain. Ultrasound shows multiple gallstones with sludge. Vitals stable. Advised Laparoscopic Cholecystectomy."
    },
    {
      group: "BPH",
      diagnosis: "Benign Prostatic Hyperplasia",
      narrative: "65M with severe urinary retention. Failed Tamsulosin therapy for 6 months. Ultrasound KUB shows enlarged prostate 60cc with post-void residual 100ml. Plan for TURP."
    },
    {
      group: "Appendicitis",
      diagnosis: "Acute appendicitis",
      narrative: "28M, 18h RLQ pain, migratory, fever 38.4, USG shows non-compressible appendix 9mm with periappendiceal fluid. Surgeon: laparoscopic appendectomy advised."
    }
  ];

  for (const c of cases) {
    console.log(`\n--- Case: ${c.group} ---`);
    console.log(`Narrative: ${c.narrative}`);
    
    console.log("\n[Baseline / Unconstrained Generation]");
    const base = await unconstrainedReasoningGemma(c.diagnosis, c.narrative);
    console.log(`Missing Evidence Requested: ${JSON.stringify(base.missing, null, 2)}`);
    
    console.log("\n[Pilot / Constrained Selection]");
    const pilot = await constrainedReasoningGemma(c.group, c.narrative);
    console.log(`Missing Evidence Requested: ${JSON.stringify(pilot.missing, null, 2)}`);
  }
}

runPilot1().catch(console.error);
