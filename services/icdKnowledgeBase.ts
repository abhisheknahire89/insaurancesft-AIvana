/**
 * ICD Knowledge Base Service
 *
 * Abstracted lookup service for ICD-10 codes.
 * Backend-agnostic: can be backed by Kaggle dataset, WHO ICD-10, ICD-11, hospital custom, or government updates.
 *
 * Provides deterministic, indexed lookup for:
 * - ICD → Description
 * - Description → ICD
 * - Keyword → ICD
 * - Synonym → ICD
 * - Hierarchy
 * - Validation
 */

export interface ICDCode {
  code: string;
  description: string;
  chapter: string;
  category: string;
  subcategory: string;
  synonyms: string[];
  keywords: string[];
  parentCode?: string;
  childCodes?: string[];
  validFrom?: string;
  validTo?: string;
  requiresSeventhCharacter?: boolean;
  applicableAge?: {
    minAge?: number;
    maxAge?: number;
  };
  applicableGender?: 'M' | 'F' | 'Both';
  relatedCodes?: string[];
}

export interface ICDSearchResult {
  code: string;
  description: string;
  relevance: number; // 0-1
  matchType: 'exact' | 'synonym' | 'keyword' | 'partial';
  chapter: string;
}

export interface ICDValidationResult {
  valid: boolean;
  code: string;
  description?: string;
  issues: string[];
  suggestions?: string[];
}

/**
 * ICD Knowledge Base - Abstracted interface
 * Implementation can be swapped without changing the engine
 */
export class ICDKnowledgeBase {
  private codeIndex: Map<string, ICDCode>;
  private descriptionIndex: Map<string, string[]>; // Description → codes
  private keywordIndex: Map<string, string[]>; // Keyword → codes
  private synonymIndex: Map<string, string[]>; // Synonym → codes
  private chapterIndex: Map<string, string[]>; // Chapter → codes
  private version: string;
  private source: string;

  constructor(version: string = '2024', source: string = 'ICD-10-WHO') {
    this.codeIndex = new Map();
    this.descriptionIndex = new Map();
    this.keywordIndex = new Map();
    this.synonymIndex = new Map();
    this.chapterIndex = new Map();
    this.version = version;
    this.source = source;
  }

  /**
   * Load ICD codes from backend
   * This method is backend-agnostic - can load from any source
   */
  async loadCodes(backend: ICDBackend): Promise<void> {
    console.log(`[ICD KB] Loading ICD codes from ${backend.constructor.name}...`);

    const codes = await backend.getAllCodes();

    for (const code of codes) {
      this.registerCode(code);
    }

    console.log(`[ICD KB] Loaded ${codes.length} ICD codes`);
    console.log(`[ICD KB] Indexes built:`, {
      codes: this.codeIndex.size,
      descriptions: this.descriptionIndex.size,
      keywords: this.keywordIndex.size,
      synonyms: this.synonymIndex.size,
      chapters: this.chapterIndex.size,
    });
  }

  /**
   * Register a single code in all indexes
   */
  private registerCode(code: ICDCode): void {
    this.codeIndex.set(code.code, code);

    // Index by description
    const descKey = code.description.toLowerCase();
    if (!this.descriptionIndex.has(descKey)) {
      this.descriptionIndex.set(descKey, []);
    }
    this.descriptionIndex.get(descKey)!.push(code.code);

    // Index by keywords
    for (const keyword of code.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (!this.keywordIndex.has(keywordLower)) {
        this.keywordIndex.set(keywordLower, []);
      }
      this.keywordIndex.get(keywordLower)!.push(code.code);
    }

    // Index by synonyms
    for (const synonym of code.synonyms) {
      const synonymLower = synonym.toLowerCase();
      if (!this.synonymIndex.has(synonymLower)) {
        this.synonymIndex.set(synonymLower, []);
      }
      this.synonymIndex.get(synonymLower)!.push(code.code);
    }

    // Index by chapter
    if (!this.chapterIndex.has(code.chapter)) {
      this.chapterIndex.set(code.chapter, []);
    }
    this.chapterIndex.get(code.chapter)!.push(code.code);
  }

