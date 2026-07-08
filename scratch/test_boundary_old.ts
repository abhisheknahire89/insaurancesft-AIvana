const responseText = '{\n  "citedEvidence": [{"a": "b"}]\n}\nThis was a hard case.';
let cleanText = responseText.trim();
const startIdx = cleanText.indexOf('{');
const endIdx = cleanText.lastIndexOf('}');
if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
  cleanText = cleanText.substring(startIdx, endIdx + 1);
}

console.log("OLD cleanText:", cleanText);

let parsed: any;
try {
  parsed = JSON.parse(cleanText);
  console.log("OLD JSON.parse SUCCEEDED!");
} catch (e) {
  console.log("OLD JSON.parse THREW!");
}
