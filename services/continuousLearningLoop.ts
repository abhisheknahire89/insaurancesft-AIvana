import * as fs from 'fs';
import * as path from 'path';
import { LlmReasoningOutput } from './llmClient';

// import { fileURLToPath } from 'url'; // Removed for browser compatibility
// Handling ES Modules environment correctly
const getDirname = () => {
    try {
        if (typeof __dirname !== 'undefined') return __dirname;
        if (typeof process !== 'undefined') return process.cwd();
        return '';
    } catch {
        return '';
    }
};

const FEW_SHOT_STORE_PATH = path.join(getDirname(), '..', 'data', 'fewShotStore.json');

export interface FewShotExample {
  input: string;
  expectedOutput: LlmReasoningOutput;
}

export interface FewShotStore {
  [category: string]: FewShotExample[];
}

/**
 * Loads the few-shot store from the JSON file.
 */
export function loadFewShotStore(): FewShotStore {
  if (!fs.existsSync(FEW_SHOT_STORE_PATH)) {
    return {};
  }
  try {
    const data = fs.readFileSync(FEW_SHOT_STORE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`[ContinuousLearningLoop] Failed to load fewShotStore:`, error);
    return {};
  }
}

/**
 * Saves the few-shot store back to the JSON file.
 */
function saveFewShotStore(store: FewShotStore) {
  try {
    fs.writeFileSync(FEW_SHOT_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[ContinuousLearningLoop] Failed to save fewShotStore:`, error);
  }
}

/**
 * Given a diagnosis, identifies the relevant ICD-10 chapter category.
 */
export function getCategoryForDiagnosis(diagnosisText: string): string | null {
  const diagLower = diagnosisText.toLowerCase();

  if (diagLower.includes('cataract') || diagLower.includes('eye') || diagLower.includes('phaco') || diagLower.includes('lens') || diagLower.includes('vision') || diagLower.includes('ophthal')) {
    if (!diagLower.includes('gonarthrosis') && !diagLower.includes('osteoarthritis')) {
      return 'ophthalmology';
    }
  }

  if (diagLower.includes('pregnancy') || diagLower.includes('lscs') || diagLower.includes('delivery') || diagLower.includes('gestation') || diagLower.includes('obstetric') || diagLower.includes('primi') || diagLower.includes('term') || diagLower.includes('caesarean') || diagLower.includes('cesarean')) {
    return 'maternity';
  }

  if (diagLower.includes('fibroid') || diagLower.includes('uterus') || diagLower.includes('hysterectomy') || diagLower.includes('myomectomy') || diagLower.includes('leiomyoma') || diagLower.includes('menorrhagia') || diagLower.includes('bulky')) {
    return 'gynecology';
  }

  if (diagLower.includes('knee') || diagLower.includes('osteoarthritis') || diagLower.includes('tkr') || diagLower.includes('arthroplasty') || diagLower.includes('gonarthrosis')) {
    return 'orthopedics';
  }

  return null;
}

/**
 * Promotes a human-corrected reasoning output to the few-shot store to prevent future hallucinations.
 * Keeps a maximum of 3 examples per category to prevent prompt bloat.
 */
export function promoteToFewShot(diagnosis: string, admissionDecision: string, correctedOutput: LlmReasoningOutput) {
  const category = getCategoryForDiagnosis(diagnosis);
  if (!category) {
    console.log(`[ContinuousLearningLoop] No predefined category found for diagnosis: "${diagnosis}". Not promoting.`);
    return;
  }

  const store = loadFewShotStore();
  if (!store[category]) {
    store[category] = [];
  }

  const newExample: FewShotExample = {
    input: `Provisional Diagnosis: ${diagnosis}\nAdmission Decision: ${admissionDecision}`,
    expectedOutput: correctedOutput
  };

  // Add to the front and limit to 3 to prevent prompt token bloat
  store[category].unshift(newExample);
  if (store[category].length > 3) {
    store[category] = store[category].slice(0, 3);
  }

  saveFewShotStore(store);
  console.log(`[ContinuousLearningLoop] Promoted new corrected example to few-shot store for category: ${category}. Total examples: ${store[category].length}`);
}
