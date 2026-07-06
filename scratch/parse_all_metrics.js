import * as fs from 'fs';

const rawLogPath = '/Users/abhishekpravinnahire/V1 tpa insaurance/logs/multi_module_raw.jsonl';
if (!fs.existsSync(rawLogPath)) {
  console.log('No raw logs file found.');
  process.exit(0);
}

const fileContent = fs.readFileSync(rawLogPath, 'utf8').trim();
const lines = fileContent.split('\n').filter(Boolean);

console.log(`Total test cases in raw log: ${lines.length}`);

// Modules: document extraction, evidence review, ICD coding, billing, denial appeals, safety
const moduleStats = {
  extraction: { tested: 0, passed: 0 },
  evidence: { tested: 0, passed: 0 },
  coding: { tested: 0, passed: 0 },
  billing: { tested: 0, passed: 0 },
  appeal: { tested: 0, passed: 0 },
  safety: { tested: 0, passed: 0 }
};

lines.forEach((line) => {
  try {
    const item = JSON.parse(line);
    const outputs = item.outputs || {};
    const audit = item.audit || {};
    const issues = audit.issues || [];
    
    // Determine which modules are tested in this case based on what output exists
    // 1. extraction (always runs)
    if (outputs.extraction !== undefined && outputs.extraction !== 'not implemented') {
      moduleStats.extraction.tested++;
      const hasExtractionIssue = issues.some(iss => iss.toLowerCase().includes('extract') || iss.toLowerCase().includes('document'));
      if (!hasExtractionIssue) moduleStats.extraction.passed++;
    }
    
    // 2. evidence (evidence review)
    if (outputs.review !== undefined && outputs.review !== 'not implemented') {
      moduleStats.evidence.tested++;
      const hasEvidenceIssue = issues.some(iss => iss.toLowerCase().includes('evidence') || iss.toLowerCase().includes('review') || iss.toLowerCase().includes('clinical'));
      if (!hasEvidenceIssue) moduleStats.evidence.passed++;
    }
    
    // 3. coding (ICD coding)
    if (outputs.coding !== undefined && outputs.coding !== 'not implemented') {
      moduleStats.coding.tested++;
      const hasCodingIssue = issues.some(iss => iss.toLowerCase().includes('coding') || iss.toLowerCase().includes('icd') || iss.toLowerCase().includes('code'));
      if (!hasCodingIssue) moduleStats.coding.passed++;
    }
    
    // 4. billing (Billing Coder)
    if (outputs.billing !== undefined && outputs.billing !== 'not implemented') {
      moduleStats.billing.tested++;
      const hasBillingIssue = issues.some(iss => iss.toLowerCase().includes('billing') || iss.toLowerCase().includes('cost') || iss.toLowerCase().includes('rent') || iss.toLowerCase().includes('amount') || iss.toLowerCase().includes('reconcile') || iss.toLowerCase().includes('cashless') || iss.toLowerCase().includes('patient'));
      if (!hasBillingIssue) moduleStats.billing.passed++;
    }
    
    // 5. appeal (Denial Appeals)
    if (outputs.appeal !== undefined && outputs.appeal !== 'not implemented') {
      moduleStats.appeal.tested++;
      const hasAppealIssue = issues.some(iss => iss.toLowerCase().includes('appeal') || iss.toLowerCase().includes('denial') || iss.toLowerCase().includes('evidence gap') || iss.toLowerCase().includes('comorbidity') || iss.toLowerCase().includes('hypertension'));
      if (!hasAppealIssue) moduleStats.appeal.passed++;
    }
    
    // 6. safety
    // Safety applies to all runs, let's check for "leak" or "safety" issues
    moduleStats.safety.tested++;
    const hasSafetyIssue = issues.some(iss => iss.toLowerCase().includes('safety') || iss.toLowerCase().includes('leak') || iss.toLowerCase().includes('phi') || iss.toLowerCase().includes('pii'));
    if (!hasSafetyIssue) moduleStats.safety.passed++;
    
  } catch (e) {
    // Skip malformed lines
  }
});

console.log('\n======================================');
console.log('📊 MODULE-BY-MODULE METRICS SUMMARY');
console.log('======================================');
Object.keys(moduleStats).forEach((modName) => {
  const stats = moduleStats[modName];
  const passRate = stats.tested > 0 ? ((stats.passed / stats.tested) * 100).toFixed(1) : '0.0';
  console.log(`${modName.toUpperCase().padEnd(12)}: Tested: ${stats.tested.toString().padEnd(4)} | Passed: ${stats.passed.toString().padEnd(4)} | Pass Rate: ${passRate}%`);
});
console.log('======================================');
