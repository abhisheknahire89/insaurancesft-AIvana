import fs from 'fs';
import readline from 'readline';

async function run() {
  const failureLines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8').split('\n').filter(Boolean);
  const reviewFailures = failureLines
    .map(line => JSON.parse(line))
    .filter(j => j.module === 'review');

  console.log(`Found ${reviewFailures.length} review failures.`);
  
  const targetCaseIds = new Set(reviewFailures.slice(0, 8).map(f => f.caseId));
  const mappedCases = new Map<number, any>();

  // Read multi_module_raw.jsonl line-by-line to save memory
  const fileStream = fs.createReadStream('logs/multi_module_raw.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      const caseId = data.caseInput?.id || data.id;
      if (caseId && targetCaseIds.has(caseId)) {
        mappedCases.set(caseId, data.caseInput || data);
      }
    } catch (e) {}
  }

  const subset = reviewFailures.slice(0, 8);
  subset.forEach((f, i) => {
    const matchedCase = mappedCases.get(f.caseId);
    const rawText = matchedCase ? matchedCase.rawDocumentText : `(Could not find raw case text in multi_module_raw.jsonl for Case ID: ${f.caseId})`;
    const diagnosis = matchedCase ? matchedCase.diagnosis : f.diagnosis;
    const complaints = matchedCase ? matchedCase.chiefComplaints : '';
    const hpi = matchedCase ? matchedCase.hpi : '';
    const findings = matchedCase ? matchedCase.relevantClinicalFindings : '';
    const notes = matchedCase ? matchedCase.additionalClinicalNotes : '';

    console.log(`\n========================================`);
    console.log(`REVIEW FAILURE #${i + 1} (Case ID: ${f.caseId})`);
    console.log(`========================================`);
    console.log(`Diagnosis: ${diagnosis}`);
    console.log(`Raw Document Text: "${rawText}"`);
    console.log(`Chief Complaints: "${complaints}"`);
    console.log(`HPI: "${hpi}"`);
    console.log(`Relevant Clinical Findings: "${findings}"`);
    console.log(`Additional Clinical Notes: "${notes}"`);
    console.log(`\nExpected Output:`, JSON.stringify(f.expectedOutput, null, 2));
    console.log(`\nActual Output Report Status:`, f.actualOutput?.status);
    console.log(`Actual Output Required Evidence:`, JSON.stringify(f.actualOutput?.requiredEvidence, null, 2));
    console.log(`Actual Output Insufficient Evidence:`, JSON.stringify(f.actualOutput?.insufficientEvidence, null, 2));
    console.log(`Actual Output anticipatedQueries:`, JSON.stringify(f.actualOutput?.anticipatedQueries, null, 2));
    console.log(`Actual Output mandatoryGaps:`, JSON.stringify(f.actualOutput?.mandatoryGaps, null, 2));
    console.log(`Reason for Failure: ${f.reasonForFailure}`);
    console.log(`Root Cause Description: ${f.rootCause?.description}`);
  });
}

run();
