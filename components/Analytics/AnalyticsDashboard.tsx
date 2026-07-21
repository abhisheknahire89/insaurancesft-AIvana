/**
 * AnalyticsDashboard — Real KPIs computed from Case data
 *
 * Replaces hardcoded "Avg Readiness: 88%" with actual metrics
 * derived from Case database. Never fabricates values.
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, AlertCircle, CheckCircle2, Clock,
  Users, Target, BarChart3, Zap, Activity
} from 'lucide-react';
import { Case } from '../../services/caseModel';
import { getAllCases } from '../../services/masterPatientRecord';
import {
  computeCaseMetrics,
  computeTeamMetrics,
  computeApprovalGateMetrics,
  computeDashboardSummary,
  CaseMetrics,
} from '../../services/analyticsEngine';

interface AnalyticsDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds default
}) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [metrics, setMetrics] = useState<CaseMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const allCases = await getAllCases();
      setCases(allCases);
      const m = computeCaseMetrics(allCases);
      setMetrics(m);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();

    if (autoRefresh) {
      const interval = setInterval(loadMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-opd-primary/20 border-t-opd-primary rounded-full animate-spin mx-auto mb-3" />
          <div className="text-opd-text-muted">Loading analytics…</div>
        </div>
      </div>
    );
  }

  const dashboard = computeDashboardSummary(cases);
  const team = computeTeamMetrics(cases);
  const gates = computeApprovalGateMetrics(cases);

  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 bg-opd-bg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-opd-primary">Insurance Operations Dashboard</h1>
        <div className="text-xs text-opd-text-muted font-mono">
          Updated: {new Date(lastUpdated).toLocaleTimeString()}
          {autoRefresh && ' (auto-refresh enabled)'}
        </div>
      </div>

      {/* Health Score Card */}
      <div className={`rounded-xl border-2 p-8 text-center ${getHealthColor(dashboard.healthScore)}`}>
        <div className="text-6xl font-bold mb-2">{dashboard.healthScore}%</div>
        <div className="text-sm font-bold uppercase tracking-wider">Platform Health Score</div>
        <div className="text-xs opacity-75 mt-2">
          Composite: Readiness (30%) + SLA Compliance (40%) + Completeness (30%)
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cases */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-opd-primary" />
            <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Total Cases</span>
          </div>
          <div className="text-3xl font-bold text-opd-primary">{metrics.totalCases}</div>
          <div className="text-xs text-opd-text-muted mt-1">
            {metrics.activeCases} active · {metrics.completedCases} completed
          </div>
        </div>

        {/* Median Completeness */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Median Completeness</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{metrics.medianCompletenessScore}%</div>
          <div className="text-xs text-opd-text-muted mt-1">Avg: {metrics.averageCompletenessScore}%</div>
        </div>

        {/* Ready for Submission */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Ready for Submission</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{metrics.casesReadyForSubmission}</div>
          <div className="text-xs text-opd-text-muted mt-1">Cases at prior-auth gate</div>
        </div>

        {/* Denial Rate */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Denial Rate</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{metrics.denialRate}%</div>
          <div className="text-xs text-opd-text-muted mt-1">{metrics.deniedCases} cases denied</div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Query Rate */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Query Rate</span>
          <div className="text-2xl font-bold text-blue-600 mt-2">{metrics.queryRate}%</div>
          <div className="text-xs text-opd-text-muted mt-1">{metrics.casesWithQueries} cases with queries</div>
        </div>

        {/* SLA Breaches */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">SLA Breaches (&gt;7 days)</span>
          <div className="text-2xl font-bold text-red-600 mt-2">{metrics.slaBreachPercent}%</div>
          <div className="text-xs text-opd-text-muted mt-1">{metrics.slaBreachCount} cases over SLA</div>
        </div>

        {/* Avg Time to Settlement */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Avg Time to Settlement</span>
          <div className="text-2xl font-bold text-purple-600 mt-2">{metrics.averageTimeToSettlement}d</div>
          <div className="text-xs text-opd-text-muted mt-1">Days to completion</div>
        </div>

        {/* Awaiting TPA Response */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Awaiting TPA</span>
          <div className="text-2xl font-bold text-blue-600 mt-2">{metrics.submittedCasesAwaitingResponse}</div>
          <div className="text-xs text-opd-text-muted mt-1">Cases in TPA review</div>
        </div>

        {/* Team Coordinator Workload */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Avg Coordinator Workload</span>
          <div className="text-2xl font-bold text-indigo-600 mt-2">{team.averageCoordinatorWorkload}</div>
          <div className="text-xs text-opd-text-muted mt-1">Cases per coordinator</div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white border border-opd-border rounded-lg p-4">
          <span className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Pending Approvals</span>
          <div className="text-2xl font-bold text-amber-600 mt-2">{gates.approvalsPending}</div>
          <div className="text-xs text-opd-text-muted mt-1">Awaiting reviewer action</div>
        </div>
      </div>

      {/* Completeness Distribution */}
      <div className="bg-white border border-opd-border rounded-lg p-6">
        <h2 className="text-lg font-bold text-opd-primary mb-4">Case Completeness Distribution</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Very Low (0-25%)', count: metrics.casesByCompleteness.veryLow, color: 'bg-red-100 text-red-700' },
            { label: 'Low (25-50%)', count: metrics.casesByCompleteness.low, color: 'bg-amber-100 text-amber-700' },
            { label: 'Medium (50-75%)', count: metrics.casesByCompleteness.medium, color: 'bg-blue-100 text-blue-700' },
            { label: 'High (75-100%)', count: metrics.casesByCompleteness.high, color: 'bg-emerald-100 text-emerald-700' },
          ].map((bucket, idx) => (
            <div key={idx} className={`${bucket.color} rounded-lg p-4 text-center`}>
              <div className="text-2xl font-bold">{bucket.count}</div>
              <div className="text-xs font-semibold mt-1">{bucket.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Important Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>All metrics are computed in real-time from Case data.</strong> No hardcoded values, no fake data.
        Metrics update automatically every {(refreshInterval / 1000).toFixed(0)} seconds.
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
