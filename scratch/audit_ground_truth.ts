import fs from 'fs';
import { getGoogleGenAIClient } from '../services/apiKeys';
import { MODEL_TEXT } from '../config/modelConfig';

interface AuditResult {
  code: string;
  isUsIcd10Cm: boolean;
  reason: string;
}

async function run() {
  const lines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8').split('\n').filter(Boolean);
  const codingCases = lines
    .map(line => JSON.parse(line))
    .filter(j => j.module === 'coding');

  console.log(`Auditing ${codingCases.length} ground truth expected codes...`);

  // Get unique expected codes first to optimize LLM calls
  const uniqueCodes = [...new Set(codingCases.map(c => c.expectedOutput))];
  console.log(`Unique expected codes to check: ${uniqueCodes.length}`);

  const ai = getGoogleGenAIClient();
  const results: Record<string, AuditResult> = {};

  // Check unique codes with Gemini using the same guidelines as scripts/geminiChecker.ts
  for (const code of uniqueCodes) {
    const prompt = `
You are a medical coding auditor. Analyze the following ICD-10 code: "${code}".
Determine if this code is a US ICD-10-CM code (clinical modification used in the United States, typically 5+ characters with specific lateralities/subtypes, e.g. M17.11, H25.11, I25.110) or a standard WHO ICD-10 code (3 or 4 characters, e.g. M17.1, H25.1, I25.1).

Output strictly a JSON object:
{
  "code": "${code}",
  "isUsIcd10Cm": true or false,
  "reason": "brief explanation"
}
`;
    try {
      const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(response.text?.trim() || '{}');
      results[code] = parsed;
    } catch (e: any) {
      console.error(`Failed to audit ${code}:`, e.message);
      results[code] = { code, isUsIcd10Cm: code.replace('.', '').length > 4, reason: 'Fallback check by length' };
    }
  }

  // Count total original expected values that are US ICD-10-CM
  let usCount = 0;
  let whoCount = 0;

  for (const c of codingCases) {
    const audit = results[c.expectedOutput];
    if (audit?.isUsIcd10Cm) {
      usCount++;
    } else {
      whoCount++;
    }
  }

  console.log('\n========================================');
  console.log('       GROUND TRUTH ICD AUDIT RESULTS');
  console.log('========================================');
  console.log(`Total coding failure cases: ${codingCases.length}`);
  console.log(`US ICD-10-CM (Contaminated): ${usCount} (${((usCount/codingCases.length)*100).toFixed(1)}%)`);
  console.log(`WHO ICD-10 (Standard):       ${whoCount} (${((whoCount/codingCases.length)*100).toFixed(1)}%)`);

  console.log('\n--- Details of Unique Checked Codes ---');
  console.log(JSON.stringify(Object.values(results), null, 2));
}

run().catch(console.error);
