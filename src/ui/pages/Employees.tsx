/**
 * Employees — staff management with roles & permissions.
 */

import { useEffect, useState } from 'react';
import { Plus, User } from 'lucide-react';
import { Card, Button, EmptyState, Badge } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { NewEmployeeModal } from '../components/forms/NewEmployeeModal';
import { USER_ROLE_LABELS, UserRole } from '@core/enums';

interface EmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  title?: string;
  isActive: boolean;
}

export function Employees() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.employees.list();
      setEmployees((rows as any[]).map((e) => ({
        id: e.id.value,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        email: e.email,
        phone: e.phone,
        role: e.role,
        title: e.title,
        isActive: e.isActive
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'fullName',
      header: 'Name',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="el-avatar" style={{ width: 28, height: 28, fontSize: 'var(--text-xs)' }}>
            {r.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <strong>{r.fullName}</strong>
            {r.title && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{r.title}</div>}
          </div>
        </div>
      )
    },
    {
      key: 'employeeCode',
      header: 'Code',
      width: 140,
      render: (r) => <span className="text-mono" style={{ color: 'var(--color-primary-blue)' }}>{r.employeeCode}</span>
    },
    { key: 'email', header: 'Email', width: 220, render: (r) => r.email ?? '—' },
    { key: 'phone', header: 'Phone', width: 140, render: (r) => r.phone ?? '—' },
    {
      key: 'role',
      header: 'Role',
      width: 160,
      render: (r) => <Badge>{USER_ROLE_LABELS[r.role]}</Badge>
    },
    {
      key: 'isActive',
      header: 'Status',
      width: 100,
      render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} staff members`}
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNewModal(true)}>New Employee</Button>}
      />
      <Card>
        <DataGrid
          columns={columns}
          data={employees}
          rowKey={(r) => r.id}
          loading={loading}
          emptyState={<EmptyState icon={<User size={24} />} title="No employees" description="Add staff to manage permissions." />}
        />
      </Card>

      <NewEmployeeModal open={showNewModal} onClose={() => setShowNewModal(false)} onSaved={loadEmployees} />
    </div>
  );
}