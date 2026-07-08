const trailingTextBadJson = '{\n  "citedEvidence": [{"a": "b"}]\n}\nThis was a hard case.';

const regex = /"citedEvidence"\s*:\s*(\[[\s\S]*?\])\s*(?:,|$)/;

console.log("Regex match:", trailingTextBadJson.match(regex) ? "MATCHED" : "FAILED");
