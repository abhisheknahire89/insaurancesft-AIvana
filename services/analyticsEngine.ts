/**
 * Analytics Engine — Compute Real KPIs from Case Data (Step 9)
 *
 * Replaces hardcoded metrics ("Avg Readiness: 88%") with real calculations.
 * All metrics are derived from actual Case data, never fabricated.
 */

import { Case, CaseStatus } from './caseModel';

// ============================================
// TYPES
// ============================================

export interface CaseMetrics {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  medianCompletenessScore: number;
  averageCompletenessScore: number;
  casesReadyForSubmission: number;
  submittedCasesAwaitingResponse: number;
  deniedCases: number;
  denialRate: number; // percentage
  casesWithQueries: number;
  queryRate: number; // percentage
  averageDaysInState: Record<CaseStatus, number>;
  slaBreachCount: number; // cases > 7 days in state
  slaBreach% : number;
  averageTimeToSettlement: number; // days
  casesByStatus: Record<CaseStatus, number>;
  casesByCompleteness: {
    veryLow: number; // 0-25%
    low: number; // 25-50%
    medium: number; // 50-75%
    high: number; // 75-100%
  };
}

export interface ApprovalGateMetrics {
  gatesEnabled: number;
  gatesDisabled: number;
  approvalsPending: number;
  averageApprovalTime: number; // days (if gates enabled)
}

export interface TeamMetrics {
  coordinatorCaseCount: number;
  billingExecutiveCaseCount: number;
  averageCoordinatorWorkload: number; // cases per coordinator
}

// ============================================
// CALCULATIONS
// ============================================

