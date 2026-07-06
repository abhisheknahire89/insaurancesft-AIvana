import * as fs from 'fs';

const rawLogPath = '/Users/abhishekpravinnahire/V1 tpa insaurance/logs/multi_module_raw.jsonl';
if (!fs.existsSync(rawLogPath)) {
  console.log('No raw logs file found.');
  process.exit(0);
}

const fileContent = fs.readFileSync(rawLogPath, 'utf8').trim();
const lines = fileContent.split('\n').filter(Boolean);
console.log(`Total lines in log: ${lines.length}`);

const last25 = lines.slice(-25).map(l => JSON.parse(l));

console.log('\n--- AUDIT OF THE 25 TEST CASES ---');
let passCount = 0;
let failCount = 0;

for (let i = 0; i < last25.length; i++) {
  const item = last25[i];
  const caseId = item.caseId || item.id;
  const diagnosis = item.caseDetails?.diagnosis || item.caseDetails?.chiefComplaints || 'Unknown';
  const audit = item.audit || {};
  
  // A case passes if there are no flags/issues or if the audit status is not failed
  const isFailed = audit.status === 'FAILED' || audit.issues?.length > 0;
  
  if (isFailed) {
    failCount++;
    console.log(`❌ Case ${caseId} (${diagnosis}): FAILED`);
    console.log(`   Issues:`, audit.issues || audit.details || 'None listed');
  } else {
    passCount++;
    console.log(`✅ Case ${caseId} (${diagnosis}): PASSED`);
  }
}

console.log(`\nSummary: Passed: ${passCount}, Failed: ${failCount}, Total: ${last25.length}`);
