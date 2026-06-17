/**
 * EmptyState — placeholder when no data is available.
 */

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="el-empty-state">
      {icon && <div className="el-empty-state__icon">{icon}</div>}
      <div className="el-empty-state__title">{title}</div>
      {description && <div className="el-empty-state__desc">{description}</div>}
      {action && <div style={{ marginTop: 'var(--space-4)' }}>{action}</div>}
    </div>
  );
}
