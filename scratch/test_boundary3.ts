const trailingText = '{\n  "citedEvidence": [{"a": "b"}]\n}';
const citedMatch = trailingText.match(/"citedEvidence"\s*:\s*(\[[\s\S]*?\])\s*(?:,|$)/);
console.log(citedMatch ? "MATCHED" : "FAILED");
