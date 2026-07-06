import pmjayPackages from '../data/pmjayPackages.json';

export interface PMJAYPackage {
    icdPrefix: string;
    packageCode: string;
    packageName: string;
    rate: number;
}

export function isPMJAYBeneficiary(insurerName: string): boolean {
    if (!insurerName) return false;
    const lower = insurerName.toLowerCase();
    return lower.includes('pm-jay') || lower.includes('pmjay') || lower.includes('ayushman') || lower.includes('ab-pmjay');
}

export function getPMJAYPackageRate(icdCode: string): PMJAYPackage | null {
    if (!icdCode) return null;
    const cleanCode = icdCode.trim().toUpperCase();
    
    // Exact match or prefix match
    for (const pkg of pmjayPackages.packages) {
        if (cleanCode.startsWith(pkg.icdPrefix)) {
            return pkg;
        }
    }
    return null;
}
