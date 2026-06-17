/**
 * Scholarships — manage granted scholarships & sibling discounts.
 */

import { useEffect, useState } from 'react';
import { Plus, Award, Percent, Ban } from 'lucide-react';
import { Card, Button, Badge, EmptyState, StatBlock, Modal } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { formatDate } from '@shared/currency';
import { DISCOUNT_TYPE_LABELS, DiscountType } from '@core/enums';

interface ScholarshipRow {
  id: string;
  studentId: string;
  type: DiscountType;
  percentage: number;
  reason: string;
  grantedAt: string;
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
}

export function Scholarships() {
  const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState<DiscountType>(DiscountType.SCHOLARSHIP_PARTIAL);
  const [percentage, setPercentage] = useState('50');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.scholarships.list();
      setScholarships((rows as any[]).map((s) => ({
        id: s.id.value,
        studentId: s.studentId,
        type: s.type,
        percentage: s.percentage,
        reason: s.reason,
        grantedAt: s.grantedAt,
        validFrom: s.validFrom,
        validUntil: s.validUntil,
        isActive: s.isActive
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!studentId.trim() || !reason.trim()) return;
    await window.elImtiyaz.scholarships.create({
      studentId,
      type,
      percentage: parseFloat(percentage),
      reason,
      grantedByEmployeeId: 'system',
      validFrom: new Date().toISOString().slice(0, 10)
    });
    setShowModal(false);
    setStudentId(''); setType(DiscountType.SCHOLARSHIP_PARTIAL); setPercentage('50'); setReason('');
    load();
  };

  const revoke = async (s: ScholarshipRow) => {
    const r = prompt(`Revoke scholarship for student ${s.studentId.slice(0, 8)}…?\nReason:`);
    if (!r) return;
    await window.elImtiyaz.scholarships.revoke(s.id, r);
    load();
  };

  const columns: Column<ScholarshipRow>[] = [
    {
      key: 'studentId',
      header: 'Student',
      render: (r) => <span className="text-mono" style={{ color: 'var(--color-primary-blue)' }}>{r.studentId.slice(0, 12)}…</span>
    },
    {
      key: 'type',
      header: 'Type',
      width: 200,
      render: (r) => <Badge>{DISCOUNT_TYPE_LABELS[r.type]}</Badge>
    },
    {
      key: 'percentage',
      header: 'Discount',
      width: 120,
      align: 'right',
      sortable: true,
      render: (r) => (
        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-warm-accent)' }}>
          {r.percentage}%
        </span>
      )
    },
    { key: 'reason', header: 'Reason', render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.reason}</span> },
    { key: 'grantedAt', header: 'Granted', width: 130, render: (r) => formatDate(r.grantedAt) },
    { key: 'validFrom', header: 'Valid From', width: 130, render: (r) => formatDate(r.validFrom) },
    {
      key: 'isActive',
      header: 'Status',
      width: 110,
      render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Revoked'}</Badge>
    },
    {
      key: 'actions',
      header: '',
      width: 100,
      render: (r) => r.isActive ? (
        <Button size="sm" variant="ghost" icon={<Ban size={12} />} onClick={() => revoke(r)} title="Revoke" />
      ) : null
    }
  ];

  const activeCount = scholarships.filter((s) => s.isActive).length;
  const fullScholarships = scholarships.filter((s) => s.percentage === 100 && s.isActive).length;
  const avgPercentage = scholarships.length > 0
    ? Math.round(scholarships.reduce((s, x) => s + x.percentage, 0) / scholarships.length)
    : 0;

  return (
    <div className="el-page">
      <PageHeader
        title="Scholarships"
        subtitle={`${scholarships.length} scholarships granted`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
            Grant Scholarship
          </Button>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock label="Active" value={activeCount} format="number" icon={<Award size={18} />} />
        <StatBlock label="Full (100%)" value={fullScholarships} format="number" icon={<Award size={18} />} />
        <StatBlock label="Avg Discount" value={avgPercentage} format="plain" icon={<Percent size={18} />} />
        <StatBlock label="Total Granted" value={scholarships.length} format="number" icon={<Award size={18} />} />
      </div>

      <Card>
        <DataGrid
          columns={columns}
          data={scholarships}
          rowKey={(r) => r.id}
          loading={loading}
          emptyState={<EmptyState icon={<Award size={24} />} title="No scholarships" description="Grant scholarships to students in need or for merit." />}
        />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Grant Scholarship"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!studentId.trim() || !reason.trim()}>Grant</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Student ID</label>
            <input className="el-input" style={{ width: '100%' }} placeholder="Student UUID" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Type</label>
              <div className="el-select" style={{ width: '100%' }}>
                <select value={type} onChange={(e) => setType(e.target.value as DiscountType)} style={{ width: '100%' }}>
                  {Object.entries(DISCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Percentage</label>
              <input
                type="number"
                min="0"
                max="100"
                className="el-input"
                style={{ width: '100%' }}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Reason</label>
            <textarea
              className="el-input"
              style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
              placeholder="Why is this scholarship being granted?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
