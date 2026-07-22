/**
 * Coding Review Workflow
 *
 * Hospital Coordinator review and approval of AI-suggested ICD codes.
 * Handles all coordinator actions and tracks every decision for audit.
 *
 * Coordinator actions:
 * • Accept engine suggestion
 * • Search ICD knowledge base
 * • Replace ICD code
 * • Add secondary diagnosis
 * • Remove code
 * • Add manual code
 * • View evidence/supporting documents
 *
 * All changes logged with timestamp, user, and reason.
 */

import type { ICDSuggestion, ClinicalCodingResult } from './clinicalCodingEngine';
import type { ICDKnowledgeBase } from './icdKnowledgeBase';

export interface CoordinatorDecision {
  // Decision metadata
  decisionId: string;
  caseId: string;
  timestamp: string;
  coordinatorId: string;
  coordinatorName: string;
  coordinatorRole: 'insurance_coordinator' | 'billing_executive' | 'medical_supervisor';

  // The decision
  action: 'accept' | 'replace' | 'add' | 'remove' | 'manual_override';
  originalCode?: string;
  newCode?: string;
  codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication';

  // Justification
  reason: string;
  evidence?: string;
  guideline?: string;

  // Confidence
  manualConfidence?: number; // If overriding AI confidence

  // Audit trail
  status: 'pending_review' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface CodingReviewTask {
  taskId: string;
  caseId: string;
  status: 'assigned' | 'in_review' | 'completed' | 'escalated';
  createdAt: string;
  assignedTo: {
    coordinatorId: string;
    coordinatorName: string;
    role: 'insurance_coordinator' | 'billing_executive' | 'medical_supervisor';
  };

  // Original engine suggestions
  engineSuggestions: ClinicalCodingResult;

  // Coordinator decisions
  coordinatorDecisions: CoordinatorDecision[];

  // Final approved codes
  approvedCodes: {
    primary?: string;
    secondary: string[];
    comorbidities: string[];
    complications: string[];
  };

  // Timeline
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;

  // Quality metrics
  changesFromEngine: number;
  manualAdditions: number;
  rejections: number;
}

/**
 * Coding Review Workflow Manager
 */
export class CodingReviewWorkflow {
  private knowledgeBase: ICDKnowledgeBase;
  private activeReviews: Map<string, CodingReviewTask>;

  constructor(knowledgeBase: ICDKnowledgeBase) {
    this.knowledgeBase = knowledgeBase;
    this.activeReviews = new Map();
  }

  /**
   * Create review task for coordinator
   */
  createReviewTask(
    caseId: string,
    engineSuggestions: ClinicalCodingResult,
    coordinatorId: string,
    coordinatorName: string,
    coordinatorRole: 'insurance_coordinator' | 'billing_executive' | 'medical_supervisor'
  ): CodingReviewTask {
    const taskId = `REVIEW-${caseId}-${Date.now()}`;

    const task: CodingReviewTask = {
      taskId,
      caseId,
      status: 'assigned',
      createdAt: new Date().toISOString(),
      assignedTo: {
        coordinatorId,
        coordinatorName,
        role: coordinatorRole,
      },
      engineSuggestions,
      coordinatorDecisions: [],
      approvedCodes: {
        secondary: [],
        comorbidities: [],
        complications: [],
      },
      changesFromEngine: 0,
      manualAdditions: 0,
      rejections: 0,
    };

    this.activeReviews.set(taskId, task);
    console.log(`[Coding Review] Created review task ${taskId} for ${coordinatorName}`);

    return task;
  }

  /**
   * Get review task
   */
  getReviewTask(taskId: string): CodingReviewTask | null {
    return this.activeReviews.get(taskId) || null;
  }

  /**
   * Start review (coordinator opens the task)
   */
  startReview(taskId: string): CodingReviewTask | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    task.status = 'in_review';
    task.startedAt = new Date().toISOString();

    return task;
  }

  /**
   * Accept engine suggestion
   */
  acceptSuggestion(
    taskId: string,
    suggestion: ICDSuggestion,
    coordinatorId: string,
    coordinatorName: string,
    reason?: string
  ): CoordinatorDecision | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    const decision: CoordinatorDecision = {
      decisionId: `DECISION-${taskId}-${Date.now()}`,
      caseId: task.caseId,
      timestamp: new Date().toISOString(),
      coordinatorId,
      coordinatorName,
      coordinatorRole: task.assignedTo.role,
      action: 'accept',
      newCode: suggestion.code,
      codeType: suggestion.type,
      reason: reason || `Accepted AI suggestion (Confidence: ${(suggestion.confidence * 100).toFixed(0)}%)`,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: coordinatorId,
    };

