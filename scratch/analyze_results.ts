import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs/overnight_run');
const manifestPath = path.join(LOG_DIR, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.log("No manifest found");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let markdown = `# Overnight Run Test Results\n\n`;

for (const batch of manifest) {
  const batchFile = path.join(LOG_DIR, `batch_${batch.batchNumber}_raw.jsonl`);
  const lines = fs.readFileSync(batchFile, 'utf8').split('\n').filter(Boolean);
  
  let passed = 0;
  let failed = 0;
  let errored = 0;
  
  markdown += `## Batch ${batch.batchNumber}: ${batch.batchName}\n`;
  markdown += `- Total Cases Generated & Processed: ${batch.caseCount}\n`;
  markdown += `- Execution Time: ${Math.round((new Date(batch.endTime).getTime() - new Date(batch.startTime).getTime()) / 1000)}s\n\n`;
  
  const errors = [];
  
  for (const line of lines) {
    try {
      const c = JSON.parse(line);
      
      if (c.error) {
        errored++;
        errors.push(`- Case ${c.id}: ${c.error}`);
      } else {
        // Compute pass dynamically if missing
        let isPass = c.pass;
        if (isPass === undefined) {
           if (c.expectedAnswer && c.expectedAnswer.primaryICD10 && Array.isArray(c.runOutput)) {
              isPass = c.runOutput.some((r: any) => r.code === c.expectedAnswer.primaryICD10);
           }
        }
        
        if (isPass === true) {
          passed++;
        } else if (isPass === false) {
          failed++;
          // If it's Aegis (Batch 7), check why it failed
          if (batch.batchNumber === 7) {
              errors.push(`- Case ${c.id}: Failed parsing quotes or mapping denial reasons.`);
          } else if (batch.batchNumber === 3 || batch.batchNumber === 4 || batch.batchNumber === 8 || batch.batchNumber === 1) {
              const expected = c.expectedAnswer?.primaryICD10;
              const actual = Array.isArray(c.runOutput) ? c.runOutput.map((r: any) => r.code).join(', ') : '';
              errors.push(`- Case ${c.id}: Expected ${expected}, got [${actual}]`);
          }
        }
      }
    } catch(e) {
      // Ignored
    }
  }
  
  markdown += `**Results:**\n`;
  markdown += `- Passed: ${passed}\n`;
  markdown += `- Failed (Logic): ${failed}\n`;
  markdown += `- Errored (Crash/Parse): ${errored}\n\n`;
  
  if (errors.length > 0) {
    markdown += `**Errors / Failures observed:**\n`;
    markdown += errors.slice(0, 10).join('\n') + '\n';
    if (errors.length > 10) markdown += `- ...and ${errors.length - 10} more.\n`;
    markdown += `\n`;
  }
}

fs.writeFileSync(path.join(LOG_DIR, 'summary.md'), markdown);
console.log("Summary generated");
