import { reviewEvidence } from '../engine/evidenceReview';

async function runCases(label: string) {
    console.log(`\n========== ${label} ==========`);

    const cases = [
        {
            id: 'CASE-001 (Appendicitis - False Positive) [RUN 1]',
            record: {
                admission: { admissionType: 'Emergency', expectedLengthOfStay: 2 },
                clinical: {
                    diagnoses: [{ diagnosis: "Acute Appendicitis", icd10Code: "K35.80", isPrimary: true }],
                    chiefComplaints: "Right lower quadrant pain for 24 hours, nausea, and low-grade fever.",
                    historyOfPresentIllness: "Patient presented with periumbilical pain that shifted to the right iliac fossa. Associated with anorexia.",
                    relevantClinicalFindings: "Tenderness at McBurney's point, positive rebound tenderness. USG abdomen confirms inflamed appendix (8mm diameter)."
                }
            }
        },
        {
            id: 'CASE-001 (Appendicitis - False Positive) [RUN 2]',
            record: {
                admission: { admissionType: 'Emergency', expectedLengthOfStay: 2 },
                clinical: {
                    diagnoses: [{ diagnosis: "Acute Appendicitis", icd10Code: "K35.80", isPrimary: true }],
                    chiefComplaints: "Right lower quadrant pain for 24 hours, nausea, and low-grade fever.",
                    historyOfPresentIllness: "Patient presented with periumbilical pain that shifted to the right iliac fossa. Associated with anorexia.",
                    relevantClinicalFindings: "Tenderness at McBurney's point, positive rebound tenderness. USG abdomen confirms inflamed appendix (8mm diameter)."
                }
            }
        },
        {
            id: 'CASE-003 (Cholecystitis - False Positive)',
            record: {
                admission: { admissionType: 'Planned', expectedLengthOfStay: 3 },
                clinical: {
                    diagnoses: [{ diagnosis: "Cholelithiasis with Acute Cholecystitis", icd10Code: "K80.00", isPrimary: true }],
                    chiefComplaints: "Severe epigastric pain radiating to the right shoulder for 2 days.",
                    historyOfPresentIllness: "Pain started after a fatty meal. Associated with nausea and vomiting.",
                    relevantClinicalFindings: "Murphy's sign positive. USG Abdomen reveals multiple gallstones and thickened gallbladder wall (5mm)."
                }
            }
        },
        {
            id: 'CASE-005 (Hernia - False Positive)',
            record: {
                admission: { admissionType: 'Planned', expectedLengthOfStay: 2 },
                clinical: {
                    diagnoses: [{ diagnosis: "Inguinal Hernia", icd10Code: "K40.90", isPrimary: true }],
                    chiefComplaints: "Bulge in the right groin area that increases on coughing.",
                    historyOfPresentIllness: "Noticed swelling 3 months ago. Occasionally painful after heavy lifting.",
                    relevantClinicalFindings: "Right-sided indirect inguinal hernia. Cough impulse positive. Swelling is reducible."
                }
            }
        },
        {
            id: 'CONTROL-01 (Incomplete Appendicitis)',
            record: {
                admission: { admissionType: 'Emergency', expectedLengthOfStay: 2 },
                clinical: {
                    diagnoses: [{ diagnosis: "Acute Appendicitis", icd10Code: "K35.80", isPrimary: true }],
                    chiefComplaints: "Stomach pain.",
                    historyOfPresentIllness: "Pain since yesterday.",
                    relevantClinicalFindings: "Stomach hurts on touch. Waiting for ultrasound results."
                }
            }
        },
        {
            id: 'CONTROL-02 (Incomplete Hernia)',
            record: {
                admission: { admissionType: 'Planned', expectedLengthOfStay: 2 },
                clinical: {
                    diagnoses: [{ diagnosis: "Inguinal Hernia", icd10Code: "K40.90", isPrimary: true }],
                    chiefComplaints: "Swelling in groin.",
                    historyOfPresentIllness: "Started recently.",
                    relevantClinicalFindings: "Swelling seen."
                }
            }
        }
    ];

    for (const c of cases) {
        console.log(`\n--- ${c.id} ---`);
        const result = await reviewEvidence(c.record as any);
        console.log(`Status: ${result.status.toUpperCase()}`);
        console.log(`Missing Evidence:`, result.insufficientEvidence);
        if (result.insufficientEvidence.length > 0) {
            console.log(`Anticipated Queries:`, result.anticipatedQueries.map(q => q.query));
        }
    }
}

async function main() {
    await runCases("BEFORE FIX");
}
main();
