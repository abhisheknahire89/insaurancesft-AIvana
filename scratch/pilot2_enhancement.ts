import { queryMedGemma } from '../services/llmClient';
import { Type } from '@google/genai';

const ENHANCEMENT_REFERENCE: Record<string, { id: string; text: string; source: string }[]> = {
  "extended_stay": [
    { id: "ENH_EXT_01", text: "Daily progress notes showing clinical instability (e.g. persistent fever, abnormal vitals)", source: "Standard TPA Audit Protocol" },
    { id: "ENH_EXT_02", text: "Lab reports showing abnormal trends requiring continued medical management", source: "Standard TPA Audit Protocol" },
    { id: "ENH_EXT_03", text: "Drainage tube output charting requiring prolonged observation", source: "Surgical recovery guidelines" }
  ],
  "new_procedure": [
    { id: "ENH_NEW_01", text: "Intra-operative notes documenting unexpected complications", source: "Surgical Society Guidelines" },
    { id: "ENH_NEW_02", text: "Post-operative imaging showing complication (e.g. hematoma, leak)", source: "Standard TPA Audit Protocol" },
    { id: "ENH_NEW_03", text: "Surgical consultant opinion on necessity of secondary procedure", source: "Standard TPA Audit Protocol" }
  ],
  "icu_upgrade": [
    { id: "ENH_ICU_01", text: "Vitals chart showing hemodynamic instability (e.g. hypotension, severe tachycardia)", source: "ICU Admission Criteria" },
    { id: "ENH_ICU_02", text: "Arterial Blood Gas (ABG) showing respiratory failure or severe acidosis", source: "ICU Admission Criteria" },
    { id: "ENH_ICU_03", text: "Neurological monitoring chart showing acute decline in GCS", source: "Neuro-critical care guidelines" }
  ]
};

async function constrainedEnhancementGemma(trigger: string, fullNarrative: string) {
  const references = ENHANCEMENT_REFERENCE[trigger];
  if (!references) throw new Error("No reference found for " + trigger);

  const allowedIds = references.map(r => r.id);
  const refString = references.map(r => `[${r.id}] ${r.text}`).join('\n');

  const prompt = `You are a clinical auditor reviewing an insurance stay enhancement request.
Trigger Type: ${trigger}
Clinical Narrative: "${fullNarrative}"

Identify which of the following pre-validated standard enhancement justification evidence requirements are present in the narrative, and which are missing.
You MUST ONLY select from the following valid IDs:
${refString}
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      present_evidence_ids: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: allowedIds },
        description: "IDs of the evidence requirements explicitly documented in the narrative."
      },
      missing_evidence_ids: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: allowedIds },
        description: "IDs of the evidence requirements NOT documented in the narrative."
      }
    },
    required: ["present_evidence_ids", "missing_evidence_ids"]
  };

  const systemPrompt = "You are a clinical selection tool. Return only valid chunk IDs from the reference list.";

  try {
    const rawOut = await queryMedGemma(prompt, systemPrompt, schema);
    const result = JSON.parse(rawOut);
    
    const present = result.present_evidence_ids.map((id: string) => references.find(r => r.id === id)?.text || id);
    const missing = result.missing_evidence_ids.map((id: string) => references.find(r => r.id === id)?.text || id);
    
    return { present, missing };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function unconstrainedEnhancementGemma(trigger: string, narrative: string) {
    const prompt = `You are a clinical auditor reviewing an insurance stay enhancement request.
Trigger: ${trigger}
Clinical Narrative: "${narrative}"

List exactly what clinical evidence is present, and what standard clinical evidence is missing (e.g. labs, vitals, consultant notes) to fully justify this enhancement request for insurance approval.
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

async function runPilot2() {
  console.log("=== PILOT 2: STAY ENHANCEMENT CONSTRAINED EVIDENCE ===\n");
  
  const cases = [
    {
      trigger: "extended_stay",
      narrative: "Patient day 4 post-op appendectomy. Complains of generalized weakness. Vitals stable. Requesting 2 more days stay."
    },
    {
      trigger: "new_procedure",
      narrative: "Patient underwent Lap Chole. Post-op day 1 developed severe abdominal pain and distension. USG shows large subhepatic collection. Plan for urgent exploratory laparotomy and drainage."
    },
    {
      trigger: "icu_upgrade",
      narrative: "Patient admitted for pneumonia in ward. Sudden onset breathlessness. SpO2 dropped to 82% on room air. ABG shows pH 7.2, pCO2 65. Shifting to ICU for NIV."
    }
  ];

  for (const c of cases) {
    console.log(`\n--- Case: ${c.trigger} ---`);
    console.log(`Narrative: ${c.narrative}`);
    
    console.log("\n[Baseline / Unconstrained Generation]");
    const base = await unconstrainedEnhancementGemma(c.trigger, c.narrative);
    console.log(`Missing Evidence Requested: ${JSON.stringify(base.missing, null, 2)}`);
    
    console.log("\n[Pilot / Constrained Selection]");
    const pilot = await constrainedEnhancementGemma(c.trigger, c.narrative);
    console.log(`Missing Evidence Requested: ${JSON.stringify(pilot.missing, null, 2)}`);
  }
}

runPilot2().catch(console.error);
