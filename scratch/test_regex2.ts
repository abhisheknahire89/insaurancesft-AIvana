const cleanText = '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor"}],\n  "stillMissing": [{';
let fallbackResult: any = { citedEvidence: [], stillMissing: [], appealTextBody: '' };
const citedMatch = cleanText.match(/"citedEvidence"\s*:\s*(\[[\s\S]*?\])\s*(?:,|$)/);
if (citedMatch) {
  try {
    fallbackResult.citedEvidence = JSON.parse(citedMatch[1]);
  } catch (e) {
    console.log("JSON.parse failed");
  }
}
console.log("fallbackResult:", fallbackResult);
