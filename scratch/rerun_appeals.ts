import fs from 'fs';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';

const rawLines = fs.readFileSync('logs/multi_module_raw.log', 'utf8').split('\n').filter(Boolean);

async function run() {
  const caseIds = [20984, 20988, 20989, 24936, 24943];
  for (const caseId of caseIds) {
    const line = rawLines.find(l => l.includes(`"id":${caseId},`) || l.includes(`"id":"${caseId}"`));
    if (!line) {
      console.log(`Case ${caseId} not found in multi_module_raw.log`);
      continue;
    }
    const record = JSON.parse(line);
    
    // We need to feed generateDenialAppeal(denialReasonText, record, existingReport)
    // Actually, where did the denial reason come from?
    // In continuousMultiAudit.ts, it pulls `record.expectedAnswer.denialReason`
    const tc = record;
    const denialReasonText = tc.expectedAnswer?.denialReason || "Treatment can be managed conservatively";
    const existingReport = tc.review || { requiredEvidence: [] };

    console.log(`\n===================\nRe-running Case ${caseId}\n===================`);
    try {
      const appealResult = await generateDenialAppeal(denialReasonText, tc, existingReport);
      console.log(JSON.stringify(appealResult, null, 2));
    } catch (e) {
      console.error(`Error on ${caseId}:`, e);
    }
  }
}

run();
