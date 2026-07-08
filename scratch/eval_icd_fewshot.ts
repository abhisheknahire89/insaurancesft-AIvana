import fs from 'fs';
import { assignICDViaModel, isIcdCodePlausible } from '../services/icdService';

// Set BLIND_MODE to true
process.env.BLIND_MODE = 'true';

const categoryRules = [
  { name: 'ophthalmology', keywords: ['cataract', 'eye', 'phaco', 'lens', 'vision', 'ophthal'] },
  { name: 'maternity', keywords: ['pregnancy', 'lscs', 'delivery', 'gestation', 'obstetric', 'primi', 'term', 'caesarean', 'cesarean'] },
  { name: 'gynecology', keywords: ['fibroid', 'uterus', 'hysterectomy', 'myomectomy', 'leiomyoma', 'menorrhagia', 'bulky'] },
  { name: 'orthopedics', keywords: ['knee', 'osteoarthritis', 'tkr', 'arthroplasty', 'gonarthrosis'] },
  { name: 'ckd', keywords: ['hemodialysis', 'dialysis', 'ckd', 'esrd', 'renal', 'kidney'] },
  { name: 'dengue', keywords: ['dengue', 'thrombocytopenia', 'petechiae', 'platelet'] },
  { name: 'typhoid', keywords: ['typhoid', 'enteric', 'widal'] },
  { name: 'appendicitis', keywords: ['appendicitis', 'appendectomy', 'appendix'] },
  { name: 'gastroenteritis', keywords: ['gastroenteritis', 'diarrhea', 'vomiting', 'food poisoning', 'stools', 'dehydration'] },
  { name: 'cardiac', keywords: ['angina', 'cad', 'tvd', 'cabg', 'heart', 'coronary', 'restenosis', 'ischemic'] }
];

function getCategoryForDiag(diagText: string): string {
  const norm = diagText.toLowerCase();
  for (const rule of categoryRules) {
    if (rule.keywords.some(k => norm.includes(k))) {
      // Avoid cross-classifying knee OA as eye
      if (rule.name === 'ophthalmology' && (norm.includes('gonarthrosis') || norm.includes('osteoarthritis'))) {
        continue;
      }
      return rule.name;
    }
  }
  return 'other';
}

async function run() {
  console.log('Extracting and analyzing genuinely wrong cases from logs/failure_intelligence.jsonl...');
  const lines = fs.readFileSync('logs/failure_intelligence.jsonl', 'utf8').split('\n').filter(Boolean);

  const testCases: any[] = [];
  for (const line of lines) {
    const j = JSON.parse(line);
    if (j.module === 'coding') {
      const cat = getCategoryForDiag(j.diagnosis);
      if (cat !== 'other') {
        testCases.push({ ...j, computedCategory: cat });
      }
    }
  }

  console.log(`Found ${testCases.length} covered coding cases for live evaluation.`);

  const stats: Record<string, { total: number; passed: number; failed: number; stillFailing: any[] }> = {};
  for (const r of categoryRules) {
    stats[r.name] = { total: 0, passed: 0, failed: 0, stillFailing: [] };
  }

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const cat = tc.computedCategory;
    stats[cat].total++;

    try {
      const candidates = await assignICDViaModel(tc.diagnosis, tc.clinicalNarrative);
      const code = candidates[0]?.code || 'Pending ICD-10';
      const isOk = isIcdCodePlausible(code, tc.diagnosis);
      
      if (isOk) {
        stats[cat].passed++;
      } else {
        stats[cat].failed++;
        if (stats[cat].stillFailing.length < 2) {
          stats[cat].stillFailing.push({
            diagnosis: tc.diagnosis,
            narrative: tc.clinicalNarrative ? (tc.clinicalNarrative.substring(0, 80) + '...') : '',
            actualCode: code,
            actualDescription: candidates[0]?.description || 'None'
          });
        }
      }
      process.stdout.write(`\rEvaluated ${i + 1}/${testCases.length} cases...`);
    } catch (err: any) {
      stats[cat].failed++;
    }
  }

  console.log('\n\n========================================');
  console.log('   EVALUATION RESULTS GROUPED BY CATEGORY');
  console.log('========================================');
  for (const cat of Object.keys(stats)) {
    const s = stats[cat];
    const passRate = s.total > 0 ? ((s.passed / s.total) * 100).toFixed(1) : 'N/A';
    console.log(`${cat.toUpperCase()}:`);
    console.log(`  Total Cases: ${s.total}`);
    console.log(`  Passed:      ${s.passed}`);
    console.log(`  Failed:      ${s.failed}`);
    console.log(`  Pass Rate:   ${passRate}%`);
    if (s.stillFailing.length > 0) {
      console.log(`  Sample Failures:`);
      console.log(JSON.stringify(s.stillFailing, null, 2));
    }
    console.log('----------------------------------------');
  }
}

run().catch(console.error);
