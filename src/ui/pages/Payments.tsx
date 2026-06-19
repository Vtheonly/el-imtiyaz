/**
 * Payments — list & record payment page.
 *
 * Extended (2026-06) with a "Ledger View" toggle that switches the table
 * to the Excel-style master ledger (ETAT 20262027 equivalent), showing
 * the three Excel-computed columns: DEVIS ANNUEL (L), TOTAL VERSEMENTS (P),
 * and TOTAL*CREANCE (Q). Also includes a "Recompute" button that re-runs
 * every active formula rule across the ledger — equivalent to pressing
 * F9 in Excel.
 *
 * No new tabs are created; the new controls live at the top of the
 * existing Payments page header.
 */

import { useEffect, useState } from 'react';
import { Plus, Search, Download, RefreshCw, BookOpen, FileSpreadsheet, Calculator } from 'lucide-react';
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

interface LedgerRow {
  id: string;
  studentName: string;
  classCode?: string;
  level?: string;
  remise: number;
  devisAnnuel: number;
  totalVersements: number;
  totalCreance: number;
  grandTotal: number;
  sourceRow?: number;
}

type ViewMode = 'payments' | 'ledger';

export function Payments() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('payments');
  const [recomputing, setRecomputing] = useState(false);
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

  const loadLedger = async () => {
    setLoading(true);
    try {
      const rows = (await window.elImtiyaz.ledger.list({ pageSize: 1000 })) as any[];
      setLedger(rows.map((e) => ({
        id: e.id.value,
        studentName: e.studentName,
        classCode: e.classCode,
        level: e.level,
        remise: e.remise,
        devisAnnuel: e.devisAnnuel,
        totalVersements: e.totalVersements,
        totalCreance: e.totalCreance,
        grandTotal: e.grandTotal,
        sourceRow: e.sourceRow,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'payments') {
      loadPayments();
    } else {
      loadLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const result = await window.elImtiyaz.ledger.recompute();
      const r = result as any;
      alert(`Recomputed ${r.recomputed} ledger entries (${r.skipped} skipped, ${r.errors?.length ?? 0} errors).`);
      if (viewMode === 'ledger') await loadLedger();
    } catch (err) {
      alert(`Recompute failed: ${(err as Error).message}`);
    } finally {
      setRecomputing(false);
    }
  };

  const paymentColumns: Column<PaymentRow>[] = [
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

  // ── Excel-style ledger columns (mirrors ETAT 20262027 sheet) ──
  const ledgerColumns: Column<LedgerRow>[] = [
    {
      key: 'sourceRow',
      header: 'Excel Row',
      width: 90,
      sortable: true,
      render: (row) => row.sourceRow ? <span className="text-mono" style={{ color: 'var(--color-text-tertiary)' }}>{row.sourceRow}</span> : '—',
    },
    {
      key: 'studentName',
      header: 'NOM (col F)',
      width: 200,
      sortable: true,
      render: (row) => <span style={{ fontWeight: 'var(--weight-medium)' }}>{row.studentName}</span>,
    },
    {
      key: 'level',
      header: 'niveau (col G)',
      width: 90,
      render: (row) => row.level ? <Badge color="info">{row.level}</Badge> : '—',
    },
    {
      key: 'classCode',
      header: 'CLASSE (col H)',
      width: 110,
      render: (row) => row.classCode ?? '—',
    },
    {
      key: 'remise',
      header: 'REMISE (col J)',
      width: 130,
      align: 'right',
      sortable: true,
      render: (row) => row.remise > 0 ? <span style={{ color: 'var(--color-warning)' }}>-{formatDZD(row.remise)}</span> : '—',
    },
    {
      key: 'devisAnnuel',
      header: 'DEVIS ANNUEL (col L)',
      width: 180,
      align: 'right',
      sortable: true,
      render: (row) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatDZD(row.devisAnnuel)}</span>,
    },
    {
      key: 'totalVersements',
      header: 'TOTAL VERSEMENTS (col P)',
      width: 200,
      align: 'right',
      sortable: true,
      render: (row) => <span style={{ color: 'var(--color-success)' }}>{formatDZD(row.totalVersements)}</span>,
    },
    {
      key: 'totalCreance',
      header: 'TOTAL*CREANCE (col Q)',
      width: 190,
      align: 'right',
      sortable: true,
      render: (row) => (
        <span style={{
          fontWeight: 'var(--weight-semibold)',
          color: row.totalCreance > 0 ? 'var(--color-danger)' : 'var(--color-text-tertiary)'
        }}>
          {formatDZD(row.totalCreance)}
        </span>
      ),
    },
    {
      key: 'grandTotal',
      header: 'TOTAL (col AL)',
      width: 150,
      align: 'right',
      sortable: true,
      render: (row) => <span style={{ color: 'var(--color-text-secondary)' }}>{formatDZD(row.grandTotal)}</span>,
    },
  ];

  // Compute Excel-style aggregate KPIs when in ledger view.
  const ledgerKpis = ledger.reduce(
    (acc, r) => ({
      devisAnnuel: acc.devisAnnuel + r.devisAnnuel,
      versements: acc.versements + r.totalVersements,
      creance: acc.creance + r.totalCreance,
      count: acc.count + 1,
    }),
    { devisAnnuel: 0, versements: 0, creance: 0, count: 0 }
  );

  return (
    <div className="el-page">
      <PageHeader
        title="Payments"
        subtitle={viewMode === 'payments'
          ? `${payments.length} payments recorded`
          : `${ledger.length} ledger entries (Excel ETAT view)`}
        actions={
          <>
            {/* View-mode toggle (no new tabs — switch in place) */}
            <div className="el-segmented" role="tablist" aria-label="View mode" style={{
              display: 'inline-flex',
              background: 'var(--color-surface-2, #2a2b2c)',
              borderRadius: 6,
              padding: 2,
              gap: 2,
            }}>
              <button
                role="tab"
                aria-selected={viewMode === 'payments'}
                onClick={() => setViewMode('payments')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  background: viewMode === 'payments' ? 'var(--color-primary-blue)' : 'transparent',
                  color: viewMode === 'payments' ? '#fff' : 'var(--color-text-secondary)',
                  borderRadius: 4,
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FileSpreadsheet size={13} /> Payments
              </button>
              <button
                role="tab"
                aria-selected={viewMode === 'ledger'}
                onClick={() => setViewMode('ledger')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  background: viewMode === 'ledger' ? 'var(--color-primary-blue)' : 'transparent',
                  color: viewMode === 'ledger' ? '#fff' : 'var(--color-text-secondary)',
                  borderRadius: 4,
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <BookOpen size={13} /> Ledger (Excel)
              </button>
            </div>

            {viewMode === 'ledger' && (
              <Button
                variant="ghost"
                icon={<RefreshCw size={14} className={recomputing ? 'el-spin' : ''} />}
                onClick={handleRecompute}
                disabled={recomputing}
              >
                {recomputing ? 'Recomputing…' : 'Recompute (F9)'}
              </Button>
            )}

            <Button variant="ghost" icon={<Download size={14} />} onClick={() => window.elImtiyaz.reports.export('revenue')}>
              Export
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNewModal(true)}>
              Record Payment
            </Button>
          </>
        }
      />

      {/* KPIs — switch by view */}
      {viewMode === 'payments' ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <StatBlock label="Today's Revenue" value={summary.today} format="currency" />
          <StatBlock label="This Month" value={summary.thisMonth} format="currency" />
          <StatBlock label="Total Payments" value={summary.count} format="number" />
          <StatBlock label="Outstanding Debt" value={summary.outstanding} format="currency" />
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <StatBlock label="Ledger Entries" value={ledgerKpis.count} format="number" />
          <StatBlock label="Σ DEVIS ANNUEL (col L)" value={ledgerKpis.devisAnnuel} format="currency" />
          <StatBlock label="Σ TOTAL VERSEMENTS (col P)" value={ledgerKpis.versements} format="currency" />
          <StatBlock label="Σ TOTAL*CREANCE (col Q)" value={ledgerKpis.creance} format="currency" />
        </div>
      )}

      <Card>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="el-search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              placeholder={viewMode === 'payments' ? 'Search by receipt number…' : 'Search by student name…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {viewMode === 'ledger' && (
            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
              <Calculator size={12} />
              <span>Excel columns L, P, Q are auto-computed via Formula Rules</span>
            </div>
          )}
        </div>

        {viewMode === 'payments' ? (
          <DataGrid
            columns={paymentColumns}
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
        ) : (
          <DataGrid
            columns={ledgerColumns}
            data={ledger.filter((r) =>
              !search || r.studentName.toLowerCase().includes(search.toLowerCase())
            )}
            rowKey={(row) => row.id}
            loading={loading}
            sortField="studentName"
            sortDir="asc"
            emptyState={
              <EmptyState
                icon={<BookOpen size={24} />}
                title="No ledger entries yet"
                description="Import a spreadsheet or create ledger entries via workflows to see the Excel-style master ledger here."
              />
            }
          />
        )}
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
