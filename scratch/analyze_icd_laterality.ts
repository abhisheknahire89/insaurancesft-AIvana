import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/icd10Codes.json', 'utf8'));
const codes = data.codes;

// Group by category for sibling lookups
const codesByCategory: Record<string, any[]> = {};
for (const item of codes) {
    if (!codesByCategory[item.category]) {
        codesByCategory[item.category] = [];
    }
    codesByCategory[item.category].push(item);
}

const containsAny = (str: string, words: string[]) => words.some(w => str.includes(w));

// TASK 1: Redo laterality check
const validatedLaterality: any[] = [];

for (const item of codes) {
    const descLower = item.description.toLowerCase();
    
    if (item.code === 'Q22.6' || item.code === 'Q23.4') continue;

    if (!descLower.includes('sequelae')) {
        if (containsAny(descLower, ['right', 'left', 'bilateral']) && containsAny(descLower, ['eye', 'leg', 'arm', 'ear', 'knee', 'heart', 'breast'])) {
            const siblings = codesByCategory[item.category].filter(s => s.code !== item.code);
            const baseDescriptionWords = descLower.replace(/,\s*(right|left|bilateral|unspecified)\s*(eye|leg|arm|ear|knee|heart|breast)?/g, '').trim().split(' ');
            
            for (const sib of siblings) {
                const sibDescLower = sib.description.toLowerCase();
                
                // Unmarked parent condition: no right/left/bilateral AND no unilateral
                if (!containsAny(sibDescLower, ['right', 'left', 'bilateral', 'unilateral', 'contralateral'])) {
                    
                    // Verify the sibling actually represents the plain parent (e.g., exact match or starts with the same root concept)
                    const baseDesc = descLower.replace(/,\s*(right|left|bilateral|unspecified)\s*(eye|leg|arm|ear|knee|heart|breast)?/g, '').trim();
                    if (sibDescLower === baseDesc || (sibDescLower.includes(baseDesc))) {
                         validatedLaterality.push({ flagged: item, sibling: sib });
                         break;
                    } else {
                         // Or if it's the exact generic parent code (e.g. N63 for N63.1)
                         if (sib.code === item.category || sib.code === item.code.substring(0, item.code.length - 1)) {
                             validatedLaterality.push({ flagged: item, sibling: sib });
                             break;
                         }
                    }
                }
            }
        }
    }
}

// Remove duplicates
const uniqueLaterality = Array.from(new Map(validatedLaterality.map(item => [item.flagged.code, item])).values());

console.log("=== TASK 1: STRICT LATERALITY CHECK ===\n");
console.log(`Validated Laterality Count: ${uniqueLaterality.length}\n`);

uniqueLaterality.forEach(entry => {
    console.log(`Flagged: [${entry.flagged.code}] ${entry.flagged.description}`);
    console.log(`Sibling: [${entry.sibling.code}] ${entry.sibling.description}`);
    console.log(`---`);
});

// TASK 2: Check O44.3
console.log("\n=== TASK 2: CHECK O44.3 ===\n");
const o44_3 = codes.find((c: any) => c.code === 'O44.3');
if (o44_3) {
    console.log(`Code: ${o44_3.code}`);
    console.log(`Description: ${o44_3.description}`);
    console.log(`Contains 'hemorrhage' (American)? ${o44_3.description.toLowerCase().includes('hemorrhage')}`);
} else {
    console.log(`O44.3 not found.`);
}
