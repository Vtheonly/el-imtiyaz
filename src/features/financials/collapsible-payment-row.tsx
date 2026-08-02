/**
 * CollapsiblePaymentRow — accordion-style payment record row (spec §1.2).
 *
 * Replaces the flat `<li>` payment lists in:
 *   - FinancialsPage `PaymentsTab`
 *   - ParentDetailDrawer "Paiements récents" section
 *   - StudentDetail `PaymentsTab`
 *
 * Clicking the summary row toggles an inline dropdown that shows the full
 * payment metadata: receipt number, method, breakdown, clearing status,
 * proof scan URL, actor details, and linked installment.
 *
 * Spec §1.2: "Currently, payment rows are flat lists showing limited info.
 * To view full details, users have to open secondary drawers or modals.
 * An inline collapsible view improves scannability and speed."
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Receipt, Upload, Hash, User, Calendar, FileText } from "lucide-react";
import type { Payment } from "../../domain/model/payment";
import {
  PAYMENT_METHOD_LABELS_FR,
  PAYMENT_STATUS_LABELS_FR,
  PAYMENT_CATEGORY_LABELS_FR,
} from "../../domain/model/payment";
import { StatusChip } from "../../shared/ui/status-chip";
import { Badge } from "../../shared/ui/badge";
import { formatDzd, formatDzdPlain } from "../../core/format/currency";
import { formatRelative, formatDateTime, formatDate } from "../../core/format/date";

export function CollapsiblePaymentRow({
  payment,
  collectedByName,
  installmentLabel,
  defaultOpen = false,
}: {
  payment: Payment;
  /** Display name of the staff member who collected the payment, if known. */
  collectedByName?: string;
  /** Label of the linked installment, if any (e.g. "Tranche 1"). */
  installmentLabel?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tone =
    payment.status === "paid"
      ? "success"
      : payment.status === "pending"
        ? "warning"
        : payment.status === "overdue"
          ? "danger"
          : payment.status === "refunded"
            ? "neutral"
            : "info";

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/5 transition-colors"
        aria-expanded={open}
      >
        <span className="text-muted-foreground shrink-0">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-xs font-medium text-foreground">{payment.receiptNumber}</code>
            <StatusChip label={PAYMENT_STATUS_LABELS_FR[payment.status]} tone={tone} />
            {installmentLabel && (
              <Badge variant="outline" className="text-[9px]">{installmentLabel}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {PAYMENT_METHOD_LABELS_FR[payment.method]} · {PAYMENT_CATEGORY_LABELS_FR[payment.category]}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-mono font-semibold">{formatDzdPlain(payment.amount)}</p>
          <p className="text-[10px] text-muted-foreground">{formatRelative(payment.collectedAt)}</p>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 bg-muted/20 border-t border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <DetailRow icon={Hash} label="Reçu" value={payment.receiptNumber} mono />
            <DetailRow icon={Receipt} label="Montant" value={formatDzd(payment.amount)} mono />
            <DetailRow icon={FileText} label="Méthode" value={PAYMENT_METHOD_LABELS_FR[payment.method]} />
            <DetailRow icon={FileText} label="Catégorie" value={PAYMENT_CATEGORY_LABELS_FR[payment.category]} />
            <DetailRow icon={Calendar} label="Encaissé le" value={formatDateTime(payment.collectedAt)} />
            <DetailRow
              icon={Calendar}
              label="Statut"
              value={PAYMENT_STATUS_LABELS_FR[payment.status]}
            />
            {collectedByName && (
              <DetailRow icon={User} label="Encaissé par" value={collectedByName} />
            )}
            {payment.installmentId && (
              <DetailRow icon={Receipt} label="Tranche liée" value={installmentLabel ?? payment.installmentId} mono />
            )}
            {payment.proofUrl && (
              <DetailRow
                icon={Upload}
                label="Justificatif"
                value={
                  <a
                    href={payment.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Upload className="h-3 w-3" /> Voir le scan
                  </a>
                }
              />
            )}
            {payment.notes && (
              <div className="md:col-span-2 mt-1">
                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Notes</p>
                <p className="text-xs text-foreground bg-background rounded p-2 border border-border">
                  {payment.notes}
                </p>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Créé le {formatDate(payment.createdAt)}</span>
            <span>Mis à jour le {formatDate(payment.updatedAt)}</span>
          </div>
        </div>
      )}
    </li>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Hash;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
