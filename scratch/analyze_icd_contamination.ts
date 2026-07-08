import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/icd10Codes.json', 'utf8'));
const codes = data.codes;

let cmTrimester = 0;
let cmEncounter = 0;
let cmLaterality = 0;
let cmAmericanSpelling = 0;
let cmSevenChars = 0;

const cmTrimesterExamples = [];
const cmEncounterExamples = [];
const cmLateralityExamples = [];
const cmAmericanSpellingExamples = [];
const cmSevenCharsExamples = [];

const americanSpellings = ['labor', 'anemia', 'hemorrhage', 'pediatric', 'edema', 'orthopedic', 'fetus', 'diarrhea'];

for (const item of codes) {
    const descLower = item.description.toLowerCase();
    
    // Check Trimester
    if (descLower.includes('trimester')) {
        cmTrimester++;
        if (cmTrimesterExamples.length < 5) cmTrimesterExamples.push(item);
    }
    
    // Check Encounter
    if (descLower.includes('initial encounter') || descLower.includes('subsequent encounter') || descLower.includes('sequela')) {
        cmEncounter++;
        if (cmEncounterExamples.length < 5) cmEncounterExamples.push(item);
    }
    
    // Check Laterality
    if (descLower.includes('right') || descLower.includes('left') || descLower.includes('bilateral')) {
        // Need to be careful, some standard codes have 'right' or 'left' (heart failure)? 
        // Typically laterality like right eye, left leg is CM.
        if (descLower.includes('eye') || descLower.includes('leg') || descLower.includes('arm') || descLower.includes('ear') || descLower.includes('knee')) {
            cmLaterality++;
            if (cmLateralityExamples.length < 5) cmLateralityExamples.push(item);
        }
    }
    
    // Check American Spelling
    for (const spelling of americanSpellings) {
        if (descLower.includes(spelling)) {
            cmAmericanSpelling++;
            if (cmAmericanSpellingExamples.length < 5) cmAmericanSpellingExamples.push(item);
            break;
        }
    }

    // Check 7 characters (very indicative of ICD-10-CM with placeholders or 7th char extensions)
    if (item.code.length >= 7) { // Usually XXX.XXX
        cmSevenChars++;
        if (cmSevenCharsExamples.length < 5) cmSevenCharsExamples.push(item);
    }
}

const totalCodes = codes.length;
const totalContaminated = cmTrimester + cmEncounter + cmLaterality + cmAmericanSpelling + cmSevenChars; 
// Note: This is an approximation as they can overlap, but it gives a sense of scale.

console.log("=== ICD-10 CONTAMINATION AUDIT ===");
console.log(`Total Codes in Database: ${totalCodes}`);
console.log(`Estimated Contaminated Entries (CM/American Specific): ~${totalContaminated}`);
console.log(`Estimated Contamination Rate: ~${((totalContaminated / totalCodes) * 100).toFixed(2)}%\n`);

console.log("--- Breakdown by Pattern ---");
console.log(`1. 'Initial/Subsequent Encounter' (Classic CM-only billing): ${cmEncounter} entries`);
console.log(JSON.stringify(cmEncounterExamples, null, 2));

console.log(`\n2. 'Trimester' extensions (CM-only granularity): ${cmTrimester} entries`);
console.log(JSON.stringify(cmTrimesterExamples, null, 2));

console.log(`\n3. 'Right/Left/Bilateral' specific laterality (CM-only): ${cmLaterality} entries`);
console.log(JSON.stringify(cmLateralityExamples, null, 2));

console.log(`\n4. American Spelling (e.g. labor, hemorrhage): ${cmAmericanSpelling} entries`);
console.log(JSON.stringify(cmAmericanSpellingExamples, null, 2));

console.log(`\n5. 7+ Character Codes (e.g. S00.00xA, CM-only): ${cmSevenChars} entries`);
console.log(JSON.stringify(cmSevenCharsExamples, null, 2));
