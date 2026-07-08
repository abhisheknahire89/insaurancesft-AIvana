function extractJson(text: string): string {
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return text.trim();
  
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(startIdx, i + 1);
        }
      }
    }
  }
  return text.substring(startIdx);
}

const trailingText = '{\n  "citedEvidence": [{"a": "b"}]\n}\nThis was a hard case.';
const truncated = '{\n  "citedEvidence": [{"a": "b"}],\n  "stillMissing": [{\n';
const fullWrapped = '```json\n{\n  "citedEvidence": [{"a": "b"}],\n  "stillMissing": []\n}\n```';

console.log("Trailing Text:");
let cleanTrailing = extractJson(trailingText);
console.log(cleanTrailing);
console.log("Parses:", (() => { try { JSON.parse(cleanTrailing); return true; } catch(e) { return false; }})());

console.log("\nTruncated:");
let cleanTruncated = extractJson(truncated);
console.log(cleanTruncated);
const regex = /"citedEvidence"\s*:\s*(\[[\s\S]*?\])\s*(?:,|$)/;
console.log("Regex match:", cleanTruncated.match(regex) ? "MATCHED" : "FAILED");

console.log("\nFull Wrapped:");
let cleanFull = extractJson(fullWrapped);
console.log(cleanFull);
console.log("Parses:", (() => { try { JSON.parse(cleanFull); return true; } catch(e) { return false; }})());
