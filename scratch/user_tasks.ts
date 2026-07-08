import fs from 'fs';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';
import { getGoogleGenerativeAIClient } from '../services/apiKeys';

async function main() {
    // TASK 1: Show actual inputs for cases 001, 003, 005
    console.log("=========================================");
    console.log("TASK 1 — Actual inputs for cases 001, 003, 005");
    console.log("=========================================\n");
    const batch5Lines = fs.readFileSync('logs/overnight_run/batch_5_raw.jsonl', 'utf8').split('\n').filter(Boolean);
    const targetCases = ['CASE-001', 'CASE-003', 'CASE-005'];
    for (const line of batch5Lines) {
        const c = JSON.parse(line);
        if (targetCases.includes(c.id)) {
            console.log(`--- ${c.id} ---`);
            console.log("Diagnosis:");
            console.log(JSON.stringify(c.runInput.diagnoses, null, 2));
            console.log("Clinical Text / Document Info:");
            console.log(`Chief Complaints: ${c.runInput.chiefComplaints}`);
            console.log(`HPI: ${c.runInput.hpi}`);
            console.log(`Past History: ${c.runInput.pastHistory}`);
            console.log(`Relevant Clinical Findings: ${c.runInput.relevantClinicalFindings}`);
            console.log(`Proposed Procedure: ${c.runInput.proposedSurgicalProcedure}`);
            console.log("");
        }
    }

    // TASK 2: Full list of 22 checked codes
    console.log("=========================================");
    console.log("TASK 2 — Full list of the 22 checked codes");
    console.log("=========================================\n");
    const batch1Lines = fs.readFileSync('logs/overnight_run/batch_1_raw.jsonl', 'utf8').split('\n').filter(Boolean);
    const batch4Lines = fs.readFileSync('logs/overnight_run/batch_4_raw.jsonl', 'utf8').split('\n').filter(Boolean);
    for (const line of [...batch1Lines, ...batch4Lines]) {
        const c = JSON.parse(line);
        let isPass = c.pass;
        if (isPass === undefined) {
            if (c.expectedAnswer && c.expectedAnswer.primaryICD10 && Array.isArray(c.runOutput)) {
                isPass = c.runOutput.some((r: any) => r.code === c.expectedAnswer.primaryICD10);
            }
        }
        if (isPass === false) {
            const expected = c.expectedAnswer?.primaryICD10;
            const actual = Array.isArray(c.runOutput) ? c.runOutput.map((r: any) => r.code).join(', ') : '';
            console.log(`Case ${c.id.padEnd(12)} | Expected: ${expected?.padEnd(6)} | Got: [${actual}]`);
        }
    }
    console.log("");

    // TASK 3: Raw JSON for Aegis conditions + realistic test
    console.log("=========================================");
    console.log("TASK 3 — Raw JSON for Aegis Isolation + Realistic Test");
    console.log("=========================================\n");
    
    // Condition A & B Setup
    const caseA = {
        denialReason: "Claim denied due to short stay",
        record: {
            clinical: {
                chiefComplaints: "Patient stated \"severe pain\"",
                hpi: "Admitted with \"crushing\" chest pain.",
                diagnoses: [{ diagnosis: "Chest Pain", icd10Code: "R07.9", isPrimary: true }]
            },
            patient: { patientName: "John Doe", age: 45, gender: "Male" },
            insurance: { tpaName: "Medi Assist", insurerName: "Star Health", policyNumber: "POL-123" }
        }
    };
    const evidenceA = [{ item: "EKG shows normal sinus rhythm", present: true, source: "anchor" }];

    const caseB = { ...caseA, record: { ...caseA.record, clinical: { chiefComplaints: "Patient stated severe pain", hpi: "Admitted with crushing chest pain.", diagnoses: caseA.record.clinical.diagnoses } } };
    const evidenceB: any[] = [];

    process.env.BLIND_MODE = 'true';
    console.log("--- Condition A (Quotes Present, Evidence Populated) ---");
    try {
        const resA = await generateDenialAppeal(caseA.denialReason, caseA.record as any, { requiredEvidence: evidenceA as any } as any);
        console.log("citedEvidence:");
        console.log(JSON.stringify(resA.citedEvidence, null, 2));
        console.log("stillMissing:");
        console.log(JSON.stringify(resA.stillMissing, null, 2));
    } catch(e:any) { console.log(e.message); }

    console.log("\n--- Condition B (Quotes Absent, Evidence Empty) ---");
    try {
        const resB = await generateDenialAppeal(caseB.denialReason, caseB.record as any, { requiredEvidence: evidenceB as any } as any);
        console.log("citedEvidence:");
        console.log(JSON.stringify(resB.citedEvidence, null, 2));
        console.log("stillMissing:");
        console.log(JSON.stringify(resB.stillMissing, null, 2));
    } catch(e:any) { console.log(e.message); }

    console.log("\n--- Condition C (Realistic Scale Retest) ---");
    const caseC = {
        denialReason: "Inpatient admission denied as the proposed procedure, diagnostic laparoscopy, could have been safely performed on a daycare basis under \"outpatient setting\". No clinical justification provided for 48 hour stay.",
        record: {
            clinical: {
                chiefComplaints: "Patient presented to ER crying, stating \"the pain is tearing through my stomach\" and \"I can't stop vomiting\".",
                hpi: "Patient reports sudden onset of severe abdominal pain for the last 12 hours. Reports feeling \"feverish and weak\".",
                diagnoses: [{ diagnosis: "Acute Appendicitis with Localized Peritonitis", icd10Code: "K35.80", isPrimary: true }]
            },
            patient: { patientName: "Jane Doe", age: 34, gender: "Female" },
            insurance: { tpaName: "HealthIndia", insurerName: "SBI General", policyNumber: "POL-445" }
        }
    };
    const evidenceC = [
        { item: "Ultrasound Abdomen showing inflamed appendix of 9mm diameter with periappendiceal fluid.", present: true, source: "anchor" },
        { item: "WBC Count elevated at 16,500 cells/cumm.", present: true, source: "anchor" },
        { item: "Fever of 102.4F recorded at triage.", present: true, source: "anchor" }
    ];
    try {
        const resC = await generateDenialAppeal(caseC.denialReason, caseC.record as any, { requiredEvidence: evidenceC as any } as any);
        console.log("citedEvidence:");
        console.log(JSON.stringify(resC.citedEvidence, null, 2));
        console.log("stillMissing:");
        console.log(JSON.stringify(resC.stillMissing, null, 2));
    } catch(e:any) { console.log(e.message); }
    console.log("");

    // TASK 4: Real insurer-extraction test
    console.log("=========================================");
    console.log("TASK 4 — Real insurer-extraction test");
    console.log("=========================================\n");
    const batch8Lines = fs.readFileSync('logs/overnight_run/batch_8_raw.jsonl', 'utf8').split('\n').filter(Boolean);
    
    // Because we just want to hit the extraction prompt directly without mocking the File object
    // I will extract the prompt from the service file and hit the model.
    const serviceContent = fs.readFileSync('services/documentExtractionService.ts', 'utf8');
    const promptMatch = serviceContent.match(/const EXTRACTION_PROMPT = `([\s\S]*?)`;/);
    if (!promptMatch) {
        console.log("Could not find EXTRACTION_PROMPT");
        return;
    }
    const EXTRACTION_PROMPT = promptMatch[1];
    const client = getGoogleGenerativeAIClient();
    const model = client.getGenerativeModel({ model: "gemini-1.5-pro" });

    for (const line of batch8Lines) {
        const c = JSON.parse(line);
        const insurerName = c.insurance?.insurerName;
        const textContent = `Policy Document\nInsurer: ${insurerName}\nPatient Name: Testing\nPolicy No: 12345`;
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

main();
