function stripMarkdown(responseText: string) {
  let cleanText = responseText.trim();
  const startIdx = cleanText.indexOf('{');
  if (startIdx !== -1) {
    cleanText = cleanText.substring(startIdx);
  }
  const endIdx = cleanText.lastIndexOf('}');
  if (endIdx !== -1) {
    const trailing = cleanText.substring(endIdx + 1).trim();
    if (trailing === '' || /^`{1,3}/.test(trailing)) {
      cleanText = cleanText.substring(0, endIdx + 1);
    }
  }
  return cleanText;
}

const truncated = '```json\n{\n  "citedEvidence": [{"a": "b"}],\n  "stillMissing": [{\n';
const fullWrapped = '```json\n{\n  "citedEvidence": [{"a": "b"}],\n  "stillMissing": []\n}\n```';
const fullNoWrap = '{\n  "citedEvidence": [{"a": "b"}],\n  "stillMissing": []\n}';
const trailingText = '{\n  "citedEvidence": [{"a": "b"}]\n}\nThis was a hard case.';

console.log("Truncated:");
console.log(stripMarkdown(truncated));
console.log("\nFull Wrapped:");
console.log(stripMarkdown(fullWrapped));
console.log("\nFull No Wrap:");
console.log(stripMarkdown(fullNoWrap));
console.log("\nTrailing Text:");
console.log(stripMarkdown(trailingText));
