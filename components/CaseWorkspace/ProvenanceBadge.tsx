/**
 * ProvenanceBadge — Inline confidence + source citation (§7)
 *
 * Every AI-populated field carries a small badge showing:
 * - Confidence level (92%)
 * - Source (from Discharge_Summary.pdf, p.2)
 * - Timestamp (when extracted)
 *
 * Replaces the fake "Evidence Explorer" screen with real, always-live provenance
 * shown directly next to each field.
 *
 * Design: small, non-intrusive, hoverable for full details
 */

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { FieldProvenance } from '../../services/caseModel';

interface ProvenanceBadgeProps {
  provenance?: FieldProvenance;
  variant?: 'inline' | 'block'; // inline: small badge next to field; block: detail row below
  compact?: boolean;
}

/**
 * Returns a color class based on confidence level
 */
function confidenceColor(confidence: number): string {
  if (confidence >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (confidence >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

/**
 * Inline badge (small, next to field)
 */
const InlineBadge: React.FC<ProvenanceBadgeProps> = ({ provenance, compact }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!provenance) return null;

  const colorClass = confidenceColor(provenance.confidence);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border ${colorClass} hover:opacity-80 transition`}
      >
        <span className="font-mono">{provenance.confidence}%</span>
        <HelpCircle className="w-2.5 h-2.5" />
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 bg-gray-900 text-white text-[9px] px-2 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-lg">
          <div className="font-semibold">{provenance.confidence}% confidence</div>
          <div className="text-gray-300 mt-0.5">{provenance.source}</div>
          {provenance.timestamp && (
            <div className="text-gray-400 text-[8px] mt-1">
              {new Date(provenance.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Block badge (detailed info row, for sections with multiple fields)
 */
const BlockBadge: React.FC<ProvenanceBadgeProps> = ({ provenance }) => {
  if (!provenance) return null;

  const colorClass = confidenceColor(provenance.confidence);

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${colorClass}`}>
      <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-bold">
          {provenance.confidence}% confidence — {provenance.source}
        </div>
        {provenance.extractedFrom && (
          <div className="text-[9px] opacity-75 mt-1">
            Extracted from <span className="font-mono">{provenance.extractedFrom}</span>
            {provenance.extractedAtPage && `, page ${provenance.extractedAtPage}`}
          </div>
        )}
        {provenance.timestamp && (
          <div className="text-[9px] opacity-75">
            {new Date(provenance.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Main component — pick variant
 */
export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  provenance,
  variant = 'inline',
  compact
}) => {
  if (variant === 'block') {
    return <BlockBadge provenance={provenance} />;
  }

  return <InlineBadge provenance={provenance} compact={compact} />;
};

export default ProvenanceBadge;

/**
 * Helper: Wrap a field value with its provenance badge (inline)
 *
 * Usage:
 * <FieldWithProvenance label="Diagnosis" value={clinical.diagnosis} provenance={clinical.provenance.diagnosis} />
 */
interface FieldWithProvenanceProps {
  label: string;
  value: string | number | undefined;
  provenance?: FieldProvenance;
  icon?: React.ReactNode;
}

export const FieldWithProvenance: React.FC<FieldWithProvenanceProps> = ({
  label,
  value,
  provenance,
  icon
}) => {
  if (!value) return null;

  return (
    <div className="flex items-center gap-2">
      {icon && <div className="text-opd-text-muted">{icon}</div>}
      <div>
        <div className="text-[9px] font-bold text-opd-text-muted uppercase tracking-wider">
          {label}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-sm font-semibold text-opd-text-primary">{value}</span>
          <ProvenanceBadge provenance={provenance} variant="inline" compact />
        </div>
      </div>
    </div>
  );
};

/**
 * Helper: Display multiple fields in a grid with shared or per-field provenance
 *
 * Usage:
 * <FieldsGrid
 *   fields={[
 *     { label: 'Diagnosis', value: clinical.diagnosis, provenance: clinical.provenance.diagnosis },
 *     { label: 'ICD-10', value: clinical.icd10Code, provenance: clinical.provenance.icd10Code },
 *   ]}
 * />
 */
interface FieldsGridProps {
  fields: Array<{
    label: string;
    value: string | number | undefined;
    provenance?: FieldProvenance;
  }>;
  columns?: 1 | 2 | 3;
}

export const FieldsGrid: React.FC<FieldsGridProps> = ({ fields, columns = 2 }) => {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
  }[columns];

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {fields.map((field, idx) => (
        <div key={idx}>
          <div className="text-[9px] font-bold text-opd-text-muted uppercase tracking-wider mb-1">
            {field.label}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-opd-text-primary">
              {field.value || '—'}
            </span>
            {field.provenance && (
              <ProvenanceBadge provenance={field.provenance} variant="inline" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
