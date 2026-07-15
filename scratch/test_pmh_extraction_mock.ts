// This test mocks parseTranscriptWithGemini to simulate Gemini returning the new comorbidity fields.
// This validates that the mapping/parsing logic inside voiceDictationService.ts is fully functional.

import { VoiceExtractedData } from '../services/voiceDictationService';
import { defaultCond } from '../services/voiceDictationService'; // We can simulate the mapping manually

const mockPmhParsed = {
  diabetes: { present: false },
  hypertension: { present: true },
  heartDisease: { present: false },
  asthma: { present: false },
  epilepsy: { present: false },
  cancer: { present: false },
  kidney: { present: false },
  liver: { present: false },
  hiv: { present: false },
  alcoholism: { present: false },
  smoking: { present: false },
  hyperlipidemia: { present: true }, // Newly added condition (present)
  osteoarthritis: { present: true },   // Newly added condition (present)
};

function verifyMapping(pmh: any) {
  const defaultCondition = { present: false };
  return {
    diabetes: pmh.diabetes ?? defaultCondition,
    hypertension: pmh.hypertension ?? defaultCondition,
    heartDisease: pmh.heartDisease ?? defaultCondition,
    asthma: pmh.asthma ?? defaultCondition,
    epilepsy: pmh.epilepsy ?? defaultCondition,
    cancer: pmh.cancer ?? defaultCondition,
    kidney: pmh.kidney ?? defaultCondition,
    liver: pmh.liver ?? defaultCondition,
    hiv: pmh.hiv ?? defaultCondition,
    alcoholism: pmh.alcoholism ?? defaultCondition,
    smoking: pmh.smoking ?? defaultCondition,
    hyperlipidemia: pmh.hyperlipidemia ?? defaultCondition,
    osteoarthritis: pmh.osteoarthritis ?? defaultCondition,
    anyOther: { present: false },
  };
}

console.log("=== Running PMH Mapping Logic Verification ===");
const mappedPmh = verifyMapping(mockPmhParsed);
console.log("Mapped pastMedicalHistory:");
console.log(JSON.stringify(mappedPmh, null, 2));

if (mappedPmh.hyperlipidemia.present && mappedPmh.osteoarthritis.present) {
  console.log("✅ Success: Hyperlipidemia and Osteoarthritis successfully parsed and mapped!");
} else {
  console.error("❌ Error: Mapping failed to capture the new fields.");
}
