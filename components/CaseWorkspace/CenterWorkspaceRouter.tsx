/**
 * CenterWorkspaceRouter — Task-Adaptive Workspace Content
 *
 * Routes case to appropriate task-specific view based on status.
 * Each view handles a different workflow:
 * - ready_for_prior_auth: Prior Auth packet generation + submission
 * - query_raised: TPA query response
 * - denied: Denial analysis + appeal generation (uses denialAppealGenerator)
 * - enhancement_requested: Enhancement request review + submission
 * - discharge_billing: Billing reconciliation (uses billingCoder)
 * - Other: Activity timeline + details
 */

import React from 'react';
import { Case } from '../../services/caseModel';
import { CaseOverviewDashboard } from '../CaseOverview/CaseOverviewDashboard';
import { QueryRaisedView } from './TaskViews/QueryRaisedView';
import { DenialView } from './TaskViews/DenialView';
// TODO: Import other task views as they're created
// import { PriorAuthReadyView } from './TaskViews/PriorAuthReadyView';
// import { EnhancementView } from './TaskViews/EnhancementView';
// import { DischargeBillingView } from './TaskViews/DischargeBillingView';

interface CenterWorkspaceRouterProps {
  caseRecord: Case;
  onUpdate: (updated: Case) => void;
}

/**
 * Returns appropriate task-specific view based on case status
 */
export const CenterWorkspaceRouter: React.FC<CenterWorkspaceRouterProps> = ({
  caseRecord,
  onUpdate
}) => {
  switch (caseRecord.status) {
    // ──────────────────────────────────────────────────────────────────────────
    // CASE OVERVIEW (NEW REGISTRATIONS & ENRICHMENT)
    // ──────────────────────────────────────────────────────────────────────────
    case 'patient_registered':
    case 'insurance_verified':
      return (
        <CaseOverviewDashboard
          caseRecord={caseRecord}
          onUpdate={onUpdate}
        />
      );

    // ──────────────────────────────────────────────────────────────────────────
    // TPA QUERY RESPONSE
    // ──────────────────────────────────────────────────────────────────────────
    case 'query_raised':
      return (
        <QueryRaisedView
          caseRecord={caseRecord}
          onUpdate={onUpdate}
        />
      );

    // ──────────────────────────────────────────────────────────────────────────
    // DENIAL & APPEAL
    // ──────────────────────────────────────────────────────────────────────────
    case 'denied':
    case 'appeal_drafted':
      return (
        <DenialView
          caseRecord={caseRecord}
          onUpdate={onUpdate}
        />
      );

    // ──────────────────────────────────────────────────────────────────────────
    // PRIOR AUTH READY (TODO: wire PriorAuthReadyView)
    // ENHANCEMENT REQUEST (TODO: wire EnhancementView)
    // DISCHARGE & BILLING (TODO: wire DischargeBillingView)
    // ──────────────────────────────────────────────────────────────────────────
    default:
      return (
        <DefaultCaseView
          caseRecord={caseRecord}
        />
      );
  }
};

/**
 * Default view showing Activity timeline + case details
 * Shown when no task-specific view applies
 */
const DefaultCaseView: React.FC<{ caseRecord: Case }> = ({ caseRecord }) => {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Current Status */}
      <div className="bg-white border border-opd-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-opd-primary mb-4">Case Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-opd-text-muted mb-1">Current Status</div>
            <div className="font-bold text-opd-text-primary capitalize">{caseRecord.status.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div className="text-opd-text-muted mb-1">Case ID</div>
            <div className="font-mono text-opd-text-primary">{caseRecord.id}</div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white border border-opd-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-opd-primary mb-4">Activity Timeline</h2>
        <div className="space-y-4">
          {caseRecord.activities.length === 0 ? (
            <p className="text-sm text-opd-text-muted">No activities yet</p>
          ) : (
            caseRecord.activities.slice(-10).reverse().map((activity, i) => (
              <div key={i} className="flex gap-4 text-sm">
                <div className="text-opd-text-muted min-w-fit">{new Date(activity.timestamp).toLocaleDateString()}</div>
                <div>
                  <div className="font-semibold text-opd-text-primary capitalize">{activity.event.replace(/_/g, ' ')}</div>
                  <div className="text-opd-text-muted">{activity.description}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Missing Items (if any) */}
      {caseRecord.completeness.missingItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-3">Missing Information</h2>
          <ul className="space-y-1">
            {caseRecord.completeness.missingItems.map((item, i) => (
              <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CenterWorkspaceRouter;
