/**
 * QueueListView — Case list for a given Queue
 *
 * Displays cases filtered and sorted by the Queue's definition:
 * - Columns: Patient name, Insurer, Status, Days in state, "Why needs you"
 * - Sort: urgency (denied/query > ready > submitted > waiting)
 * - Bulk actions: multi-select for batch operations at 40–80 cases/day
 * - Click row: open that Case in the Workspace
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, Checkbox, Clock, AlertCircle,
  CheckCircle2, Eye, XCircle, TrendingUp, DollarSign
} from 'lucide-react';
import { Case, CaseStatus, QueueDefinition } from '../../services/caseModel';
import type { Role } from '../../services/caseModel';

interface QueueListViewProps {
  queue: QueueDefinition;
  cases: Case[];
  onCaseClick: (caseRecord: Case) => void;
  isLoading?: boolean;
}

// Urgency scoring (higher = more urgent)
const URGENCY_SCORE: Record<CaseStatus, number> = {
  query_raised: 100,
  denied: 95,
  enhancement_requested: 90,
  submitted_to_tpa: 80,
  ready_for_prior_auth: 75,
  documents_uploaded: 60,
  clinical_info_available: 50,
  insurance_verified: 40,
  patient_registered: 30,
  appeal_drafted: 85,
  discharge_billing: 70,
  settlement: 65,
  completed: 0,
  cancelled: 0,
};

function getUrgencyScore(caseRecord: Case): number {
  return URGENCY_SCORE[caseRecord.status] || 0;
}

function daysInState(caseRecord: Case): number {
  const now = new Date();
  const then = new Date(caseRecord.statusChangedAt || caseRecord.updatedAt);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function sortRecords(records: Case[], sortBy: 'urgency' | 'created' | 'updated' | 'sla_risk', order: 'asc' | 'desc'): Case[] {
  const sorted = [...records].sort((a, b) => {
    let aVal: number, bVal: number;

    switch (sortBy) {
      case 'urgency':
        aVal = getUrgencyScore(a);
        bVal = getUrgencyScore(b);
        break;
      case 'created':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
      case 'updated':
        aVal = new Date(a.updatedAt).getTime();
        bVal = new Date(b.updatedAt).getTime();
        break;
      case 'sla_risk':
        aVal = daysInState(a);
        bVal = daysInState(b);
        break;
      default:
        return 0;
    }

    if (order === 'desc') {
      return bVal - aVal;
    } else {
      return aVal - bVal;
    }
  });

  return sorted;
}

function filterRecords(records: Case[], queue: QueueDefinition): Case[] {
  return records.filter(c => {
    // Status filter
    if (queue.statusFilter && queue.statusFilter.length > 0) {
      if (!queue.statusFilter.includes(c.status)) return false;
    }

    // Owner filter
    if (queue.ownerRoleFilter && c.ownerRole !== queue.ownerRoleFilter) {
      return false;
    }

    // Pending approval filter
    if (queue.requiresPendingApproval && c.pendingApprovals.length === 0) {
      return false;
    }

    return true;
  });
}

function getWhyThisNeedsYou(caseRecord: Case): string {
  switch (caseRecord.status) {
    case 'query_raised':
      return 'TPA query needs response';
    case 'denied':
      return 'Denial requires review';
    case 'enhancement_requested':
      return 'Enhancement pending review';
    case 'ready_for_prior_auth':
      return 'Ready to submit to TPA';
    case 'documents_uploaded':
      return 'Awaiting completeness check';
    case 'clinical_info_available':
      return 'Documents needed';
    case 'insurance_verified':
      return 'Clinical info needed';
    case 'patient_registered':
      return 'New admission, needs review';
    case 'submitted_to_tpa':
      return `Submitted ${daysInState(caseRecord)} days ago`;
    case 'discharge_billing':
      return 'Billing reconciliation needed';
    case 'settlement':
      return 'Settlement pending';
    default:
      return 'Action needed';
  }
}

function getStatusIcon(status: CaseStatus): React.ReactNode {
  switch (status) {
    case 'query_raised':
      return <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
    case 'denied':
      return <XCircle className="w-3.5 h-3.5 text-red-600" />;
    case 'enhancement_requested':
      return <TrendingUp className="w-3.5 h-3.5 text-amber-600" />;
    case 'ready_for_prior_auth':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case 'submitted_to_tpa':
      return <Clock className="w-3.5 h-3.5 text-blue-600" />;
    case 'discharge_billing':
      return <DollarSign className="w-3.5 h-3.5 text-purple-600" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />;
    default:
      return <Eye className="w-3.5 h-3.5 text-gray-500" />;
  }
}

function getStatusColor(status: CaseStatus): string {
  switch (status) {
    case 'query_raised':
    case 'denied':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'enhancement_requested':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ready_for_prior_auth':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'submitted_to_tpa':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'discharge_billing':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'completed':
      return 'bg-gray-50 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export const QueueListView: React.FC<QueueListViewProps> = ({
  queue,
  cases,
  onCaseClick,
  isLoading = false
}) => {
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());

  // Filter and sort cases
  const filtered = useMemo(() => filterRecords(cases, queue), [cases, queue]);
  const sorted = useMemo(
    () => sortRecords(filtered, queue.sortBy, queue.sortOrder),
    [filtered, queue.sortBy, queue.sortOrder]
  );

  const toggleCase = (caseId: string) => {
    const newSet = new Set(selectedCases);
    if (newSet.has(caseId)) {
      newSet.delete(caseId);
    } else {
      newSet.add(caseId);
    }
    setSelectedCases(newSet);
  };

  const toggleAll = () => {
    if (selectedCases.size === sorted.length) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(sorted.map(c => c.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-opd-bg">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-opd-primary/20 border-t-opd-primary rounded-full animate-spin mx-auto mb-2" />
          <div className="text-sm font-semibold text-opd-text-muted">Loading cases…</div>
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-opd-bg">
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
          <div className="text-sm font-semibold text-opd-text-muted">No cases in this queue</div>
          <div className="text-xs text-opd-text-muted mt-1">All caught up! 🎉</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-opd-bg overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-opd-border flex items-center justify-between">
        <div className="text-sm font-semibold text-opd-text-primary">
          {sorted.length} case{sorted.length !== 1 ? 's' : ''}
        </div>

        {/* Bulk actions (visible if any selected) */}
        {selectedCases.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-opd-text-muted">
              {selectedCases.size} selected
            </span>
            <button className="text-xs font-bold text-opd-primary hover:underline">
              Reassign
            </button>
            <button className="text-xs font-bold text-opd-primary hover:underline">
              Tag
            </button>
          </div>
        )}
      </div>

      {/* Case List */}
      <div className="flex-1 overflow-y-auto divide-y divide-opd-border">
        {/* Header Row */}
        <div className="sticky top-0 bg-white px-4 py-2 flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider text-opd-text-muted border-b border-opd-border">
          <button
            onClick={toggleAll}
            className="w-4 h-4 flex items-center justify-center text-opd-primary hover:bg-gray-100 rounded"
          >
            {selectedCases.size === sorted.length && sorted.length > 0 ? '✓' : ''}
          </button>
          <div className="flex-1 min-w-0">Patient</div>
          <div className="w-32">Insurer</div>
          <div className="w-24">Status</div>
          <div className="w-16 text-right">Days</div>
          <div className="flex-1 min-w-0 text-right">Needs</div>
        </div>

        {/* Case Rows */}
        {sorted.map(caseRecord => {
          const isSelected = selectedCases.has(caseRecord.id);
          const days = daysInState(caseRecord);

          return (
            <div
              key={caseRecord.id}
              onClick={() => onCaseClick(caseRecord)}
              className={`px-4 py-3 flex items-center gap-3 hover:bg-opd-input-bg transition cursor-pointer ${
                isSelected ? 'bg-opd-input-bg' : ''
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={e => {
                  e.stopPropagation();
                  toggleCase(caseRecord.id);
                }}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 accent-opd-primary rounded"
              />

              {/* Patient Name */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-opd-text-primary truncate">
                  {caseRecord.patient.name}
                </div>
                <div className="text-[9px] text-opd-text-muted font-mono truncate">
                  {caseRecord.id}
                </div>
              </div>

              {/* Insurer */}
              <div className="w-32 text-sm font-semibold text-opd-text-primary truncate">
                {caseRecord.insurance.insurerName}
              </div>

              {/* Status Pill */}
              <div className="w-24">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold border w-fit ${getStatusColor(caseRecord.status)}`}>
                  {getStatusIcon(caseRecord.status)}
                  <span className="truncate">
                    {caseRecord.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Days in State */}
              <div className="w-16 text-right">
                <div className={`text-sm font-bold ${
                  days > 7 ? 'text-red-600' :
                  days > 3 ? 'text-amber-600' :
                  'text-opd-text-secondary'
                }`}>
                  {days}d
                </div>
              </div>

              {/* Why This Needs You */}
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-opd-text-muted text-right">
                  {getWhyThisNeedsYou(caseRecord)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QueueListView;
