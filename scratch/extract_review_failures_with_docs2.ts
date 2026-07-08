import fs from 'fs';
import { testCases } from '../scripts/testBattery';

function run() {
  const failureLines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8').split('\n').filter(Boolean);
  const reviewFailures = failureLines
    .map(line => JSON.parse(line))
    .filter(j => j.module === 'review');

  console.log(`Found ${reviewFailures.length} review failures.`);
  
  const subset = reviewFailures.slice(0, 8);
  subset.forEach((f, i) => {
    // Find matching case
    const matchedCase = testCases.find((c: any) => c.id === f.caseId);
    const rawText = matchedCase ? matchedCase.rawDocumentText : `(Could not find raw case text in testBattery.ts for Case ID: ${f.caseId})`;
    const hpi = matchedCase ? matchedCase.hpi : '';
    const findings = matchedCase ? matchedCase.relevantClinicalFindings : '';
    const complaints = matchedCase ? matchedCase.chiefComplaints : '';
    const notes = matchedCase ? matchedCase.additionalClinicalNotes : '';

    console.log(`\n========================================`);
    console.log(`REVIEW FAILURE #${i + 1} (Case ID: ${f.caseId})`);
    console.log(`========================================`);
    console.log(`Diagnosis: ${f.diagnosis}`);
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
