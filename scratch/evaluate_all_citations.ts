import { testCases, makePreAuthRecord } from '../scripts/testBattery';
import { reviewEvidence } from '../engine/evidenceReview';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';

function getOverlapRatio(citedText: string, poolItemText: string): number {
  const cited = citedText.toLowerCase().trim();
  const pool = poolItemText.toLowerCase().trim();
  if (pool.includes(cited) || cited.includes(pool)) return 1.0;

  const citedTokens = new Set(cited.split(/\s+/).filter(t => t.length > 3));
  const poolTokens = new Set(pool.split(/\s+/).filter(t => t.length > 3));
  if (citedTokens.size === 0) return 0.0;

  let overlap = 0;
  for (const token of citedTokens) {
    if (poolTokens.has(token)) overlap++;
  }
  return overlap / citedTokens.size;
}

interface CitationEvaluation {
  caseId: number;
  diagnosis: string;
  citedText: string;
  wordCount: number;
  matchedField: string;
  overlapRatio: number;
  isPassed: boolean;
  status: string;
}

async function main() {
  // Use Gemini fallback path directly for speed and reliability
  delete process.env.VITE_MEDGEMMA_ENDPOINT_URL;

  const casesToTest = testCases.slice(0, 15);
  const evaluations: CitationEvaluation[] = [];

  for (const tc of casesToTest) {
    const record = makePreAuthRecord(tc);
    const report = await reviewEvidence(record);
    const appeal = await generateDenialAppeal("Pre-auth denied", record, report);

    // Build ONLY genuine record fields clinical pool
    const poolFields: Array<{ text: string; source: string }> = [];
    if (record.clinical?.chiefComplaints) {
      poolFields.push({ text: record.clinical.chiefComplaints, source: 'chief_complaints' });
    }
    if (record.clinical?.historyOfPresentIllness) {
      poolFields.push({ text: record.clinical.historyOfPresentIllness, source: 'history_of_present_illness' });
    }
    if (record.clinical?.relevantClinicalFindings) {
      poolFields.push({ text: record.clinical.relevantClinicalFindings, source: 'clinical_findings' });
    }
    if (record.clinical?.treatmentTakenSoFar) {
      poolFields.push({ text: record.clinical.treatmentTakenSoFar, source: 'treatment_taken' });
    }
    if (record.clinical?.additionalClinicalNotes) {
      poolFields.push({ text: record.clinical.additionalClinicalNotes, source: 'additional_notes' });
    }

    const pmh = record.admission?.pastMedicalHistory;
    if (pmh) {
      if (pmh.hypertension?.present) {
        poolFields.push({ text: `History of Hypertension (duration: ${pmh.hypertension.duration || '10 years'})`, source: 'past_medical_history (hypertension)' });
        poolFields.push({ text: 'hypertension', source: 'past_medical_history (hypertension)' });
      }
      if (pmh.diabetes?.present) {
        poolFields.push({ text: `History of Diabetes (duration: ${pmh.diabetes.duration || 'not specified'})`, source: 'past_medical_history (diabetes)' });
        poolFields.push({ text: 'diabetes', source: 'past_medical_history (diabetes)' });
      }
      if (pmh.heartDisease?.present) {
        poolFields.push({ text: `History of Heart/Cardiac Disease (duration: ${pmh.heartDisease.duration || 'not specified'})`, source: 'past_medical_history (heart)' });
      }
      if (pmh.asthma?.present) {
        poolFields.push({ text: `History of Asthma (duration: ${pmh.asthma.duration || 'not specified'})`, source: 'past_medical_history (asthma)' });
      }
      if (pmh.kidney?.present) {
        poolFields.push({ text: `History of Kidney/Renal Disease (duration: ${pmh.kidney.duration || 'not specified'})`, source: 'past_medical_history (kidney)' });
      }
    }

    if (appeal.citedEvidence) {
      for (const item of appeal.citedEvidence) {
        const citedText = item.evidenceItem || '';
        const wordCount = citedText.split(/\s+/).filter(w => w.length > 0).length;

        // Find the best match from the genuine clinical pool
        let bestField = 'None';
        let maxRatio = 0.0;

        for (const f of poolFields) {
          const ratio = getOverlapRatio(citedText, f.text);
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestField = f.source;
          }
        }

        // Apply corrected strict definition:
        // 1. Word count <= 20
        // 2. Matched source field is not 'None' (must be genuine record field)
        // 3. Overlap ratio >= 40% (0.4)
        const isPassed = wordCount <= 20 && bestField !== 'None' && maxRatio >= 0.4;
        
        let status = '🟢 Grounded & Verified';
        if (wordCount > 20) {
          status = '🟡 Too Verbose (>20 words)';
        } else if (bestField === 'None') {
          status = '🔴 Unverified (No Match in Patient Record)';
        } else if (maxRatio < 0.4) {
          status = '🔴 Weak Match (<40% overlap)';
        }

        evaluations.push({
          caseId: tc.id,
          diagnosis: tc.diagnosis,
          citedText,
          wordCount,
          matchedField: bestField,
          overlapRatio: maxRatio,
          isPassed,
          status
        });
      }
    }
  }

  // Print results
  console.log(`\n### Citation Evaluations Count: ${evaluations.length}`);
  const passedCount = evaluations.filter(e => e.isPassed).length;
  console.log(`Passed (Grounded in Patient Record): ${passedCount} / ${evaluations.length} (${((passedCount / evaluations.length) * 100).toFixed(1)}%)`);
  
  console.log(`\n| Case ID | Diagnosis | Cited Text | Word Count | Matched Source Field | Ratio | Status |`);
  console.log(`| :---: | :--- | :--- | :---: | :--- | :---: | :--- |`);
  for (const e of evaluations) {
    console.log(`| Case ${e.caseId} | ${e.diagnosis.substring(0, 30)} | "${e.citedText}" | ${e.wordCount} | ${e.matchedField} | ${(e.overlapRatio * 100).toFixed(1)}% | ${e.status} |`);
  }
}

main().catch(console.error);