export function computeCaseMetrics(cases: Case[]): CaseMetrics {
  if (cases.length === 0) {
    return getEmptyCaseMetrics();
  }

  const now = new Date();

  // Basic counts
  const totalCases = cases.length;
  const activeCases = cases.filter(c => c.status !== 'completed' && c.status !== 'cancelled').length;
  const completedCases = cases.filter(c => c.status === 'completed').length;

  // Completeness
  const scores = cases.map(c => c.completeness.overallScore);
  const sortedScores = [...scores].sort((a, b) => a - b);
  const medianCompletenessScore = sortedScores[Math.floor(sortedScores.length / 2)];
  const averageCompletenessScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Readiness for submission
  const casesReadyForSubmission = cases.filter(
    c => c.status === 'ready_for_prior_auth'
  ).length;

  // Submitted & awaiting
  const submittedCasesAwaitingResponse = cases.filter(
    c => c.status === 'submitted_to_tpa'
  ).length;

  // Denials
  const deniedCases = cases.filter(c => c.status === 'denied').length;
  const denialRate = totalCases > 0 ? Math.round((deniedCases / totalCases) * 100) : 0;

  // Queries
  const casesWithQueries = cases.filter(c => c.status === 'query_raised').length;
  const queryRate = totalCases > 0 ? Math.round((casesWithQueries / totalCases) * 100) : 0;

  // Days in state per status
  const averageDaysInState: Record<CaseStatus, number> = {} as Record<CaseStatus, number>;
  const statusGroups = new Map<CaseStatus, number[]>();

  cases.forEach(c => {
    const days = Math.floor(
      (now.getTime() - new Date(c.statusChangedAt || c.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (!statusGroups.has(c.status)) {
      statusGroups.set(c.status, []);
    }
    statusGroups.get(c.status)!.push(days);
  });

  statusGroups.forEach((days, status) => {
    averageDaysInState[status] = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  });

  // SLA breaches (> 7 days in state)
  const slaBreachCount = cases.filter(c => {
    const days = Math.floor(
      (now.getTime() - new Date(c.statusChangedAt || c.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days > 7 && c.status !== 'completed' && c.status !== 'cancelled';
  }).length;
  const slaBreach% = activeCases > 0 ? Math.round((slaBreachCount / activeCases) * 100) : 0;

  // Average time to settlement
  const settledCases = cases.filter(c => c.status === 'completed' && c.dischargeDate);
  const averageTimeToSettlement = settledCases.length > 0
    ? Math.round(
        settledCases.reduce((sum, c) => {
          const days = Math.floor(
            (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }, 0) / settledCases.length
      )
    : 0;

  // Cases by status
  const casesByStatus: Record<CaseStatus, number> = {} as Record<CaseStatus, number>;
  statusGroups.forEach((_, status) => {
    casesByStatus[status] = cases.filter(c => c.status === status).length;
  });

  // Cases by completeness buckets
  const casesByCompleteness = {
    veryLow: cases.filter(c => c.completeness.overallScore < 25).length,
    low: cases.filter(c => c.completeness.overallScore >= 25 && c.completeness.overallScore < 50).length,
    medium: cases.filter(c => c.completeness.overallScore >= 50 && c.completeness.overallScore < 75).length,
    high: cases.filter(c => c.completeness.overallScore >= 75).length,
  };

  return {
    totalCases,
    activeCases,
    completedCases,
    medianCompletenessScore,
    averageCompletenessScore,
    casesReadyForSubmission,
    submittedCasesAwaitingResponse,
    deniedCases,
    denialRate,
    casesWithQueries,
    queryRate,
    averageDaysInState,
    slaBreachCount,
    slaBreach%,
    averageTimeToSettlement,
    casesByStatus,
    casesByCompleteness,
  };
}

export function getEmptyCaseMetrics(): CaseMetrics {
  return {
    totalCases: 0,
    activeCases: 0,
    completedCases: 0,
    medianCompletenessScore: 0,
    averageCompletenessScore: 0,
    casesReadyForSubmission: 0,
    submittedCasesAwaitingResponse: 0,
    deniedCases: 0,
    denialRate: 0,
    casesWithQueries: 0,
    queryRate: 0,
    averageDaysInState: {},
    slaBreachCount: 0,
    slaBreach%: 0,
    averageTimeToSettlement: 0,
    casesByStatus: {},
    casesByCompleteness: { veryLow: 0, low: 0, medium: 0, high: 0 },
  };
}

// ============================================
// TEAM-LEVEL METRICS
// ============================================

export function computeTeamMetrics(cases: Case[]): TeamMetrics {
  const coordinatorCases = cases.filter(c => c.ownerRole === 'insurance_coordinator');
  const billingExecutiveCases = cases.filter(c => c.ownerRole === 'billing_executive');

  // Count unique owners per role
  const uniqueCoordinators = new Set(coordinatorCases.map(c => c.ownerId)).size || 1;
  const uniqueBillingExecutives = new Set(billingExecutiveCases.map(c => c.ownerId)).size || 1;

  return {
    coordinatorCaseCount: coordinatorCases.length,
    billingExecutiveCaseCount: billingExecutiveCases.length,
    averageCoordinatorWorkload: Math.round(coordinatorCases.length / uniqueCoordinators),
  };
}

// ============================================
// APPROVAL GATE METRICS
// ============================================

export function computeApprovalGateMetrics(cases: Case[]): ApprovalGateMetrics {
  const casesWithPendingApprovals = cases.filter(c => c.pendingApprovals.length > 0);
  const approvalsPending = casesWithPendingApprovals.reduce(
    (sum, c) => sum + c.pendingApprovals.length,
    0
  );

  // Average approval time (for completed approvals in activities)
  let totalApprovalTime = 0;
  let completedApprovalsCount = 0;

  cases.forEach(c => {
    c.activities.forEach((act, idx) => {
      if (act.event === 'approval_granted' && idx > 0) {
        const prevApprovalReq = c.activities.slice(0, idx).reverse().find(a => a.event === 'approval_gate_triggered');
        if (prevApprovalReq) {
          const timeMs = new Date(act.timestamp).getTime() - new Date(prevApprovalReq.timestamp).getTime();
          const timeDays = timeMs / (1000 * 60 * 60 * 24);
          totalApprovalTime += timeDays;
          completedApprovalsCount++;
        }
      }
    });
  });

  const averageApprovalTime = completedApprovalsCount > 0
    ? Math.round(totalApprovalTime / completedApprovalsCount)
    : 0;

  return {
    gatesEnabled: 0, // TODO: compute from ApprovalRuleConfig
    gatesDisabled: 0, // TODO: compute from ApprovalRuleConfig
    approvalsPending,
    averageApprovalTime,
  };
}

// ============================================
// DASHBOARD SUMMARY
// ============================================

export interface DashboardSummary {
  timestamp: string;
  caseMetrics: CaseMetrics;
  teamMetrics: TeamMetrics;
  approvalGateMetrics: ApprovalGateMetrics;
  healthScore: number; // 0-100, composite of all metrics
}

export function computeDashboardSummary(cases: Case[]): DashboardSummary {
  const caseMetrics = computeCaseMetrics(cases);
  const teamMetrics = computeTeamMetrics(cases);
  const approvalGateMetrics = computeApprovalGateMetrics(cases);

  // Health score: composite of readiness, denial rate, SLA breaches
  let healthScore = 100;
  healthScore -= caseMetrics.denialRate * 0.3; // Denials reduce health by 30%
  healthScore -= caseMetrics.slaBreach% * 0.4; // SLA breaches reduce by 40%
  healthScore -= (100 - caseMetrics.medianCompletenessScore) * 0.3; // Low completeness reduces by 30%
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  return {
    timestamp: new Date().toISOString(),
    caseMetrics,
    teamMetrics,
    approvalGateMetrics,
    healthScore,
  };
}
