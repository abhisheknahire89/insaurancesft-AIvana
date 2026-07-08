import { checkClinicalPresence } from '../engine/evidenceReview';

async function testFix() {
    const record = {
        clinical: {
            chiefComplaints: "Right lower quadrant pain for 24 hours, nausea, and low-grade fever.",
            historyOfPresentIllness: "Patient presented with periumbilical pain that shifted to the right iliac fossa. Associated with anorexia.",
            relevantClinicalFindings: "Tenderness at McBurney's point, positive rebound tenderness. USG abdomen confirms inflamed appendix (8mm diameter)."
        }
    };
    
    // Testing the prompt fix outputs:
    const betterEvidence = "Ultrasound or CT scan showing inflamed appendix";
    
    const res = await checkClinicalPresence(betterEvidence, record);
    console.log(`Presence of "${betterEvidence}":`, res);
}
testFix();
