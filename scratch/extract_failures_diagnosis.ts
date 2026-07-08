import fs from 'fs';

function run() {
  const lines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8').split('\n').filter(Boolean);
  const extractionFailures = lines
    .map(line => JSON.parse(line))
    .filter(j => j.module === 'extraction');

  console.log(`Found ${extractionFailures.length} extraction failures.`);
  
  // Show first 6 failures in detail
  const subset = extractionFailures.slice(0, 6);
  subset.forEach((f, i) => {
    console.log(`\n========================================`);
    console.log(`FAILURE #${i + 1} (Case ID: ${f.caseId})`);
    console.log(`========================================`);
    console.log(`Diagnosis: ${f.diagnosis}`);
    console.log(`Expected Output:`, JSON.stringify(f.expectedOutput, null, 2));
    console.log(`Actual Output (Normalized):`, JSON.stringify({
      patientName: f.actualOutput.patient?.name,
      age: f.actualOutput.patient?.age,
      gender: f.actualOutput.patient?.gender,
      policyNumber: f.actualOutput.insurance?.policy_number,
      insurerName: f.actualOutput.insurance?.insurance_company,
      tpaName: f.actualOutput.insurance?.tpa_name
    }, null, 2));
    console.log(`Actual Raw Output:`, JSON.stringify(f.actualOutput, null, 2));
    console.log(`Reason for Failure: ${f.reasonForFailure}`);
    console.log(`Root Cause Description: ${f.rootCause?.description}`);
  });
}

run();
