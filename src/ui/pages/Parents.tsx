/**
 * Parents — list & manage parent/guardian records.
 */

import { useEffect, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Card, Button, EmptyState, Badge } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { NewParentModal } from '../components/forms/NewParentModal';

interface ParentRow {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  relationship: string;
  studentIds: string[];
}

export function Parents() {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const loadParents = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.parents.list({ search: search || undefined, pageSize: 200 });
      setParents((rows as any[]).map((p) => ({
        id: p.id.value,
        fullName: p.fullName,
        phone: p.phone,
        email: p.email,
        relationship: p.relationship,
        studentIds: p.studentIds
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParents();
  }, [search]);

  const columns: Column<ParentRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="el-avatar" style={{ width: 28, height: 28, fontSize: 'var(--text-xs)' }}>
            {r.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <strong>{r.fullName}</strong>
        </div>
      )
    },
    { key: 'phone', header: 'Phone', width: 150, render: (r) => <span className="text-mono">{r.phone}</span> },
    { key: 'email', header: 'Email', width: 200, render: (r) => r.email ?? '—' },
    {
      key: 'relationship',
      header: 'Relationship',
      width: 130,
      render: (r) => <span style={{ textTransform: 'capitalize' }}>{r.relationship}</span>
    },
    {
      key: 'studentIds',
      header: 'Children',
      width: 100,
      align: 'center',
      render: (r) => <Badge tone="success">{r.studentIds.length}</Badge>
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Parents"
        subtitle={`${parents.length} parents`}
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNewModal(true)}>New Parent</Button>}
      />
      <Card>
        <div className="el-search-bar" style={{ maxWidth: 400, marginBottom: 'var(--space-4)' }}>
          <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <input placeholder="Search parents…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <DataGrid
          columns={columns}
          data={parents}
          rowKey={(r) => r.id}
          loading={loading}
          emptyState={<EmptyState icon={<Users size={24} />} title="No parents" description="Add parents to link them with students." />}
        />
      </Card>

      <NewParentModal open={showNewModal} onClose={() => setShowNewModal(false)} onSaved={loadParents} />
    </div>
  );
}