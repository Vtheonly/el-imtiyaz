/**
 * Spinner — branded loading indicator.
 */

import clsx from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={clsx('el-spinner', {
        'el-spinner--sm': size === 'sm',
        'el-spinner--lg': size === 'lg'
      }, className)}
    />
  );
}
