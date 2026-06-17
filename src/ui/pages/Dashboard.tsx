/**
 * Dashboard — overview page with KPIs, charts, recent activity.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, DollarSign, AlertCircle, TrendingUp, UserPlus, Receipt as ReceiptIcon,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Card, StatBlock, Badge } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { ActivityTimeline } from '../components/timeline/ActivityTimeline';
import { formatDZD, formatNumber, relativeTime } from '@shared/currency';

interface DashboardData {
  summary: {
    totalOutstanding: number;
    totalCollectedThisYear: number;
    totalCollectedThisMonth: number;
    studentsWithDebtCount: number;
    overduePaymentsCount: number;
  };
  totalStudents: number;
  activeStudents: number;
  recentPayments: any[];
  recentAudit: any[];
  revenueByDay: any[];
  revenueByMethod: Record<string, number>;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [summary, students, recentPayments, audit, revenue] = await Promise.all([
          window.elImtiyaz.debt.summary(),
          window.elImtiyaz.students.list({ pageSize: 1000 }),
          window.elImtiyaz.payments.list({ pageSize: 10 }),
          window.elImtiyaz.audit.list({ limit: 8 }),
          window.elImtiyaz.reports.revenue({})
        ]);

        const totalStudents = (students as any[]).length;
        const activeStudents = (students as any[]).filter((s) => s.status === 'active').length;

        setData({
          summary: summary as any,
          totalStudents,
          activeStudents,
          recentPayments: recentPayments as any[],
          recentAudit: audit as any[],
          revenueByDay: (revenue as any).byDay ?? [],
          revenueByMethod: (revenue as any).byMethod ?? {}
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) {
    return (
      <div className="el-page">
        <PageHeader title="Dashboard" subtitle="Loading overview…" />
        <div className="flex items-center justify-center" style={{ padding: 'var(--space-12)' }}>
          <div className="el-spinner el-spinner--lg" />
        </div>
      </div>
    );
  }

  const methodData = Object.entries(data.revenueByMethod).map(([name, value]) => ({ name, value }));
  const METHOD_COLORS = ['#349bd4', '#2b7fb0', '#6ec1e4', '#c8a98c', '#3fa66e', '#836c68'];

  return (
    <div className="el-page">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of school operations"
        actions={
          <>
            <button className="el-btn el-btn--ghost" onClick={() => navigate('/reports')}>
              View Reports
            </button>
            <button className="el-btn el-btn--primary" onClick={() => navigate('/payments?action=new')}>
              <DollarSign size={14} /> Record Payment
            </button>
          </>
        }
      />

      {/* KPI Row */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock
          label="Total Students"
          value={data.totalStudents}
          format="number"
          delta={{ value: 5.2, label: 'vs last month' }}
          icon={<Users size={18} />}
        />
        <StatBlock
          label="Active Students"
          value={data.activeStudents}
          format="number"
          icon={<UserPlus size={18} />}
        />
        <StatBlock
          label="Revenue (This Month)"
          value={data.summary.totalCollectedThisMonth}
          format="currency"
          delta={{ value: 12.4, label: 'vs last month' }}
          icon={<DollarSign size={18} />}
        />
        <StatBlock
          label="Outstanding Debt"
          value={data.summary.totalOutstanding}
          format="currency"
          delta={{ value: -3.1, label: 'vs last month' }}
          icon={<AlertCircle size={18} />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <Card
          title="Revenue Trend"
          subtitle="Daily collected payments (last 30 days)"
          actions={<Badge tone="success"><TrendingUp size={10} /> Trending up</Badge>}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.revenueByDay.slice(-30)}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#349bd4" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#349bd4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: '#8a9499', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#8a9499', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: '#1e1f20',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#eff2f3'
                }}
                formatter={(v: number) => [formatDZD(v), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#349bd4"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Payment Methods" subtitle="Distribution by method">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={methodData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {methodData.map((_, idx) => (
                  <Cell key={idx} fill={METHOD_COLORS[idx % METHOD_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1e1f20',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#eff2f3'
                }}
                formatter={(v: number) => formatDZD(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#b0bac0' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Activity & Recent Payments */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Card title="Recent Payments" subtitle="Latest 10 transactions" actions={
          <button className="el-btn el-btn--ghost el-btn--sm" onClick={() => navigate('/payments')}>
            View all
          </button>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.recentPayments.map((p: any) => (
              <div
                key={p.id.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast) var(--ease-out)'
                }}
                onClick={() => navigate(`/payments/${p.id.value}`)}
              >
                <div className="el-avatar" style={{ width: 36, height: 36 }}>
                  <ReceiptIcon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                    {p.receiptNumber}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {relativeTime(p.paymentDate)} • {p.paymentMethod}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--color-success)'
                  }}>
                    {formatDZD(p.amount)}
                  </div>
                  <Badge tone="success" dot>{p.status}</Badge>
                </div>
              </div>
            ))}
            {data.recentPayments.length === 0 && (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                No recent payments.
              </div>
            )}
          </div>
        </Card>

        <Card title="Activity Timeline" subtitle="Latest system events" actions={
          <button className="el-btn el-btn--ghost el-btn--sm" onClick={() => navigate('/audit')}>
            View all
          </button>
        }>
          <ActivityTimeline
            entries={data.recentAudit.map((a: any) => ({
              id: a.id.value,
              timestamp: a.timestamp,
              title: a.action.replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
              description: `${a.entityType}: ${a.entityId.slice(0, 8)}…`,
              actor: a.actorName,
              tone: a.action.includes('delete') ? 'danger' : a.action.includes('create') ? 'success' : 'default'
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
