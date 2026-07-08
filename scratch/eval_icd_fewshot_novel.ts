import fs from 'fs';
import { assignICDViaModel, isIcdCodePlausible } from '../services/icdService';

process.env.BLIND_MODE = 'true';

const categoryRules = [
  { name: 'gynecology', keywords: ['fibroid', 'uterus', 'hysterectomy', 'myomectomy', 'leiomyoma', 'menorrhagia', 'bulky'] },
  { name: 'orthopedics', keywords: ['knee', 'osteoarthritis', 'tkr', 'arthroplasty', 'gonarthrosis'] }
];

const seedDiagnoses = [
  "Uterine Fibroids (Intramural)",
  "Primary Osteoarthritis Right Knee"
];

function getCategoryForDiag(diagText: string): string | null {
  const norm = diagText.toLowerCase();
  for (const rule of categoryRules) {
    if (rule.keywords.some(k => norm.includes(k))) {
      return rule.name;
    }
  }
  return null;
}

async function run() {
  console.log('Parsing logs/failure_intelligence.jsonl...');
  const lines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8').split('\n').filter(Boolean);

  const testCases: any[] = [];
  const seenIds = new Set<string>();

  for (const line of lines) {
    const j = JSON.parse(line);
    if (j.module === 'coding') {
      const cat = getCategoryForDiag(j.diagnosis);
      if (cat) {
        // Exclude verbatim seed cases
        if (seedDiagnoses.includes(j.diagnosis)) {
          continue;
        }
        // Deduplicate cases by diagnosis to keep it clean if needed, or run all unique occurrences
        const caseKey = `${j.diagnosis}-${j.caseId}`;
        if (!seenIds.has(caseKey)) {
          seenIds.add(caseKey);
          testCases.push({ ...j, computedCategory: cat });
        }
      }
    }
  }

  console.log(`Found ${testCases.length} genuinely novel (non-seed) cases.`);

  let passed = 0;
  let failed = 0;
  const resultsList: any[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    try {
      const candidates = await assignICDViaModel(tc.diagnosis, tc.clinicalNarrative);
      const code = candidates[0]?.code || 'Pending ICD-10';
      const isOk = isIcdCodePlausible(code, tc.diagnosis);
      
      if (isOk) {
        passed++;
      } else {
        failed++;
      }

      resultsList.push({
        diagnosis: tc.diagnosis,
        expectedCategory: tc.computedCategory,
        actualCode: code,
        actualDescription: candidates[0]?.description || 'None',
        plausible: isOk
      });
      
      console.log(`Evaluated ${i + 1}/${testCases.length}: "${tc.diagnosis}" -> ${code} (${isOk ? 'PASS' : 'FAIL'})`);
    } catch (err: any) {
      failed++;
      resultsList.push({
        diagnosis: tc.diagnosis,
        expectedCategory: tc.computedCategory,
        actualCode: 'ERROR',
        actualDescription: err.message,
        plausible: false
      });
    }
  }

  console.log('\n--- FINAL NOVEL CASES VERDICT ---');
  console.log(`Novel Cases Passed: ${passed} / ${testCases.length}`);
  console.log(`Novel Cases Failed: ${failed} / ${testCases.length}`);
  console.log(`Genuinely Novel Pass Rate: ${(passed / testCases.length * 100).toFixed(1)}%`);

  console.log('\n--- FULL LIST OF NOVEL RESULTS ---');
  console.log(JSON.stringify(resultsList, null, 2));
}

run().catch(console.error);
