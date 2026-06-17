/**
 * StudentProfile — detailed view with financial profile & payment timeline.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, DollarSign, Calendar } from 'lucide-react';
import { Card, Badge, Button, StatBlock, EmptyState } from '../components/common';
import { PageHeader } from '../components/common/PageHeader';
import { PaymentTimeline } from '../components/timeline/PaymentTimeline';
import { ActivityTimeline } from '../components/timeline/ActivityTimeline';
import { formatDZD, formatDate, relativeTime } from '@shared/currency';
import { STUDENT_STATUS_COLORS, STUDENT_STATUS_LABELS } from '@core/enums';

interface Profile {
  student: any;
  totalPaid: number;
  totalOwed: number;
  outstandingBalance: number;
  lastPayment?: { amount: number; date: string; receiptNumber: string };
  paymentCount: number;
  scholarshipActive: boolean;
}

export function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [p, t, pays] = await Promise.all([
          window.elImtiyaz.students.profile(id),
          window.elImtiyaz.students.timeline(id),
          window.elImtiyaz.payments.byStudent(id)
        ]);
        setProfile(p as any);
        setTimeline(t as any[]);
        setPayments(pays as any[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !profile) {
    return (
      <div className="el-page">
        <div className="flex items-center justify-center" style={{ padding: 'var(--space-12)' }}>
          <div className="el-spinner el-spinner--lg" />
        </div>
      </div>
    );
  }

  const s = profile.student;

  return (
    <div className="el-page">
      <PageHeader
        title={s.fullName}
        subtitle={`${s.studentCode} • Enrolled ${formatDate(s.registeredAt)}`}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => navigate('/students')}>
              Back
            </Button>
            <Button variant="primary" icon={<Edit size={14} />}>Edit</Button>
          </>
        }
      />

      {/* KPI Row */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatBlock label="Total Paid" value={profile.totalPaid} format="currency" icon={<DollarSign size={18} />} />
        <StatBlock label="Total Owed" value={profile.totalOwed} format="currency" />
        <StatBlock
          label="Outstanding"
          value={profile.outstandingBalance}
          format="currency"
          icon={<FileText size={18} />}
        />
        <StatBlock label="Payments" value={profile.paymentCount} format="number" icon={<Calendar size={18} />} />
      </div>

      {/* Profile + Timeline */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 'var(--space-4)' }}>
        <Card title="Student Information">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-3)' }}>
              <div className="el-avatar el-avatar--xl">
                {s.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>{s.fullName}</div>
                <Badge color={STUDENT_STATUS_COLORS[s.status]}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
              </div>
            </div>

            <div className="el-divider" />

            <InfoRow label="Date of Birth" value={formatDate(s.dateOfBirth)} />
            <InfoRow label="Gender" value={<span style={{ textTransform: 'capitalize' }}>{s.gender}</span>} />
            <InfoRow label="Phone Numbers" value={s.phoneNumbers.join(', ') || '—'} />
            <InfoRow label="Address" value={`${s.address.line1}, ${s.address.city}, ${s.address.country}`} />
            <InfoRow label="Registered" value={formatDate(s.registeredAt)} />

            {s.notes && (
              <>
                <div className="el-divider" />
                <div>
                  <div className="el-stat__label" style={{ marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{s.notes}</div>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title="Payment Timeline" subtitle="Monthly payment status overview">
          {timeline.length > 0 ? (
            <PaymentTimeline entries={timeline} />
          ) : (
            <EmptyState title="No payment history" description="This student has no invoices yet." />
          )}

          <div className="el-divider" />

          <div className="el-stat__label" style={{ marginBottom: 'var(--space-3)' }}>Recent Payments</div>
          <div className="flex flex-col gap-2">
            {payments.slice(0, 5).map((p: any) => (
              <div
                key={p.id.value}
                className="flex items-center justify-between"
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                    {p.receiptNumber}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {relativeTime(p.paymentDate)} • {p.paymentMethod}
                  </div>
                </div>
                <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-success)' }}>
                  {formatDZD(p.amount)}
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                No payments recorded.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{value}</span>
    </div>
  );
}
