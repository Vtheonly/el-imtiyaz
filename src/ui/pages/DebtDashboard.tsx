/**
 * Debt Dashboard — visualises outstanding debt, largest debtors, overdue payments.
 */

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingDown, Users, Clock } from 'lucide-react';
import { Card, StatBlock, Badge, EmptyState } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { formatDZD, formatDate } from '@shared/currency';

export function DebtDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [debtors, setDebtors] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, d, o] = await Promise.all([
          window.elImtiyaz.debt.summary(),
          window.elImtiyaz.debt.students({ limit: 100 }),
          window.elImtiyaz.debt.overdue()
        ]);
        setSummary(s);
        setDebtors(d as any[]);
        setOverdue(o as any[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="el-page">
        <PageHeader title="Debt Dashboard" subtitle="Loading…" />
        <div className="flex items-center justify-center" style={{ padding: 'var(--space-12)' }}>
          <div className="el-spinner el-spinner--lg" />
        </div>
      </div>
    );
  }

  const debtorColumns: Column<any>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="el-avatar" style={{ width: 28, height: 28, fontSize: 'var(--text-xs)' }}>
            {row.student.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div style={{ fontWeight: 'var(--weight-medium)' }}>{row.student.fullName}</div>
            <div className="text-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {row.student.studentCode}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'totalInvoiced',
      header: 'Invoiced',
      width: 140,
      align: 'right',
      render: (row) => formatDZD(row.totalInvoiced)
    },
    {
      key: 'totalPaid',
      header: 'Paid',
      width: 140,
      align: 'right',
      render: (row) => <span style={{ color: 'var(--color-success)' }}>{formatDZD(row.totalPaid)}</span>
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      width: 140,
      align: 'right',
      render: (row) => <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-danger)' }}>{formatDZD(row.outstanding)}</span>
    },
    {
      key: 'overdueAmount',
      header: 'Overdue',
      width: 140,
      align: 'right',
      render: (row) => row.overdueAmount > 0
        ? <Badge tone="danger">{formatDZD(row.overdueAmount)}</Badge>
        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
    }
  ];

  const overdueColumns: Column<any>[] = [
    {
      key: 'studentName',
      header: 'Student',
      render: (row) => row.studentName
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 140,
      align: 'right',
      render: (row) => <span style={{ color: 'var(--color-danger)', fontWeight: 'var(--weight-semibold)' }}>{formatDZD(row.amount)}</span>
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      width: 140,
      render: (row) => formatDate(row.dueDate)
    },
    {
      key: 'daysOverdue',
      header: 'Days Overdue',
      width: 130,
      align: 'right',
      render: (row) => <Badge tone={row.daysOverdue > 30 ? 'danger' : 'warning'}>{row.daysOverdue} days</Badge>
    }
  ];

  return (
    <div className="el-page">
      <PageHeader title="Debt Dashboard" subtitle="Outstanding balances & overdue payments" />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock
          label="Total Outstanding"
          value={summary?.totalOutstanding ?? 0}
          format="currency"
          icon={<AlertCircle size={18} />}
        />
        <StatBlock
          label="Students in Debt"
          value={summary?.studentsWithDebtCount ?? 0}
          format="number"
          icon={<Users size={18} />}
        />
        <StatBlock
          label="Overdue Payments"
          value={summary?.overduePaymentsCount ?? 0}
          format="number"
          icon={<Clock size={18} />}
        />
        <StatBlock
          label="Collected (Month)"
          value={summary?.totalCollectedThisMonth ?? 0}
          format="currency"
          delta={{ value: -3.1, label: 'vs last month' }}
          icon={<TrendingDown size={18} />}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Card title="Students with Outstanding Debt">
          <DataGrid
            columns={debtorColumns}
            data={debtors}
            rowKey={(row) => row.student.id.value}
            emptyState={<EmptyState title="No debtors" description="All students are up to date." />}
          />
        </Card>
      </div>

      <Card title="Overdue Payments" subtitle="Invoices past their due date">
        <DataGrid
          columns={overdueColumns}
          data={overdue}
          rowKey={(row) => row.invoiceId}
          emptyState={<EmptyState title="No overdue payments" description="All invoices are within their terms." />}
        />
      </Card>
    </div>
  );
}
