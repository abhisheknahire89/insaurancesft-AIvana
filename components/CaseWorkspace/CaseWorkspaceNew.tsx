/**
 * CaseWorkspace (Insurance Operations Platform) — Three-region design
 *
 * ┌───────────────┬─────────────────────────────────────┬───────────────────────┐
 * │ LEFT SIDEBAR  │         CENTER WORKSPACE             │   RIGHT AI COPILOT    │
 * │ (Case Summary)│      (adapts to current task)        │     (persistent)      │
 * │               │                                       │                       │
 * │ Patient       │  e.g. Ready for Prior Auth:           │ Missing documents     │
 * │ UHID          │   Medical Summary → Documents →       │ Missing fields        │
 * │ Insurer       │   Generated Part C → Review → Submit  │ Expected TPA queries  │
 * │ Status        │                                       │ Policy warnings       │
 * │ Current Owner │  e.g. TPA Query active:               │ AI suggestions        │
 * │ SLA Timer     │   Query → AI-Suggested Response →     │ Timeline (click a     │
 * │ Progress %    │   Supporting Docs → Doctor             │   stage to focus the │
 * │ Quick Actions │   Clarification → Reply                │   matching section)  │
 * │               │                                       │ Confidence            │
 * │               │  e.g. Denial active:                  │ Recommended next     │
 * │               │   Denial Analysis → Evidence →         │   action              │
 * │               │   Appeal Draft → Submit Appeal         │                       │
 * └───────────────┴─────────────────────────────────────┴───────────────────────┘
 *
 * Key invariants:
 * - Coordinator never leaves page; all tasks happen in CENTER
 * - Timeline is clickable navigation; selecting a past stage focuses that section
 * - RIGHT copilot surface is always visible (missing items, predictions, next actions)
 * - Every stage (Prior Auth, Query, Enhancement, Denial, Billing) gets its own CENTER view
 */

import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Clock, AlertCircle, CheckCircle2,
  FileText, MessageSquare, TrendingUp, DollarSign, AlertTriangle,
  Calendar, User, Building2, Zap, Eye, Plus, Send
} from 'lucide-react';
import { Case, CaseStatus, computeCompletenessScore, Activity, Role } from '../../services/caseModel';
import { useRole } from '../../contexts/RoleContext';
import { CenterWorkspaceRouter } from './CenterWorkspaceRouter';

interface CaseWorkspaceNewProps {
  caseRecord: Case;
  onSave: (updated: Case) => Promise<void>;
  onClose: () => void;
}

// ============================================
// LEFT SIDEBAR — Case Summary & Quick Actions
// ============================================

