import { clinicalTextMatchSync } from '../utils/clinicalTextMatch';

const target = "diagnostic investigation reports";
const source = "Right lower quadrant pain for 24 hours, nausea, and low-grade fever. Patient presented with periumbilical pain that shifted to the right iliac fossa. Associated with anorexia. No significant medical history. Tenderness at McBurney's point, positive rebound tenderness. USG abdomen confirms inflamed appendix (8mm diameter).";

const result = clinicalTextMatchSync(target, source);
console.log("Match Result:", result);
