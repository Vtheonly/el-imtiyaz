/**
 * Receipts — list & regenerate receipts.
 */

import { useEffect, useState } from 'react';
import { Receipt as ReceiptIcon, Download, Eye } from 'lucide-react';
import { Card, Button, Badge, EmptyState } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { formatDZD, formatDateTime } from '@shared/currency';

interface ReceiptRow {
  id: string;
  receiptNumber: string;
  paymentId: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  generatedAt: string;
  voidedAt?: string;
}

export function Receipts() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rows = await window.elImtiyaz.receipts.list({ pageSize: 200 });
        setReceipts((rows as any[]).map((r) => ({
          id: r.id.value,
          receiptNumber: r.receiptNumber,
          paymentId: r.paymentId,
          studentId: r.studentId,
          amount: r.amount,
          paymentDate: r.paymentDate,
          generatedAt: r.generatedAt,
          voidedAt: r.voidedAt
        })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns: Column<ReceiptRow>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt #',
      sortable: true,
      render: (r) => (
        <span className="flex items-center gap-2">
          <ReceiptIcon size={14} style={{ color: 'var(--color-primary-blue)' }} />
          <span className="text-mono" style={{ color: 'var(--color-primary-blue)' }}>{r.receiptNumber}</span>
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 140,
      align: 'right',
      render: (r) => <strong>{formatDZD(r.amount)}</strong>
    },
    {
      key: 'paymentDate',
      header: 'Payment Date',
      width: 180,
      render: (r) => formatDateTime(r.paymentDate)
    },
    {
      key: 'generatedAt',
      header: 'Generated',
      width: 180,
      render: (r) => formatDateTime(r.generatedAt)
    },
    {
      key: 'voidedAt',
      header: 'Status',
      width: 130,
      render: (r) => r.voidedAt
        ? <Badge tone="danger">Voided</Badge>
        : <Badge tone="success">Valid</Badge>
    },
    {
      key: 'actions',
      header: '',
      width: 100,
      render: () => (
        <div className="flex gap-1">
          <button className="el-btn el-btn--ghost el-btn--icon el-btn--sm" title="View PDF"><Eye size={14} /></button>
          <button className="el-btn el-btn--ghost el-btn--icon el-btn--sm" title="Download"><Download size={14} /></button>
        </div>
      )
    }
  ];

  return (
    <div className="el-page">
      <PageHeader title="Receipts" subtitle={`${receipts.length} receipts generated`} />
      <Card>
        <DataGrid
          columns={columns}
          data={receipts}
          rowKey={(r) => r.id}
          loading={loading}
          emptyState={<EmptyState icon={<ReceiptIcon size={24} />} title="No receipts" description="Receipts are auto-generated when payments are recorded." />}
        />
      </Card>
    </div>
  );
}
