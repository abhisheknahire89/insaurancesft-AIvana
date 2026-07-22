/**
 * ICD System Initializer
 *
 * Complete setup for the clinical coding system:
 * 1. Download real ICD codes from Kaggle
 * 2. Initialize knowledge base
 * 3. Setup deterministic validator
 * 4. Ready for case processing
 *
 * Usage:
 *   const system = await ICDSystemInitializer.initialize();
 *   const result = await system.codingEngine.generateSuggestions(unifiedCase, reconciliation);
 */

import { ICDKnowledgeBase, KaggleICDBackend } from './icdKnowledgeBase';
import { ClinicalCodingEngine } from './clinicalCodingEngine';
import { KaggleICDDataLoader, KaggleICDBackendReal } from './kaggleICDDataLoader';

export interface ICDSystem {
  knowledgeBase: ICDKnowledgeBase;
  codingEngine: ClinicalCodingEngine;
  initialized: boolean;
  stats: {
    totalCodes: number;
    loadTime: number;
  };
}

/**
 * ICD System Initializer
 */
export class ICDSystemInitializer {
  /**
   * Initialize complete ICD system with real data
   */
  static async initialize(useRealData: boolean = false): Promise<ICDSystem> {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  INITIALIZING ICD CLINICAL CODING SYSTEM   ║');
    console.log('╚════════════════════════════════════════════╝\n');

    const startTime = Date.now();

    try {
      // Step 1: Initialize knowledge base
      console.log('📚 Step 1: Initializing Knowledge Base...');
      const knowledgeBase = new ICDKnowledgeBase('2024', 'India Hospital Readmission Dataset');

      let backend;
      if (useRealData) {
        console.log('   Loading real data from Kaggle...\n');
        backend = await this.loadKaggleData();
      } else {
        console.log('   Using sample data for testing...\n');
        backend = new KaggleICDBackend();
      }

      // Step 2: Load codes into knowledge base
      console.log('🔄 Step 2: Loading codes into knowledge base...');
      await knowledgeBase.loadCodes(backend);

      // Step 3: Initialize coding engine
      console.log('🔧 Step 3: Initializing Clinical Coding Engine...');
      const codingEngine = new ClinicalCodingEngine(knowledgeBase);

      const endTime = Date.now();
      const loadTime = (endTime - startTime) / 1000;

      // Step 4: Display summary
      const metadata = knowledgeBase.getMetadata();
      console.log('\n✅ ICD SYSTEM INITIALIZED SUCCESSFULLY\n');
      console.log(`   📊 Total ICD Codes: ${metadata.totalCodes}`);
      console.log(`   📅 Version: ${metadata.version}`);
      console.log(`   📖 Source: ${metadata.source}`);
      console.log(`   ⏱️  Initialization Time: ${loadTime.toFixed(2)}s\n`);

      // Step 5: Show sample codes available
      console.log('🔍 Sample Codes Available:');
      const sampleCodes = [
        'M51.26',
        'M54.1',
        'I10',
        'E11.9',
        'J18',
        'K35',
        'R50.9',
        'I21.9',
      ];

      for (const code of sampleCodes) {
        const codeData = knowledgeBase.getCode(code);
        if (codeData) {
          console.log(`   ✓ ${code}: ${codeData.description}`);
        }
      }

      console.log('\n🎯 System Status: READY FOR CASE PROCESSING\n');

      return {
        knowledgeBase,
        codingEngine,
        initialized: true,
        stats: {
          totalCodes: metadata.totalCodes,
          loadTime,
        },
      };
    } catch (error) {
      console.error('\n❌ Failed to initialize ICD system:', error);
      console.log('\n⚠️  Falling back to sample data mode...\n');

      // Fallback to sample data
      const knowledgeBase = new ICDKnowledgeBase('2024', 'Sample Data (Fallback)');
      const backend = new KaggleICDBackend();
      await knowledgeBase.loadCodes(backend);
      const codingEngine = new ClinicalCodingEngine(knowledgeBase);

      const metadata = knowledgeBase.getMetadata();

      return {
        knowledgeBase,
        codingEngine,
        initialized: true,
        stats: {
          totalCodes: metadata.totalCodes,
          loadTime: (Date.now() - startTime) / 1000,
        },
      };
    }
  }

  /**
   * Load Kaggle data
   */
  private static async loadKaggleData(): Promise<KaggleICDBackendReal> {
    const loader = new KaggleICDDataLoader();

    try {
      // Try to download fresh data
      console.log('   Downloading dataset from Kaggle...');
      await loader.downloadDataset();
      console.log('   Parsing ICD codes...');
      await loader.parseDataset();

      const stats = loader.getStats();
      console.log(`   ✓ Loaded ${stats.totalCodes} unique ICD codes`);

      // Export for backup
      const backupPath = '/Users/abhishekpravinnahire/V1 tpa insaurance/data/icd_codes_backup.json';
      loader.exportJSON(backupPath);
      console.log(`   ✓ Backup saved to ${backupPath}`);

      return new KaggleICDBackendReal(loader.getICDCodes());
    } catch (error) {
      console.error('   ✗ Failed to load Kaggle data:', error);
      throw error;
    }
  }
}

/**
 * Example usage
 */
export async function exampleUsage() {
  // Initialize with sample data (fast for demo)
  const system = await ICDSystemInitializer.initialize(false);

  // In production, use real data:
  // const system = await ICDSystemInitializer.initialize(true);

  // Now you can use the system:
  // const result = await system.codingEngine.generateSuggestions(unifiedCase, reconciliation);

  return system;
}
