import { getGoogleGenAIClient } from '../services/apiKeys';
import { MODEL_TEXT } from '../config/modelConfig';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';

async function generateQuotedCases() {
  const prompt = `
Generate an array of 3 highly realistic, completely fictional patient cases based on common Indian inpatient conditions.
CRITICAL: The patient's chief complaints, HPI, and relevantClinicalFindings MUST contain explicit double quotes.
For example: Patient stated "I have severe abdominal pain".

Return ONLY valid JSON matching this schema exactly:
[
  {
    "id": "CASE-1",
    "difficulty": "medium",
    "focusCategory": "denial_heavy",
    "patient": { "patientName": "Raj Kumar", "age": 45, "ageUnit": "years", "gender": "Male" },
    "insurance": { "tpaName": "Medi Assist", "insurerName": "Star Health", "policyNumber": "POL-123" },
    "clinical": {
      "chiefComplaints": "Patient stated \\\"severe chest pain\\\"",
      "hpi": "Admitted after complaining of \\\"crushing\\\" pain.",
      "relevantClinicalFindings": "ECG shows \\\"ST elevation\\\".",
      "pastHistory": "None",
      "dateOfAdmission": "2026-07-06",
      "expectedLos": 3,
      "roomCategory": "ICU",
      "lineOfTreatment": ["Medical Management"],
      "admissionType": "Emergency",
      "reasonForHospitalisation": "Acute MI",
      "diagnoses": [{ "diagnosis": "Acute Myocardial Infarction", "icd10Code": "I21.9", "isPrimary": true }]
    },
    "costEstimate": {
      "totalEstimatedCost": 150000,
      "amountClaimedFromInsurer": 150000,
      "costBreakdown": { "Room Charges": 30000, "ICU Charges": 50000, "Medicines": 70000 }
    },
    "expectedAnswer": {
      "denialReason": "Treatment could have been managed conservatively without ICU."
    }
  }
]
  `;

  const ai = getGoogleGenAIClient();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT,
    contents: prompt,
    config: {
      temperature: 0.7,
      responseMimeType: "application/json",
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response");
  
  return JSON.parse(text);
}

async function run() {
  console.log("Generating cases...");
  const cases = await generateQuotedCases();
  console.log(`Generated ${cases.length} cases.`);

  for (const tc of cases) {
    console.log(`\n===================\nRunning Case ${tc.id}\n===================`);
    try {
      const appealResult = await generateDenialAppeal(tc.expectedAnswer.denialReason, tc, { requiredEvidence: [] } as any);
      console.log(JSON.stringify(appealResult, null, 2));
    } catch (e) {
      console.error(`Error on ${tc.id}:`, e);
    }
  }
}

run();
