import { clinicalTextMatch } from '../utils/clinicalTextMatch';

async function run() {
    const target = "diagnostic investigation reports";
    const source = "Right lower quadrant pain for 24 hours, nausea, and low-grade fever. Patient presented with periumbilical pain that shifted to the right iliac fossa. Associated with anorexia. No significant medical history. Tenderness at McBurney's point, positive rebound tenderness. USG abdomen confirms inflamed appendix (8mm diameter).";

    const result = await clinicalTextMatch(target, source);
    console.log("Async Match Result:", result);
}
run();
