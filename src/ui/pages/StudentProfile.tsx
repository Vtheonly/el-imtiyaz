/**
 * StudentProfile — detailed view with financial profile & payment timeline.
 *
 * Extended (2026-06) with an Excel-migration section at the bottom that
 * shows the linked ledger entry (if any) with the three Excel-computed
 * columns (DEVIS ANNUEL, TOTAL VERSEMENTS, TOTAL*CREANCE) and the
 * column-AM audit-trail comments. No new tab — this section lives
 * inside the existing profile page.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, DollarSign, Calendar, BookOpen, MessageSquare } from 'lucide-react';
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
  const [ledger, setLedger] = useState<any[]>([]);
  const [auditComments, setAuditComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [p, t, pays, ledg] = await Promise.all([
          window.elImtiyaz.students.profile(id),
          window.elImtiyaz.students.timeline(id),
          window.elImtiyaz.payments.byStudent(id),
          window.elImtiyaz.ledger.byStudent(id)
        ]);
        setProfile(p as any);
        setTimeline(t as any[]);
        setPayments(pays as any[]);
        setLedger(ledg as any[]);

        // Load audit comments for the first ledger entry (if any).
        if (Array.isArray(ledg) && ledg.length > 0) {
          const entryId = (ledg[0] as any).id.value;
          const comments = await window.elImtiyaz.ledger.auditComments.list(entryId);
          setAuditComments(comments as any[]);
        }
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
  const ledgerEntry = ledger[0] as any | undefined;

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
                <Badge color={STUDENT_STATUS_COLORS[s.status as keyof typeof STUDENT_STATUS_COLORS]}>{STUDENT_STATUS_LABELS[s.status as keyof typeof STUDENT_STATUS_LABELS]}</Badge>
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

      {/* ═══ Excel-migration section (added 2026-06) ═══
          Shows the linked ledger entry + column-AM audit comments.
          Lives inside the existing StudentProfile page — no new tab. */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <Card title="Excel Ledger Entry" subtitle="Master ledger row linked to this student (ETAT 20262027 equivalent)">
          {ledgerEntry ? (
            <div className="flex flex-col gap-4">
              <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
                <LedgerStat label="REMISE (col J)" value={ledgerEntry.remise} variant="warning" />
                <LedgerStat label="DEVIS ANNUEL (col L)" value={ledgerEntry.devisAnnuel} variant="primary" />
                <LedgerStat label="TOTAL VERSEMENTS (col P)" value={ledgerEntry.totalVersements} variant="success" />
                <LedgerStat label="TOTAL*CREANCE (col Q)" value={ledgerEntry.totalCreance} variant={ledgerEntry.totalCreance > 0 ? 'danger' : 'neutral'} />
              </div>

              <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                {[
                  { col: 'R', label: 'FI', value: ledgerEntry.fi },
                  { col: 'S', label: 'V2', value: ledgerEntry.v2 },
                  { col: 'T', label: '2V', value: ledgerEntry.altV2 },
                  { col: 'U', label: 'v3', value: ledgerEntry.v3 },
                  { col: 'W', label: '1T', value: ledgerEntry.t1 },
                  { col: 'X', label: 'T2', value: ledgerEntry.t2 },
                  { col: 'Y', label: 't3', value: ledgerEntry.t3 },
                ].map((c) => (
                  <div key={c.col} style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface-2, #2a2b2c)',
                    textAlign: 'center',
                  }}>
                    <div style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>col {c.col}</div>
                    <div style={{ fontWeight: 'var(--weight-semibold)' }}>{c.label}</div>
                    <div style={{ color: 'var(--color-success)', marginTop: 2 }}>{formatDZD(c.value)}</div>
                  </div>
                ))}
              </div>

              {ledgerEntry.destination && (
                <InfoRow label="Transport destination (col V)" value={ledgerEntry.destination} />
              )}

              {/* Audit comments (column AM equivalent) */}
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                  <MessageSquare size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                  <div className="el-stat__label">Audit Comments (column AM)</div>
                  <Badge>{auditComments.length}</Badge>
                </div>
                {auditComments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {auditComments.map((c: any) => (
                      <div key={c.id.value} style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface-2, #2a2b2c)',
                        borderLeft: c.isClosed ? '3px solid var(--color-success)' : '3px solid var(--color-text-tertiary)',
                        fontSize: 'var(--text-sm)',
                      }}>
                        <div className="flex items-center justify-between">
                          <code style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{c.rawText}</code>
                          <div className="flex items-center gap-2">
                            {c.amount !== null && (
                              <span style={{ color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)' }}>
                                {formatDZD(c.amount)}
                              </span>
                            )}
                            {c.batch && <Badge>{c.batch}</Badge>}
                            {c.isClosed && <Badge color="success">CLOSED</Badge>}
                            {c.excelCell && (
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
                                {c.excelCell}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 'var(--space-3)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    No audit comments on this ledger entry.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen size={24} />}
              title="No linked ledger entry"
              description="This student is not yet linked to a master ledger row. Use 'Import from Excel' on the Fee Templates page, or create a ledger entry via a workflow, to populate this section."
            />
          )}
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

function LedgerStat({ label, value, variant }: { label: string; value: number; variant: 'primary' | 'success' | 'danger' | 'warning' | 'neutral' }) {
  const colorMap: Record<string, string> = {
    primary: 'var(--color-primary-blue)',
    success: 'var(--color-success)',
    danger: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    neutral: 'var(--color-text-secondary)',
  };
  return (
    <div style={{
      padding: 'var(--space-3)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface-2, #2a2b2c)',
      borderTop: `2px solid ${colorMap[variant]}`,
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: colorMap[variant], marginTop: 4 }}>
        {formatDZD(value)}
      </div>
    </div>
  );
}
