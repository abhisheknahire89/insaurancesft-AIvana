import { reviewEnhancement, EnhancementInput } from '../engine/enhancementReview';

async function runTests() {
  console.log("==================================================");
  console.log("🧪 TESTING STAY ENHANCEMENT REVIEW");
  console.log("==================================================\n");

  const cases: { name: string; input: EnhancementInput; diagnosis: string }[] = [
    {
      name: "Case 1: extended_stay",
      diagnosis: "Acute Gastroenteritis with severe dehydration",
      input: {
        originalApprovalRef: "AUTH-12345",
        originalApprovedAmount: 25000,
        amountUtilizedToDate: 23000,
        trigger: "extended_stay",
        additionalAmountRequested: 10000,
        originalDischargeDate: "2026-07-15",
        newDischargeDate: "2026-07-17",
        dischargeDelayReasons: ["Patient still experiencing loose stools and unable to tolerate oral fluids", "Vitals stable but persistent weakness"],
        currentSeverityScores: { phenoIntensity: 4, deteriorationVelocity: 2 }
      }
    },
    {
      name: "Case 2: new_procedure",
      diagnosis: "Cholelithiasis",
      input: {
        originalApprovalRef: "AUTH-67890",
        originalApprovedAmount: 50000,
        amountUtilizedToDate: 48000,
        trigger: "new_procedure",
        additionalAmountRequested: 25000,
        newProcedureName: "ERCP with stone removal",
        newProcedureCode: "CPT-43264",
        newProcedureDate: "2026-07-14",
        clinicalFindingTriggeringProcedure: "Ultrasound showed CBD stone not visualized in previous scan, patient developed obstructive jaundice."
      }
    },
    {
      name: "Case 3: icu_upgrade",
      diagnosis: "Community Acquired Pneumonia",
      input: {
        originalApprovalRef: "AUTH-11223",
        originalApprovedAmount: 40000,
        amountUtilizedToDate: 35000,
        trigger: "icu_upgrade",
        additionalAmountRequested: 50000,
        deteriorationDateTime: "2026-07-13T22:00:00Z",
        deteriorationVitals: "SpO2 dropped to 85% on room air, RR 32/min, BP 90/60 mmHg",
        icuIntervention: "Started on Non-Invasive Ventilation (BiPAP) and continuous cardiac monitoring"
      }
    }
  ];

  for (const c of cases) {
    console.log(`--- Testing ${c.name} ---`);
    try {
      const result = await reviewEnhancement(c.input, c.diagnosis);
      console.log(JSON.stringify(result, null, 2));
    } catch (err: any) {
      console.error(`Error in ${c.name}:`, err.message);
    }
    console.log("\n");
  }
}

runTests();
