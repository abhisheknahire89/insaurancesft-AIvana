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

// Category 1: 7+ chars / X or A placeholder (44 entries, stands as-is)
const cmSevenChars = codes.filter((c: any) => c.code.length >= 7 || c.code.includes('X') || (c.code.length === 6 && c.code.endsWith('A'))); 

const validatedTrimesters: any[] = [];
const validatedLaterality: any[] = [];

// Helper to check if string contains any of the target words
const containsAny = (str: string, words: string[]) => words.some(w => str.includes(w));

for (const item of codes) {
    const descLower = item.description.toLowerCase();
    
    // Check Trimester
    if (descLower.includes('trimester')) {
        // Find siblings in the same category
        const siblings = codesByCategory[item.category].filter(s => s.code !== item.code);
        // Look for a sibling that is the "base" code (e.g. same core description but without trimester)
        // Or look for American vs British spelling
        const baseDescription = descLower.replace(/,\s*(first|second|third|unspecified)\s*trimester/g, '').trim();
        
        let foundSibling = false;
        for (const sib of siblings) {
            const sibDescLower = sib.description.toLowerCase();
            // If the sibling is just the base disease without trimester
            if (sibDescLower === baseDescription || sibDescLower.includes(baseDescription) && !sibDescLower.includes('trimester')) {
                validatedTrimesters.push({ flagged: item, sibling: sib, reason: "Base description exists without trimester" });
                foundSibling = true;
                break;
            }
        }
        if (!foundSibling) {
             // Let's just push it if we find ANY sibling that looks like a base
             const genericSibling = siblings.find(s => s.code === item.category || s.code === item.code.substring(0, item.code.length - 1));
             if (genericSibling) {
                 validatedTrimesters.push({ flagged: item, sibling: genericSibling, reason: "Generic parent code exists" });
             }
        }
    }
    
    // Check Laterality (excluding sequelae)
    if (!descLower.includes('sequelae')) {
        if (containsAny(descLower, ['right', 'left', 'bilateral']) && containsAny(descLower, ['eye', 'leg', 'arm', 'ear', 'knee', 'heart', 'breast'])) {
            const siblings = codesByCategory[item.category].filter(s => s.code !== item.code);
            const baseDescription = descLower.replace(/,\s*(right|left|bilateral|unspecified)\s*(eye|leg|arm|ear|knee|heart|breast)?/g, '').trim();
            
            let foundSibling = false;
            for (const sib of siblings) {
                const sibDescLower = sib.description.toLowerCase();
                if (sibDescLower === baseDescription || (sibDescLower.includes(baseDescription) && !containsAny(sibDescLower, ['right', 'left', 'bilateral']))) {
                    validatedLaterality.push({ flagged: item, sibling: sib, reason: "Base description exists without laterality" });
                    foundSibling = true;
                    break;
                }
            }
            if (!foundSibling) {
                 const genericSibling = siblings.find(s => s.code === item.category || s.code === item.code.substring(0, item.code.length - 1));
                 if (genericSibling && !containsAny(genericSibling.description.toLowerCase(), ['right', 'left', 'bilateral'])) {
                     validatedLaterality.push({ flagged: item, sibling: genericSibling, reason: "Generic parent code exists without laterality" });
                 }
            }
        }
    }
}

// Ensure uniqueness
const uniqueTrimesters = Array.from(new Map(validatedTrimesters.map(item => [item.flagged.code, item])).values());
const uniqueLaterality = Array.from(new Map(validatedLaterality.map(item => [item.flagged.code, item])).values());

// Total 
const totalContaminated = cmSevenChars.length + uniqueTrimesters.length + uniqueLaterality.length;

console.log("=== REVISED ICD-10 CONTAMINATION AUDIT ===\n");
console.log(`1. 7+ Chars / 'X' / 'A' Placeholders (CM-Only): ${cmSevenChars.length}`);
console.log(`2. Trimester Subdivisions (Validated via Sibling Check): ${uniqueTrimesters.length}`);
console.log(`3. Laterality Subdivisions (Validated via Sibling Check): ${uniqueLaterality.length}`);
console.log(`-------------------------------------------------`);
console.log(`TOTAL VALIDATED CONTAMINATED ENTRIES: ${totalContaminated}\n`);

console.log("--- TRIMESTER SIBLING COMPARISONS ---");
uniqueTrimesters.forEach(entry => {
    console.log(`Flagged: [${entry.flagged.code}] ${entry.flagged.description}`);
    console.log(`Sibling: [${entry.sibling.code}] ${entry.sibling.description}`);
    console.log(`---`);
});

console.log("\n--- LATERALITY SIBLING COMPARISONS ---");
uniqueLaterality.forEach(entry => {
    console.log(`Flagged: [${entry.flagged.code}] ${entry.flagged.description}`);
    console.log(`Sibling: [${entry.sibling.code}] ${entry.sibling.description}`);
    console.log(`---`);
});

