const testCases = [
  {
    name: 'Truncated mid-array',
    content: '{\n  "citedEvidence": [\n    {\n      "denialReason": "Claim denied",\n      "evidenceItem": "Shock",\n      "source": "anchor"'
  },
  {
    name: 'Missing closing bracket',
    content: '{\n  "citedEvidence": [],\n  "stillMissing": []'
  },
  {
    name: 'Prose before JSON',
    content: 'Here is the JSON:\n```json\n{\n  "citedEvidence": [{"a":"b"}],\n  "stillMissing": []\n}\n```'
  },
  {
    name: 'Prose after JSON',
    content: '{\n  "citedEvidence": [{"a":"b"}],\n  "stillMissing": []\n}\nThis was a hard case.'
  },
  {
    name: 'Unescaped quote in string',
    content: '{\n  "citedEvidence": [{"a":"b"}],\n  "stillMissing": [{\n    "denialReason": "Claim denied as "hospitalization" is short",\n    "explanation": "test"\n  }]\n}'
  },
  {
    name: 'Unescaped quote at start of string',
    content: '{\n  "citedEvidence": [{"a":"b"}],\n  "stillMissing": [{\n    "denialReason": ""Claim denied",\n    "explanation": "test"\n  }]\n}'
  },
  {
    name: 'Valid citedEvidence, truncated stillMissing',
    content: '{\n  "citedEvidence": [{"denialReason": "Claim denied", "evidenceItem": "Shock", "source": "anchor"}],\n  "stillMissing": [{'
  },
  {
    name: 'Plain prose (no JSON)',
    content: 'The patient was admitted for gastroenteritis. There is no evidence.'
  },
  {
    name: 'Trailing Text (Original task)',
    content: '{\n  "citedEvidence": [{"a": "b"}]\n}\nThis was a hard case.'
  }
];

for (const tc of testCases) {
  let cleanText = tc.content.trim();
  const startIdx = cleanText.indexOf('{');
  if (startIdx !== -1) {
    cleanText = cleanText.substring(startIdx);
  }

  let parsed: any;
  let fallbackResult: any = { citedEvidence: [], stillMissing: [], appealTextBody: '' };
  let primarySuccess = false;

  // Simulate stripping just the markdown wrappers if it ends cleanly (for Prose before/after)
  const endIdx = cleanText.lastIndexOf('}');
  if (endIdx !== -1) {
    const trailing = cleanText.substring(endIdx + 1).trim();
    if (trailing === '' || /^`{1,3}/.test(trailing)) {
      cleanText = cleanText.substring(0, endIdx + 1);
    }
  }

  try {
    parsed = JSON.parse(cleanText);
    primarySuccess = true;
  } catch (parseErr) {
    const citedMatch = cleanText.match(/"citedEvidence"\s*:\s*(\[[\s\S]*?\])(?=\s*(?:,|\]|\}|$))/);
    if (citedMatch) {
      try {
        fallbackResult.citedEvidence = JSON.parse(citedMatch[1]);
      } catch (e) {
        // regex object-by-object fallback
      }
    }
    const missingMatch = cleanText.match(/"stillMissing"\s*:\s*(\[[\s\S]*?\])(?=\s*(?:,|\]|\}|$))/);
    if (missingMatch) {
      try {
        fallbackResult.stillMissing = JSON.parse(missingMatch[1]);
      } catch (e) {
        // regex object-by-object fallback
      }
    }
  }

  if (primarySuccess) {
    console.log(`[${tc.name}] -> Primary JSON.parse SUCCEEDED!`);
  } else {
    console.log(`[${tc.name}] -> Fallback regex citedEvidence length: ${fallbackResult.citedEvidence.length}`);
  }
}
