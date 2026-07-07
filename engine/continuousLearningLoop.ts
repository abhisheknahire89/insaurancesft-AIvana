/**
 * engine/continuousLearningLoop.ts
 *
 * Taiga Layer - Continuous Learning Loop
 * Captures human corrections to AI-suggested ICD-10 and CPT codes
 * and stores them to be used as few-shot prompt injections in future runs.
 */

export interface CodeCorrection {
    caseId: string;
    originalAiCode: string;
    humanCorrectedCode: string;
    clinicalContext: string; // Key terms from the clinical note
    reasonForCorrection?: string;
    timestamp: string;
}

// In-memory mock database for few-shot examples
const fewShotDatabase: CodeCorrection[] = [];

/**
 * Endpoint to capture a human correction.
 * Triggered when a medical coder overrides the AI's suggestion in the UI.
 */
export async function captureCodingCorrection(correction: Omit<CodeCorrection, 'timestamp'>): Promise<void> {
    const entry: CodeCorrection = {
        ...correction,
        timestamp: new Date().toISOString()
    };
    
    fewShotDatabase.push(entry);
    console.log(`[Taiga Learning Loop] Captured correction for case ${entry.caseId}: ${entry.originalAiCode} -> ${entry.humanCorrectedCode}`);
    
    // Future expansion: If enough similar corrections are made, automatically update a deterministic rule (e.g., if "fibroid" always maps to D25 instead of N84, add it to rule engine).
}

/**
 * Retrieves relevant few-shot examples for the Qwen prompt based on the current clinical context.
 */
export function getFewShotExamplesForPrompt(clinicalNote: string): string[] {
    const noteLower = clinicalNote.toLowerCase();
    
    // Simple heuristic: find past corrections that share keywords with the current note
    const relevantCorrections = fewShotDatabase.filter(c => {
        const keywords = c.clinicalContext.toLowerCase().split(' ').filter(w => w.length > 5);
        return keywords.some(kw => noteLower.includes(kw));
    });

    return relevantCorrections.map(c => 
        `Example: Clinical Context: "${c.clinicalContext}". Incorrect AI Code: ${c.originalAiCode}. Correct Human Code: ${c.humanCorrectedCode}.`
    );
}
