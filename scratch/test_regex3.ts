const cleanText = '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor"}],\n  "stillMissing": [{';
const citedMatch = cleanText.match(/"citedEvidence"\s*:\s*(\[[\s\S]*?\])\s*(?:,|$)/);
console.log(citedMatch ? citedMatch[1] : "No match");
