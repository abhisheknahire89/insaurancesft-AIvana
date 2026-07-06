import { lookupICD, validateCode } from '../services/icdService';

const candidates = lookupICD("Bilateral primary osteoarthritis knee");
console.log('Candidates count:', candidates.length);
console.log('Candidates:', candidates);

const allWho = candidates.every(c => validateCode(c.code));
console.log('All WHO valid:', allWho);