    task.coordinatorDecisions.push(decision);

    // Add to approved codes
    if (suggestion.type === 'primary') {
      task.approvedCodes.primary = suggestion.code;
    } else if (suggestion.type === 'secondary') {
      task.approvedCodes.secondary.push(suggestion.code);
    } else if (suggestion.type === 'comorbidity') {
      task.approvedCodes.comorbidities.push(suggestion.code);
    } else if (suggestion.type === 'complication') {
      task.approvedCodes.complications.push(suggestion.code);
    }

    console.log(`[Coding Review] ${coordinatorName} accepted ${suggestion.code}`);

    return decision;
  }

  /**
   * Search ICD knowledge base for alternative codes
   */
  searchICDCodes(query: string, limit: number = 10): Array<{
    code: string;
    description: string;
    relevance: number;
  }> {
    const results = this.knowledgeBase.search(query, limit);
    return results.map(r => ({
      code: r.code,
      description: r.description,
      relevance: r.relevance,
    }));
  }

  /**
   * Replace ICD code (reject suggestion and select alternative)
   */
  replaceCode(
    taskId: string,
    originalCode: string,
    newCode: string,
    codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication',
    coordinatorId: string,
    coordinatorName: string,
    reason: string,
    guideline?: string,
    manualConfidence?: number
  ): CoordinatorDecision | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    // Validate new code
    const newCodeData = this.knowledgeBase.getCode(newCode);
    if (!newCodeData) {
      console.warn(`[Coding Review] Invalid code: ${newCode}`);
      return null;
    }

    const decision: CoordinatorDecision = {
      decisionId: `DECISION-${taskId}-${Date.now()}`,
      caseId: task.caseId,
      timestamp: new Date().toISOString(),
      coordinatorId,
      coordinatorName,
      coordinatorRole: task.assignedTo.role,
      action: 'replace',
      originalCode,
      newCode,
      codeType,
      reason,
      guideline,
      manualConfidence,
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: coordinatorId,
    };

    task.coordinatorDecisions.push(decision);
    task.changesFromEngine++;

    // Update approved codes
    if (codeType === 'primary') {
      task.approvedCodes.primary = newCode;
    } else if (codeType === 'secondary') {
      task.approvedCodes.secondary = task.approvedCodes.secondary.filter(c => c !== originalCode);
      task.approvedCodes.secondary.push(newCode);
    } else if (codeType === 'comorbidity') {
      task.approvedCodes.comorbidities = task.approvedCodes.comorbidities.filter(c => c !== originalCode);
      task.approvedCodes.comorbidities.push(newCode);
    }

    console.log(
      `[Coding Review] ${coordinatorName} replaced ${originalCode} with ${newCode}: ${reason}`
    );

    return decision;
  }

  /**
   * Add additional code not suggested by engine
   */
  addManualCode(
    taskId: string,
    code: string,
    codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication',
    coordinatorId: string,
    coordinatorName: string,
    reason: string,
    evidence: string,
    guideline?: string
  ): CoordinatorDecision | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    // Validate code
    const codeData = this.knowledgeBase.getCode(code);
    if (!codeData) {
      console.warn(`[Coding Review] Invalid code: ${code}`);
      return null;
    }

    const decision: CoordinatorDecision = {
      decisionId: `DECISION-${taskId}-${Date.now()}`,
      caseId: task.caseId,
      timestamp: new Date().toISOString(),
      coordinatorId,
      coordinatorName,
      coordinatorRole: task.assignedTo.role,
      action: 'manual_override',
      newCode: code,
      codeType,
      reason,
      evidence,
      guideline,
      manualConfidence: 0.85, // Default confidence for manual additions
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: coordinatorId,
    };

    task.coordinatorDecisions.push(decision);
    task.manualAdditions++;

    // Add to approved codes
    if (codeType === 'primary' && !task.approvedCodes.primary) {
      task.approvedCodes.primary = code;
    } else if (codeType === 'secondary') {
      task.approvedCodes.secondary.push(code);
    } else if (codeType === 'comorbidity') {
      task.approvedCodes.comorbidities.push(code);
    } else if (codeType === 'complication') {
      task.approvedCodes.complications.push(code);
    }

    console.log(`[Coding Review] ${coordinatorName} manually added ${code}: ${reason}`);

    return decision;
  }

  /**
   * Reject code (don't use engine suggestion)
   */
  rejectCode(
    taskId: string,
    code: string,
    coordinatorId: string,
    coordinatorName: string,
    reason: string
  ): CoordinatorDecision | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    const decision: CoordinatorDecision = {
      decisionId: `DECISION-${taskId}-${Date.now()}`,
      caseId: task.caseId,
      timestamp: new Date().toISOString(),
      coordinatorId,
      coordinatorName,
      coordinatorRole: task.assignedTo.role,
      action: 'remove',
      originalCode: code,
      codeType: 'secondary', // Simplified
      reason,
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: coordinatorId,
    };

    task.coordinatorDecisions.push(decision);
    task.rejections++;

    // Remove from approved codes if present
    task.approvedCodes.secondary = task.approvedCodes.secondary.filter(c => c !== code);
    task.approvedCodes.comorbidities = task.approvedCodes.comorbidities.filter(c => c !== code);
    task.approvedCodes.complications = task.approvedCodes.complications.filter(c => c !== code);

    console.log(`[Coding Review] ${coordinatorName} rejected ${code}: ${reason}`);

    return decision;
  }

  /**
   * Complete review and approve codes
   */
  completeReview(
    taskId: string,
    coordinatorId: string,
    finalNotes?: string
  ): CodingReviewTask | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    // Validate that at least primary code is selected
    if (!task.approvedCodes.primary) {
      console.warn(`[Coding Review] Cannot complete review without primary diagnosis`);
      return null;
    }

    task.status = 'completed';
    task.completedAt = new Date().toISOString();

    if (task.startedAt) {
      task.durationMinutes = Math.round(
        (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 60000
      );
    }

    console.log(`[Coding Review] ${taskId} completed by ${coordinatorId}`);
    console.log('[Coding Review] Final approved codes:', task.approvedCodes);
    console.log('[Coding Review] Changes from engine:', {
      replacements: task.changesFromEngine,
      manualAdditions: task.manualAdditions,
      rejections: task.rejections,
    });

    return task;
  }

  /**
   * Escalate to supervisor if needed
   */
  escalateReview(
    taskId: string,
    reason: string,
    escalatedBy: string
  ): CodingReviewTask | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    task.status = 'escalated';

    console.log(
      `[Coding Review] ${taskId} escalated by ${escalatedBy}: ${reason}`
    );

    return task;
  }

  /**
   * Get audit trail for a review task
   */
  getAuditTrail(taskId: string): {
    taskId: string;
    caseId: string;
    coordinatorName: string;
    decisions: Array<{
      timestamp: string;
      action: string;
      code: string;
      reason: string;
    }>;
    summary: {
      totalDecisions: number;
      acceptedFromEngine: number;
      changedCodes: number;
      manualAdditions: number;
      rejections: number;
      durationMinutes?: number;
    };
  } | null {
    const task = this.activeReviews.get(taskId);
    if (!task) return null;

    return {
      taskId: task.taskId,
      caseId: task.caseId,
      coordinatorName: task.assignedTo.coordinatorName,
      decisions: task.coordinatorDecisions.map(d => ({
        timestamp: d.timestamp,
        action: d.action,
        code: d.newCode || d.originalCode || 'N/A',
        reason: d.reason,
      })),
      summary: {
        totalDecisions: task.coordinatorDecisions.length,
        acceptedFromEngine: task.coordinatorDecisions.filter(d => d.action === 'accept').length,
        changedCodes: task.changesFromEngine,
        manualAdditions: task.manualAdditions,
        rejections: task.rejections,
        durationMinutes: task.durationMinutes,
      },
    };
  }

  /**
   * Export review for storage/compliance
   */
  exportReviewForAudit(taskId: string): string {
    const task = this.activeReviews.get(taskId);
    if (!task) return '';

    const auditData = {
      taskId: task.taskId,
      caseId: task.caseId,
      status: task.status,
      coordinator: task.assignedTo,
      timeline: {
        created: task.createdAt,
        started: task.startedAt,
        completed: task.completedAt,
        durationMinutes: task.durationMinutes,
      },
      engineSuggestions: {
        primary: task.engineSuggestions.primaryDiagnosis?.code,
        secondary: task.engineSuggestions.secondaryDiagnoses.map(s => s.code),
        comorbidities: task.engineSuggestions.comorbidities.map(s => s.code),
      },
      coordinatorApproval: {
        primary: task.approvedCodes.primary,
        secondary: task.approvedCodes.secondary,
        comorbidities: task.approvedCodes.comorbidities,
        complications: task.approvedCodes.complications,
      },
      allDecisions: task.coordinatorDecisions,
      statistics: {
        totalDecisions: task.coordinatorDecisions.length,
        changes: task.changesFromEngine,
        additions: task.manualAdditions,
        rejections: task.rejections,
      },
    };

    return JSON.stringify(auditData, null, 2);
  }
}
