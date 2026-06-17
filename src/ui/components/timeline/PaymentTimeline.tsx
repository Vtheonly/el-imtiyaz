/**
 * PaymentTimeline — visual month-by-month payment status bar.
 *
 * One glance reveals which months are paid, partial, or missing.
 */

import { formatDate } from '@shared/currency';
import { Check, AlertCircle, Clock } from 'lucide-react';

interface TimelineEntry {
  period: string;
  label: string;
  amountDue: number;
  amountPaid: number;
  status: 'paid' | 'partial' | 'missing';
}

interface PaymentTimelineProps {
  entries: TimelineEntry[];
}

export function PaymentTimeline({ entries }: PaymentTimelineProps) {
  if (entries.length === 0) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)'
      }}>
        No payment history yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-end', height: 60 }}>
      {entries.map((entry) => {
        const icon = entry.status === 'paid'
          ? <Check size={14} color="var(--color-success)" />
          : entry.status === 'partial'
            ? <Clock size={14} color="var(--color-warm-accent)" />
            : <AlertCircle size={14} color="var(--color-danger)" />;

        const bg = entry.status === 'paid'
          ? 'rgba(63, 166, 110, 0.15)'
          : entry.status === 'partial'
            ? 'rgba(200, 169, 140, 0.15)'
            : 'rgba(192, 80, 77, 0.1)';

        const borderColor = entry.status === 'paid'
          ? 'rgba(63, 166, 110, 0.4)'
          : entry.status === 'partial'
            ? 'rgba(200, 169, 140, 0.4)'
            : 'rgba(192, 80, 77, 0.3)';

        return (
          <div
            key={entry.period}
            title={`${entry.label}: ${entry.amountPaid.toFixed(2)} / ${entry.amountDue.toFixed(2)} DZD`}
            style={{
              flex: 1,
              minWidth: 36,
              padding: '6px 4px',
              borderRadius: 'var(--radius-sm)',
              background: bg,
              border: `1px solid ${borderColor}`,
              textAlign: 'center',
              transition: 'all var(--duration-fast) var(--ease-out)',
              cursor: 'default'
            }}
          >
            <div style={{ marginBottom: 2 }}>{icon}</div>
            <div style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-text-secondary)',
              textTransform: 'capitalize'
            }}>
              {entry.label.split('-')[1] ?? entry.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
