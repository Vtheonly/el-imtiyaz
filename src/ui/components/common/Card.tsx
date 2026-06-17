/**
 * Card — themed container with optional header.
 */

import { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  interactive?: boolean;
  elevated?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  interactive,
  elevated,
  className,
  bodyClassName
}: CardProps) {
  return (
    <div
      className={clsx(
        'el-card',
        elevated && 'el-card--elevated',
        interactive && 'el-card--interactive',
        className
      )}
    >
      {(title || actions) && (
        <div className="el-card__header">
          <div>
            {title && <div className="el-card__title">{title}</div>}
            {subtitle && <div className="el-card__subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
