import * as fs from 'fs';
import * as path from 'path';
import { queryMedGemma } from '../services/llmClient';
import { Type } from '@google/genai';

interface Chunk {
  id: string;
  text: string;
}

async function constrainedCitationGemma(denialReason: string, chunks: Chunk[]) {
  const allowedIds = chunks.map(c => c.id);
  const chunkString = chunks.map(c => `[${c.id}] ${c.text}`).join('\n');

  const prompt = `You are a legal and medical denial appeals officer.
The TPA has denied the pre-auth claim with this reason:
"${denialReason}"

Identify which EXACT text chunks from the patient record act as evidence to counter this denial.
You MUST ONLY return the exact chunk IDs from the list below.

Patient Record Chunks:
${chunkString}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      citation_ids: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: allowedIds },
        description: "Array of chunk IDs that refute the denial reason."
      },
      appeal_argument: {
        type: Type.STRING,
        description: "A short sentence explaining how these citations refute the denial."
      }
    },
    required: ["citation_ids", "appeal_argument"]
  };

  try {
    const rawOut = await queryMedGemma(prompt, "You are a structural citation tool. Only return valid chunk IDs.", schema);
    return JSON.parse(rawOut);
  } catch (err: any) {
    return { error: err.message };
  }
}

async function runBenchmarkRerun() {
  console.log("=== PILOT 3: 39% BENCHMARK RERUN (CHUNK-AND-SELECT) ===\n");
  
  const failureFile = path.join(process.cwd(), 'scratch', 'appeal_failures.jsonl');
  const lines = fs.readFileSync(failureFile, 'utf8').split('\n').filter(l => l.trim().length > 0);
  
  let successCount = 0;
  let totalCount = 0;
  
  for (const line of lines) {
    const data = JSON.parse(line);
    const caseId = data.caseId;
    const denialReason = data.expectedOutput?.denialReason || data.denialReasonsParsed?.[0] || '';
    const evidenceItems = data.evidenceUsed || [];
    
    if (evidenceItems.length === 0 || !denialReason) continue;
    
    const chunks = evidenceItems.map((ev: string, idx: number) => ({
      id: `CHK_${String(idx + 1).padStart(3, '0')}`,
      text: ev
    }));
    
    totalCount++;
    console.log(`\n--- Case: ${caseId} (${data.diagnosis}) ---`);
    console.log(`Denial: ${denialReason}`);
    
    const pilotOut = await constrainedCitationGemma(denialReason, chunks);
    
    if (pilotOut.error) {
        console.log(`❌ FAILED: ${pilotOut.error}`);
    } else if (pilotOut.citation_ids && pilotOut.citation_ids.length > 0) {
        console.log(`✅ SUCCESS: Grounded on ${pilotOut.citation_ids.join(', ')}`);
        for (const id of pilotOut.citation_ids) {
            const chunk = chunks.find(c => c.id === id);
            console.log(`   -> "${chunk?.text}"`);
        }
        successCount++;
    } else {
        console.log(`⚠️ NO CITATIONS FOUND`);
    }
  }
  
  console.log(`\n================================`);
  console.log(`Total Benchmark Failure Cases Re-run: ${totalCount}`);
  console.log(`Grounding Success Rate: ${((successCount / totalCount) * 100).toFixed(1)}%`);
  console.log(`================================`);
}

runBenchmarkRerun().catch(console.error);
