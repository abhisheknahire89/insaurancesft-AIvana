/**
 * Coding Audit Trail
 *
 * Complete traceability system for ICD coding decisions.
 * Every decision, change, and override is logged for IRDAI compliance.
 *
 * Tracks:
 * • Engine suggestions and reasoning
 * • Coordinator review timeline
 * • All manual changes with justification
 * • Approval chain
 * • Evidence trail for each code
 * • Quality metrics
 * • Compliance status
 */

export interface CodingAuditEntry {
  entryId: string;
  caseId: string;
  timestamp: string;
  actor: {
    userId: string;
    name: string;
    role: 'system' | 'insurance_coordinator' | 'billing_executive' | 'medical_supervisor' | 'auditor';
  };

  // Event type
  eventType:
    | 'engine_suggestion'
    | 'coordinator_review_started'
    | 'code_accepted'
    | 'code_replaced'
    | 'code_added'
    | 'code_rejected'
    | 'review_completed'
    | 'audit_check'
    | 'compliance_verification';

  // Details
  code?: string;
  previousCode?: string;
  newCode?: string;
  codeType?: 'primary' | 'secondary' | 'comorbidity' | 'complication';
  reason?: string;
  evidence?: string;
  guideline?: string;
  confidence?: number;

  // Impact
  impactOnCase: 'none' | 'minor' | 'major';
  requiresApproval: boolean;

  // Status
  status: 'recorded' | 'approved' | 'flagged' | 'escalated';
  notes?: string;
}

export interface CaseCodeAuditTrail {
  caseId: string;
  createdAt: string;
  entries: CodingAuditEntry[];

  // Summary statistics
  statistics: {
    totalEntries: number;
    suggestionsFromEngine: number;
    coordinatorReviews: number;
    codesAccepted: number;
    codesChanged: number;
    codesAdded: number;
    codesRejected: number;
    manualOverrides: number;
    escalations: number;
  };

  // Compliance
  complianceStatus: 'compliant' | 'flagged' | 'non_compliant';
  complianceIssues: string[];
  auditedBy?: string;
  auditedAt?: string;
  auditNotes?: string;
}

/**
 * Coding Audit Trail Manager
 */
export class CodingAuditTrail {
  private caseTrails: Map<string, CaseCodeAuditTrail>;
  private globalLog: CodingAuditEntry[];

  constructor() {
    this.caseTrails = new Map();
    this.globalLog = [];
  }

  /**
   * Initialize audit trail for a case
   */
  initializeTrail(caseId: string): CaseCodeAuditTrail {
    const trail: CaseCodeAuditTrail = {
      caseId,
      createdAt: new Date().toISOString(),
      entries: [],
      statistics: {
        totalEntries: 0,
        suggestionsFromEngine: 0,
        coordinatorReviews: 0,
        codesAccepted: 0,
        codesChanged: 0,
        codesAdded: 0,
        codesRejected: 0,
        manualOverrides: 0,
        escalations: 0,
      },
      complianceStatus: 'compliant',
      complianceIssues: [],
    };

    this.caseTrails.set(caseId, trail);
    return trail;
  }

  /**
   * Record engine suggestion
   */
  recordEngineSuggestion(
    caseId: string,
    code: string,
    codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication',
    confidence: number,
    reasoning: string,
    evidence: string[]
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: 'SYSTEM',
        name: 'Clinical Coding Engine',
        role: 'system',
      },
      eventType: 'engine_suggestion',
      code,
      codeType,
      reason: reasoning,
      evidence: evidence.join('; '),
      confidence,
      impactOnCase: this.calculateImpact(code, codeType),
      requiresApproval: confidence < 0.95,
      status: 'recorded',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.statistics.suggestionsFromEngine++;

    console.log(
      `[Audit Trail] Engine suggestion recorded: ${code} (${(confidence * 100).toFixed(0)}%)`
    );

