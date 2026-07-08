import fs from 'fs';
import path from 'path';

function run() {
  const failureLines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8').split('\n').filter(Boolean);
  const reviewFailures = failureLines
    .map(line => JSON.parse(line))
    .filter(j => j.module === 'review');

  console.log(`Found ${reviewFailures.length} review failures.`);

  // Load regression suite cases to map raw documents
  let allCases: any[] = [];
  try {
    const regSuitePath = 'logs/regression_suite.json';
    if (fs.existsSync(regSuitePath)) {
      const suite = JSON.parse(fs.readFileSync(regSuitePath, 'utf8'));
      if (Array.isArray(suite.cases)) {
        allCases = suite.cases;
      } else if (Array.isArray(suite)) {
        allCases = suite;
      }
    }
  } catch (e) {
    console.error('Failed to load regression suite:', e);
  }

  // Load dynamic cases from dynamicCaseGenerator hardcoded examples if not in suite
  // We can look them up dynamically or just print what we have
  
  const subset = reviewFailures.slice(0, 7);
  subset.forEach((f, i) => {
    // Find matching case
    const matchedCase = allCases.find((c: any) => c.id === f.caseId);
    const rawText = matchedCase ? matchedCase.rawDocumentText : `(Could not find raw case text in regression_suite.json for Case ID: ${f.caseId})`;
    
    console.log(`\n========================================`);
    console.log(`REVIEW FAILURE #${i + 1} (Case ID: ${f.caseId})`);
    console.log(`========================================`);
    console.log(`Diagnosis: ${f.diagnosis}`);
    console.log(`Raw Document Text: \n"${rawText}"`);
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
