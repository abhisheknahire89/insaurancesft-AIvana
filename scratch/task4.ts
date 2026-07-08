import fs from 'fs';
import { getGoogleGenerativeAIClient } from '../services/apiKeys';

async function runTask4() {
    console.log("\n=========================================");
    console.log("TASK 4 — Real insurer-extraction test");
    console.log("=========================================\n");
    const batch8Lines = fs.readFileSync('logs/overnight_run/batch_8_raw.jsonl', 'utf8').split('\n').filter(Boolean);
    
    const serviceContent = fs.readFileSync('services/documentExtractionService.ts', 'utf8');
    const promptMatch = serviceContent.match(/const EXTRACTION_PROMPT = `([\s\S]*?)`;/);
    if (!promptMatch) {
        console.log("Could not find EXTRACTION_PROMPT");
        return;
    }
    const EXTRACTION_PROMPT = promptMatch[1];
    const client = getGoogleGenerativeAIClient();
    const model = client.getGenerativeModel({ model: "gemini-3-flash-preview" });

    for (const line of batch8Lines) {
        const c = JSON.parse(line);
        const insurerName = c.insurance?.insurerName;
        // Constructing realistic messy text that contains the unlisted insurer
        const textContent = `[SCAN PAGE 1]\nPATIENT DISCHARGE SUMMARY\n\nName: John Doe\nAge/Sex: 45/M\nPolicy Num: ABC-123456\nINSURANCE COMPANY: ${insurerName}\n\nDiagnosis: Acute Appendicitis\n`;
        const payload = [EXTRACTION_PROMPT, textContent];
        try {
            const result = await model.generateContent(payload);
            const responseText = result.response.text().trim();
            let jsonStr = responseText;
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
            else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
            
            const data = JSON.parse(jsonStr);
            console.log(`Document Insurer: ${insurerName}`);
            console.log(`Extracted Insurer: ${data.insurance?.insurance_company || 'N/A'}`);
            console.log("---");
        } catch(e:any) {
            console.log(`Failed to extract for ${insurerName}: ${e.message}`);
        }
    }
}

runTask4();
