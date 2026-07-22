/**
 * Kaggle ICD Data Loader
 *
 * Loads real ICD-10 codes from the India Hospital Readmission Dataset (Kaggle)
 * Populates the ICDKnowledgeBase with actual diagnostic codes used in Indian hospitals
 *
 * Usage:
 *   const loader = new KaggleICDDataLoader();
 *   await loader.downloadAndParse();
 *   const codes = await loader.getICDCodes();
 *   await knowledgeBase.loadCodes(new KaggleICDBackendReal(codes));
 */

import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';

export interface RawICDRecord {
  icd_code: string;
  diagnosis: string;
  age_group?: string;
  gender?: string;
  frequency?: number;
  severity?: string;
}

export interface ParsedICDCode {
  code: string;
  description: string;
  chapter: string;
  category: string;
  subcategory: string;
  keywords: string[];
  synonyms: string[];
  applicableAge?: { minAge?: number; maxAge?: number };
  applicableGender?: 'M' | 'F' | 'Both';
  relatedCodes?: string[];
  frequency?: number;
}

/**
 * Kaggle ICD Data Loader
 */
export class KaggleICDDataLoader {
  private datasetPath: string | null = null;
  private icdCodes: Map<string, ParsedICDCode> = new Map();

  /**
   * Download Kaggle dataset using kagglehub
   * Requires: pip install kagglehub
   */
  async downloadDataset(): Promise<string> {
    console.log('[Kaggle Loader] Downloading India Hospital Readmission Dataset...');

    // Use Python child process to download via kagglehub
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      const pythonScript = `
import kagglehub
path = kagglehub.dataset_download("digutlaranjithkumar/india-hospital-readmission-dataset-20152024")
print(path)
`;

      const python = spawn('python3', ['-c', pythonScript]);
      let output = '';
      let error = '';

      python.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      python.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });

      python.on('close', (code: number) => {
        if (code !== 0) {
          console.error('[Kaggle Loader] Error downloading dataset:', error);
          reject(new Error(`Failed to download Kaggle dataset: ${error}`));
          return;
        }

        const datasetPath = output.trim();
        console.log('[Kaggle Loader] Dataset downloaded to:', datasetPath);
        this.datasetPath = datasetPath;
        resolve(datasetPath);
      });
    });
  }

  /**
   * Parse CSV files from Kaggle dataset
   */
  async parseDataset(): Promise<void> {
    if (!this.datasetPath) {
      throw new Error('Dataset not downloaded. Call downloadDataset() first.');
    }

    console.log('[Kaggle Loader] Parsing dataset files...');

    // Find CSV files in dataset
    const files = fs.readdirSync(this.datasetPath);
    const csvFiles = files.filter(f => f.endsWith('.csv'));

    console.log('[Kaggle Loader] Found CSV files:', csvFiles);

    for (const csvFile of csvFiles) {
      const filePath = path.join(this.datasetPath, csvFile);
      await this.parseCSVFile(filePath);
    }

    console.log(`[Kaggle Loader] Parsed ${this.icdCodes.size} unique ICD codes`);
  }

  /**
   * Parse individual CSV file
   */
  private async parseCSVFile(filePath: string): Promise<void> {
    console.log(`[Kaggle Loader] Processing ${path.basename(filePath)}...`);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`[Kaggle Loader] Found ${records.length} records in ${path.basename(filePath)}`);

    for (const record of records) {
      const icdCode = record.icd_code?.trim() || record.ICD_CODE?.trim();
      const diagnosis = record.diagnosis?.trim() || record.Diagnosis?.trim();

      if (icdCode && diagnosis) {
        this.addICDCode(icdCode, diagnosis, record);
      }
    }
  }

  /**
   * Add ICD code to the database
   */
  private addICDCode(code: string, diagnosis: string, metadata: any): void {
    // Skip if already parsed
    if (this.icdCodes.has(code)) {
      return;
    }

    // Extract chapter from code (first character)
    const chapter = this.getChapter(code);

    // Create normalized keywords from diagnosis
    const keywords = this.extractKeywords(diagnosis);
    const synonyms = this.extractSynonyms(diagnosis, code);

    // Parse age applicability
    const ageGroup = metadata.age_group?.trim();
    const applicableAge = this.parseAgeGroup(ageGroup);

    // Parse gender applicability
    const genderStr = metadata.gender?.trim();
    const applicableGender = this.parseGender(genderStr);

    const parsedCode: ParsedICDCode = {
      code,
      description: diagnosis,
      chapter,
      category: this.getCategory(code),
      subcategory: this.getSubcategory(code),
      keywords,
      synonyms,
      applicableAge,
      applicableGender,
      frequency: parseInt(metadata.frequency) || 1,
    };

    this.icdCodes.set(code, parsedCode);
  }

  /**
   * Get ICD chapter from code
   * Chapter is determined by first 1-3 characters
   */
  private getChapter(code: string): string {
    const firstChar = code.charAt(0);

    const chapters: Record<string, string> = {
      'A': 'I - Certain infectious and parasitic diseases',
      'B': 'I - Certain infectious and parasitic diseases',
      'C': 'II - Neoplasms',
      'D': 'II - Neoplasms',
      'E': 'IV - Endocrine, nutritional and metabolic diseases',
      'F': 'V - Mental, behavioral and neurodevelopmental disorders',
      'G': 'VI - Diseases of the nervous system',
      'H': 'VII & VIII - Diseases of eye, ear, nose and throat',
      'I': 'IX - Diseases of the circulatory system',
      'J': 'X - Diseases of the respiratory system',
      'K': 'XI - Diseases of the digestive system',
      'L': 'XII - Diseases of the skin and subcutaneous tissue',
      'M': 'XIII - Diseases of the musculoskeletal system',
      'N': 'XIV - Diseases of the genitourinary system',
      'O': 'XV - Pregnancy, childbirth and the puerperium',
      'P': 'XVI - Certain conditions originating in the perinatal period',
      'Q': 'XVII - Congenital malformations',
      'R': 'XVIII - Symptoms, signs and abnormal findings',
      'S': 'XIX - Injury, poisoning and consequences',
      'T': 'XIX - Injury, poisoning and consequences',
      'U': 'XX - External causes of morbidity',
      'V': 'XX - External causes of morbidity',
      'W': 'XX - External causes of morbidity',
      'X': 'XX - External causes of morbidity',
      'Y': 'XX - External causes of morbidity',
      'Z': 'XXI - Factors influencing health status',
    };

    return chapters[firstChar] || 'Unknown';
  }

  /**
   * Get category (first 3 chars of ICD code)
   */
  private getCategory(code: string): string {
    return code.substring(0, 3);
  }

  /**
   * Get subcategory (first 4 chars of ICD code)
   */
  private getSubcategory(code: string): string {
    return code.substring(0, 4);
  }

  /**
   * Extract keywords from diagnosis text
   */
  private extractKeywords(diagnosis: string): string[] {
    const keywords = new Set<string>();

    // Split by common delimiters
    const words = diagnosis.toLowerCase().split(/[,\s\-/]+/);

    for (const word of words) {
      const trimmed = word.trim();

      // Include words > 3 characters (skip articles, prepositions)
      if (trimmed.length > 3 && !this.isStopword(trimmed)) {
        keywords.add(trimmed);
      }
    }

    // Add common abbreviations
    const abbrevMatches = diagnosis.match(/\b[A-Z]{2,4}\b/g);
    if (abbrevMatches) {
      abbrevMatches.forEach(abbr => keywords.add(abbr.toLowerCase()));
    }

    return Array.from(keywords);
  }

  /**
   * Extract synonyms from diagnosis
   */
  private extractSynonyms(diagnosis: string, code: string): string[] {
    const synonyms = new Set<string>();

    // Add common alternative spellings
    const replacements: Record<string, string[]> = {
      'diabetes': ['DM', 'mellitus'],
      'hypertension': ['HTN', 'high blood pressure'],
      'myocardial infarction': ['MI', 'heart attack'],
      'coronary': ['CAD', 'heart disease'],
      'pneumonia': ['PNA', 'chest infection'],
      'urinary tract infection': ['UTI', 'bladder infection'],
      'chronic obstructive': ['COPD'],
      'acute kidney injury': ['AKI', 'renal failure'],
      'cancer': ['malignancy', 'tumor', 'carcinoma'],
      'arthritis': ['joint disease', 'inflammation'],
      'asthma': ['reactive airway'],
      'fracture': ['break', 'broken bone'],
      'dislocation': ['luxation'],
      'sprain': ['ligament injury'],
      'laceration': ['cut', 'wound'],
      'contusion': ['bruise', 'trauma'],
    };

    const diagLower = diagnosis.toLowerCase();
    for (const [key, alts] of Object.entries(replacements)) {
      if (diagLower.includes(key)) {
        alts.forEach(alt => synonyms.add(alt));
      }
    }

    return Array.from(synonyms);
  }

  /**
   * Parse age group string
   */
  private parseAgeGroup(ageGroup?: string): { minAge?: number; maxAge?: number } | undefined {
    if (!ageGroup) return undefined;

    const match = ageGroup.match(/(\d+)\s*-\s*(\d+)/);
    if (match) {
      return {
        minAge: parseInt(match[1]),
        maxAge: parseInt(match[2]),
      };
    }

    // Handle age ranges like "18-30", "30+", "newborn"
    if (ageGroup.includes('newborn')) {
      return { minAge: 0, maxAge: 1 };
    }
    if (ageGroup.includes('infant')) {
      return { minAge: 0, maxAge: 2 };
    }
    if (ageGroup.includes('child')) {
      return { minAge: 2, maxAge: 12 };
    }
    if (ageGroup.includes('adult')) {
      return { minAge: 18 };
    }

    return undefined;
  }

  /**
   * Parse gender string
   */
  private parseGender(genderStr?: string): 'M' | 'F' | 'Both' | undefined {
    if (!genderStr) return 'Both';

    const lower = genderStr.toLowerCase();
    if (lower.includes('male')) return 'M';
    if (lower.includes('female')) return 'F';
    return 'Both';
  }

  /**
   * Check if word is a stop word
   */
  private isStopword(word: string): boolean {
    const stopwords = ['and', 'the', 'or', 'with', 'for', 'to', 'in', 'of', 'by', 'at', 'is', 'are'];
    return stopwords.includes(word);
  }

  /**
   * Get parsed ICD codes
   */
  getICDCodes(): ParsedICDCode[] {
    return Array.from(this.icdCodes.values());
  }

  /**
   * Get code by ICD code
   */
  getCode(code: string): ParsedICDCode | null {
    return this.icdCodes.get(code) || null;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalCodes: number;
    codesByChapter: Record<string, number>;
    frequencySum: number;
  } {
    const stats = {
      totalCodes: this.icdCodes.size,
      codesByChapter: {} as Record<string, number>,
      frequencySum: 0,
    };

    for (const code of this.icdCodes.values()) {
      stats.codesByChapter[code.chapter] = (stats.codesByChapter[code.chapter] || 0) + 1;
      stats.frequencySum += code.frequency || 1;
    }

    return stats;
  }

  /**
   * Export as JSON for offline use
   */
  exportJSON(outputPath: string): void {
    const data = {
      version: '2024-01',
      source: 'Kaggle - India Hospital Readmission Dataset',
      totalCodes: this.icdCodes.size,
      exportedAt: new Date().toISOString(),
      codes: Array.from(this.icdCodes.values()),
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`[Kaggle Loader] Exported ${this.icdCodes.size} codes to ${outputPath}`);
  }
}

