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

const trailingText = '{\n  "citedEvidence": [{"a": "b"}]\n}\nThis was a hard case.';

console.log("Trailing Text:");
let cleanText = stripMarkdown(trailingText);
console.log(cleanText);

let parsed: any;
let fallbackResult: any = { citedEvidence: [], stillMissing: [], appealTextBody: '' };
try {
  parsed = JSON.parse(cleanText);
  console.log("Primary JSON.parse SUCCEEDED!");
} catch (e) {
  console.log("Primary JSON.parse THREW!");
  const citedMatch = cleanText.match(/"citedEvidence"\s*:\s*(\[[\s\S]*?\])\s*(?:,|$)/);
  if (citedMatch) {
    try {
      fallbackResult.citedEvidence = JSON.parse(citedMatch[1]);
      console.log("Fallback Regex SUCCEEDED!");
      console.log("Extracted citedEvidence:", fallbackResult.citedEvidence);
    } catch (err) {
      console.log("Fallback Regex THREW inside citedMatch!");
    }
  } else {
    console.log("Fallback Regex FAILED to match!");
  }
}
