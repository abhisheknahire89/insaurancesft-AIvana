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
    // ──────────────────────────────────────────────────────────────────────────
    // case 'ready_for_prior_auth':
    //   return (
    //     <PriorAuthReadyView
    //       caseRecord={caseRecord}
    //       onUpdate={onUpdate}
    //     />
    //   );

    // ──────────────────────────────────────────────────────────────────────────
    // ENHANCEMENT REQUEST (TODO: wire EnhancementView)
    // ──────────────────────────────────────────────────────────────────────────
    // case 'enhancement_requested':
    //   return (
    //     <EnhancementView
    //       caseRecord={caseRecord}
    //       onUpdate={onUpdate}
    //     />
    //   );

    // ──────────────────────────────────────────────────────────────────────────
    // DISCHARGE & BILLING (TODO: wire DischargeBillingView)
    // ──────────────────────────────────────────────────────────────────────────
    // case 'discharge_billing':
    //   return (
    //     <DischargeBillingView
    //       caseRecord={caseRecord}
    //       onUpdate={onUpdate}
    //     />
    //   );

    // ──────────────────────────────────────────────────────────────────────────
    // DEFAULT: Activity Timeline
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
            <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Current Stage</div>
            <div className="font-semibold text-opd-text-primary capitalize mt-1">
              {caseRecord.status.replace(/_/g, ' ')}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Completeness</div>
            <div className="font-semibold text-opd-text-primary mt-1">
              {caseRecord.completeness.overallScore}%
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Created</div>
            <div className="font-semibold text-opd-text-primary mt-1">
              {new Date(caseRecord.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider">Last Updated</div>
            <div className="font-semibold text-opd-text-primary mt-1">
              {new Date(caseRecord.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white border border-opd-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-opd-primary mb-4">Activity Timeline</h2>

        <div className="space-y-3">
          {caseRecord.activities.length === 0 ? (
            <div className="text-sm text-opd-text-muted text-center py-4">
              No activities yet
            </div>
          ) : (
            caseRecord.activities.map((activity, idx) => (
              <div key={activity.id} className="flex gap-3 pb-3 border-b border-opd-border last:border-b-0">
                <div className="w-6 h-6 rounded-full bg-opd-primary text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-opd-text-primary capitalize">
                    {activity.event.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-opd-text-muted mt-0.5">
                    {activity.description}
                  </div>
                  <div className="text-xs text-opd-text-muted font-mono mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
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
