/**
 * PageHeader — standard page title block with optional actions.
 */

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="el-page__header">
      <div>
        <div className="el-page__title">{title}</div>
        {subtitle && <div className="el-page__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
