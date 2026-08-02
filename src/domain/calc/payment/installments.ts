/**
 * Installment calculation helpers — single source of truth for per-installment
 * and parent-level installment math.
 *
 * Extracted from `domain/model/payment.ts`:
 *   - `installmentRemaining`  — remaining on a single installment (clamped ≥ 0)
 *   - `totalOutstanding`      — sum of remaining across all installments
 *   - `overdueAmount`         — sum of remaining for overdue installments
 *   - `maxDaysOverdue`        — worst (max) days overdue across installments
 *   - `agingBucketFromDays`   — maps a days-overdue number to an aging bucket
 *
 * Behavior preserved verbatim:
 *   - "Overdue" = `status !== "paid"` AND `dueDate < now`.
 *   - `maxDaysOverdue` uses `Math.floor((now - dueDate) / MS_PER_DAY)` (days).
 *   - `agingBucketFromDays` boundaries: 0-30, 31-60, 61-90, 91-180, 180+.
 */
import type { Installment, AgingBucket } from "@/domain/model/payment";
import { clampNonNegative, sumOf } from "../shared/money";
import { daysBetweenFloor, isStrictlyPast } from "../shared/dates";
import { sumInstallmentsDue, sumInstallmentsPaid } from "./sums";

/**
 * Remaining amount on a single installment: `amountDue - amountPaid`.
 * Never negative (clamped at 0 via `Math.max(0, ...)`, preserved from original).
 */
export function installmentRemaining(installment: Installment): number {
  return clampNonNegative(installment.amountDue - installment.amountPaid);
}

/**
 * Total remaining balance for a parent across all installments.
 * Equals `sumInstallmentsDue - sumInstallmentsPaid`, clamped at 0.
 */
export function totalOutstanding(installments: readonly Installment[]): number {
  return clampNonNegative(
    sumInstallmentsDue(installments) - sumInstallmentsPaid(installments),
  );
}

/**
 * Overdue amount: the portion of the outstanding balance whose
 * installment due date has already passed AND the installment is not
 * fully paid.
 *
 * `now` is injectable for testability.
 */
export function overdueAmount(
  installments: readonly Installment[],
  now: Date = new Date(),
): number {
  const overdueInstallments = installments.filter(
    (i) => i.status !== "paid" && isStrictlyPast(i.dueDate, now),
  );
  return sumOf(overdueInstallments, (i) => installmentRemaining(i));
}

/**
 * Days overdue for a parent's worst (max) overdue installment.
 * Returns 0 if no installments are overdue.
 *
 * Implementation note: uses `daysBetweenFloor(dueDate, now)` from
 * `calc/shared/dates` to guarantee the same `Math.floor(... / 86_400_000)`
 * behavior as the original inline code.
 */
export function maxDaysOverdue(
  installments: readonly Installment[],
  now: Date = new Date(),
): number {
  const overdueDays = installments
    .filter((i) => i.status !== "paid" && isStrictlyPast(i.dueDate, now))
    .map((i) => daysBetweenFloor(i.dueDate, now));
  return overdueDays.length === 0 ? 0 : Math.max(...overdueDays);
}

/**
 * Map a days-overdue number to an aging bucket.
 *
 * Boundaries (preserved from original):
 *   - 0–30 days   → "0_30"
 *   - 31–60 days  → "31_60"
 *   - 61–90 days  → "61_90"
 *   - 91–180 days → "91_180"
 *   - 181+ days   → "180_plus"
 *
 * Note: negative inputs (future due dates) are treated as 0 days.
 */
export function agingBucketFromDays(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return "0_30";
  if (daysOverdue <= 60) return "31_60";
  if (daysOverdue <= 90) return "61_90";
  if (daysOverdue <= 180) return "91_180";
  return "180_plus";
}

/* ================================================================== */
/*  Spec §1.4 — Partial Tranche Payments                              */
/*                                                                    */
/*  Parents can pay a percentage of an individual tranche instead of  */
/*  the full remaining balance. The slider (10%–100%) and manual DZD  */
/*  input are linked: moving one updates the other.                   */
/* ================================================================== */

/**
 * Compute the DZD amount corresponding to a percentage of an installment's
 * `amountDue`. Clamped to [0, amountDue].
 *
 * Used by the CounterPaymentModal slider: when the user drags the slider
 * to `percentage`, the DZD input is updated to `computePartialAmount(installment, percentage)`.
 *
 * NOTE: this is computed against `amountDue` (the original tranche total),
 * NOT against the remaining balance. This matches the spec which says
 * "paying 50% or 60% of Tranche 1" — i.e. a fraction of the tranche's
 * face value, not a fraction of what's left.
 *
 * For "pay X% of what's left" semantics, use `computePartialOfRemaining`.
 */
export function computePartialAmount(installment: Installment, percentage: number): number {
  const pct = clampPercentage(percentage);
  return Math.round(installment.amountDue * (pct / 100));
}

/**
 * Compute the DZD amount corresponding to a percentage of the installment's
 * *remaining* balance (`amountDue − amountPaid`). Clamped to [0, remaining].
 *
 * Use this when the user wants to pay "X% of what's still owed" on a
 * tranche that has already received partial payments.
 */
export function computePartialOfRemaining(installment: Installment, percentage: number): number {
  const pct = clampPercentage(percentage);
  const remaining = installmentRemaining(installment);
  return Math.round(remaining * (pct / 100));
}

/**
 * Compute the percentage that a given DZD amount represents relative to
 * the installment's `amountDue`. Clamped to [0, 100].
 *
 * Used by the CounterPaymentModal: when the user types a DZD amount into
 * the manual input, the slider position is updated to this percentage.
 */
export function computePercentageForAmount(installment: Installment, amount: number): number {
  if (installment.amountDue <= 0) return 0;
  const pct = (amount / installment.amountDue) * 100;
  return clampPercentage(pct);
}

/**
 * Spec §1.4 — apply a partial payment to an installment and return the
 * updated `amountPaid`, `percentPaid`, and resulting `status`.
 *
 * Does NOT mutate the input — returns a new object with the computed fields.
 * The caller is responsible for persisting this via the installment repository.
 */
export function applyPartialPayment(
  installment: Installment,
  paidAmount: number,
): Pick<Installment, "amountPaid" | "percentPaid" | "status" | "paidDate"> {
  const newAmountPaid = Math.max(0, Math.min(installment.amountDue, installment.amountPaid + paidAmount));
  const percentPaid = installment.amountDue > 0 ? (newAmountPaid / installment.amountDue) * 100 : 0;
  let status = installment.status;
  if (newAmountPaid >= installment.amountDue) {
    status = "paid";
  } else if (newAmountPaid > 0) {
    status = "partial";
  }
  const paidDate = status === "paid" ? new Date().toISOString() : installment.paidDate;
  return {
    amountPaid: newAmountPaid,
    percentPaid: Math.round(percentPaid * 100) / 100,
    status,
    paidDate,
  };
}

/**
 * Spec §1.4 — compute the discounted annual total when a parent chooses
 * the "Full Annual Payment" mode (10% off per the official 2026–2027 schedule).
 *
 * @param annualTotal Sum of all 3 tranches' `amountDue`.
 * @param discountPercent Discount percentage (default 10 per the official schedule).
 */
export function computeFullAnnualDiscountedTotal(annualTotal: number, discountPercent = 10): number {
  return Math.round(annualTotal * (1 - discountPercent / 100));
}

function clampPercentage(pct: number): number {
  if (Number.isNaN(pct) || !Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}
