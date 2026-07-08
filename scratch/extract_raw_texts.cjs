const fs = require('fs');

function run() {
  const files = fs.readdirSync('logs').filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));
  const targetIds = [24936, 24937, 24938];
  
  // Try to find the objects inside regression_suite.json
  try {
    const rs = JSON.parse(fs.readFileSync('logs/regression_suite.json', 'utf8'));
    const cases = rs.cases || rs.entries || rs;
    if (Array.isArray(cases)) {
      for (const c of cases) {
        if (targetIds.includes(c.id) || targetIds.includes(c.caseId)) {
           console.log(`FOUND RAW TEXT FOR ${c.id || c.caseId} in regression_suite.json:`);
           console.log(c.rawDocumentText || c.caseInput?.rawDocumentText || '(no raw text)');
           console.log('---');
        }
      }
    }
  } catch(e) {}
  
  for (const file of files) {
    if (file === 'regression_suite.json') continue;
    const content = fs.readFileSync('logs/' + file, 'utf8');
    for (const line of content.split('\n')) {
      if (!line) continue;
      for (const id of targetIds) {
        if (line.includes(`"id": ${id}`) || line.includes(`"id":${id}`) || line.includes(`"caseId": ${id}`)) {
          try {
            const parsed = JSON.parse(line);
            const rawText = parsed.rawDocumentText || parsed.caseInput?.rawDocumentText || parsed.testCase?.rawDocumentText;
            if (rawText) {
              console.log(`FOUND RAW TEXT FOR ${id} in ${file}:`);
              console.log(rawText);
              console.log('---');
            }
          } catch(e) {}
        }
      }
    }
  }
}
run();
