import { PatientCaseRecord } from '../services/masterPatientRecord';
import { simulateInsurerDecision } from '../services/simulatedInsurerService';

// Base mock case record
const baseRecord: PatientCaseRecord = {
  id: "CASE-99824",
  patientProfile: {
    name: "Devendra Joshi",
    age: 58,
    gender: "Male",
    contact: "9876543210",
    uhid: "UHID-99218"
  },
  insuranceDetails: {
    insurer: "Care Health Insurance Ltd",
    policyNumber: "POL-48291",
    sumInsured: 500000,
    TPA: "Medi Assist TPA"
  },
  encounters: [{
    admissionDate: "2026-07-14",
    diagnosis: "Bilateral Knee Osteoarthritis",
    diagnoses: [{
      diagnosis: "Bilateral Knee Osteoarthritis",
      icd10Code: "M17.0",
      icd10Description: "Bilateral primary osteoarthritis of knee",
      probability: 1,
      isSelected: true
    }],
    chiefComplaints: "Severe bilateral knee pain on walking.",
    historyOfPresentIllness: "History of osteoarthritis since 2018.",
    wardType: "Private",
    icuDays: 0
  }],
  documents: [
    { id: "doc-1", name: "Knee X-ray", type: "pdf", extractedData: {} }
  ],
  authorizations: [],
  enhancements: [],
  claims: [],
  appeals: [],
  auditLog: [],
  timeline: [],
  currentStage: "registered",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rawPreAuthRecord: {
    id: "CASE-99824",
    patient: { patientName: "Devendra Joshi", age: 58, gender: "Male", uhid: "UHID-99218" },
    insurance: { insurerName: "Care Health Insurance Ltd", policyNumber: "POL-48291", sumInsured: 500000, tpaName: "Medi Assist TPA" },
    clinical: {
      diagnoses: [{ diagnosis: "Bilateral Knee Osteoarthritis", icd10Code: "M17.0", icd10Description: "Bilateral primary osteoarthritis of knee", isSelected: true }],
      selectedDiagnosisIndex: 0,
      chiefComplaints: "Severe bilateral knee pain on walking.",
      historyOfPresentIllness: "History of osteoarthritis since 2018."
    },
    admission: { dateOfAdmission: "2026-07-14", roomCategory: "Private", expectedLengthOfStay: 4 },
    declarations: {
      doctor: { doctorRegistrationNumber: "DMC-9812", confirmed: true },
      hospital: { hospitalSealApplied: true },
      patient: { agreedToTerms: true }
    },
    costEstimate: {
      roomRentPerDay: 8000, // Standard cap is 1% of 500k = 5,000. Exceeds standard cap.
      expectedRoomDays: 4,
      totalEstimatedCost: 185000
    },
    uploadedDocuments: [
      { id: "doc-1", fileName: "Knee X-ray", fileType: "pdf", documentCategory: "xray_knee" }
    ]
  }
};

console.log("=== RUNNING SIMULATED INSURER DECISION ENGINE TESTS ===\n");

// Scenario 1: Room rent cap exceeded (deluxe/private room rate ₹8000/day > limit ₹5000/day)
console.log("--- SCENARIO 1: Room Rent Capping Partial Approval ---");
const record1 = JSON.parse(JSON.stringify(baseRecord));
const decision1 = simulateInsurerDecision(record1, 'initial', 185000);
console.log("Decision Outcome:", decision1.outcome);
console.log("Approved Amount:", decision1.approvedAmount);
console.log("Deduction Reason:", decision1.deductionReason);
console.log("\n");

// Scenario 2: Missing mandatory document (e.g. Patient terms signature or SMC details missing)
console.log("--- SCENARIO 2: Missing Mandatory Document Query ---");
const record2 = JSON.parse(JSON.stringify(baseRecord));
// Remove hospital seal to trigger gap check
record2.rawPreAuthRecord.declarations.hospital.hospitalSealApplied = false;
const decision2 = simulateInsurerDecision(record2, 'initial', 185000);
console.log("Decision Outcome:", decision2.outcome);
console.log("Query Details:", decision2.queryDetails);
console.log("\n");

// Scenario 3: Clean Case Approval
console.log("--- SCENARIO 3: Clean Case Approval ---");
const record3 = JSON.parse(JSON.stringify(baseRecord));
// Reduce room rent rate to limit (₹5,000/day)
record3.rawPreAuthRecord.costEstimate.roomRentPerDay = 5000;
const decision3 = simulateInsurerDecision(record3, 'initial', 185000);
console.log("Decision Outcome:", decision3.outcome);
console.log("Approved Amount:", decision3.approvedAmount);
console.log("\n");

// Scenario 4: Large Enhancement Request (> 50% threshold)
console.log("--- SCENARIO 4: Enhancement Request Downgrade ---");
const record4 = JSON.parse(JSON.stringify(baseRecord));
// Set room rent rate to limit (₹5,000/day) to prevent Scenario 1 capping trigger
record4.rawPreAuthRecord.costEstimate.roomRentPerDay = 5000;
// Add initial authorization of 100,000
record4.authorizations = [{
  id: "AUTH-1",
  status: "approved",
  requestedAmount: 100000,
  approvedAmount: 100000,
  submittedAt: new Date().toISOString()
}];
// Request enhancement of 80,000 (which is > 50% of 100,000)
const decision4 = simulateInsurerDecision(record4, 'enhancement', 80000);
console.log("Decision Outcome:", decision4.outcome);
console.log("Approved Amount:", decision4.approvedAmount);
console.log("Deduction Reason:", decision4.deductionReason);
console.log("\n");
