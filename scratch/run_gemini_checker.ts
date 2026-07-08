import fs from 'fs';
import { checkCaseWithGemini } from '../scripts/geminiChecker';

async function run() {
  const content = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8');
  const lines = content.split('\n').filter(Boolean);
  
  const uniqueCodes = new Set<string>();
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      // Wait, expected codes in failure_intelligence are in the failure record... wait, where are they?
      // In failure_intelligence.jsonl, the 'expected' or 'expectedCode' might be logged, or it's in the actual case.
      // Let's check a sample line first.
    } catch(e) {}
  }
}
run();
