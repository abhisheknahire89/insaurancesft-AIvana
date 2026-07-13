import { queryMedGemma } from '../services/llmClient';
import { Type } from '@google/genai';

interface Chunk {
  id: string;
  sourceField: string;
  text: string;
}

function chunkRecord(record: any): Chunk[] {
  const chunks: Chunk[] = [];
  let counter = 1;

  const fields = [
    { name: 'chiefComplaints', text: record.clinical?.chiefComplaints },
    { name: 'historyOfPresentIllness', text: record.clinical?.historyOfPresentIllness },
    { name: 'relevantClinicalFindings', text: record.clinical?.relevantClinicalFindings },
  ];

  for (const field of fields) {
    if (!field.text) continue;
    // Split by period to get sentences
    const sentences = field.text.split('. ').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    for (const sentence of sentences) {
      chunks.push({
        id: `CHUNK_${String(counter++).padStart(3, '0')}`,
        sourceField: field.name,
        text: sentence.endsWith('.') ? sentence : sentence + '.'
      });
    }
  }

  return chunks;
}

async function constrainedCitationGemma(denialReason: string, chunks: Chunk[]) {
  const allowedIds = chunks.map(c => c.id);
  const chunkString = chunks.map(c => `[${c.id}] ${c.text}`).join('\n');

  const prompt = `You are a legal and medical denial appeals officer.
The TPA has denied the pre-auth claim with this reason:
"${denialReason}"

Your job is to identify which EXACT text chunks from the patient record act as evidence to counter this denial.
You MUST ONLY return the exact chunk IDs from the list below.

Patient Record Chunks:
${chunkString}
`;

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
    const rawOut = await queryMedGemma(prompt, "You are a structural citation tool. Pick valid chunk IDs only.", schema);
    const result = JSON.parse(rawOut);
    
    const citedText = result.citation_ids.map((id: string) => {
      const chunk = chunks.find(c => c.id === id);
      return chunk ? chunk.text : `[ERROR: Invalid ID ${id}]`;
    });
    
    return { argument: result.appeal_argument, citations: citedText, rawIds: result.citation_ids };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function unconstrainedCitationGemma(denialReason: string, narrative: string) {
    const prompt = `You are a legal and medical denial appeals officer.
The TPA has denied the pre-auth claim with this reason:
"${denialReason}"

Clinical Narrative:
"${narrative}"

Generate the exact clinical evidence strings you would cite from the narrative to refute the denial.
`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            citations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Exact quotes from narrative" }
        },
        required: ["citations"]
    };

    const rawOut = await queryMedGemma(prompt, "You are an appeals generator.", schema);
    return JSON.parse(rawOut);
}

async function runPilot3() {
  console.log("=== PILOT 3: AEGIS CHUNK-AND-SELECT CITATION ===\n");
  
  const record = {
    clinical: {
      chiefComplaints: 'heavy menstrual bleeding, severe abdominal pain.',
      historyOfPresentIllness: 'Patient has had a history of menorrhagia. Failed medical management with Tranexamic acid and Hormonal pills over the last few months. Uterus enlarged to 14 weeks size.',
      relevantClinicalFindings: 'Large intramural fibroid measuring 6x5 cm on USG. Hemoglobin: 8.2 g/dL.'
    }
  };
  
  const denialReason = "Pre-auth denied as conservative management trial documentation is insufficient for a surgical claim.";

  const fullNarrative = `${record.clinical.chiefComplaints} ${record.clinical.historyOfPresentIllness} ${record.clinical.relevantClinicalFindings}`;
  
  console.log(`Denial Reason: ${denialReason}`);
  
  console.log("\n[Baseline / Generate-then-Validate]");
  const base = await unconstrainedCitationGemma(denialReason, fullNarrative);
  console.log(`Generated Citations (Prone to hallucination/paraphrasing):\n${JSON.stringify(base.citations, null, 2)}`);
  
  console.log("\n[Pilot / Chunk-and-Select]");
  const chunks = chunkRecord(record);
  const pilot = await constrainedCitationGemma(denialReason, chunks);
  console.log(`Selected Chunk IDs: ${JSON.stringify(pilot.rawIds)}`);
  console.log(`Deterministic Citations (Guaranteed 100% Grounding):\n${JSON.stringify(pilot.citations, null, 2)}`);
  console.log(`Appeal Argument: ${pilot.argument}`);
}

runPilot3().catch(console.error);