interface LeftSidebarProps {
  caseRecord: Case;
  onQuickAction: (action: string) => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ caseRecord, onQuickAction }) => {
  const { isGateEnabled, canApprove } = useRole();
  const [expandedSection, setExpandedSection] = useState<string | null>('patient');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const completeness = computeCompletenessScore(caseRecord);
  const completenessColor =
    completeness >= 80 ? 'text-emerald-600' :
    completeness >= 50 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div className="w-72 bg-opd-bg border-r border-opd-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-opd-border">
        <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider mb-2">Case ID</div>
        <div className="font-mono font-bold text-sm text-opd-primary truncate">{caseRecord.id}</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {/* Completeness Ring */}
        <div className="rounded-xl border border-opd-border bg-white p-4 text-center">
          <div className={`text-3xl font-bold ${completenessColor}`}>
            {completeness}%
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-opd-text-muted mt-1">
            Case Completeness
          </div>
        </div>

        {/* Patient Section */}
        <div className="border border-opd-border rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => toggleSection('patient')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-opd-primary">Patient</span>
            {expandedSection === 'patient' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expandedSection === 'patient' && (
            <div className="border-t border-opd-border p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-opd-text-muted">Name</span>
                <span className="font-semibold text-opd-text-primary">{caseRecord.patient.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-opd-text-muted">Contact</span>
                <span className="font-mono text-opd-text-primary">{caseRecord.patient.contactNumber}</span>
              </div>
              {caseRecord.patient.uhid && (
                <div className="flex justify-between">
                  <span className="text-opd-text-muted">UHID</span>
                  <span className="font-mono text-opd-text-primary">{caseRecord.patient.uhid}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Insurance Section */}
        <div className="border border-opd-border rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => toggleSection('insurance')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-opd-primary">Insurance</span>
            {expandedSection === 'insurance' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expandedSection === 'insurance' && (
            <div className="border-t border-opd-border p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-opd-text-muted">Insurer</span>
                <span className="font-semibold text-opd-text-primary">{caseRecord.insurance.insurerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-opd-text-muted">TPA</span>
                <span className="font-semibold text-opd-text-primary">{caseRecord.insurance.tpaName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-opd-text-muted">Policy #</span>
                <span className="font-mono text-opd-text-primary text-[8px]">{caseRecord.insurance.policyNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-opd-text-muted">Sum Insured</span>
                <span className="font-mono text-opd-text-primary">₹{caseRecord.insurance.sumInsured.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Status & Owner Section */}
        <div className="border border-opd-border rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => toggleSection('status')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-opd-primary">Status</span>
            {expandedSection === 'status' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expandedSection === 'status' && (
            <div className="border-t border-opd-border p-3 space-y-2 text-xs">
              <div>
                <div className="text-opd-text-muted font-bold mb-1">Current Stage</div>
                <div className="bg-opd-input-bg text-opd-primary font-mono font-semibold px-2 py-1 rounded text-[10px]">
                  {caseRecord.status.replace(/_/g, ' ').toUpperCase()}
                </div>
              </div>
              {caseRecord.ownerRole && (
                <div className="flex justify-between">
                  <span className="text-opd-text-muted">Owned By</span>
                  <span className="font-semibold text-opd-text-primary capitalize">{caseRecord.ownerRole.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Missing Items Section (AI Copilot Preview) */}
        {caseRecord.completeness.missingItems.length > 0 && (
          <div className="border border-amber-200 rounded-lg overflow-hidden bg-amber-50">
            <button
              onClick={() => toggleSection('missing')}
              className="w-full flex items-center justify-between p-3 hover:bg-amber-100/50 transition"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Missing ({caseRecord.completeness.missingItems.length})
              </span>
              {expandedSection === 'missing' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expandedSection === 'missing' && (
              <div className="border-t border-amber-200 p-3 space-y-1">
                {caseRecord.completeness.missingItems.map((item, i) => (
                  <div key={i} className="text-xs text-amber-800 flex items-start gap-1">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div className="border-t border-opd-border p-3 space-y-1">
        <button
          onClick={() => onQuickAction('submit_prior_auth')}
          className="w-full text-xs font-bold text-white bg-opd-primary rounded-lg py-2 hover:opacity-90 transition"
        >
          Submit Prior Auth
        </button>
        <button
          onClick={() => onQuickAction('view_timeline')}
          className="w-full text-xs font-bold text-opd-primary border border-opd-primary rounded-lg py-2 hover:bg-opd-input-bg transition"
        >
          View Timeline
        </button>
      </div>
    </div>
  );
};

// ============================================
// CENTER WORKSPACE — Adaptive Content
// ============================================

interface CenterWorkspaceProps {
  caseRecord: Case;
  onSave: (updated: Case) => Promise<void>;
}

const CenterWorkspace: React.FC<CenterWorkspaceProps> = ({ caseRecord, onSave }) => {
  const handleCaseUpdate = async (updated: Case) => {
    await onSave(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl">
        <h2 className="text-lg font-bold text-opd-primary mb-6">
          {caseRecord.status.replace(/_/g, ' ').toUpperCase()}
        </h2>

        {/* Task-Adaptive Content Router */}
        <CenterWorkspaceRouter
          caseRecord={caseRecord}
          onUpdate={handleCaseUpdate}
        />

      </div>
    </div>
  );
};

// ============================================
// RIGHT COPILOT PANEL — Persistent AI Support
// ============================================

interface RightCopilotProps {
  caseRecord: Case;
}

const RightCopilot: React.FC<RightCopilotProps> = ({ caseRecord }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('missing');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="w-80 bg-opd-bg border-l border-opd-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-opd-border">
        <div className="text-xs font-bold text-opd-text-muted uppercase tracking-wider flex items-center gap-1">
          <Zap className="w-3.5 h-3.5" /> AI Copilot
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {/* Missing Items */}
        {caseRecord.completeness.missingItems.length > 0 && (
          <div className="border border-opd-border rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => toggleSection('missing')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Missing Items
              </span>
              {expandedSection === 'missing' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expandedSection === 'missing' && (
              <div className="border-t border-opd-border p-3 space-y-2 text-xs">
                {caseRecord.completeness.missingItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2">
                    <AlertCircle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                    <span className="text-red-700 font-semibold flex-1">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Completeness Score */}
        <div className="border border-opd-border rounded-lg bg-white p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-opd-primary mb-2">Readiness Score</div>
          <div className="flex items-end gap-2">
            <div className="text-2xl font-bold text-opd-primary">{computeCompletenessScore(caseRecord)}%</div>
            <div className="text-[9px] text-opd-text-muted mb-1">Ready for submission</div>
          </div>
        </div>

        {/* Expected TPA Queries */}
        {caseRecord.authorization.requestedAmount > 0 && (
          <div className="border border-opd-border rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => toggleSection('queries')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Expected Queries
              </span>
              {expandedSection === 'queries' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expandedSection === 'queries' && (
              <div className="border-t border-opd-border p-3 space-y-2 text-xs">
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">
                  No documented prior procedures — TPA may query
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">
                  Discharge date estimated — TPA may challenge length of stay
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Recommended Action */}
        <div className="border border-emerald-200 rounded-lg bg-emerald-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1 mb-2">
            <Zap className="w-3.5 h-3.5" />
            Suggested Next
          </div>
          <div className="text-sm font-semibold text-emerald-800">Upload Admission Letter</div>
          <div className="text-xs text-emerald-700 mt-1">
            Will improve completeness to 85% and reduce expected TPA queries
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-opd-border p-3">
        <button className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white bg-opd-primary rounded-lg hover:opacity-90 transition">
          <Eye className="w-3.5 h-3.5" />
          View Full Copilot
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const CaseWorkspaceNew: React.FC<CaseWorkspaceNewProps> = ({
  caseRecord,
  onSave,
  onClose
}) => {
  const [localCase, setLocalCase] = React.useState(caseRecord);

  const handleQuickAction = (action: string) => {
    console.log('Quick action:', action);
    // TODO: Implement quick actions
  };

  return (
    <div className="flex h-full bg-opd-bg overflow-hidden">
      {/* LEFT: Case Summary */}
      <LeftSidebar caseRecord={localCase} onQuickAction={handleQuickAction} />

      {/* CENTER: Adaptive Workspace */}
      <CenterWorkspace caseRecord={localCase} onSave={onSave} />

      {/* RIGHT: AI Copilot */}
      <RightCopilot caseRecord={localCase} />
    </div>
  );
};

export default CaseWorkspaceNew;
