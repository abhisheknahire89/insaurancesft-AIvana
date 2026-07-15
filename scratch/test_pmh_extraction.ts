import { parseTranscriptWithGemini } from '../services/voiceDictationService';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runExtractionTest() {
  console.log("=== Testing Past Medical History AI Extraction ===");
  
  const testTranscript = `
    Patient Devendra Joshi, 58 years old male. 
    He has a history of severe bilateral knee osteoarthritis since 2018, and also suffers from hyperlipidemia. 
    Chief complaints: chest pain on exertion. 
    Vitals: BP is 140/80, pulse 76, temp 98.6, SpO2 98%.
    Proposed treatment: Coronary angioplasty.
  `;

  console.log("Dictation transcript to parse:", testTranscript);

  try {
    const extracted = await parseTranscriptWithGemini(testTranscript);
    console.log("\n=== Extracted Past Medical History ===");
    console.log(JSON.stringify(extracted.admission.pastMedicalHistory, null, 2));
  } catch (err) {
    console.error("AI Extraction failed:", err);
  }
}

runExtractionTest();
