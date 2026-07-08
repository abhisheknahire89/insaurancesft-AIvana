import fs from 'fs';
import { checkCaseWithGemini } from '../scripts/geminiChecker';
import { MultiModuleTestCase } from '../scripts/testBattery';

async function run() {
  const content = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8');
  const lines = content.split('\n').filter(Boolean);
  const codingFailures = lines.map(l => JSON.parse(l)).filter(j => j.module === 'coding');
  
  // Exclude the 11 orthopedics/gynecology cases that passed if needed, or just run on all and we'll see the count.
  // The prompt says "Report how many of the 87 original expected values..."
  // If we just check all of them, we can report the total.

  const expectedCodes = codingFailures.map(j => j.expectedOutput);
  const uniqueCodes = [...new Set(expectedCodes)] as string[];

  console.log(`Found ${uniqueCodes.length} unique expected codes.`);
  
  const contaminatedSet = new Set<string>();

  for (let i = 0; i < uniqueCodes.length; i++) {
    const code = uniqueCodes[i];
    
    const mockCase: any = {
      id: 99999,
      diagnosis: 'Mock',
      realGap: 'None',
      expectedAnswer: { expectedCode: code }
    };
    
    // We put the code in engineOutput so Gemini can check it.
    const mockEngineOutput: any = {
      assignedCode: code
    };

    try {
      const result = await checkCaseWithGemini(mockCase as any, mockEngineOutput, 1);
      if (result && result.codeIssues && result.codeIssues.length > 0) {
        contaminatedSet.add(code);
        console.log(`[CONTAMINATED] ${code}: ${result.codeIssues[0]}`);
      } else {
        console.log(`[OK] ${code}`);
      }
    } catch (e) {
      console.log(`[ERROR] ${code} failed to validate: ${e}`);
    }
    
    // Slight delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n--- SUMMARY ---');
  let contaminatedCount = 0;
  for (const f of codingFailures) {
    if (contaminatedSet.has(f.expectedOutput)) {
      contaminatedCount++;
    }
  }
  
  console.log(`Total coding failures evaluated: ${codingFailures.length}`);
  console.log(`Total failures where expectedOutput is a US ICD-10-CM code: ${contaminatedCount}`);
  console.log('List of contaminated codes:', [...contaminatedSet].join(', '));
}

run();
