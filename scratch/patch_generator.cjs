const fs = require('fs');
let code = fs.readFileSync('engine/denialAppealGenerator.ts', 'utf-8');

// Fix 1: Deduplicate citedEvidence
const fix1 = `
  // Fix 1: Deduplicate citedEvidence by exact or near-exact evidenceItem text
  const seenItems = new Set<string>();
  citedEvidence = citedEvidence.filter(ce => {
    const key = ce.evidenceItem.toLowerCase().trim();
    if (seenItems.has(key)) return false;
    seenItems.add(key);
    return true;
  });
`;
code = code.replace('const addressedCount = citedEvidence.length;', fix1 + '\n  const addressedCount = citedEvidence.length;');

// Fix 2: System prompt for granularity
const fix2 = `5. JSON ESCAPE RULE: In the \\"appealTextBody\\" string, you must escape any double quotes (use \\\\\\" instead of \\") and represent newlines using \\\\n. The JSON must be fully valid and parseable without syntax errors.
6. CITATION GRANULARITY: Extract ONLY the specific phrase or sentence that directly supports the challenge. DO NOT cite the entire paragraph or raw text field. The extracted text MUST be an exact unedited substring of the Clinical Pool item.`;
code = code.replace('5. JSON ESCAPE RULE: In the \\"appealTextBody\\" string, you must escape any double quotes (use \\\\\\" instead of \\") and represent newlines using \\\\n. The JSON must be fully valid and parseable without syntax errors.', fix2);

// Fix 3 & 4: stillMissing wiring + exact denial reason snap
const fix34 = `
  // Fix 3 & 4: Snap paraphrased denial reasons to original and inject insufficientEvidence
  const getOriginalReason = (paraphrased: string) => {
    if (reasons.length === 1) return reasons[0];
    const match = reasons.find(r => r === paraphrased || r.includes(paraphrased) || paraphrased.includes(r));
    return match || paraphrased;
  };

  citedEvidence.forEach((ce: any) => {
    ce.denialReason = getOriginalReason(ce.denialReason);
  });

  stillMissing.forEach((sm: any) => {
    sm.denialReason = getOriginalReason(sm.denialReason);
    if (existingReport && Array.isArray(existingReport.insufficientEvidence) && existingReport.insufficientEvidence.length > 0) {
      sm.explanation = 'Required clinical evidence missing: ' + existingReport.insufficientEvidence.join(', ');
    } else {
      sm.explanation = 'No matching confirmed evidence found in the submitted pre-authorization report.';
    }
  });

  // Remove exact duplicates from stillMissing after snapping
  const uniqueMissing: any[] = [];
  const seenMissing = new Set();
  for (const sm of stillMissing) {
    if (!seenMissing.has(sm.denialReason)) {
      seenMissing.add(sm.denialReason);
      uniqueMissing.push(sm);
    }
  }
  stillMissing.splice(0, stillMissing.length, ...uniqueMissing);
`;
code = code.replace('  // Dynamic expected citations mapping overlay', fix34 + '\n  // Dynamic expected citations mapping overlay');

// Change let citedEvidence to allow assignment if necessary
code = code.replace('const citedEvidence: CitedEvidenceItem[] = [];', 'let citedEvidence: CitedEvidenceItem[] = [];');

fs.writeFileSync('scratch/denialAppealGenerator_fixed.ts', code);
