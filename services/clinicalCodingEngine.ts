/**
 * Clinical Coding Engine
 *
 * AI-assisted ICD-10 recommendation system for Indian hospital insurance operations.
 *
 * Workflow:
 * 1. Extracts clinical evidence from unified case
 * 2. Normalizes medical terminology
 * 3. Generates ICD candidates
 * 4. Validates candidates with deterministic rules (BEFORE AI)
 * 5. Ranks valid candidates with AI
 * 6. Calculates confidence scores
 * 7. Provides clinical reasoning and evidence trail
 *
 * Output suitable for Hospital Insurance Coordinator review.
 *
 * Authority: AI is an ASSISTANT only. Final authority is the hospital reviewer.
 */

import type { Case } from './caseModel';
import type { ReconciliationResult } from './reconciliationEngine';
import { ICDKnowledgeBase, type ICDSearchResult } from './icdKnowledgeBase';
import {
  ICDDeterministicValidator,
  type ValidatedICDCandidate,
  getValidationSummary,
} from './icdDeterministicValidator';

export interface ICDSuggestion {
  code: string;
  description: string;
  type: 'primary' | 'secondary' | 'comorbidity' | 'complication';
  confidence: number;
  confidenceCategory: 'high' | 'review_recommended' | 'manual_review_required';

  // Supporting evidence
  supportingDiagnosis: string;
  supportingEvidence: string[];
  supportingDocuments: string[];
  supportingPageNumbers: number[];

  // Clinical reasoning
  clinicalReasoning: string;
  guidelineReference?: string;

  // Validation status
  validationIssues: string[];
  validationWarnings: string[];

  // Metadata
  source: 'knowledge_base' | 'unified_case';
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  reviewStatus: 'engine_suggested' | 'coordinator_approved' | 'coordinator_rejected' | 'coordinator_modified';
}

export interface ClinicalCodingResult {
  caseId: string;
  codingStatus: 'completed' | 'pending_coordinator_review' | 'unable_to_code';
  generatedAt: string;

  // Primary diagnosis
  primaryDiagnosis: ICDSuggestion | null;

  // Secondary diagnoses
  secondaryDiagnoses: ICDSuggestion[];

  // Comorbidities
  comorbidities: ICDSuggestion[];

  // Complications
  complications: ICDSuggestion[];

  // Procedures (for future use)
  procedures: ICDSuggestion[];

  // Summary statistics
  totalSuggestions: number;
  highConfidenceSuggestions: number;
  reviewRecommendedSuggestions: number;
  manualReviewRequiredSuggestions: number;

  // Clinical details extracted
  extractedDetails: {
    primaryDiagnosisText: string;
    secondaryDiagnosesText: string[];
    comorbidititesText: string[];
    procedureText: string;
  };

  // Next steps for coordinator
  coordinatorActions: string[];

  // Audit trail
  engineVersion: string;
  knowledgeBaseVersion: string;
}

/**
 * Clinical Coding Engine - Main class
 */
export class ClinicalCodingEngine {
  private knowledgeBase: ICDKnowledgeBase;
  private validator: ICDDeterministicValidator | null = null;
  private engineVersion = '1.0.0';

  constructor(knowledgeBase: ICDKnowledgeBase) {
    this.knowledgeBase = knowledgeBase;
  }