    return entry;
  }

  /**
   * Record coordinator review start
   */
  recordReviewStart(
    caseId: string,
    coordinatorId: string,
    coordinatorName: string,
    coordinatorRole: string
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: coordinatorId,
        name: coordinatorName,
        role: coordinatorRole as any,
      },
      eventType: 'coordinator_review_started',
      impactOnCase: 'none',
      requiresApproval: false,
      status: 'recorded',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.statistics.coordinatorReviews++;

    return entry;
  }

  /**
   * Record code acceptance
   */
  recordCodeAccepted(
    caseId: string,
    code: string,
    codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication',
    coordinatorId: string,
    coordinatorName: string,
    coordinatorRole: string,
    reason?: string
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: coordinatorId,
        name: coordinatorName,
        role: coordinatorRole as any,
      },
      eventType: 'code_accepted',
      code,
      codeType,
      reason: reason || 'Engine suggestion approved',
      impactOnCase: 'none',
      requiresApproval: false,
      status: 'approved',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.statistics.codesAccepted++;

    console.log(`[Audit Trail] Code accepted by ${coordinatorName}: ${code}`);

    return entry;
  }

  /**
   * Record code replacement (override)
   */
  recordCodeReplaced(
    caseId: string,
    previousCode: string,
    newCode: string,
    codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication',
    coordinatorId: string,
    coordinatorName: string,
    coordinatorRole: string,
    reason: string,
    evidence?: string,
    guideline?: string
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: coordinatorId,
        name: coordinatorName,
        role: coordinatorRole as any,
      },
      eventType: 'code_replaced',
      previousCode,
      newCode,
      codeType,
      reason,
      evidence,
      guideline,
      impactOnCase: 'major',
      requiresApproval: true,
      status: 'approved',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.statistics.codesChanged++;
    trail.statistics.manualOverrides++;

    console.log(
      `[Audit Trail] Code replaced by ${coordinatorName}: ${previousCode} → ${newCode}`
    );
    console.log(`[Audit Trail] Reason: ${reason}`);

    return entry;
  }

  /**
   * Record manual code addition
   */
  recordCodeAdded(
    caseId: string,
    code: string,
    codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication',
    coordinatorId: string,
    coordinatorName: string,
    coordinatorRole: string,
    reason: string,
    evidence: string,
    guideline?: string,
    confidence?: number
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: coordinatorId,
        name: coordinatorName,
        role: coordinatorRole as any,
      },
      eventType: 'code_added',
      code,
      codeType,
      reason,
      evidence,
      guideline,
      confidence: confidence || 0.8,
      impactOnCase: 'major',
      requiresApproval: true,
      status: 'approved',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.statistics.codesAdded++;
    trail.statistics.manualOverrides++;

    console.log(`[Audit Trail] Code manually added by ${coordinatorName}: ${code}`);
    console.log(`[Audit Trail] Evidence: ${evidence}`);

    return entry;
  }

  /**
   * Record code rejection
   */
  recordCodeRejected(
    caseId: string,
    code: string,
    coordinatorId: string,
    coordinatorName: string,
    coordinatorRole: string,
    reason: string
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: coordinatorId,
        name: coordinatorName,
        role: coordinatorRole as any,
      },
      eventType: 'code_rejected',
      code,
      reason,
      impactOnCase: 'minor',
      requiresApproval: false,
      status: 'approved',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.statistics.codesRejected++;

    console.log(`[Audit Trail] Code rejected by ${coordinatorName}: ${code}`);
    console.log(`[Audit Trail] Reason: ${reason}`);

    return entry;
  }

  /**
   * Record review completion
   */
  recordReviewCompleted(
    caseId: string,
    coordinatorId: string,
    coordinatorName: string,
    finalCodes: {
      primary?: string;
      secondary: string[];
      comorbidities: string[];
      complications: string[];
    }
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: coordinatorId,
        name: coordinatorName,
        role: 'insurance_coordinator',
      },
      eventType: 'review_completed',
      reason: `Review completed. Final codes: Primary=${finalCodes.primary}, Secondary=${finalCodes.secondary.join(',')}`,
      impactOnCase: 'major',
      requiresApproval: false,
      status: 'approved',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;

    console.log(`[Audit Trail] Review completed by ${coordinatorName}`);
    console.log('[Audit Trail] Final codes:', finalCodes);

    return entry;
  }

  /**
   * Record escalation
   */
  recordEscalation(
    caseId: string,
    escalatedBy: string,
    escalatedByName: string,
    reason: string,
    escalateTo: string
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: escalatedBy,
        name: escalatedByName,
        role: 'insurance_coordinator',
      },
      eventType: 'audit_check',
      reason: `Escalated to ${escalateTo}: ${reason}`,
      impactOnCase: 'major',
      requiresApproval: true,
      status: 'escalated',
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.statistics.escalations++;

    console.log(`[Audit Trail] Case escalated: ${reason}`);

    return entry;
  }

  /**
   * Perform compliance audit
   */
  performComplianceAudit(
    caseId: string,
    auditorId: string,
    auditorName: string
  ): CodingAuditEntry | null {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return null;

    // Check for compliance issues
    const issues = this.validateCompliance(trail);

    const entry: CodingAuditEntry = {
      entryId: `ENTRY-${caseId}-${Date.now()}`,
      caseId,
      timestamp: new Date().toISOString(),
      actor: {
        userId: auditorId,
        name: auditorName,
        role: 'auditor',
      },
      eventType: 'compliance_verification',
      reason: `Compliance audit performed. Issues: ${issues.length}`,
      impactOnCase: 'none',
      requiresApproval: false,
      status: issues.length > 0 ? 'flagged' : 'approved',
      notes: issues.join('; '),
    };

    trail.entries.push(entry);
    this.globalLog.push(entry);
    trail.statistics.totalEntries++;
    trail.complianceStatus = issues.length === 0 ? 'compliant' : 'flagged';
    trail.complianceIssues = issues;
    trail.auditedBy = auditorName;
    trail.auditedAt = entry.timestamp;

    console.log(`[Audit Trail] Compliance audit by ${auditorName}`);
    if (issues.length > 0) {
      console.log('[Audit Trail] Issues found:', issues);
    }

    return entry;
  }

  /**
   * Validate compliance
   */
  private validateCompliance(trail: CaseCodeAuditTrail): string[] {
    const issues: string[] = [];

    // Check 1: Primary code must be present
    const primaryEntry = trail.entries.find(
      e => e.eventType === 'code_accepted' || e.eventType === 'code_replaced'
    );
    if (!primaryEntry) {
      issues.push('No primary diagnosis code recorded');
    }

    // Check 2: All manual overrides must have justification
    const manualOverrides = trail.entries.filter(e =>
      ['code_replaced', 'code_added'].includes(e.eventType)
    );
    for (const override of manualOverrides) {
      if (!override.reason || override.reason.length < 10) {
        issues.push(`Insufficient justification for ${override.code}: ${override.eventType}`);
      }
    }

    // Check 3: All entries must be timestamped
    const noTimestamp = trail.entries.filter(e => !e.timestamp);
    if (noTimestamp.length > 0) {
      issues.push(`${noTimestamp.length} entries missing timestamp`);
    }

    // Check 4: Audit trail must be complete
    if (trail.entries.length < 2) {
      issues.push('Insufficient audit trail entries (minimum 2 required)');
    }

    return issues;
  }

  /**
   * Calculate impact of a code
   */
  private calculateImpact(
    code: string,
    codeType: 'primary' | 'secondary' | 'comorbidity' | 'complication'
  ): 'none' | 'minor' | 'major' {
    if (codeType === 'primary') return 'major';
    if (codeType === 'complication') return 'major';
    if (codeType === 'comorbidity') return 'minor';
    return 'minor';
  }

  /**
   * Get audit trail for case
   */
  getAuditTrail(caseId: string): CaseCodeAuditTrail | null {
    return this.caseTrails.get(caseId) || null;
  }

  /**
   * Export audit trail for IRDAI compliance
   */
  exportForCompliance(caseId: string): string {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return '';

    const complianceReport = {
      caseId: trail.caseId,
      auditTrailCreatedAt: trail.createdAt,
      complianceStatus: trail.complianceStatus,
      complianceAuditedAt: trail.auditedAt,
      complianceAuditedBy: trail.auditedBy,
      complianceIssues: trail.complianceIssues,
      statistics: trail.statistics,
      entries: trail.entries.map(e => ({
        timestamp: e.timestamp,
        actor: e.actor,
        eventType: e.eventType,
        code: e.code,
        previousCode: e.previousCode,
        newCode: e.newCode,
        reason: e.reason,
        evidence: e.evidence,
        guideline: e.guideline,
        status: e.status,
      })),
    };

    return JSON.stringify(complianceReport, null, 2);
  }

  /**
   * Generate compliance summary
   */
  generateComplianceSummary(caseId: string): string {
    const trail = this.caseTrails.get(caseId);
    if (!trail) return '';

    const lines: string[] = [];

    lines.push('=== ICD CODING COMPLIANCE REPORT ===\n');
    lines.push(`Case ID: ${trail.caseId}`);
    lines.push(`Audit Trail Created: ${trail.createdAt}`);
    lines.push(`Status: ${trail.complianceStatus.toUpperCase()}\n`);

    lines.push('STATISTICS:');
    lines.push(`  Total Entries: ${trail.statistics.totalEntries}`);
    lines.push(`  Engine Suggestions: ${trail.statistics.suggestionsFromEngine}`);
    lines.push(`  Coordinator Reviews: ${trail.statistics.coordinatorReviews}`);
    lines.push(`  Codes Accepted: ${trail.statistics.codesAccepted}`);
    lines.push(`  Codes Changed: ${trail.statistics.codesChanged}`);
    lines.push(`  Manual Additions: ${trail.statistics.manualAdditions}`);
    lines.push(`  Rejections: ${trail.statistics.codesRejected}\n`);

    if (trail.complianceIssues.length > 0) {
      lines.push('COMPLIANCE ISSUES:');
      trail.complianceIssues.forEach(issue => lines.push(`  ⚠ ${issue}`));
      lines.push('');
    } else {
      lines.push('✓ No compliance issues found\n');
    }

    if (trail.auditedBy) {
      lines.push(`Compliance Audited By: ${trail.auditedBy}`);
      lines.push(`Audit Date: ${trail.auditedAt}`);
    }

    lines.push('\nFull audit trail available for IRDAI compliance review.');

    return lines.join('\n');
  }
}
