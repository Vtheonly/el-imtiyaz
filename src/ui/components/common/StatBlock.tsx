/**
 * StatBlock — KPI display with label, value, and optional delta.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';
import { formatNumber } from '@shared/currency';

interface StatBlockProps {
  label: string;
  value: number | string;
  format?: 'number' | 'currency' | 'plain';
  delta?: { value: number; label?: string };
  icon?: ReactNode;
  className?: string;
}

export function StatBlock({ label, value, format = 'plain', delta, icon, className }: StatBlockProps) {
  const formatted = (() => {
    if (typeof value === 'string') return value;
    if (format === 'number') return formatNumber(value);
    if (format === 'currency') return `${formatNumber(value)} DZD`;
    return String(value);
  })();

  return (
    <div className={clsx('el-card el-stat', className)}>
      <div className="flex items-center justify-between">
        <div className="el-stat__label">{label}</div>
        {icon && <div style={{ color: 'var(--color-primary-blue)' }}>{icon}</div>}
      </div>
      <div className="el-stat__value">{formatted}</div>
      {delta && (
        <div
          className={clsx(
            'el-stat__delta',
            delta.value >= 0 ? 'el-stat__delta--up' : 'el-stat__delta--down'
          )}
        >
          <span>{delta.value >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(delta.value).toFixed(1)}%</span>
          {delta.label && <span style={{ color: 'var(--color-text-tertiary)' }}>{delta.label}</span>}
        </div>
      )}
    </div>
  );
}
