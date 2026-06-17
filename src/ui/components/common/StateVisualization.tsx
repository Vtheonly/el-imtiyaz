/**
 * StateVisualization — explains WHY an entity is in its current state.
 *
 * Example:
 *   "Payment marked OVERDUE because due_date < today AND unpaid_amount > 0"
 *
 * Renders a list of condition evaluations, highlighting which fired and
 * which didn't, so the user can understand the system's reasoning.
 */

import { Check, X, Info } from 'lucide-react';
import { Badge } from '../common';

export interface StateRule {
  description: string;
  fired: boolean;
  /** The actual values that were evaluated. */
  evaluated?: Record<string, unknown>;
}

interface StateVisualizationProps {
  currentState: string;
  currentStateTone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  rules: StateRule[];
  /** Optional human-readable summary of how the state was derived. */
  summary?: string;
}

export function StateVisualization({
  currentState,
  currentStateTone = 'info',
  rules,
  summary
}: StateVisualizationProps) {
  const firedCount = rules.filter((r) => r.fired).length;
  const allFired = firedCount === rules.length;
  const noneFired = firedCount === 0;

  return (
    <div
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        background: 'rgba(52,155,212,0.04)',
        border: '1px solid var(--border-primary)',
        fontFamily: 'var(--font-sans)'
      }}
    >
      {/* Current state header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
        <div>
          <div className="el-stat__label" style={{ marginBottom: 2 }}>Current state</div>
          <div className="flex items-center gap-2">
            <Badge tone={currentStateTone} dot>{currentState}</Badge>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {allFired ? 'All conditions met'
                : noneFired ? 'No conditions met'
                : `${firedCount}/${rules.length} conditions met`}
            </span>
          </div>
        </div>
        <Info size={16} style={{ color: 'var(--color-primary-blue)' }} />
      </div>

      {/* Summary */}
      {summary && (
        <div
          style={{
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5
          }}
        >
          {summary}
        </div>
      )}

      {/* Rule evaluations */}
      <div className="flex flex-col gap-1">
        {rules.map((rule, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: rule.fired
                ? 'rgba(63,166,110,0.08)'
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${rule.fired ? 'rgba(63,166,110,0.2)' : 'var(--border-subtle)'}`
            }}
          >
            <div style={{ marginTop: 2 }}>
              {rule.fired
                ? <Check size={14} style={{ color: 'var(--color-success)' }} />
                : <X size={14} style={{ color: 'var(--color-text-muted)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: rule.fired ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.5
                }}
              >
                {rule.description}
              </div>
              {rule.evaluated && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  {Object.entries(rule.evaluated).map(([k, v]) => (
                    <span key={k} style={{ marginRight: 8 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{k}:</span>{' '}
                      <span style={{ color: 'var(--color-text-secondary)' }}>{String(v)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Conclusion */}
      <div
        style={{
          marginTop: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-primary-tint-08)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-primary-blue)',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)'
        }}
      >
        → State = <strong>{currentState}</strong>
      </div>
    </div>
  );
}
