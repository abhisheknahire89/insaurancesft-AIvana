/**
 * Insurance Operations Platform — Role & Permission Management
 *
 * Manages the current user's roles, approval gates configuration per hospital,
 * and permission checks for gated transitions.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Role, ApprovalGateConfig, GateableTransition } from '../services/caseModel';

// ============================================
// TYPES
// ============================================

export interface HospitalSettings {
  hospitalId: string;
  hospitalName: string;
  approvalGates: ApprovalGateConfig;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  hospitals: HospitalSettings[];
  activeHospitalId: string;
}

export interface RoleContextValue {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;

  // Role helpers
  hasRole(role: Role): boolean;
  hasAnyRole(roles: Role[]): boolean;
  canApprove(transition: GateableTransition): boolean;
  canAccess(requiredRoles: Role[]): boolean;

  // Hospital settings
  activeHospital: HospitalSettings | null;
  switchHospital(hospitalId: string): void;

  // Gate config
  isGateEnabled(transition: GateableTransition): boolean;
  getApproverRoleForGate(transition: GateableTransition): Role | null;
  getAmountThresholdForGate(transition: GateableTransition): number | null;

  // Auth actions
  login(email: string, password: string): Promise<void>;
  logout(): void;
  updateHospitalGates(hospitalId: string, gates: ApprovalGateConfig): Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

interface RoleProviderProps {
  children: ReactNode;
}

export const RoleProvider: React.FC<RoleProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock: Initialize with a demo user (single-user mode, all roles)
  useEffect(() => {
    const initializeUser = async () => {
      try {
        // TODO: Replace with real auth when identity system exists
        const mockUser: UserProfile = {
          id: 'user-1',
          name: 'Demo Coordinator',
          email: 'coordinator@hospital.local',
          roles: ['insurance_coordinator', 'billing_executive', 'senior_reviewer'],
          hospitals: [
            {
              hospitalId: 'default',
              hospitalName: 'Default Hospital',
              approvalGates: {
                hospitalId: 'default',
                rules: [
                  // All gates OFF by default (single-user mode)
                  {
                    transition: 'submit_prior_auth',
                    requiresApproval: false,
                    approverRole: 'senior_reviewer',
                  },
                  {
                    transition: 'submit_enhancement',
                    requiresApproval: false,
                    approverRole: 'senior_reviewer',
                  },
                  {
                    transition: 'submit_appeal',
                    requiresApproval: false,
                    approverRole: 'senior_reviewer',
                  },
                ],
              },
            },
          ],
          activeHospitalId: 'default',
        };
        setUser(mockUser);
        setError(null);
      } catch (err) {
        setError(`Failed to initialize user: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const hasRole = (role: Role): boolean => {
    return user?.roles.includes(role) ?? false;
  };

  const hasAnyRole = (roles: Role[]): boolean => {
    return roles.some(r => user?.roles.includes(r)) ?? false;
  };

  const activeHospital = user?.hospitals.find(h => h.hospitalId === user.activeHospitalId) || null;

  const isGateEnabled = (transition: GateableTransition): boolean => {
    if (!activeHospital) return false;
    const rule = activeHospital.approvalGates.rules.find(r => r.transition === transition);
    return rule?.requiresApproval ?? false;
  };

  const getApproverRoleForGate = (transition: GateableTransition): Role | null => {
    if (!activeHospital) return null;
    const rule = activeHospital.approvalGates.rules.find(r => r.transition === transition);
    return rule?.approverRole ?? null;
  };

  const getAmountThresholdForGate = (transition: GateableTransition): number | null => {
    if (!activeHospital) return null;
    const rule = activeHospital.approvalGates.rules.find(r => r.transition === transition);
    return rule?.amountThreshold ?? null;
  };

  const canApprove = (transition: GateableTransition): boolean => {
    if (!isGateEnabled(transition)) return true; // Gate is off, no approval needed
    const approverRole = getApproverRoleForGate(transition);
    return approverRole ? hasRole(approverRole) : false;
  };

  const canAccess = (requiredRoles: Role[]): boolean => {
    return hasAnyRole(requiredRoles);
  };

  const switchHospital = (hospitalId: string) => {
    if (!user) return;
    if (!user.hospitals.find(h => h.hospitalId === hospitalId)) {
      setError(`User does not have access to hospital ${hospitalId}`);
      return;
    }
    setUser({ ...user, activeHospitalId: hospitalId });
  };

  const login = async (email: string, password: string) => {
    // TODO: Real login
    console.log('Mock login:', email);
  };

  const logout = () => {
    setUser(null);
  };

  const updateHospitalGates = async (hospitalId: string, gates: ApprovalGateConfig) => {
    if (!user) return;
    const updatedHospitals = user.hospitals.map(h =>
      h.hospitalId === hospitalId ? { ...h, approvalGates: gates } : h
    );
    setUser({ ...user, hospitals: updatedHospitals });
    // TODO: Persist to backend
  };

  const value: RoleContextValue = {
    user,
    loading,
    error,
    hasRole,
    hasAnyRole,
    canApprove,
    canAccess,
    activeHospital,
    switchHospital,
    isGateEnabled,
    getApproverRoleForGate,
    getAmountThresholdForGate,
    login,
    logout,
    updateHospitalGates,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

// ============================================
// HOOK
// ============================================

export const useRole = (): RoleContextValue => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

// ============================================
// PERMISSION HELPERS
// ============================================

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  insurance_coordinator: 'Creates/enriches cases, uploads documents, generates Prior Auth',
  senior_reviewer: 'Reviews and approves complex cases and gated actions',
  billing_executive: 'Validates estimates, generates final bills, reconciles payments',
  treating_doctor: 'Provides clinical documentation and responds to queries',
  medical_records: 'Supplies missing reports and documents',
  reception: 'Registers patients and initiates basic cases',
  tpa: 'External TPA user (reviews submitted cases)',
  patient: 'Limited access (receives updates, uploads documents)',
};

export const QUEUE_VISIBILITY: Record<Role, string[]> = {
  insurance_coordinator: ['my_queue', 'inbox', 'waiting_on_tpa', 'tpa_queries', 'enhancements', 'needs_appeal'],
  senior_reviewer: ['needs_my_approval', 'my_queue'],
  billing_executive: ['billing_settlement', 'my_queue'],
  treating_doctor: ['tpa_queries'],
  medical_records: ['tpa_queries'],
  reception: ['inbox'],
  tpa: [], // External, no queues
  patient: [], // Limited access
};

export function getVisibleQueuesForRoles(roles: Role[]): string[] {
  const queues = new Set<string>();
  roles.forEach(role => {
    QUEUE_VISIBILITY[role]?.forEach(q => queues.add(q));
  });
  return Array.from(queues);
}

// ============================================
// GATE CONFIGURATION HELPERS
// ============================================

export function createDefaultGateConfig(hospitalId: string): ApprovalGateConfig {
  return {
    hospitalId,
    rules: [
      {
        transition: 'submit_prior_auth',
        requiresApproval: false,
        approverRole: 'senior_reviewer',
      },
      {
        transition: 'submit_enhancement',
        requiresApproval: false,
        approverRole: 'senior_reviewer',
        amountThreshold: 50000,
      },
      {
        transition: 'submit_appeal',
        requiresApproval: false,
        approverRole: 'senior_reviewer',
      },
    ],
  };
}

export function enableGate(config: ApprovalGateConfig, transition: GateableTransition): ApprovalGateConfig {
  return {
    ...config,
    rules: config.rules.map(r =>
      r.transition === transition ? { ...r, requiresApproval: true } : r
    ),
  };
}

export function disableGate(config: ApprovalGateConfig, transition: GateableTransition): ApprovalGateConfig {
  return {
    ...config,
    rules: config.rules.map(r =>
      r.transition === transition ? { ...r, requiresApproval: false } : r
    ),
  };
}

export function setAmountThreshold(
  config: ApprovalGateConfig,
  transition: GateableTransition,
  amount: number
): ApprovalGateConfig {
  return {
    ...config,
    rules: config.rules.map(r =>
      r.transition === transition ? { ...r, amountThreshold: amount } : r
    ),
  };
}
