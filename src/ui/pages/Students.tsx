/**
 * Students — list page with DataGrid, filters, bulk actions.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Download, Search, Filter } from 'lucide-react';
import { Card, Badge, Button, EmptyState } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { NewStudentModal } from '../components/forms/NewStudentModal';
import { formatDZD, formatDate } from '@shared/currency';
import { STUDENT_STATUS_COLORS, STUDENT_STATUS_LABELS, StudentStatus } from '@core/enums';

interface StudentRow {
  id: string;
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  status: StudentStatus;
  registeredAt: string;
}

export function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewModal, setShowNewModal] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.students.list({
        search: search || undefined,
        status: statusFilter || undefined,
        pageSize: 200
      });
      setStudents((rows as any[]).map((s) => ({
        id: s.id.value,
        studentCode: s.studentCode,
        fullName: s.fullName,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        status: s.status,
        registeredAt: s.registeredAt
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadStudents, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const columns: Column<StudentRow>[] = [
    {
      key: 'studentCode',
      header: 'Code',
      width: 120,
      sortable: true,
      render: (row) => (
        <span className="text-mono" style={{ color: 'var(--color-primary-blue)', fontSize: 'var(--text-xs)' }}>
          {row.studentCode}
        </span>
      )
    },
    {
      key: 'fullName',
      header: 'Full Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="el-avatar" style={{ width: 28, height: 28, fontSize: 'var(--text-xs)' }}>
            {row.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <span style={{ fontWeight: 'var(--weight-medium)' }}>{row.fullName}</span>
        </div>
      )
    },
    {
      key: 'dateOfBirth',
      header: 'Date of Birth',
      width: 140,
      render: (row) => formatDate(row.dateOfBirth)
    },
    {
      key: 'gender',
      header: 'Gender',
      width: 90,
      render: (row) => <span style={{ textTransform: 'capitalize' }}>{row.gender}</span>
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (row) => (
        <Badge color={STUDENT_STATUS_COLORS[row.status]}>
          {STUDENT_STATUS_LABELS[row.status]}
        </Badge>
      )
    },
    {
      key: 'registeredAt',
      header: 'Registered',
      width: 130,
      render: (row) => formatDate(row.registeredAt)
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Students"
        subtitle={`${students.length} students enrolled`}
        actions={
          <>
            <Button variant="ghost" icon={<Upload size={14} />}>Import</Button>
            <Button variant="ghost" icon={<Download size={14} />} onClick={() => window.elImtiyaz.reports.export('students')}>Export</Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNewModal(true)}>
              New Student
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="el-search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              placeholder="Search by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="el-select">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StudentStatus | '')}
            >
              <option value="">All statuses</option>
              {Object.entries(STUDENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost">Bulk Edit</Button>
              <Button size="sm" variant="ghost">Promote</Button>
              <Button size="sm" variant="danger">Delete</Button>
            </div>
          )}
        </div>

        <DataGrid
          columns={columns}
          data={students}
          rowKey={(row) => row.id}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={(row) => navigate(`/students/${row.id}`)}
          loading={loading}
          sortField="fullName"
          sortDir="asc"
          emptyState={
            <EmptyState
              icon={<Search size={24} />}
              title="No students found"
              description="Try adjusting your filters or add a new student."
            />
          }
        />
      </Card>

      <NewStudentModal open={showNewModal} onClose={() => setShowNewModal(false)} onSaved={loadStudents} />
    </div>
  );
}