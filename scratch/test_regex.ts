import { sanitizeQueryText } from '../engine/evidenceReview';

const cases = [
  "creatinine 2.5 mg/dL",
  "output 40 ml/kg",
  "500mg dose of amoxicillin",
  "give 10 ml of syrup",
  "take 2 units of blood"
];

cases.forEach(c => {
  console.log(`Original: ${c}`);
  console.log(`Sanitized: ${sanitizeQueryText(c)}\n`);
});
