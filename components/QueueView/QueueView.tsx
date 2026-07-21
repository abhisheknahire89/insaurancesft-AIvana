/**
 * QueueView — Main queue browsing interface (replacing Case Queue vs Ops Tools)
 *
 * Layout:
 * ┌─────────────────┬──────────────────────────────────────────┐
 * │  QueueNav       │       QueueListView                       │
 * │  (left-rail)    │       (case list for active queue)        │
 * │                 │                                            │
 * │ My Queue        │ Patient | Insurer | Status | Days | Needs │
 * │ Inbox           │                                            │
 * │ Waiting on TPA  │ [patient 1]                               │
 * │ TPA Queries     │ [patient 2]                               │
 * │ Enhancements    │ [patient 3]                               │
 * │ Needs Appeal    │                                            │
 * │                 │                                            │
 * │ Settings        │                                            │
 * │ Analytics       │                                            │
 * └─────────────────┴──────────────────────────────────────────┘
 *
 * Clicking a case row opens it in the Workspace.
 */

import React, { useState, useEffect } from 'react';
import { QueueNav } from './QueueNav';
import { QueueListView } from './QueueListView';
import { Case, generateCaseId, DEFAULT_QUEUES } from '../../services/caseModel';
import { getAllCases } from '../../services/masterPatientRecord';
import type { CaseWorkspaceNewProps } from '../CaseWorkspace/CaseWorkspaceNew';

interface QueueViewProps {
  onOpenCase: (caseRecord: Case) => void;
  onCreateCase: () => void;
}

export const QueueView: React.FC<QueueViewProps> = ({ onOpenCase, onCreateCase }) => {
  const [activeQueueId, setActiveQueueId] = useState('my_queue');
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Load all cases on mount
  useEffect(() => {
    const loadCases = async () => {
      setIsLoading(true);
      try {
        const allCases = await getAllCases();
        setCases(allCases);

        // Compute unread counts per queue (simple: count cases in each status)
        const counts: Record<string, number> = {
          my_queue: 0,
          inbox: 0,
          waiting_on_tpa: 0,
          tpa_queries: 0,
          enhancements: 0,
          needs_appeal: 0,
          needs_my_approval: 0,
          billing_settlement: 0,
        };

        allCases.forEach(c => {
          if (c.status === 'patient_registered' || c.status === 'insurance_verified') {
            counts.inbox++;
            counts.my_queue++;
          } else if (c.status === 'query_raised') {
            counts.tpa_queries++;
            counts.my_queue++;
          } else if (c.status === 'enhancement_requested') {
            counts.enhancements++;
            counts.my_queue++;
          } else if (c.status === 'denied') {
            counts.needs_appeal++;
            counts.my_queue++;
          } else if (c.status === 'submitted_to_tpa') {
            counts.waiting_on_tpa++;
          } else if (c.status === 'discharge_billing') {
            counts.billing_settlement++;
          }

          if (c.pendingApprovals.length > 0) {
            counts.needs_my_approval++;
            counts.my_queue++;
          }
        });

        setUnreadCounts(counts);
      } catch (err) {
        console.error('Failed to load cases:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCases();

    // Refresh every 30 seconds (optional: could use real-time sync here)
    const interval = setInterval(loadCases, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full bg-opd-bg overflow-hidden">
      {/* Left Navigation */}
      <QueueNav
        activeQueueId={activeQueueId}
        onSelectQueue={setActiveQueueId}
        unreadCounts={unreadCounts}
        onCreateCase={onCreateCase}
      />

      {/* Case List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Optional: Queue header with description */}
        <div className="px-6 py-4 border-b border-opd-border bg-white">
          <h1 className="text-lg font-bold text-opd-primary capitalize">
            {activeQueueId.replace(/_/g, ' ')}
          </h1>
        </div>

        {/* Queue List View — actual case table */}
        <QueueListView
          queue={DEFAULT_QUEUES[activeQueueId]}
          cases={cases}
          onCaseClick={onOpenCase}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default QueueView;
