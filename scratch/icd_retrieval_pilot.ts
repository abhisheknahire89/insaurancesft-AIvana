import fs from 'fs';
import path from 'path';
import { queryMedGemma } from '../services/llmClient';
import { Type } from '@google/genai';
import { testCases } from '../scripts/testBattery';

interface ICDCode {
    code: string;
    description: string;
    category?: string;
}

// BM25 implementation
class BM25 {
    private documents: ICDCode[] = [];
    private docTokens: string[][] = [];
    private df = new Map<string, number>();
    private idf = new Map<string, number>();
    private avgdl = 0;
    private N = 0;
    
    private readonly k1 = 1.2;
    private readonly b = 0.75;

    private tokenize(text: string): string[] {
        if (!text) return [];
        return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
    }

    public build(documents: ICDCode[]) {
        this.documents = documents;
        this.N = documents.length;
        let totalLen = 0;

        for (const doc of documents) {
            const tokens = this.tokenize(`${doc.code} ${doc.description} ${doc.category || ''}`);
            this.docTokens.push(tokens);
            totalLen += tokens.length;
            
            const uniqueTokens = new Set(tokens);
            for (const token of uniqueTokens) {
                this.df.set(token, (this.df.get(token) || 0) + 1);
            }
        }
        
        this.avgdl = totalLen / this.N;

        for (const [token, count] of this.df.entries()) {
            const idfVal = Math.log(1 + (this.N - count + 0.5) / (count + 0.5));
            this.idf.set(token, idfVal);
        }
    }

    public retrieve(query: string, topK: number = 10): ICDCode[] {
        const queryTokens = this.tokenize(query);
        const scores = new Array(this.N).fill(0);

        for (const token of queryTokens) {
            const tokenIDF = this.idf.get(token) || 0;
            if (tokenIDF === 0) continue;

            for (let i = 0; i < this.N; i++) {
                const docToks = this.docTokens[i];
                const tf = docToks.filter(t => t === token).length;
                if (tf > 0) {
                    const docLen = docToks.length;
                    const numerator = tf * (this.k1 + 1);
                    const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
                    scores[i] += tokenIDF * (numerator / denominator);
                }
            }
        }

        const scoredDocs = scores.map((score, index) => ({ score, index }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);

        return scoredDocs.slice(0, topK).map(item => this.documents[item.index]);
    }
}

const bm25 = new BM25();
let cleanCorpus: ICDCode[] = [];

async function initRetrieval() {
    const rawData = fs.readFileSync(path.join(process.cwd(), 'data/icd10Codes_clean.json'), 'utf-8');
    const data = JSON.parse(rawData);
    cleanCorpus = data.codes;
    bm25.build(cleanCorpus);
}

function getExpectedCategory(code: string) {
    if (!code) return null;
    return code.substring(0, 3);
}

export async function processCaseRetrievalFirst(diagnosisText: string) {
    const candidates = bm25.retrieve(diagnosisText, 10);
    if (candidates.length === 0) {
        return { icd10_code: "UNKNOWN", rationale: "No candidates found" };
    }

    const allowedCodes = candidates.map(c => c.code);
    const candidateStr = candidates.map(c => `- ${c.code}: ${c.description}`).join('\n');
    
    const constrainedSchema = {
        type: Type.OBJECT,
        properties: {
            icd10_code: {
                type: Type.STRING,
                description: "The most appropriate ICD-10 code from the retrieved candidates list.",
                enum: allowedCodes
            },
            rationale: {
                type: Type.STRING,
                description: "Clinical explanation of why this code is the best match among the candidates."
            }
        },
        required: ["icd10_code", "rationale"]
    };

    const prompt = `
You are an expert clinical medical coder.
Given the patient's diagnosis string, you must select the MOST ACCURATE ICD-10 code from the provided constrained candidate list.
You cannot invent a code; you MUST select from the candidate list.

Diagnosis: "${diagnosisText}"

Retrieved Candidates:
${candidateStr}
`;

    const systemPrompt = "You are a clinical coder restricted to picking only from a provided list of retrieved candidates.";

    try {
        const responseText = await queryMedGemma(prompt, systemPrompt, constrainedSchema);
        const parsed = JSON.parse(responseText);
        return parsed;
    } catch (e: any) {
        return { icd10_code: "ERROR", rationale: e.message };
    }
}

async function runEvaluation() {
    await initRetrieval();
    console.log("Starting Evaluation...");
    let passed = 0;
    let failed = 0;
    let contaminated = 0;

    // Filter to the 87 cases.
    const evalCases = testCases.filter(c => c.id <= 87);
    
    for (const testCase of evalCases) {
        const inputText = `${testCase.diagnosis} ${testCase.chiefComplaints || ''} ${testCase.hpi || ''}`;
        const expectedBase = getExpectedCategory(testCase.code);
        
        const result = await processCaseRetrievalFirst(inputText);
        
        const isContaminated = result.icd10_code !== 'UNKNOWN' && result.icd10_code !== 'ERROR' && !cleanCorpus.some(c => c.code === result.icd10_code);
        if (isContaminated) {
            contaminated++;
        }
        
        const resultBase = getExpectedCategory(result.icd10_code);
        
        const isPass = resultBase === expectedBase;
        if (isPass) {
            passed++;
        } else {
            failed++;
        }
        console.log(`[Case ${testCase.id}] Expected: ${testCase.code}, Got: ${result.icd10_code}. Pass: ${isPass ? '✅' : '❌'}`);
    }

    console.log("================================");
    console.log(`Total Cases: ${evalCases.length}`);
    console.log(`Passed (Category Match): ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Contamination Rate: ${((contaminated / evalCases.length) * 100).toFixed(2)}% (${contaminated} cases)`);
    console.log("================================");
}

runEvaluation();
