import { queryMedGemma } from '../services/llmClient';

async function test() {
  const reasons = ['Pre-auth denied as conservative management trial documentation is insufficient for a surgical claim.'];
  
  const clinicalPoolStr = `[Item 0] "Patient has had a history of menorrhagia. Failed medical management with Tranexamic acid and Hormonal pills over the last few months. Uterus enlarged to 14 weeks size." (Source: anchor)
[Item 1] "heavy menstrual bleeding, severe abdominal pain" (Source: anchor)
[Item 2] "Large intramural fibroid measuring 6x5 cm on USG. Hemoglobin: 8.2 g/dL." (Source: anchor)`;

  const systemInstruction = `You are a medical appeal letter generator for an Indian hospital RCM department.
Your task is to analyze TPA denial reasons and map them to available clinical evidence from the patient's record.

CRITICAL CONSTRAINT - ZERO-TOLERANCE RULES:
1. ONLY cite evidence items that are explicitly listed in the "Available Clinical Pool".
2. Under NO circumstances may you fabricate or hallucinate any symptoms, clinical vitals, lab reports, diagnostics, or patient history that are not explicitly present in the provided clinical pool.
3. If a denial reason cannot be resolved or supported by any item in the Clinical Pool, you MUST list it under "stillMissing" and state that supplementary documentation is required. Do not construct a fake citation or claim evidence is present when it is not.
4. Output strictly a JSON response matching the schema. Do not include markdown code block formatting (like \`\`\`json). Just the raw JSON.
5. JSON ESCAPE RULE: In the "appealTextBody" string, you must escape any double quotes (use \\" instead of ") and represent newlines using \\n. The JSON must be fully valid and parseable without syntax errors.
6. CITATION GRANULARITY: Extract ONLY the specific phrase or sentence that directly supports the challenge. DO NOT cite the entire paragraph or raw text field. The extracted text MUST be an exact unedited substring of the Clinical Pool item.`;

  const prompt = `
DENIAL REASONS TO CHALLENGE:
${reasons.map((r, i) => `${i + 1}. "${r}"`).join('\n')}

AVAILABLE CLINICAL POOL:
${clinicalPoolStr}

Your response must be a JSON object structured exactly as follows:
{
  "citedEvidence": [
    {
      "denialReason": "the exact denial reason text",
      "evidenceItem": "the exact text of the matched evidence item from the Clinical Pool",
      "source": "anchor",
      "forChallenge": "associated challenge"
    }
  ],
  "stillMissing": [
    {
      "denialReason": "the exact denial reason text",
      "explanation": "the missing evidence"
    }
  ],
  "appealTextBody": "the formal letter text"
}`;

  console.log("Querying LLM...");
  const raw = await queryMedGemma(prompt, systemInstruction);
  console.log("\nRAW LLM OUTPUT:\n" + raw);
}

test().catch(console.error);
