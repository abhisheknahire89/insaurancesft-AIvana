import { testCases, makePreAuthRecord } from '../scripts/testBattery';
import { reviewEvidence } from '../engine/evidenceReview';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';

async function main() {
  process.env.VITE_MEDGEMMA_ENDPOINT_URL = 'http://127.0.0.1:11434/v1/chat/completions';
  
  const casesToTest = [11, 12];
  for (const id of casesToTest) {
    const tc = testCases.find(x => x.id === id)!;
    const record = makePreAuthRecord(tc);
    console.log(`\n======================================`);
    console.log(`Running Case ${id}: ${tc.diagnosis}`);
    console.log(`======================================`);

    const startReview = Date.now();
    const report = await reviewEvidence(record);
    console.log(`Fairway Review took: ${((Date.now() - startReview)/1000).toFixed(2)}s`);

    const startAppeal = Date.now();
    const appeal = await generateDenialAppeal("Pre-auth denied", record, report);
    console.log(`Aegis Appeal took: ${((Date.now() - startAppeal)/1000).toFixed(2)}s`);
    console.log(`Raw Appeal Text length: ${appeal.appealText?.length || 0}`);
  }
}

main().catch(console.error);