  /**
   * Get code by ICD code
   */
  getCode(code: string): ICDCode | null {
    return this.codeIndex.get(code) || null;
  }

  /**
   * Search by diagnosis description
   */
  searchByDiagnosis(diagnosis: string, limit: number = 10): ICDSearchResult[] {
    const normalized = diagnosis.toLowerCase();
    const results: ICDSearchResult[] = [];
    const seen = new Set<string>();

    // Exact match in descriptions
    if (this.descriptionIndex.has(normalized)) {
      for (const code of this.descriptionIndex.get(normalized)!) {
        if (!seen.has(code)) {
          const icdCode = this.codeIndex.get(code)!;
          results.push({
            code,
            description: icdCode.description,
            relevance: 1.0,
            matchType: 'exact',
            chapter: icdCode.chapter,
          });
          seen.add(code);
        }
      }
    }

    // Partial match in descriptions
    for (const [desc, codes] of this.descriptionIndex.entries()) {
      if (desc.includes(normalized) || normalized.includes(desc)) {
        for (const code of codes) {
          if (!seen.has(code)) {
            const icdCode = this.codeIndex.get(code)!;
            results.push({
              code,
              description: icdCode.description,
              relevance: 0.8,
              matchType: 'partial',
              chapter: icdCode.chapter,
            });
            seen.add(code);
          }
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Search by keyword (clinical abbreviations, common terms)
   */
  searchByKeyword(keyword: string, limit: number = 10): ICDSearchResult[] {
    const normalized = keyword.toLowerCase();
    const results: ICDSearchResult[] = [];
    const seen = new Set<string>();

    // Direct keyword match
    if (this.keywordIndex.has(normalized)) {
      for (const code of this.keywordIndex.get(normalized)!) {
        if (!seen.has(code)) {
          const icdCode = this.codeIndex.get(code)!;
          results.push({
            code,
            description: icdCode.description,
            relevance: 1.0,
            matchType: 'keyword',
            chapter: icdCode.chapter,
          });
          seen.add(code);
        }
      }
    }

    // Partial keyword match
    for (const [kw, codes] of this.keywordIndex.entries()) {
      if (kw.includes(normalized) || normalized.includes(kw)) {
        for (const code of codes) {
          if (!seen.has(code)) {
            const icdCode = this.codeIndex.get(code)!;
            results.push({
              code,
              description: icdCode.description,
              relevance: 0.7,
              matchType: 'keyword',
              chapter: icdCode.chapter,
            });
            seen.add(code);
          }
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Search by synonym (medical terminology variations)
   */
  searchBySynonym(synonym: string, limit: number = 10): ICDSearchResult[] {
    const normalized = synonym.toLowerCase();
    const results: ICDSearchResult[] = [];
    const seen = new Set<string>();

    if (this.synonymIndex.has(normalized)) {
      for (const code of this.synonymIndex.get(normalized)!) {
        if (!seen.has(code)) {
          const icdCode = this.codeIndex.get(code)!;
          results.push({
            code,
            description: icdCode.description,
            relevance: 0.95,
            matchType: 'synonym',
            chapter: icdCode.chapter,
          });
          seen.add(code);
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Combined search - try all methods
   */
  search(term: string, limit: number = 15): ICDSearchResult[] {
    const allResults = new Map<string, ICDSearchResult>();

    // Try each search method
    const diagnResults = this.searchByDiagnosis(term, limit);
    const keyResults = this.searchByKeyword(term, limit);
    const synResults = this.searchBySynonym(term, limit);

    // Combine and deduplicate, keeping highest relevance
    for (const result of [...diagnResults, ...keyResults, ...synResults]) {
      if (!allResults.has(result.code)) {
        allResults.set(result.code, result);
      } else {
        const existing = allResults.get(result.code)!;
        if (result.relevance > existing.relevance) {
          allResults.set(result.code, result);
        }
      }
    }

    // Sort by relevance
    return Array.from(allResults.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Get description for ICD code
   */
  getDescription(code: string): string | null {
    const icdCode = this.codeIndex.get(code);
    return icdCode?.description || null;
  }

  /**
   * Get hierarchy for code
   */
  getHierarchy(code: string): { parent?: string; children: string[] } | null {
    const icdCode = this.codeIndex.get(code);
    if (!icdCode) return null;

    return {
      parent: icdCode.parentCode,
      children: icdCode.childCodes || [],
    };
  }

  /**
   * Validate ICD code
   */
  validateCode(code: string): ICDValidationResult {
    const icdCode = this.codeIndex.get(code);

    if (!icdCode) {
      return {
        valid: false,
        code,
        issues: [`Code ${code} not found in knowledge base`],
        suggestions: this.searchByDiagnosis(code, 3).map(r => r.code),
      };
    }

    return {
      valid: true,
      code,
      description: icdCode.description,
      issues: [],
    };
  }

  /**
   * Get related codes (similar diagnoses, comorbidities, sequelae)
   */
  getRelatedCodes(code: string, limit: number = 5): ICDSearchResult[] {
    const icdCode = this.codeIndex.get(code);
    if (!icdCode) return [];

    const results: ICDSearchResult[] = [];
    const seen = new Set<string>([code]);

    // Return related codes from metadata
    if (icdCode.relatedCodes) {
      for (const relatedCode of icdCode.relatedCodes.slice(0, limit)) {
        const related = this.codeIndex.get(relatedCode);
        if (related && !seen.has(relatedCode)) {
          results.push({
            code: relatedCode,
            description: related.description,
            relevance: 0.8,
            matchType: 'keyword',
            chapter: related.chapter,
          });
          seen.add(relatedCode);
        }
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Get all codes in a chapter
   */
  getChapterCodes(chapter: string): ICDCode[] {
    const codes = this.chapterIndex.get(chapter) || [];
    return codes
      .map(code => this.codeIndex.get(code)!)
      .filter(Boolean);
  }

  /**
   * Autocomplete for search
   */
  autocomplete(prefix: string, limit: number = 10): string[] {
    const normalized = prefix.toLowerCase();
    const suggestions = new Set<string>();

    // Autocomplete from descriptions
    for (const [desc, codes] of this.descriptionIndex.entries()) {
      if (desc.startsWith(normalized)) {
        for (const code of codes.slice(0, 2)) {
          const icdCode = this.codeIndex.get(code);
          if (icdCode) {
            suggestions.add(icdCode.description);
          }
        }
      }
    }

    // Autocomplete from synonyms
    for (const [syn, codes] of this.synonymIndex.entries()) {
      if (syn.startsWith(normalized)) {
        for (const code of codes.slice(0, 2)) {
          const icdCode = this.codeIndex.get(code);
          if (icdCode) {
            suggestions.add(icdCode.description);
          }
        }
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Check if code is valid for patient demographics
   */
  isValidForDemographics(
    code: string,
    age: number,
    gender: 'M' | 'F'
  ): { valid: boolean; reason?: string } {
    const icdCode = this.codeIndex.get(code);
    if (!icdCode) return { valid: false, reason: 'Code not found' };

    // Check age
    if (icdCode.applicableAge) {
      if (icdCode.applicableAge.minAge && age < icdCode.applicableAge.minAge) {
        return {
          valid: false,
          reason: `Code not applicable for age ${age} (minimum: ${icdCode.applicableAge.minAge})`,
        };
      }
      if (icdCode.applicableAge.maxAge && age > icdCode.applicableAge.maxAge) {
        return {
          valid: false,
          reason: `Code not applicable for age ${age} (maximum: ${icdCode.applicableAge.maxAge})`,
        };
      }
    }

    // Check gender
    if (icdCode.applicableGender && icdCode.applicableGender !== 'Both') {
      if (icdCode.applicableGender === 'M' && gender !== 'M') {
        return { valid: false, reason: `Code only applicable for males` };
      }
      if (icdCode.applicableGender === 'F' && gender !== 'F') {
        return { valid: false, reason: `Code only applicable for females` };
      }
    }

    return { valid: true };
  }

  /**
   * Get metadata
   */
  getMetadata(): {
    version: string;
    source: string;
    totalCodes: number;
    lastUpdated?: string;
  } {
    return {
      version: this.version,
      source: this.source,
      totalCodes: this.codeIndex.size,
    };
  }
}

/**
 * Backend interface - allows swapping different data sources
 * Can be implemented by: Kaggle dataset, WHO ICD-10, ICD-11, hospital custom, government updates
 */
export interface ICDBackend {
  /**
   * Get all available codes
   */
  getAllCodes(): Promise<ICDCode[]>;

  /**
   * Get single code
   */
  getCode(code: string): Promise<ICDCode | null>;

  /**
   * Check if backend is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get backend metadata
   */
  getMetadata(): Promise<{
    version: string;
    lastUpdated: string;
    totalCodes: number;
    source: string;
  }>;
}

/**
 * Kaggle Dataset Backend Implementation
 * Loads from India Hospital Readmission dataset
 */
export class KaggleICDBackend implements ICDBackend {
  private codes: Map<string, ICDCode>;

  constructor() {
    this.codes = new Map();
  }

  async getAllCodes(): Promise<ICDCode[]> {
    // In production: load from Kaggle CSV
    // For now: return sample codes
    const sampleCodes: ICDCode[] = [
      {
        code: 'M51.26',
        description: 'Unspecified internal displacement of lumbar intervertebral disc',
        chapter: 'XIII',
        category: 'M51',
        subcategory: 'M51.2',
        keywords: ['herniated disc', 'prolapsed disc', 'slipped disc', 'disc herniation'],
        synonyms: ['disk herniation', 'nucleus pulposus herniation'],
        applicableAge: { minAge: 18 },
        applicableGender: 'Both',
        relatedCodes: ['M54.1', 'M51.1', 'M51.3'],
      },
      {
        code: 'M54.1',
        description: 'Radiculopathy',
        chapter: 'XIII',
        category: 'M54',
        subcategory: 'M54.1',
        keywords: ['radiculopathy', 'nerve pain', 'root pain', 'sciatica'],
        synonyms: ['nerve root compression', 'radicular pain'],
        applicableAge: { minAge: 18 },
        applicableGender: 'Both',
      },
      {
        code: 'I10',
        description: 'Essential (primary) hypertension',
        chapter: 'IX',
        category: 'I10',
        subcategory: 'I10',
        keywords: ['hypertension', 'high blood pressure', 'HTN', 'BP'],
        synonyms: ['essential hypertension', 'primary hypertension'],
        applicableAge: { minAge: 18 },
        applicableGender: 'Both',
      },
      {
        code: 'E11.9',
        description: 'Type 2 diabetes mellitus without complications',
        chapter: 'IV',
        category: 'E11',
        subcategory: 'E11.9',
        keywords: ['diabetes', 'type 2 diabetes', 'DM', 'T2DM'],
        synonyms: ['non-insulin dependent diabetes', 'NIDDM'],
        applicableAge: { minAge: 0 },
        applicableGender: 'Both',
      },
    ];

    return sampleCodes;
  }

  async getCode(code: string): Promise<ICDCode | null> {
    const allCodes = await this.getAllCodes();
    return allCodes.find(c => c.code === code) || null;
  }

  async isAvailable(): Promise<boolean> {
    // Check if Kaggle dataset is accessible
    return true;
  }

  async getMetadata(): Promise<{
    version: string;
    lastUpdated: string;
    totalCodes: number;
    source: string;
  }> {
    return {
      version: '2024',
      lastUpdated: '2024-01-15',
      totalCodes: 70000,
      source: 'India Hospital Readmission Dataset (Kaggle)',
    };
  }
}

/**
 * WHO ICD-10 Backend Implementation (Future)
 * Can be implemented when official WHO data is available
 */
export class WHOICDBackend implements ICDBackend {
  async getAllCodes(): Promise<ICDCode[]> {
    throw new Error('WHO ICD-10 backend not yet implemented');
  }

  async getCode(code: string): Promise<ICDCode | null> {
    throw new Error('WHO ICD-10 backend not yet implemented');
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async getMetadata(): Promise<{
    version: string;
    lastUpdated: string;
    totalCodes: number;
    source: string;
  }> {
    throw new Error('WHO ICD-10 backend not yet implemented');
  }
}
