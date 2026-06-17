/**
 * Badge — small status pill.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  color?: string;  // overrides tone color
  className?: string;
}

export function Badge({ tone = 'default', children, dot, color, className }: BadgeProps) {
  const toneClass = {
    default: '',
    success: 'el-badge--success',
    warning: 'el-badge--warning',
    danger: 'el-badge--danger',
    neutral: 'el-badge--neutral'
  }[tone];

  const style = color
    ? {
        background: `${color}22`,
        color,
        borderColor: `${color}66`
      }
    : undefined;

  return (
    <span className={clsx('el-badge', toneClass, className)} style={style}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block'
          }}
        />
      )}
      {children}
    </span>
  );
}
