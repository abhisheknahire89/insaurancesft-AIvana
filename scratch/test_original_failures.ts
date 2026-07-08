import { readFileSync } from 'fs';
import { generateDenialAppeal } from '../engine/denialAppealGenerator';

async function run() {
    const rawData = readFileSync('./data/test_cases.json', 'utf-8');
    const allCases = JSON.parse(rawData);
    const targetIds = ['20984', '20988', '20989', '24936', '24943'];
    
    for (const tc of allCases) {
        if (targetIds.includes(tc.id) && tc.simulatedDenialReason) {
            console.log(`\n\n=== RUNNING CASE ${tc.id} ===`);
            const record = { ...tc, insurance: tc.insurance || {}, patient: tc.patient || {}, costEstimate: tc.cost || {} };
            
            let reviewReportToUse = { 
                status: 'insufficient', 
                requiredEvidence: [
                    { item: tc.chiefComplaints || 'Clinical documentation details', present: true, source: 'anchor' as const }, 
                    { item: tc.relevantClinicalFindings || 'Diagnostic investigation findings', present: true, source: 'discriminator' as const }
                ], 
                missingRequiredItems: [], 
                recommendedDecision: 'query', 
                generatedAt: new Date().toISOString() 
            };
            
            const appeal = await generateDenialAppeal(tc.simulatedDenialReason, record, reviewReportToUse);
            const hasBoilerplateEmpty = appeal.citedEvidence.length === 0 && appeal.stillMissing.length === 0;
            console.log(`Case ${tc.id}: ${hasBoilerplateEmpty ? 'EMPTY BOILERPLATE (FAILED)' : 'SUCCESS (' + appeal.citedEvidence.length + ' cited)'}`);
        }
    }
}
run().catch(console.error);
