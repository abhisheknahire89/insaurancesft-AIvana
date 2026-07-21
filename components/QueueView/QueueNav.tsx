/**
 * QueueNav — Left-rail queue navigation (§3 & §9)
 *
 * Replaces the "Case Queue vs Ops Tools" toggle with role-scoped Queues:
 * - My Queue (everything needing MY action, sorted by urgency)
 * - Inbox (new/incomplete cases)
 * - Waiting on TPA, TPA Queries, Enhancements, Needs Appeal (status-specific)
 * - Needs My Approval (only for senior_reviewer role when gates are on)
 * - Billing & Settlement (only for billing_executive role)
 *
 * Visibility is role-scoped. A Coordinator sees 6 queues; a Billing Executive sees 2.
 */

import React, { useState } from 'react';
import {
  Home, Inbox, Clock, MessageSquare, TrendingUp, Scale,
  CheckCircle, BarChart3, Settings, ChevronDown, ChevronUp,
  Search, Plus
} from 'lucide-react';
import { useRole } from '../../contexts/RoleContext';
import { DEFAULT_QUEUES } from '../../services/caseModel';
import type { Role } from '../../services/caseModel';

interface QueueNavProps {
  activeQueueId: string;
  onSelectQueue: (queueId: string) => void;
  unreadCounts: Record<string, number>;
  onCreateCase: () => void;
}

const QUEUE_ICONS: Record<string, React.ReactNode> = {
  my_queue: <Home className="w-4 h-4" />,
  inbox: <Inbox className="w-4 h-4" />,
  waiting_on_tpa: <Clock className="w-4 h-4" />,
  tpa_queries: <MessageSquare className="w-4 h-4" />,
  enhancements: <TrendingUp className="w-4 h-4" />,
  needs_appeal: <Scale className="w-4 h-4" />,
  needs_my_approval: <CheckCircle className="w-4 h-4" />,
  billing_settlement: <DollarSign className="w-4 h-4" />,
  analytics: <BarChart3 className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
};

const QUEUE_ORDER = [
  'my_queue', 'inbox', 'waiting_on_tpa', 'tpa_queries',
  'enhancements', 'needs_appeal', 'needs_my_approval',
  'billing_settlement'
];

export const QueueNav: React.FC<QueueNavProps> = ({
  activeQueueId,
  onSelectQueue,
  unreadCounts,
  onCreateCase
}) => {
  const { user } = useRole();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!user) {
    return <div className="w-64 bg-opd-bg border-r border-opd-border" />;
  }

  // Filter queues by role
  const visibleQueues = QUEUE_ORDER
    .filter(queueId => {
      const queue = DEFAULT_QUEUES[queueId];
      return queue && queue.visibleToRoles.some(r => user.roles.includes(r));
    })
    .map(queueId => DEFAULT_QUEUES[queueId]);

  return (
    <div className="w-64 bg-opd-bg border-r border-opd-border flex flex-col overflow-hidden">
      {/* Header with hospital/user info */}
      <div className="p-4 border-b border-opd-border">
        <div className="text-[9px] font-bold text-opd-text-muted uppercase tracking-wider">Hospital</div>
        <div className="font-bold text-sm text-opd-text-primary truncate mb-3">
          {user.hospitals[0]?.hospitalName || 'Default Hospital'}
        </div>

        {/* Create Case Button */}
        <button
          onClick={onCreateCase}
          className="w-full flex items-center justify-center gap-2 py-2 bg-opd-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          New Case
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-opd-border">
        <div className="relative">
          <input
            type="text"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs px-2 py-1.5 pl-8 border border-opd-border rounded-lg focus:outline-none focus:border-opd-primary"
          />
          <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-opd-text-muted" />
        </div>
      </div>

      {/* Queues */}
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {visibleQueues.map(queue => {
          const unread = unreadCounts[queue.id] || 0;
          const isActive = activeQueueId === queue.id;
          const icon = QUEUE_ICONS[queue.id] || <FileText className="w-4 h-4" />;

          return (
            <button
              key={queue.id}
              onClick={() => onSelectQueue(queue.id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition ${
                isActive
                  ? 'bg-opd-primary text-white'
                  : 'text-opd-text-secondary hover:bg-opd-input-bg'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={isActive ? 'text-white' : 'text-opd-text-muted'}>{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${
                    isActive ? 'text-white' : 'text-opd-text-primary'
                  }`}>
                    {queue.name}
                  </div>
                  {queue.description && (
                    <div className={`text-[9px] truncate ${
                      isActive ? 'text-white/70' : 'text-opd-text-muted'
                    }`}>
                      {queue.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Unread badge */}
              {unread > 0 && (
                <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-opd-primary text-white'
                }`}>
                  {unread > 99 ? '99+' : unread}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer: Settings & Analytics */}
      <div className="border-t border-opd-border p-2 space-y-1">
        <button className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-opd-text-secondary hover:bg-opd-input-bg transition text-sm font-semibold">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </div>
        </button>
        <button className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-opd-text-secondary hover:bg-opd-input-bg transition text-sm font-semibold">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </div>
        </button>
      </div>
    </div>
  );
};

export default QueueNav;
