import * as fs from 'fs';

const logLines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf-8').split('\n').filter(Boolean);
let appealCases = [];

for (const line of logLines) {
  try {
    const record = JSON.parse(line);
    if (record.module === 'appeal' && record.actualOutput && record.actualOutput.citedEvidence && record.actualOutput.citedEvidence.length > 0) {
      appealCases.push(record);
    }
  } catch (e) {}
}

const last10 = appealCases.slice(-10);

let wholeFieldDumps = 0;
let granularCitations = 0;

for (const record of last10) {
  console.log(`\nCase ID: ${record.caseId}`);
  const cited = record.actualOutput.citedEvidence;
  for (const evidence of cited) {
    const text = evidence.evidenceItem;
    // Check if it matches a whole field in the input. 
    // Since failure_intelligence doesn't log the raw input, we look at evidenceUsed for context, 
    // or we can just print the evidenceItem length to see if it's a huge dump.
    console.log(`evidenceItem (len: ${text.length}): ${text.substring(0, 100)}...`);
    // Wait, the prompt says "does evidenceItem's text length and content match a specific granular clinical fact, or does it match ... one of the raw input fields".
    // I don't have the original input for all cases, but I can print them and inspect them manually.
  }
}
