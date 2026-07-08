const trailingText = '{\n  "citedEvidence": [{"a": "b"}]\n}\nThis was a hard case.';
const truncated = '{\n  "citedEvidence": [{"a": "b"}],\n  "stillMissing": [{\n';

const regex = /"citedEvidence"\s*:\s*(\[[\s\S]*?\])(?=\s*(?:,|\]|\}|$))/;

console.log("trailingText match:", trailingText.match(regex) ? trailingText.match(regex)![1] : "FAILED");
console.log("truncated match:", truncated.match(regex) ? truncated.match(regex)![1] : "FAILED");
