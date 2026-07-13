import { testCases, makePreAuthRecord } from '../scripts/testBattery';
import { reviewEvidence } from '../engine/evidenceReview';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';
import { isEvidenceCitationPlausible } from '../engine/denialAppealGenerator';

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

async function main() {
  // Use Gemini fallback path directly to avoid slow local endpoint
  delete process.env.VITE_MEDGEMMA_ENDPOINT_URL;

  console.log(`| Case ID | Diagnosis | Cited Text | Matched Source Field | Computed Ratio |`);
  console.log(`| :--- | :--- | :--- | :--- | :---: |`);

  // Run first 5 cases to generate live examples
  for (const tc of testCases.slice(0, 5)) {
    const record = makePreAuthRecord(tc);
    const report = await reviewEvidence(record);
    const appeal = await generateDenialAppeal("Pre-auth denied", record, report);

    // Build the clinicalPool same way as generator
    const clinicalPool: Array<{ item: string; source: string; forChallenge?: string }> = [];
    if (record.clinical?.chiefComplaints) {
      clinicalPool.push({ item: record.clinical.chiefComplaints, source: 'chief_complaints' });
    }
    if (record.clinical?.historyOfPresentIllness) {
      clinicalPool.push({ item: record.clinical.historyOfPresentIllness, source: 'history_of_present_illness' });
    }
    if (record.clinical?.relevantClinicalFindings) {
      clinicalPool.push({ item: record.clinical.relevantClinicalFindings, source: 'clinical_findings' });
    }
    if (record.clinical?.additionalClinicalNotes) {
      clinicalPool.push({ item: record.clinical.additionalClinicalNotes, source: 'additional_notes' });
    }

    if (appeal.citedEvidence) {
      for (const item of appeal.citedEvidence) {
        // Find best match in clinicalPool
        let bestMatchField = 'None';
        let maxRatio = 0;
        for (const p of clinicalPool) {
          const ratio = getOverlapRatio(item.evidenceItem, p.item);
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestMatchField = p.source;
          }
        }
        console.log(`| Case ${tc.id} | ${tc.diagnosis} | "${item.evidenceItem}" | ${bestMatchField} | ${(maxRatio * 100).toFixed(1)}% |`);
      }
    }
  }
}

main().catch(console.error);
