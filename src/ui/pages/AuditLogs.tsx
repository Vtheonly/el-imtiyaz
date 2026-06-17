/**
 * AuditLogs — full audit trail viewer.
 */

import { useEffect, useState } from 'react';
import { Database, Filter } from 'lucide-react';
import { Card, Badge, EmptyState } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { ActivityTimeline } from '../components/timeline/ActivityTimeline';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  before?: any;
  after?: any;
}

export function AuditLogs() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const rows = await window.elImtiyaz.audit.list({ limit: 200 });
        setEntries((rows as any[]).map((a) => ({
          id: a.id.value,
          timestamp: a.timestamp,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          actorName: a.actorName,
          before: a.before,
          after: a.after
        })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = entries.filter((e) =>
    !filter ||
    e.action.toLowerCase().includes(filter.toLowerCase()) ||
    e.entityType.toLowerCase().includes(filter.toLowerCase()) ||
    e.actorName.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="el-page">
      <PageHeader title="Audit Logs" subtitle={`${entries.length} events recorded`} />

      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 'var(--space-4)' }}>
        <Card title="Filters">
          <div className="flex flex-col gap-3">
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Search</label>
              <input
                className="el-input"
                style={{ width: '100%' }}
                placeholder="Filter by action, entity, or actor…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Entity Type</label>
              <div className="el-select" style={{ width: '100%' }}>
                <select style={{ width: '100%' }}>
                  <option value="">All</option>
                  <option value="Student">Student</option>
                  <option value="Payment">Payment</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Class">Class</option>
                  <option value="Employee">Employee</option>
                </select>
              </div>
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Date Range</label>
              <div className="flex gap-2">
                <input type="date" className="el-input" style={{ flex: 1 }} />
                <input type="date" className="el-input" style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Event Timeline" subtitle={`${filtered.length} matching events`}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: 'var(--space-12)' }}>
              <div className="el-spinner el-spinner--lg" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Database size={24} />} title="No audit entries" description="Actions performed in the app will appear here." />
          ) : (
            <ActivityTimeline
              entries={filtered.map((e) => ({
                id: e.id,
                timestamp: e.timestamp,
                title: e.action.split(/[._]/).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                description: `${e.entityType}: ${e.entityId.slice(0, 8)}…`,
                actor: e.actorName,
                tone: e.action.includes('delete') ? 'danger' : e.action.includes('create') ? 'success' : 'default'
              }))}
              maxHeight={600}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