/**
 * Real Kaggle Backend Implementation - Uses actual loaded data
 */
export class KaggleICDBackendReal {
  private codes: Map<string, ParsedICDCode>;

  constructor(icdCodes: ParsedICDCode[]) {
    this.codes = new Map(icdCodes.map(c => [c.code, c]));
  }

  async getAllCodes(): Promise<ParsedICDCode[]> {
    return Array.from(this.codes.values());
  }

  async getCode(code: string): Promise<ParsedICDCode | null> {
    return this.codes.get(code) || null;
  }

  async isAvailable(): Promise<boolean> {
    return this.codes.size > 0;
  }

  async getMetadata(): Promise<{
    version: string;
    lastUpdated: string;
    totalCodes: number;
    source: string;
  }> {
    return {
      version: '2024-01',
      lastUpdated: new Date().toISOString(),
      totalCodes: this.codes.size,
      source: 'Kaggle - India Hospital Readmission Dataset',
    };
  }
}

/**
 * Setup script - Download and initialize knowledge base
 */
export async function initializeKnowledgeBaseFromKaggle(): Promise<KaggleICDBackendReal> {
  console.log('[Setup] Initializing ICD Knowledge Base from Kaggle...\n');

  const loader = new KaggleICDDataLoader();

  try {
    // Step 1: Download dataset
    console.log('📥 Step 1: Downloading Kaggle dataset...');
    await loader.downloadDataset();

    // Step 2: Parse dataset
    console.log('\n📖 Step 2: Parsing ICD codes...');
    await loader.parseDataset();

    // Step 3: Get statistics
    const stats = loader.getStats();
    console.log('\n📊 Dataset Statistics:');
    console.log(`   Total ICD codes: ${stats.totalCodes}`);
    console.log(`   Codes by chapter: ${JSON.stringify(stats.codesByChapter, null, 2)}`);

    // Step 4: Export for backup
    const backupPath = '/Users/abhishekpravinnahire/V1 tpa insaurance/data/icd_codes.json';
    loader.exportJSON(backupPath);

    // Step 5: Create backend
    console.log('\n✅ Knowledge base initialized!');
    return new KaggleICDBackendReal(loader.getICDCodes());
  } catch (error) {
    console.error('\n❌ Error initializing knowledge base:', error);
    throw error;
  }
}