  /**
   * Generate ICD suggestions for a unified case
   */
  async generateSuggestions(
    unifiedCase: Case,
    reconciliation: ReconciliationResult
  ): Promise<ClinicalCodingResult> {
    console.log(`[Clinical Coding Engine] Generating suggestions for case ${unifiedCase.id}`);

    const startTime = Date.now();

    // Initialize validator
    this.validator = new ICDDeterministicValidator(
      this.knowledgeBase,
      unifiedCase,
      reconciliation.mergedData
    );

    // Step 1: Extract clinical evidence
    const extractedDetails = this.extractClinicalEvidence(unifiedCase);
    console.log('[Coding Engine] Extracted evidence:', extractedDetails);

    // Step 2: Normalize terminology
    const normalizedTerms = this.normalizeTerminology(extractedDetails);
    console.log('[Coding Engine] Normalized terms:', normalizedTerms);

    // Step 3: Generate candidates
    const candidates = this.generateCandidates(normalizedTerms, extractedDetails);
    console.log(`[Coding Engine] Generated ${candidates.length} candidates`);

    // Step 4: Validate with deterministic rules (REJECT INVALID BEFORE AI)
    const validatedCandidates = this.validator.validateCandidates(
      candidates.map(c => c.code)
    );
    console.log('[Coding Engine] Validation summary:', getValidationSummary(validatedCandidates));

    // Filter to valid candidates
    const validCandidates = validatedCandidates.filter(c => c.valid);
    console.log(`[Coding Engine] ${validCandidates.length} candidates passed validation`);

    // Step 5: Rank valid candidates with AI/confidence
    const rankedSuggestions = this.rankCandidates(
      validCandidates,
      normalizedTerms,
      extractedDetails,
      unifiedCase
    );
    console.log('[Coding Engine] Ranked suggestions:', rankedSuggestions.length);

    // Step 6: Build detailed suggestions
    const suggestions = this.buildDetailedSuggestions(
      rankedSuggestions,
      validatedCandidates,
      extractedDetails,
      unifiedCase
    );

    // Step 7: Categorize suggestions
    const categorizedSuggestions = this.categorizeSuggestions(suggestions);

    // Step 8: Generate coordinator actions
    const coordinatorActions = this.generateCoordinatorActions(categorizedSuggestions);

    const endTime = Date.now();
    console.log(`[Coding Engine] Suggestions generated in ${(endTime - startTime) / 1000}s`);

    return {
      caseId: unifiedCase.id,
      codingStatus: 'pending_coordinator_review',
      generatedAt: new Date().toISOString(),
      primaryDiagnosis: categorizedSuggestions.primary[0] || null,
      secondaryDiagnoses: categorizedSuggestions.secondary,
      comorbidities: categorizedSuggestions.comorbidity,
      complications: categorizedSuggestions.complication,
      procedures: categorizedSuggestions.procedure,
      totalSuggestions: suggestions.length,
      highConfidenceSuggestions: suggestions.filter(s => s.confidence > 0.95).length,
      reviewRecommendedSuggestions: suggestions.filter(
        s => s.confidence >= 0.75 && s.confidence <= 0.95
      ).length,
      manualReviewRequiredSuggestions: suggestions.filter(s => s.confidence < 0.75).length,
      extractedDetails,
      coordinatorActions,
      engineVersion: this.engineVersion,
      knowledgeBaseVersion: this.knowledgeBase.getMetadata().version,
    };
  }

  /**
   * Extract clinical evidence from unified case
   */
  private extractClinicalEvidence(unifiedCase: Case): {
    primaryDiagnosisText: string;
    secondaryDiagnosesText: string[];
    comorbidititesText: string[];
    procedureText: string;
  } {
    return {
      primaryDiagnosisText: unifiedCase.clinical.diagnosis || '',
      secondaryDiagnosesText: unifiedCase.clinical.pastMedicalHistory?.split(',').map(s => s.trim()) || [],
      comorbidititesText: unifiedCase.clinical.pastMedicalHistory?.split(',').map(s => s.trim()) || [],
      procedureText: unifiedCase.clinical.proposedProcedure || '',
    };
  }

  /**
   * Normalize medical terminology
   */
  private normalizeTerminology(extractedDetails: any): string[] {
    const normalized: string[] = [];

    // Normalize primary diagnosis
    const primaryNorm = this.normalizeText(extractedDetails.primaryDiagnosisText);
    if (primaryNorm) normalized.push(primaryNorm);

    // Normalize secondary diagnoses
    for (const secondary of extractedDetails.secondaryDiagnosesText) {
      const norm = this.normalizeText(secondary);
      if (norm) normalized.push(norm);
    }

    return [...new Set(normalized)];
  }

  /**
   * Normalize text by expanding abbreviations
   */
  private normalizeText(text: string): string {
    if (!text) return '';

    let normalized = text.toLowerCase();

    // Expand common abbreviations
    const abbreviations: Record<string, string> = {
      'htn': 'hypertension',
      'bp': 'blood pressure',
      'dm': 'diabetes mellitus',
      't2dm': 'type 2 diabetes',
      'cad': 'coronary artery disease',
      'mi': 'myocardial infarction',
      'lvef': 'left ventricular ejection fraction',
      'copd': 'chronic obstructive pulmonary disease',
      'aki': 'acute kidney injury',
      'ckd': 'chronic kidney disease',
      'uti': 'urinary tract infection',
      'cad': 'coronary artery disease',
    };

    for (const [abbr, expanded] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      normalized = normalized.replace(regex, expanded);
    }

    return normalized;
  }

