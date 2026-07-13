import { queryMedGemma } from '../services/llmClient';
import { DIABETES_DEMO_RECORD, APPENDICITIS_DEMO_RECORD } from '../data/demoCases';
import { predictTpaQueries as livePredict } from '../services/tpaQueryPredictionService';
import { mapPreAuthToCase } from '../services/masterPatientRecord';

async function deterministicTpaClassifier(record: any) {
  const flags = [];
  
  const rawRecord = record.rawPreAuthRecord || record;
  const cost = rawRecord.costEstimate || {};
  const admission = rawRecord.admission || {};
  const insurance = rawRecord.insurance || {};
  const clinical = rawRecord.clinical || {};

  const roomRent = cost.roomRentPerDay || 0;
  const sumInsured = insurance.sumInsured || 500000;
  const isIcu = (admission.roomCategory || '').toLowerCase().includes('icu');
  const expectedLOS = admission.expectedLengthOfStay || 0;
  
  const cap = sumInsured * (isIcu ? 0.02 : 0.01);
  
  // Rule 1: Room Rent Capping
  if (roomRent > cap) {
    flags.push(`Room rent (₹${roomRent}) exceeds policy cap (₹${cap}). Result: Proportional deduction applies.`);
  }

  // Rule 2: Length of Stay
  const diagnosis = (clinical.diagnoses && clinical.diagnoses[0]?.diagnosis) || '';
  const isDaycare = diagnosis.toLowerCase().includes('cataract') || expectedLOS <= 1;
  if (!isDaycare && expectedLOS > 3) {
    flags.push(`Length of stay (${expectedLOS} days) exceeds standard 3-day duration without obvious complication.`);
  }
  
  // Rule 3: Missing basic docs (dummy rule for pilot)
  if (!clinical.chiefComplaints || clinical.chiefComplaints.length < 5) {
    flags.push("Chief complaints poorly documented.");
  }

  return flags;
}

async function formatQueryWithGemma(flags: string[]) {
  if (flags.length === 0) return { queries: [] };

  const prompt = `You are a TPA medical reviewer. 
The deterministic rules engine has flagged the following issues on an insurance claim:
${flags.map(f => `- ${f}`).join('\n')}

Your ONLY job is to write a readable, professional TPA Query message for the hospital based EXACTLY on these flags. Do not invent any other medical reasons.
Format the output as a simple array of strings.`;

  const schema = {
    type: "object",
    properties: {
      queries: { type: "array", items: { type: "string" }, description: "Human-readable TPA queries based on the flags." }
    },
    required: ["queries"]
  };

  try {
    const rawOut = await queryMedGemma(prompt, "You are a formatter.", schema as any);
    return JSON.parse(rawOut);
  } catch (err: any) {
    return { error: err.message };
  }
}

async function runPilot4() {
  console.log("=== PILOT 4: TPA QUERY PREDICTION (DETERMINISTIC + LLM FORMATTER) ===\n");
  
  const testCases = [
    { name: "Diabetes Demo Record", data: DIABETES_DEMO_RECORD, modify: (tc: any) => { if (tc.rawPreAuthRecord?.costEstimate) tc.rawPreAuthRecord.costEstimate.roomRentPerDay = 15000; } },
    { name: "Appendicitis (Clean)", data: APPENDICITIS_DEMO_RECORD, modify: (tc: any) => { if (tc.rawPreAuthRecord?.costEstimate) tc.rawPreAuthRecord.costEstimate.roomRentPerDay = 4000; } },
    { name: "Stroke / Comorbidities", data: {
      id: "CASE-STROKE",
      patient: { patientName: "Rahul Sharma", age: 58, gender: "Male" },
      insurance: { insurerName: "HDFC ERGO", sumInsured: 600000, tpaName: "MediAssist" },
      clinical: {
          diagnoses: [{ diagnosis: "Ischemic Stroke", icd10Code: "I63.9", icd10Description: "Cerebral infarction, unspecified" }],
          chiefComplaints: "Weakness in left arm and leg since 2 hours"
      },
      admission: { expectedLengthOfStay: 2, roomCategory: "ICU", pastMedicalHistory: { hypertension: { present: true, duration: "5 years" }, diabetes: { present: true, duration: "3 years" } } },
      costEstimate: { roomRentPerDay: 8000, expectedRoomDays: 0, expectedIcuDays: 2 }
    }, modify: (tc: any) => {} }
  ];

  for (const t of testCases) {
      console.log(`\n--- Case: ${t.name} ---`);
      const testCase = mapPreAuthToCase(t.data as any);
      t.modify(testCase);

      const triggeredFlags = await deterministicTpaClassifier(testCase);
      console.log(`Deterministic Flags Triggered:`);
      console.log(triggeredFlags);
      
      const pilotOutput = await formatQueryWithGemma(triggeredFlags);
      console.log(`LLM Formatted Output:`);
      console.log(JSON.stringify(pilotOutput, null, 2));
  }
}

runPilot4().catch(console.error);
