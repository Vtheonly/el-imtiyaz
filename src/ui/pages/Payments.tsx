/**
 * Payments — list & record payment page.
 */

import { useEffect, useState } from 'react';
import { Plus, Search, Download } from 'lucide-react';
import { Card, Badge, Button, EmptyState, StatBlock } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { Modal } from '../components/common/Modal';
import { formatDZD, formatDateTime } from '@shared/currency';
import {
  PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS, PaymentStatus,
  PAYMENT_METHOD_LABELS
} from '@core/enums';

interface PaymentRow {
  id: string;
  receiptNumber: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  status: PaymentStatus;
}

export function Payments() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [summary, setSummary] = useState({
    today: 0, thisMonth: 0, count: 0, outstanding: 0
  });

  const loadPayments = async () => {
    setLoading(true);
    try {
      const [rows, debt] = await Promise.all([
        window.elImtiyaz.payments.list({ pageSize: 200 }),
        window.elImtiyaz.debt.summary()
      ]);
      const data = rows as any[];
      setPayments(data.map((p) => ({
        id: p.id.value,
        receiptNumber: p.receiptNumber,
        studentId: p.studentId,
        amount: p.amount,
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        status: p.status
      })));

      const today = new Date().toISOString().slice(0, 10);
      const thisMonth = new Date().toISOString().slice(0, 7);
      setSummary({
        today: data.filter((p) => p.paymentDate.slice(0, 10) === today).reduce((s, p) => s + p.amount, 0),
        thisMonth: data.filter((p) => p.paymentDate.slice(0, 7) === thisMonth).reduce((s, p) => s + p.amount, 0),
        count: data.length,
        outstanding: (debt as any).totalOutstanding
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const columns: Column<PaymentRow>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt',
      width: 140,
      sortable: true,
      render: (row) => (
        <span className="text-mono" style={{ color: 'var(--color-primary-blue)' }}>
          {row.receiptNumber}
        </span>
      )
    },
    {
      key: 'studentId',
      header: 'Student',
      render: (row) => (
        <span style={{ color: 'var(--color-text-tertiary)' }}>
          {row.studentId.slice(0, 8)}…
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 140,
      align: 'right',
      sortable: true,
      render: (row) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-success)' }}>
          {formatDZD(row.amount)}
        </span>
      )
    },
    {
      key: 'paymentMethod',
      header: 'Method',
      width: 140,
      render: (row) => PAYMENT_METHOD_LABELS[row.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? row.paymentMethod
    },
    {
      key: 'paymentDate',
      header: 'Date',
      width: 180,
      sortable: true,
      render: (row) => formatDateTime(row.paymentDate)
    },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      render: (row) => (
        <Badge color={PAYMENT_STATUS_COLORS[row.status]}>
          {PAYMENT_STATUS_LABELS[row.status]}
        </Badge>
      )
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Payments"
        subtitle={`${payments.length} payments recorded`}
        actions={
          <>
            <Button variant="ghost" icon={<Download size={14} />} onClick={() => window.elImtiyaz.reports.export('revenue')}>
              Export
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNewModal(true)}>
              Record Payment
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock label="Today's Revenue" value={summary.today} format="currency" />
        <StatBlock label="This Month" value={summary.thisMonth} format="currency" />
        <StatBlock label="Total Payments" value={summary.count} format="number" />
        <StatBlock label="Outstanding Debt" value={summary.outstanding} format="currency" />
      </div>

      <Card>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="el-search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              placeholder="Search by receipt number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <DataGrid
          columns={columns}
          data={payments.filter((p) =>
            !search || p.receiptNumber.toLowerCase().includes(search.toLowerCase())
          )}
          rowKey={(row) => row.id}
          loading={loading}
          sortField="paymentDate"
          sortDir="desc"
          emptyState={
            <EmptyState
              icon={<Search size={24} />}
              title="No payments found"
              description="Record your first payment to see it here."
            />
          }
        />
      </Card>

      <NewPaymentModal open={showNewModal} onClose={() => setShowNewModal(false)} onSaved={loadPayments} />
    </div>
  );
}

function NewPaymentModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await window.elImtiyaz.payments.create({
        studentId,
        amount: parseFloat(amount),
        paymentMethod: method,
        reference: reference || undefined,
        notes: notes || undefined
      });
      onSaved();
      onClose();
      // Reset form
      setStudentId(''); setAmount(''); setMethod('cash'); setReference(''); setNotes('');
    } catch (err) {
      alert(`Failed to record payment: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !studentId || !amount}>
            {saving ? 'Saving…' : 'Record Payment'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Student ID</label>
          <input
            className="el-input"
            style={{ width: '100%' }}
            placeholder="e.g. abcd-1234-…"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Amount (DZD)</label>
            <input
              type="number"
              className="el-input"
              style={{ width: '100%' }}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Method</label>
            <div className="el-select" style={{ width: '100%' }}>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{ width: '100%' }}
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Reference (optional)</label>
          <input
            className="el-input"
            style={{ width: '100%' }}
            placeholder="Cheque #, transfer ID, etc."
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea
            className="el-input"
            style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