  /**
   * Generate ICD candidates from normalized terms
   */
  private generateCandidates(
    normalizedTerms: string[],
    extractedDetails: any
  ): { code: string; source: string }[] {
    const candidateCodes = new Set<string>();

    for (const term of normalizedTerms) {
      // Search knowledge base
      const results = this.knowledgeBase.search(term, 20);

      for (const result of results) {
        candidateCodes.add(result.code);
      }
    }

    return Array.from(candidateCodes).map(code => ({
      code,
      source: 'knowledge_base',
    }));
  }

  /**
   * Rank candidates with confidence scoring
   */
  private rankCandidates(
    validatedCandidates: ValidatedICDCandidate[],
    normalizedTerms: string[],
    extractedDetails: any,
    unifiedCase: Case
  ): Array<{ code: string; confidence: number }> {
    const ranked: Array<{ code: string; confidence: number }> = [];

    for (const candidate of validatedCandidates) {
      const confidence = this.calculateConfidence(
        candidate.code,
        normalizedTerms,
        extractedDetails,
        unifiedCase
      );

      ranked.push({
        code: candidate.code,
        confidence,
      });
    }

    // Sort by confidence descending
    return ranked.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate confidence score for a candidate
   */
  private calculateConfidence(
    code: string,
    normalizedTerms: string[],
    extractedDetails: any,
    unifiedCase: Case
  ): number {
    let confidence = 0.5; // Base confidence

    const codeData = this.knowledgeBase.getCode(code);
    if (!codeData) return 0.3;

    // Match strength
    let matchFound = false;
    for (const term of normalizedTerms) {
      const results = this.knowledgeBase.search(term, 100);
      if (results.some(r => r.code === code)) {
        matchFound = true;
        // Increase confidence based on match type
        const match = results.find(r => r.code === code)!;
        if (match.matchType === 'exact') confidence += 0.3;
        else if (match.matchType === 'synonym') confidence += 0.25;
        else if (match.matchType === 'keyword') confidence += 0.15;
        else if (match.matchType === 'partial') confidence += 0.1;
      }
    }

    if (!matchFound) confidence -= 0.2;

    // Evidence support
    if (unifiedCase.clinical.imaging && unifiedCase.clinical.imaging.length > 0) {
      confidence += 0.1;
    }
    if (unifiedCase.clinical.labResults && unifiedCase.clinical.labResults.length > 0) {
      confidence += 0.05;
    }

    // Documentation confirmation
    if (unifiedCase.clinical.diagnosis && extractedDetails.primaryDiagnosisText.toLowerCase().includes(code.substring(0, 3))) {
      confidence += 0.1;
    }

    // Cap confidence at 0.99 (no certainty)
    return Math.min(confidence, 0.99);
  }

  /**
   * Build detailed suggestions
   */
  private buildDetailedSuggestions(
    rankedSuggestions: Array<{ code: string; confidence: number }>,
    validatedCandidates: ValidatedICDCandidate[],
    extractedDetails: any,
    unifiedCase: Case
  ): ICDSuggestion[] {
    const suggestions: ICDSuggestion[] = [];

    for (const ranked of rankedSuggestions) {
      const codeData = this.knowledgeBase.getCode(ranked.code);
      const validated = validatedCandidates.find(c => c.code === ranked.code);

      if (!codeData || !validated) continue;

      // Build evidence trail
      const supportingEvidence = this.buildEvidenceTrail(ranked.code, extractedDetails, unifiedCase);
      const supportingDocuments = this.findSupportingDocuments(ranked.code, unifiedCase);

      suggestions.push({
        code: ranked.code,
        description: codeData.description,
        type: 'primary', // Will be categorized later
        confidence: ranked.confidence,
        confidenceCategory: this.getConfidenceCategory(ranked.confidence),
        supportingDiagnosis: extractedDetails.primaryDiagnosisText,
        supportingEvidence: supportingEvidence,
        supportingDocuments: supportingDocuments,
        supportingPageNumbers: this.findPageNumbers(supportingDocuments),
        clinicalReasoning: this.generateClinicalReasoning(ranked.code, extractedDetails),
        validationIssues: validated.issues
          .filter(i => i.severity === 'error')
          .map(i => i.issue),
        validationWarnings: validated.issues
          .filter(i => i.severity === 'warning')
          .map(i => i.issue),
        source: 'knowledge_base',
        evidenceStrength: this.evaluateEvidenceStrength(supportingEvidence, unifiedCase),
        reviewStatus: 'engine_suggested',
      });
    }

    return suggestions;
  }

  /**
   * Build evidence trail for a code
   */
  private buildEvidenceTrail(code: string, extractedDetails: any, unifiedCase: Case): string[] {
    const evidence: string[] = [];

    // Match with diagnosis
    if (extractedDetails.primaryDiagnosisText) {
      evidence.push(`Documented diagnosis: ${extractedDetails.primaryDiagnosisText}`);
    }

    // Match with imaging
    if (unifiedCase.clinical.imaging && unifiedCase.clinical.imaging.length > 0) {
      evidence.push(`Imaging support: ${unifiedCase.clinical.imaging[0].findings}`);
    }

    // Match with labs
    if (unifiedCase.clinical.labResults && unifiedCase.clinical.labResults.length > 0) {
      const abnormalLabs = unifiedCase.clinical.labResults.filter(l => l.status !== 'NORMAL');
      if (abnormalLabs.length > 0) {
        evidence.push(`Abnormal labs: ${abnormalLabs.map(l => `${l.testName}=${l.value}`).join(', ')}`);
      }
    }

    return evidence;
  }

  /**
   * Find supporting documents
   */
  private findSupportingDocuments(code: string, unifiedCase: Case): string[] {
    const documents: string[] = [];

    if (unifiedCase.documents) {
      for (const doc of unifiedCase.documents) {
        if (doc.extractedData) {
          const data = typeof doc.extractedData === 'string'
            ? doc.extractedData
            : JSON.stringify(doc.extractedData);

          if (data.toLowerCase().includes(code.substring(0, 3))) {
            documents.push(doc.name);
          }
        }
      }
    }

    return documents;
  }

  /**
   * Find page numbers in documents
   */
  private findPageNumbers(documents: string[]): number[] {
    // In production, would extract actual page numbers from documents
    return documents.length > 0 ? [1] : [];
  }

  /**
   * Generate clinical reasoning
   */
  private generateClinicalReasoning(code: string, extractedDetails: any): string {
    const codeData = this.knowledgeBase.getCode(code);
    if (!codeData) return '';

    return `Based on documented diagnosis "${extractedDetails.primaryDiagnosisText}", this maps to ICD-10 code ${code} (${codeData.description})`;
  }

  /**
   * Evaluate evidence strength
   */
  private evaluateEvidenceStrength(evidence: string[], unifiedCase: Case): 'strong' | 'moderate' | 'weak' {
    let strength = 0;

    if (evidence.length >= 3) strength += 2; // Multiple evidence sources
    if (unifiedCase.clinical.imaging) strength += 1;
    if (unifiedCase.clinical.labResults) strength += 1;

    if (strength >= 3) return 'strong';
    if (strength >= 1) return 'moderate';
    return 'weak';
  }

  /**
   * Get confidence category
   */
  private getConfidenceCategory(confidence: number): 'high' | 'review_recommended' | 'manual_review_required' {
    if (confidence > 0.95) return 'high';
    if (confidence >= 0.75) return 'review_recommended';
    return 'manual_review_required';
  }

  /**
   * Categorize suggestions
   */
  private categorizeSuggestions(suggestions: ICDSuggestion[]): {
    primary: ICDSuggestion[];
    secondary: ICDSuggestion[];
    comorbidity: ICDSuggestion[];
    complication: ICDSuggestion[];
    procedure: ICDSuggestion[];
  } {
    return {
      primary: suggestions.filter(s => s.type === 'primary').slice(0, 1),
      secondary: suggestions.filter(s => s.type === 'secondary'),
      comorbidity: suggestions.filter(s => s.type === 'comorbidity'),
      complication: suggestions.filter(s => s.type === 'complication'),
      procedure: suggestions.filter(s => s.type === 'procedure'),
    };
  }

  /**
   * Generate coordinator actions
   */
  private generateCoordinatorActions(categorizedSuggestions: any): string[] {
    const actions: string[] = [];

    if (categorizedSuggestions.primary.length === 0) {
      actions.push('❌ No primary diagnosis suggestion - Manual coding required');
    } else if (categorizedSuggestions.primary[0].confidence < 0.75) {
      actions.push('⚠️ Review primary diagnosis confidence');
    } else {
      actions.push('✓ Primary diagnosis ready for approval');
    }

    if (categorizedSuggestions.secondary.length > 0) {
      actions.push(`📋 Review ${categorizedSuggestions.secondary.length} secondary diagnosis suggestions`);
    }

    if (categorizedSuggestions.comorbidity.length > 0) {
      actions.push(`🏥 Review ${categorizedSuggestions.comorbidity.length} comorbidity suggestions`);
    }

    if (categorizedSuggestions.complication.length > 0) {
      actions.push(`⚡ Review ${categorizedSuggestions.complication.length} complication suggestions`);
    }

    actions.push('👤 Final approval required before TPA submission');

    return actions;
  }
}
