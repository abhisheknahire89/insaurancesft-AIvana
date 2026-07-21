/**
 * services/queryResponseService.ts
 *
 * Extracted from DenialQueue.tsx handleGenerateQueryResponse (lines 107-131).
 * Generates a formal TPA query-clarification letter for a given pre-auth record.
 * Caller is responsible for persisting the result via recordQueryResponse().
 *
 * Does NOT mutate any record.
 */

import { PreAuthRecord } from '../components/PreAuthWizard/types';

/**
 * Generate a formal query-clarification letter addressing the TPA's query.
 * Falls back to a deterministic letter template if the LLM call fails.
 */
export async function generateQueryResponse(record: PreAuthRecord, overrideQueryText?: string): Promise<string> {
    const queryDetailsText = overrideQueryText || record.tpaResponse?.queryDetails || '';
    if (!queryDetailsText.trim()) {
        throw new Error('No query details recorded for this case. Log the query details first.');
    }

    const selectedDx = record.clinical?.diagnoses?.[record.clinical.selectedDiagnosisIndex ?? 0];
    const diagnosisText = selectedDx?.diagnosis ?? 'the documented diagnosis';

    const prompt = `Write a brief, professional clarification response addressing EXACTLY this query: "${queryDetailsText}", using this case's documented clinical facts: "${record.clinical?.chiefComplaints || ''}. ${record.clinical?.historyOfPresentIllness || ''}". Respond as the Attending Medical Director. Do not introduce new claims.`;

    const systemPrompt =
        'You are a Senior Hospital Medical Director in India. Write a formal, concise clarification letter responding to a TPA claim query. Be factual and brief. Use standard Indian hospital letter format.';

    try {
        const { queryMedGemma } = await import('./llmClient');
        const response = await queryMedGemma(prompt, systemPrompt);
        return response;
    } catch (llmError) {
        console.warn('[queryResponseService] LLM call failed, using deterministic fallback.', llmError);
        return buildFallbackLetter(record, queryDetailsText, diagnosisText);
    }
}

function buildFallbackLetter(
    record: PreAuthRecord,
    queryDetailsText: string,
    diagnosisText: string
): string {
    const patient = record.patient;
    const ageStr = patient?.age
        ? `${patient.age}${(patient as any).ageUnit === 'months' ? 'M' : 'Y'}`
        : '';

    return `Dear Sir/Madam,

Sub: Clarification in response to TPA query — Pre-Auth Ref: ${record.id}

This is in response to your query regarding the pre-authorization request for ${patient?.patientName || 'the patient'} (Case ID: ${record.id}).

Patient Details:
• Name   : ${patient?.patientName || '—'}
• Age/Sex: ${ageStr} ${patient?.gender || ''}
• Diagnosis: ${diagnosisText}
• Policy No: ${record.insurance?.policyNumber || '—'}

Query Raised:
${queryDetailsText}

Clarification:
We have thoroughly reviewed the clinical case file. The patient is admitted with a confirmed diagnosis of ${diagnosisText}. The proposed line of treatment is medically necessary and requires continuous inpatient monitoring as per standard clinical protocols. All supporting clinical findings, laboratory investigations, and specialist consultations have been documented in the case file and are available on request.

We request you to kindly review the submitted documents and process the cashless authorization at the earliest to avoid any delay in patient care.

Yours sincerely,
Attending Medical Director
Hospital — Aivana Health Network
Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
}
