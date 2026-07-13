import { predictTpaQueries } from '../services/tpaQueryPredictionService';
import { DIABETES_DEMO_RECORD, PNEUMONIA_DEMO_RECORD, APPENDICITIS_DEMO_RECORD } from '../data/demoCases';
import { mapPreAuthToCase } from '../services/masterPatientRecord';

async function runTest() {
  console.log("==================================================");
  console.log("🧪 TESTING TPA QUERY PREDICTION SERVICE");
  console.log("==================================================");

  // 1. Test Case: Diabetes Profile (should trigger room rent or stay duration checks if any)
  console.log("\n--- Testing Case: Diabetes Demo Record ---");
  const diabetesCase = mapPreAuthToCase(DIABETES_DEMO_RECORD as any);
  
  // Set room rent high to trigger Rule 1
  if (diabetesCase.rawPreAuthRecord && diabetesCase.rawPreAuthRecord.costEstimate) {
      diabetesCase.rawPreAuthRecord.costEstimate.roomRentPerDay = 15000; // Cap is 5000 (1% of 500,000)
  }
  
  let result = await predictTpaQueries(diabetesCase);
  console.log("Predicted Queries:");
  console.log(JSON.stringify(result.predictedQueries, null, 2));

  // 2. Test Case: Appendicitis (clean case)
  console.log("\n--- Testing Case: Appendicitis Demo Record (Clean) ---");
  const appendicitisCase = mapPreAuthToCase(APPENDICITIS_DEMO_RECORD as any);
  if (appendicitisCase.rawPreAuthRecord && appendicitisCase.rawPreAuthRecord.costEstimate) {
      appendicitisCase.rawPreAuthRecord.costEstimate.roomRentPerDay = 4000; // Under cap
  }
  result = await predictTpaQueries(appendicitisCase);
  console.log("Predicted Queries:");
  console.log(JSON.stringify(result.predictedQueries, null, 2));

  // 3. Test Case: Cardiovascular/Stroke comorbidity correlation (Rule 3)
  console.log("\n--- Testing Case: Stroke / HTN & Diabetes Comorbidities ---");
  const strokeCase = mapPreAuthToCase({
      id: "CASE-STROKE",
      patient: { patientName: "Rahul Sharma", age: 58, gender: "Male" },
      insurance: { insurerName: "HDFC ERGO", sumInsured: 600000, tpaName: "MediAssist" },
      clinical: {
          diagnoses: [{ diagnosis: "Ischemic Stroke", icd10Code: "I63.9", icd10Description: "Cerebral infarction, unspecified" }],
          chiefComplaints: "Weakness in left arm and leg since 2 hours"
      },
      admission: {
          expectedLengthOfStay: 2,
          roomCategory: "ICU",
          pastMedicalHistory: {
              hypertension: { present: true, duration: "5 years" },
              diabetes: { present: true, duration: "3 years" }
          }
      },
      costEstimate: {
          roomRentPerDay: 8000, // Capped at 2% (12000), so no rent capping query
          expectedRoomDays: 0,
          expectedIcuDays: 2
      }
  } as any);

  result = await predictTpaQueries(strokeCase);
  console.log("Predicted Queries:");
  console.log(JSON.stringify(result.predictedQueries, null, 2));
}

runTest().catch(console.error);
