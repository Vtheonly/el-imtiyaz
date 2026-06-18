/**
 * Notifications — center for in-app and email messages.
 */

import { useEffect, useState } from 'react';
import {
  Bell, Mail, MessageSquare, Check, CheckCheck, Trash2,
  AlertCircle, Info, AlertTriangle
} from 'lucide-react';
import { Card, Button, Badge, EmptyState, StatBlock } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { ActivityTimeline } from '../components/timeline/ActivityTimeline';
import { formatDateTime, relativeTime } from '@shared/currency';

interface NotificationRow {
  id: string;
  recipientType: string;
  channel: string;
  category: string;
  priority: string;
  subject: string;
  body?: string;
  status: string;
  readAt?: string;
  createdAt: string;
}

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  urgent: <AlertCircle size={14} style={{ color: 'var(--color-danger)' }} />,
  high: <AlertTriangle size={14} style={{ color: 'var(--color-warm-accent)' }} />,
  normal: <Info size={14} style={{ color: 'var(--color-primary-blue)' }} />,
  low: <Info size={14} style={{ color: 'var(--color-text-tertiary)' }} />
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  in_app: <Bell size={14} />,
  email: <Mail size={14} />
};

export function Notifications() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, count] = await Promise.all([
        window.elImtiyaz.notifications.list({ limit: 100 }),
        window.elImtiyaz.notifications.unreadCount()
      ]);
      setNotifications((rows as any[]).map((n) => ({
        id: n.id.value,
        recipientType: n.recipientType,
        channel: n.channel,
        category: n.category,
        priority: n.priority,
        subject: n.subject,
        body: n.body,
        status: n.status,
        readAt: n.readAt,
        createdAt: n.createdAt
      })));
      setUnreadCount(count as number);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.readAt;
    if (filter === 'urgent') return n.priority === 'urgent' || n.priority === 'high';
    return true;
  });

  const markRead = async (id: string) => {
    await window.elImtiyaz.notifications.markRead(id);
    load();
  };

  const markAllRead = async () => {
    await window.elImtiyaz.notifications.markAllRead();
    load();
  };

  const remove = async (id: string) => {
    await window.elImtiyaz.notifications.delete(id);
    load();
  };

  return (
    <div className="el-page">
      <PageHeader
        title="Notification Center"
        subtitle={`${unreadCount} unread of ${notifications.length} total`}
        actions={
          <>
            <Button variant="ghost" icon={<CheckCheck size={14} />} onClick={markAllRead} disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock label="Total" value={notifications.length} format="number" icon={<Bell size={18} />} />
        <StatBlock label="Unread" value={unreadCount} format="number" icon={<Mail size={18} />} />
        <StatBlock
          label="High Priority"
          value={notifications.filter((n) => n.priority === 'high' || n.priority === 'urgent').length}
          format="number"
          icon={<AlertCircle size={18} />}
        />
        <StatBlock
          label="Email Channel"
          value={notifications.filter((n) => n.channel === 'email').length}
          format="number"
          icon={<Mail size={18} />}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2" style={{ marginBottom: 'var(--space-4)' }}>
        {(['all', 'unread', 'urgent'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'primary' : 'ghost'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'High Priority'}
          </Button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: 'var(--space-8)' }}>
            <div className="el-spinner el-spinner--lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Bell size={24} />} title="No notifications" description="You're all caught up." />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((n) => {
              const isUnread = !n.readAt;
              return (
                <div
                  key={n.id}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: isUnread ? 'var(--color-primary-tint-05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isUnread ? 'var(--border-primary)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast) var(--ease-out)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-primary-tint-08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isUnread ? 'var(--color-primary-tint-05)' : 'rgba(255,255,255,0.02)';
                  }}
                  onClick={() => !n.readAt && markRead(n.id)}
                >
                  <div style={{ marginTop: 2 }}>
                    {PRIORITY_ICONS[n.priority]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: isUnread ? 'var(--weight-semibold)' : 'var(--weight-medium)' }}>
                        {n.subject}
                      </span>
                      {isUnread && (
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--color-primary-blue)',
                          boxShadow: '0 0 6px var(--color-primary-blue)'
                        }} />
                      )}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                        {n.body}
                      </div>
                    )}
                    <div className="flex items-center gap-3" style={{ marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                      <span className="flex items-center gap-1">
                        {CHANNEL_ICONS[n.channel]}
                        {n.channel.replace('_', ' ')}
                      </span>
                      <span>•</span>
                      <Badge tone="neutral">{n.category}</Badge>
                      <span>•</span>
                      <span>{relativeTime(n.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {!n.readAt && (
                      <Button size="sm" variant="ghost" icon={<Check size={12} />} onClick={() => markRead(n.id)} title="Mark read" />
                    )}
                    <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => remove(n.id)} title="Delete" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
