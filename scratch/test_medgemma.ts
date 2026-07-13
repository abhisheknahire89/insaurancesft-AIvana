import { queryMedGemma } from '../services/llmClient';

async function main() {
  process.env.VITE_MEDGEMMA_ENDPOINT_URL = 'http://127.0.0.1:11434/v1/chat/completions';
  console.log('Testing queryMedGemma with endpoint:', process.env.VITE_MEDGEMMA_ENDPOINT_URL);
  try {
    const res = await queryMedGemma('Recommend a valid WHO ICD-10 code for "cataract"', 'You are a WHO medical coding assistant. Respond with JSON: {"code": "...", "description": "..."}');
    console.log('Ollama Response:');
    console.log(res);
  } catch (err: any) {
    console.error('Ollama Error:', err.message);
  }
}

main().catch(console.error);
