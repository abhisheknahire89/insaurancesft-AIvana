/**
 * InsuranceModule — Refactored for Insurance Operations Platform (Step 10)
 *
 * Replaces:
 * - Old "Case Queue vs Ops Tools" toggle
 * - 14-screen simulator
 * - Wizard-based case creation
 *
 * With:
 * - QueueView (role-scoped case list)
 * - CaseWorkspaceNew (three-region adaptive workspace)
 * - CaseIntakeFlow (bare-minimum intake)
 * - AnalyticsDashboard (real KPIs)
 */

import React, { useState } from 'react';
import { Case } from '../services/caseModel';
import { QueueView } from './QueueView/QueueView';
import { CaseWorkspaceNew } from './CaseWorkspace/CaseWorkspaceNew';
import { CaseIntakeFlow } from './CaseIntake/CaseIntakeFlow';
import { AnalyticsDashboard } from './Analytics/AnalyticsDashboard';
import { saveCase } from '../services/masterPatientRecord';

type AppMode = 'queue' | 'case_workspace' | 'intake' | 'analytics';

export const InsuranceModule: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('queue');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────

  const handleOpenCase = (caseRecord: Case) => {
    setSelectedCase(caseRecord);
    setMode('case_workspace');
  };

  const handleCreateNewCase = () => {
    setMode('intake');
  };

  const handleCaseCreated = (newCase: Case) => {
    setSelectedCase(newCase);
    setMode('case_workspace');
  };

  const handleSaveCase = async (updated: Case) => {
    try {
      await saveCase(updated);
      setSelectedCase(updated);
    } catch (err) {
      console.error('Failed to save case:', err);
    }
  };

  const handleBackToQueue = () => {
    setMode('queue');
    setSelectedCase(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER BY MODE
  // ─────────────────────────────────────────────────────────────────────────

  if (mode === 'intake') {
    return (
      <div className="flex flex-col h-screen bg-opd-bg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-opd-border bg-white flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-opd-primary">New Patient Registration</h1>
            <p className="text-sm text-opd-text-muted mt-1">Register patient for insurance processing</p>
          </div>
          <button
            onClick={handleBackToQueue}
            className="px-4 py-2 border border-opd-border text-opd-text-secondary font-semibold rounded-lg hover:bg-opd-input-bg transition"
          >
            ← Back to Queue
          </button>
        </div>

        {/* Intake Form */}
        <div className="flex-1 overflow-y-auto">
          <CaseIntakeFlow
            onCaseCreated={handleCaseCreated}
            onCancel={handleBackToQueue}
            intakeChannel="manual"
          />
        </div>
      </div>
    );
  }

  if (mode === 'analytics') {
    return (
      <div className="flex flex-col h-screen bg-opd-bg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-opd-border bg-white flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-opd-primary">Analytics Dashboard</h1>
            <p className="text-sm text-opd-text-muted mt-1">Real-time insurance operations metrics</p>
          </div>
          <button
            onClick={handleBackToQueue}
            className="px-4 py-2 border border-opd-border text-opd-text-secondary font-semibold rounded-lg hover:bg-opd-input-bg transition"
          >
            ← Back to Queue
          </button>
        </div>

        {/* Analytics */}
        <div className="flex-1 overflow-y-auto">
          <AnalyticsDashboard autoRefresh={true} refreshInterval={30000} />
        </div>
      </div>
    );
  }

  if (mode === 'case_workspace' && selectedCase) {
    return (
      <div className="flex h-screen bg-opd-bg overflow-hidden">
        {/* Workspace */}
        <CaseWorkspaceNew
          caseRecord={selectedCase}
          onSave={handleSaveCase}
          onClose={handleBackToQueue}
        />
      </div>
    );
  }

  // Default: Queue View
  return (
    <div className="flex h-screen bg-opd-bg overflow-hidden">
      {/* Queue View with integrated navigation */}
      <QueueView
        onOpenCase={handleOpenCase}
        onCreateCase={handleCreateNewCase}
      />

      {/* Top navigation bar (always visible in queue mode) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <button
          onClick={() => setMode('analytics')}
          className="px-4 py-2 text-sm font-bold text-opd-primary border border-opd-primary rounded-lg hover:bg-opd-input-bg transition"
        >
          📊 Analytics
        </button>
      </div>
    </div>
  );
};

export default InsuranceModule;
