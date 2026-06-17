/**
 * Reports — financial & student reports with export options.
 */

import { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, FileText, Download, DollarSign, Users, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import { Card, Button, StatBlock, Badge } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { formatDZD } from '@shared/currency';

export function Reports() {
  const [revenue, setRevenue] = useState<any>(null);
  const [outstanding, setOutstanding] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rev, out] = await Promise.all([
          window.elImtiyaz.reports.revenue({}),
          window.elImtiyaz.reports.outstanding()
        ]);
        setRevenue(rev);
        setOutstanding(out);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="el-page">
        <PageHeader title="Reports" subtitle="Loading…" />
        <div className="flex items-center justify-center" style={{ padding: 'var(--space-12)' }}>
          <div className="el-spinner el-spinner--lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="el-page">
      <PageHeader
        title="Reports"
        subtitle="Financial insights & student analytics"
        actions={
          <>
            <Button variant="ghost" icon={<Download size={14} />} onClick={() => window.elImtiyaz.reports.export('revenue')}>
              Export Revenue
            </Button>
            <Button variant="ghost" icon={<Download size={14} />} onClick={() => window.elImtiyaz.reports.export('outstanding')}>
              Export Outstanding
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock
          label="Total Revenue (Range)"
          value={revenue?.total ?? 0}
          format="currency"
          icon={<DollarSign size={18} />}
        />
        <StatBlock
          label="Total Outstanding"
          value={outstanding?.totalOutstanding ?? 0}
          format="currency"
          icon={<AlertCircle size={18} />}
        />
        <StatBlock
          label="Classes with Debt"
          value={outstanding?.byClass?.length ?? 0}
          format="number"
          icon={<Users size={18} />}
        />
        <StatBlock
          label="Days in Range"
          value={revenue?.byDay?.length ?? 0}
          format="number"
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* Revenue Chart */}
      <Card
        title="Revenue by Day"
        subtitle="Collected payments over time"
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenue?.byDay ?? []}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#349bd4" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#349bd4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: '#8a9499', fontSize: 11 }} />
            <YAxis tick={{ fill: '#8a9499', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#1e1f20', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#eff2f3' }}
              formatter={(v: number) => formatDZD(v)}
            />
            <Area type="monotone" dataKey="total" stroke="#349bd4" strokeWidth={2} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Outstanding by Class */}
      <Card title="Outstanding by Class" subtitle="Debt distribution across classes">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={outstanding?.byClass ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="className" tick={{ fill: '#8a9499', fontSize: 11 }} />
            <YAxis tick={{ fill: '#8a9499', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#1e1f20', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#eff2f3' }}
              formatter={(v: number) => formatDZD(v)}
            />
            <Bar dataKey="outstanding" fill="#2b7fb0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
