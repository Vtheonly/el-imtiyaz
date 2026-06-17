/**
 * Attendance — record & view daily attendance.
 */

import { useEffect, useState } from 'react';
import { Calendar, Check, X, Clock as ClockIcon, AlertCircle } from 'lucide-react';
import { Card, Button, Badge, EmptyState, StatBlock } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { DataGrid, Column } from '../components/data/DataGrid';
import { formatDZD, formatDate } from '@shared/currency';
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS, AttendanceStatus } from '@core/enums';

interface AttendanceRow {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatus;
}

export function Attendance() {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await window.elImtiyaz.attendance.list({ date });
        setRecords((rows as any[]).map((a) => ({
          id: a.id.value,
          studentId: a.studentId,
          classId: a.classId,
          date: a.date,
          status: a.status
        })));
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const stats = {
    present: records.filter((r) => r.status === AttendanceStatus.PRESENT).length,
    absent: records.filter((r) => r.status === AttendanceStatus.ABSENT).length,
    late: records.filter((r) => r.status === AttendanceStatus.LATE).length,
    excused: records.filter((r) => r.status === AttendanceStatus.EXCUSED).length
  };

  const columns: Column<AttendanceRow>[] = [
    {
      key: 'studentId',
      header: 'Student ID',
      render: (r) => <span className="text-mono" style={{ color: 'var(--color-primary-blue)' }}>{r.studentId.slice(0, 8)}…</span>
    },
    {
      key: 'classId',
      header: 'Class',
      width: 140,
      render: (r) => <span className="text-mono" style={{ color: 'var(--color-text-tertiary)' }}>{r.classId.slice(0, 8)}…</span>
    },
    {
      key: 'date',
      header: 'Date',
      width: 140,
      render: (r) => formatDate(r.date)
    },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      render: (r) => (
        <Badge color={ATTENDANCE_STATUS_COLORS[r.status]}>
          {ATTENDANCE_STATUS_LABELS[r.status]}
        </Badge>
      )
    }
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Attendance"
        subtitle={formatDate(date)}
        actions={
          <div className="el-input" style={{ padding: 0 }}>
            <Calendar size={14} style={{ marginLeft: 12, color: 'var(--color-text-tertiary)' }} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', padding: '8px 12px' }}
            />
          </div>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock label="Present" value={stats.present} format="number" icon={<Check size={18} />} />
        <StatBlock label="Absent" value={stats.absent} format="number" icon={<X size={18} />} />
        <StatBlock label="Late" value={stats.late} format="number" icon={<ClockIcon size={18} />} />
        <StatBlock label="Excused" value={stats.excused} format="number" icon={<AlertCircle size={18} />} />
      </div>

      <Card>
        <DataGrid
          columns={columns}
          data={records}
          rowKey={(r) => r.id}
          loading={loading}
          emptyState={<EmptyState icon={<Calendar size={24} />} title="No attendance records" description="Select a date to view or record attendance." />}
        />
      </Card>
    </div>
  );
}
