/**
 * ParentDetailDrawer — slide-over panel showing a parent's complete profile.
 *
 * Plan §04.05: 4 sections — Identity / Children / Finances / Actions.
 * The Finances section embeds ParentFinancialProfile (services, payments,
 * balance, tranches, due dates). Per plan §03.02 / §07.06, financial
 * views must NOT open in a separate tab — always render inside the
 * parent drawer.
 *
 * Iteration 4: migrated from raw `Drawer` to `UnifiedModal variant="drawer"`
 * so the parent drawer shares the exact same chrome, padding, header, footer,
 * animations, and close behavior as every other modal/drawer in the app
 * (matching `student-detail-drawer.tsx`).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  MessageCircle,
  Mail,
  FileText,
  Plus,
  UserPlus,
  Wallet,
  AlertTriangle,
  Users,
  Download,
  Zap,
  ArrowRight,
  CalendarDays,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useRepositories } from "../../app/providers/repository-provider";
import { useToast } from "../../app/providers/toast-provider";
import { useAuth } from "../../app/providers/auth-provider";
import { useObservable } from "../../shared/hooks/use-observable";
import { UnifiedModal } from "../../shared/ui/unified-modal";
import { Button } from "../../shared/ui/button";
import { Badge } from "../../shared/ui/badge";
import { Avatar, AvatarFallback } from "../../shared/ui/avatar";
import { Separator } from "../../shared/ui/separator";
import { StatusChip } from "../../shared/ui/status-chip";
import { MoneyInput } from "../../shared/ui/money-input";
import { FormField } from "../../shared/ui/form-field";
import { Textarea } from "../../shared/ui/textarea";
import { formatDzd, formatDzdPlain } from "../../core/format/currency";
import { formatRelative, formatDate, formatDateTime } from "../../core/format/date";
import {
  PAYMENT_METHOD_LABELS_FR,
  PAYMENT_STATUS_LABELS_FR,
  PAYMENT_CATEGORY_LABELS_FR,
  resolveTranchePeriod,
  type Installment,
} from "../../domain/model/payment";
import { Permission } from "../../core/rbac/permissions";
import { generateAccountStatementPdf, downloadPdf } from "../../infrastructure/receipt-pdf";
import { CollapsiblePaymentRow } from "../financials/collapsible-payment-row";

export function ParentDetailDrawer({
  parentId,
  open,
  onOpenChange,
  onAddChild,
  onOpenStudent,
}: {
  parentId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAddChild?: (parentId: string) => void;
  /** Spec §3.1 — open the child's student drawer from within the parent drawer. */
  onOpenStudent?: (studentId: string) => void;
}) {
  const repos = useRepositories();
  const toast = useToast();
  const navigate = useNavigate();
  const parent = useObservable(
    () => repos.parents.observeById(parentId ?? ""),
    [parentId],
  );
  const students = useObservable(
    () => repos.students.observeByParent(parentId ?? ""),
    [parentId],
  );
  const financialProfile = useObservable(
    () => repos.debt.observeParentProfile(parentId ?? ""),
    [parentId],
  );
  const payments = useObservable(
    () => repos.payments.observeByParent(parentId ?? ""),
    [parentId],
  );

  if (!open || !parentId || !parent) return null;

  const initials = `${parent.firstName[0] ?? ""}${parent.lastName[0] ?? ""}`.toUpperCase();
  const outstanding = financialProfile?.totalOutstanding ?? 0;
  const overdue = financialProfile?.overdueAmount ?? 0;

  /**
   * Spec §1.5 — "Résoudre / Solver" direct settlement shortcut.
   *
   * Navigates to /financials with URL params that auto-open the
   * CounterPaymentModal pre-filled with the parent + oldest overdue
   * installment. This eliminates the manual search-and-find flow.
   */
  function handleResolveDebt(installment?: Installment) {
    const params = new URLSearchParams();
    params.set("parentId", parent!.id);
    if (installment) {
      params.set("installmentId", installment.id);
      params.set("category", installment.category);
      params.set("amount", String(installment.amountDue - installment.amountPaid));
    }
    params.set("tab", "payments");
    onOpenChange(false);
    navigate(`/financials?${params.toString()}`);
  }

  // Find the oldest overdue/pending installment for the "Résoudre" button.
  const oldestUnpaidInstallment = financialProfile?.installments
    .filter((i) => i.status !== "paid" && i.amountDue - i.amountPaid > 0)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  // Iteration 6: Wire up the "Reçu PDF" button — generates a full account
  // statement PDF for the parent and triggers a browser download.
  async function handleDownloadStatement() {
    if (!parent || payments.length === 0) {
      toast.showWarning("Aucun paiement", "Ce parent n'a aucun paiement à inclure dans le relevé.");
      return;
    }
    try {
      const pdfBytes = await generateAccountStatementPdf(payments, parent);
      const fileName = `releve-compte-${parent.code}-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadPdf(pdfBytes, fileName);
      toast.showSuccess("Relevé téléchargé", fileName);
    } catch (e) {
      toast.showError("Échec du téléchargement", e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <UnifiedModal
      open={open}
      onOpenChange={onOpenChange}
      variant="drawer"
      size="lg"
      icon={Users}
      iconTone="primary"
      title={
        <span className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span>{parent.firstName} {parent.lastName}</span>
        </span>
      }
      description={
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{parent.code}</span>
        </span>
      }
      footer={
        <>
          <AdjustAccountButton parentId={parent.id} outstanding={outstanding} />
          {/* Spec §1.5 — "Résoudre / Solver" direct settlement shortcut */}
          {outstanding > 0 && (
            <Button
              variant="default"
              onClick={() => handleResolveDebt(oldestUnpaidInstallment)}
              title="Résoudre la créance — ouvrir le module financier pré-rempli"
              className="bg-status-danger hover:bg-status-danger/90"
            >
              <Zap className="h-4 w-4" /> Résoudre {formatDzd(outstanding, { compact: true })}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="icon" title="Appeler" onClick={() => window.open(`tel:${parent.phone}`)}>
              <Phone className="h-4 w-4" />
            </Button>
            {parent.whatsapp && (
              <Button
                variant="outline"
                size="icon"
                title="WhatsApp"
                onClick={() => window.open(`https://wa.me/${parent.whatsapp!.replace(/[\s+]/g, "")}`)}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}
            {parent.email && (
              <Button variant="outline" size="icon" title="E-mail" onClick={() => window.open(`mailto:${parent.email}`)}>
                <Mail className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              title="Relevé de compte PDF"
              onClick={handleDownloadStatement}
              disabled={payments.length === 0}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        {/* === Section 1: Identity === */}
        <section className="space-y-2">
          <SectionTitle icon={<UserPlus className="h-3.5 w-3.5" />}>Identité</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Detail label="Téléphone" value={parent.phone} />
            <Detail label="WhatsApp" value={parent.whatsapp ?? "—"} />
            <Detail label="E-mail" value={parent.email ?? "—"} />
            <Detail label="Profession" value={parent.occupation ?? "—"} />
            <Detail label="Zone" value={zoneLabel(parent.cityTier)} />
            <Detail label="Langue" value={parent.preferredLanguage === "fr" ? "Français" : "العربية"} />
            <Detail label="Adresse" value={parent.address ?? "—"} className="col-span-2" />
          </div>
        </section>

        <Separator />

        {/* === Section 2: Children === */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionTitle icon={<UserPlus className="h-3.5 w-3.5" />}>
              Enfants ({students.length})
            </SectionTitle>
            {onAddChild && (
              <Button size="sm" variant="outline" onClick={() => onAddChild(parent.id)}>
                <Plus className="h-4 w-4" /> Ajouter un enfant
              </Button>
            )}
          </div>
          {students.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun enfant inscrit.</p>
          ) : (
            <ul className="space-y-1.5">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border border-border p-2.5 hover:bg-accent/5 cursor-pointer group"
                  onClick={() => onOpenStudent?.(s.id)}
                  title={`Ouvrir le profil de ${s.firstName}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {s.firstName[0]}
                      {s.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">{s.code}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {levelLabel(s.level)} · An. {s.gradeYear}
                  </Badge>
                  <StatusChip
                    label={s.status === "active" ? "Actif" : s.status}
                    tone={s.status === "active" ? "success" : "neutral"}
                  />
                  {/* Spec §3.1 — clickable child name transitions to student drawer */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        {/* === Section 3: Finances === */}
        <section className="space-y-3">
          <SectionTitle icon={<Wallet className="h-3.5 w-3.5" />}>Finances</SectionTitle>

          {/* Balance cards */}
          <div className="grid grid-cols-3 gap-2">
            <BalanceCard label="Total dû" value={financialProfile?.totalDue ?? 0} tone="default" />
            <BalanceCard label="Payé" value={financialProfile?.totalPaid ?? 0} tone="success" />
            <BalanceCard label="Reste" value={outstanding} tone={outstanding > 0 ? "danger" : "neutral"} />
          </div>

          {overdue > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-status-danger/40 bg-status-danger/10 p-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-status-danger" />
              <span className="text-status-danger font-medium">
                Créance en retard: {formatDzd(overdue)}
              </span>
            </div>
          )}

          {/* Installments (tranches) */}
          <div className="rounded-md border border-border">
            <div className="border-b border-border px-3 py-1.5 bg-muted/30 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tranches
              </p>
              <span className="text-[9px] text-muted-foreground">
                T1=S1 Sept–Nov · T2=S2 Dec–Feb · T3=S3 Mar–May
              </span>
            </div>
            {financialProfile && financialProfile.installments.length > 0 ? (
              <ul className="divide-y divide-border text-xs">
                {financialProfile.installments.map((i) => {
                  const period = resolveTranchePeriod(i);
                  const remaining = i.amountDue - i.amountPaid;
                  const canResolve = i.status !== "paid" && remaining > 0;
                  return (
                    <li key={i.id} className="px-3 py-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{i.label}</span>
                        {/* Spec §1.3 — semester + covered months badges */}
                        {period.semester && (
                          <Badge variant="outline" className="text-[9px] text-status-info bg-status-info/10">
                            S{period.semester}
                          </Badge>
                        )}
                        {period.months && (
                          <span className="text-[10px] text-status-info">{period.months}</span>
                        )}
                        <span className="text-muted-foreground">{PAYMENT_CATEGORY_LABELS_FR[i.category]}</span>
                        <span className="ml-auto font-mono">{formatDzdPlain(i.amountDue)}</span>
                        <span className="text-muted-foreground">→ {formatDate(i.dueDate)}</span>
                        <StatusChip
                          label={PAYMENT_STATUS_LABELS_FR[i.status]}
                          tone={
                            i.status === "paid"
                              ? "success"
                              : i.status === "partial"
                                ? "warning"
                                : i.status === "overdue"
                                  ? "danger"
                                  : "neutral"
                          }
                        />
                      </div>
                      {/* Spec §1.3 — paid timestamp with exact date/time */}
                      {i.paidDate && (
                        <p className="text-[10px] text-status-success flex items-center gap-1 pl-1">
                          <Clock className="h-2.5 w-2.5" />
                          Payée le {formatDateTime(i.paidDate)}
                        </p>
                      )}
                      {/* Spec §1.5 — per-tranche "Résoudre" shortcut for overdue/unpaid */}
                      {canResolve && (
                        <button
                          type="button"
                          onClick={() => handleResolveDebt(i)}
                          className="text-[10px] text-status-danger hover:text-status-danger/80 hover:underline flex items-center gap-1 pl-1"
                        >
                          <Zap className="h-2.5 w-2.5" />
                          Résoudre cette tranche ({formatDzdPlain(remaining)})
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">Aucune tranche.</p>
            )}
          </div>

          {/* Recent payments — Spec §1.2: collapsible accordion rows */}
          <div className="rounded-md border border-border">
            <div className="border-b border-border px-3 py-1.5 bg-muted/30">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Paiements récents (cliquer pour détails)
              </p>
            </div>
            {financialProfile && financialProfile.recentPayments.length > 0 ? (
              <ul className="divide-y divide-border">
                {financialProfile.recentPayments.slice(0, 8).map((p) => (
                  <CollapsiblePaymentRow
                    key={p.id}
                    payment={p}
                    installmentLabel={
                      p.installmentId
                        ? financialProfile.installments.find((i) => i.id === p.installmentId)?.label
                        : undefined
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">Aucun paiement.</p>
            )}
          </div>
        </section>
      </div>
    </UnifiedModal>
  );
}

// ============================================================
// Account Adjustment (replaces deprecated scholarships)
// ============================================================
function AdjustAccountButton({ parentId, outstanding }: { parentId: string; outstanding: number }) {
  const repos = useRepositories();
  const { session } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  const canAdjust = !!session && session.permissions.has(Permission.AdjustAccount);

  if (!canAdjust) return null;

  async function submit() {
    if (amount === 0 || !reason.trim()) {
      toast.showWarning("Champs invalides", "Montant non nul et motif requis.");
      return;
    }
    const r = await repos.payments.adjust(
      parentId,
      amount,
      reason.trim(),
      session?.userId ?? "usr-current",
    );
    if (r.ok) {
      toast.showSuccess("Ajustement appliqué", formatDzd(amount));
      setOpen(false);
      setAmount(0);
      setReason("");
    } else {
      toast.showError("Échec", r.error.userMessage);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4" /> Ajuster le compte
      </Button>
      <UnifiedModal
        open={open}
        onOpenChange={setOpen}
        variant="dialog"
        size="sm"
        icon={Wallet}
        iconTone="primary"
        title="Ajustement de compte"
        description="Remplace le système de bourses supprimé (plan §07.04). Reason code + note admin requis."
        submitLabel="Appliquer"
        submitIcon={Wallet}
        onSubmit={submit}
        submitDisabled={amount === 0 || !reason.trim()}
      >
        <div className="space-y-3">
          <div className="rounded-md border border-border p-2 text-xs">
            <p className="text-muted-foreground">Solde en cours</p>
            <p className="font-mono font-semibold">{formatDzd(outstanding)}</p>
          </div>
          <FormField
            label="Montant"
            required
            hint="Positif = crédit (remise). Négatif = débit (pénalité)."
          >
            <MoneyInput value={amount} onChange={setAmount} />
          </FormField>
          <FormField label="Motif" required hint="Reason code obligatoire pour audit">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Remise fratrie 2ème enfant — 10%"
              rows={3}
            />
          </FormField>
        </div>
      </UnifiedModal>
    </>
  );
}

// ============================================================
// Helpers
// ============================================================
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </p>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "danger" | "neutral";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-status-success",
    danger: "text-status-danger",
    neutral: "text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-md border border-border p-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm font-mono font-semibold ${toneClass}`}>{formatDzdPlain(value)}</p>
    </div>
  );
}

function zoneLabel(tier: string | null): string {
  if (!tier) return "—";
  if (tier === "t1") return "Zone urbaine";
  if (tier === "t2") return "Zone périurbaine";
  if (tier === "t3") return "Zone rurale";
  return tier;
}

function levelLabel(level: string): string {
  if (level === "primaire") return "Primaire";
  if (level === "cem") return "CEM";
  if (level === "lycee") return "Lycée";
  return level;
}
