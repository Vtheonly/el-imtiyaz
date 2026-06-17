/**
 * AcademicYears — manage school calendar.
 */

import { useEffect, useState } from 'react';
import { Plus, BookOpen, Check } from 'lucide-react';
import { Card, Button, Badge, EmptyState, Modal } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { formatDate } from '@shared/currency';
import { ACADEMIC_TERM_LABELS } from '@core/enums';

interface YearRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  termType: string;
  isActive: boolean;
}

export function AcademicYears() {
  const [years, setYears] = useState<YearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.academicYears.list();
      setYears((rows as any[]).map((y) => ({
        id: y.id.value,
        name: y.name,
        startDate: y.startDate,
        endDate: y.endDate,
        termType: y.termType,
        isActive: y.isActive
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const columns: Column<YearRow>[] = [
    {
      key: 'name',
      header: 'Academic Year',
      sortable: true,
      render: (r) => <strong style={{ fontSize: 'var(--text-md)' }}>{r.name}</strong>
    },
    {
      key: 'termType',
      header: 'Term Structure',
      width: 160,
      render: (r) => <Badge>{ACADEMIC_TERM_LABELS[r.termType as keyof typeof ACADEMIC_TERM_LABELS]}</Badge>
    },
    {
      key: 'startDate',
      header: 'Start',
      width: 140,
      render: (r) => formatDate(r.startDate)
    },
    {
      key: 'endDate',
      header: 'End',
      width: 140,
      render: (r) => formatDate(r.endDate)
    },
    {
      key: 'isActive',
      header: 'Status',
      width: 130,
      render: (r) => r.isActive
        ? <Badge tone="success" dot>Active</Badge>
        : <Badge tone="neutral">Inactive</Badge>
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Academic Years"
        subtitle={`${years.length} years configured`}
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)}>New Year</Button>}
      />
      <Card>
        <DataGrid
          columns={columns}
          data={years}
          rowKey={(r) => r.id}
          loading={loading}
          emptyState={<EmptyState icon={<BookOpen size={24} />} title="No academic years" description="Create an academic year to start enrolling students." />}
        />
      </Card>

      <NewYearModal open={showModal} onClose={() => setShowModal(false)} onSaved={load} />
    </div>
  );
}

function NewYearModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [termType, setTermType] = useState('semester');

  const submit = async () => {
    await window.elImtiyaz.academicYears.create({ name, startDate, endDate, termType });
    onSaved();
    onClose();
    setName(''); setStartDate(''); setEndDate(''); setTermType('semester');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Academic Year"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!name || !startDate || !endDate}>Create</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Name</label>
          <input className="el-input" style={{ width: '100%' }} placeholder="e.g. 2026-2027" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Start Date</label>
            <input type="date" className="el-input" style={{ width: '100%' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>End Date</label>
            <input type="date" className="el-input" style={{ width: '100%' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Term Structure</label>
          <div className="el-select" style={{ width: '100%' }}>
            <select value={termType} onChange={(e) => setTermType(e.target.value)} style={{ width: '100%' }}>
              {Object.entries(ACADEMIC_TERM_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
