import React, { useEffect, useState } from "react";
import {
  Users,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Calendar,
  Inbox,
} from "lucide-react";
import { Card, StatBlock, Badge } from "../components/common";
import { PageHeader } from "../components/common/PageHeader";
import { formatDZD } from "@shared/currency";
import toast from "react-hot-toast";

interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  outstandingDebt: number;
  collectedThisMonth: number;
  collectedThisYear: number;
  recentPayments: any[];
  ledgerBreakdown: { classCode: string; count: number; creance: number }[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [studentList, debtSummary, paymentList, ledgerStats] =
          await Promise.all([
            window.elImtiyaz.students.list({ pageSize: 1000 }),
            window.elImtiyaz.debt.summary(),
            window.elImtiyaz.payments.list({ pageSize: 5 }),
            window.elImtiyaz.ledger.summary(),
          ]);

        const students = studentList as any[];
        setData({
          totalStudents: students.length,
          activeStudents: students.filter((s) => s.status === "active").length,
          outstandingDebt: (debtSummary as any).totalOutstanding,
          collectedThisMonth: (debtSummary as any).totalCollectedThisMonth,
          collectedThisYear: (debtSummary as any).totalCollectedThisYear,
          recentPayments: paymentList as any[],
          ledgerBreakdown: (ledgerStats as any).byClass || [],
        });
      } catch (err) {
        toast.error("Failed to load dashboard metrics.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading || !data) {
    return (
      <div className="el-page flex items-center justify-center">
        <div className="el-spinner el-spinner--lg" />
      </div>
    );
  }

  return (
    <div className="el-page">
      <PageHeader
        title="Administrative Overview"
        subtitle="Consolidated metrics and real-time ledger accounting"
      />

      {/* KPI Grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatBlock
          label="Enrolled Students"
          value={data.totalStudents}
          format="number"
          icon={<Users size={18} />}
        />
        <StatBlock
          label="Monthly Collections"
          value={data.collectedThisMonth}
          format="currency"
          icon={<DollarSign size={18} />}
        />
        <StatBlock
          label="Annual Collections"
          value={data.collectedThisYear}
          format="currency"
          icon={<TrendingUp size={18} />}
        />
        <StatBlock
          label="Total Outstanding Balance"
          value={data.outstandingDebt}
          format="currency"
          icon={<AlertCircle size={18} />}
        />
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "2fr 1fr", gap: "var(--space-4)" }}
      >
        {/* Ledger Breakdown Card */}
        <Card
          title="Ledger Class-wise Receivables"
          subtitle="Total outstanding balance grouped by class grade"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            {data.ledgerBreakdown.map((item) => (
              <div
                key={item.classCode}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3)",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div>
                  <span style={{ fontWeight: "var(--weight-semibold)" }}>
                    {item.classCode || "Unassigned"}
                  </span>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    {item.count} pupils registered
                  </div>
                </div>
                <strong
                  style={{
                    color:
                      item.creance > 0
                        ? "var(--color-danger)"
                        : "var(--color-success)",
                  }}
                >
                  {formatDZD(item.creance)}
                </strong>
              </div>
            ))}
            {data.ledgerBreakdown.length === 0 && (
              <div
                style={{
                  padding: "var(--space-6)",
                  textAlign: "center",
                  color: "var(--color-text-tertiary)",
                }}
              >
                <Inbox size={32} />
                <div>No active class metrics registered.</div>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Transactions List */}
        <Card title="Recent Transactions" subtitle="Last 5 processed receipts">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            {data.recentPayments.map((p) => (
              <div
                key={p.id.value}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--color-surface-2, rgba(255,255,255,0.01))",
                  borderRadius: "var(--radius-sm)",
                  borderLeft: "3px solid var(--color-primary-blue)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <div
                  className="flex justify-between"
                  style={{ marginBottom: 2 }}
                >
                  <strong style={{ fontSize: "var(--text-xs)" }}>
                    {p.receiptNumber}
                  </strong>
                  <span
                    style={{
                      color: "var(--color-success)",
                      fontWeight: "var(--weight-semibold)",
                    }}
                  >
                    {formatDZD(p.amount)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  {new Date(p.paymentDate).toLocaleDateString()} ·{" "}
                  {p.paymentMethod}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
