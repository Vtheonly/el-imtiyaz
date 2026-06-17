/**
 * ActivityTimeline — audit-grade event log UI.
 */

import { ReactNode } from 'react';

interface ActivityEntry {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  actor?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}

interface ActivityTimelineProps {
  entries: ActivityEntry[];
  maxHeight?: number;
}

export function ActivityTimeline({ entries, maxHeight = 400 }: ActivityTimelineProps) {
  if (entries.length === 0) {
    return (
      <div style={{
        padding: 'var(--space-6)',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-sm)'
      }}>
        No recent activity.
      </div>
    );
  }

  return (
    <div className="el-timeline" style={{ maxHeight, overflowY: 'auto' }}>
      {entries.map((entry) => (
        <div key={entry.id} className="el-timeline__item">
          <div className={`el-timeline__dot el-timeline__dot--${entry.tone ?? 'default'}`} />
          <div className="el-timeline__label">
            {new Date(entry.timestamp).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
            {entry.actor && ` • ${entry.actor}`}
          </div>
          <div className="el-timeline__title">
            {entry.icon && <span style={{ marginRight: 6 }}>{entry.icon}</span>}
            {entry.title}
          </div>
          {entry.description && (
            <div className="el-timeline__desc">{entry.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}
