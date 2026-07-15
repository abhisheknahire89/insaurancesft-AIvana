import { predictTpaQueries } from '../services/tpaQueryPredictionService';
import { PatientCaseRecord } from '../services/masterPatientRecord';

async function runTest() {
  console.log("=== Running TPA Query Prediction Provenance Verification ===");

  const mockCase: PatientCaseRecord = {
    id: "PA-TEST-001",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStage: "pre_auth_review",
    patientProfile: {
      uhid: "UHID-TEST-001",
      name: "Test Patient Name",
      age: 45,
      gender: "Male"
    } as any,
    insuranceDetails: {
      insurerName: "Star Health Insurance",
      policyNumber: "POL-TEST-001",
      tpaName: "Medi Assist TPA",
      sumInsured: 100000 // SI: ₹1,00,000
    } as any,
    encounters: [
      {
        id: "ENC-TEST-001",
        chiefComplaints: "High fever, chills, and breathing issues for 5 days.",
        diagnosis: "Lobar Pneumonia",
        admissionDate: new Date().toISOString().split('T')[0]
      }
    ] as any,
    documents: [],
    authorizations: [],
    enhancements: [],
    claims: [],
    appeals: [],
    auditLog: [],
    timeline: [],
    rawPreAuthRecord: {
      costEstimate: {
        totalEstimatedCost: 80000,
        roomRentPerDay: 5000, // ₹5,000 per day (Limit is 1% SI = ₹1,000/day)
        expectedRoomDays: 4
      },
      admission: {
        roomCategory: "Normal Ward",
        expectedLengthOfStay: 5 // > 3 days (triggers stay duration rule)
      }
    }
  };

  try {
    const result = await predictTpaQueries(mockCase);
    console.log("Queries returned:", result.predictedQueries.length);
    console.log(JSON.stringify(result.predictedQueries, null, 2));
  } catch (err) {
    console.error("Error running query prediction:", err);
  }
}

runTest();
