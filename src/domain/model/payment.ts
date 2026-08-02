/**
 * Payment & Financial domain — plan §07.
 *
 * Payment methods: Cash / Check / Transfer (3 only).
 * Payment lifecycle: pending → partial → paid (or overdue / refunded / cancelled).
 * Non-cash requires proof scan (mandatory).
 * Tuition = 3 tranches; Transport = tier-based.
 * Discretionary Account Adjustments replace deprecated scholarships (§07.04).
 */
export type PaymentMethod = "cash" | "check" | "transfer";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue" | "refunded" | "cancelled";

export type PaymentCategory =
  | "tuition"
  | "transport"
  | "canteen"
  | "uniform"
  | "books"
  | "extracurricular"
  | "other";

export interface Payment {
  readonly id: string;
  readonly tenantId: string;
  readonly receiptNumber: string; // REC-2025-000123
  readonly parentId: string;
  readonly studentId: string | null;
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;
  readonly category: PaymentCategory;
  readonly installmentId: string | null;
  readonly proofUrl: string | null;
  readonly notes: string | null;
  readonly collectedBy: string;
  readonly collectedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Installment {
  readonly id: string;
  readonly parentId: string;
  readonly studentId: string | null;
  readonly category: PaymentCategory;
  readonly label: string; // "Tranche 1" / "Tranche 2" / "Tranche 3"
  readonly amountDue: number;
  readonly amountPaid: number;
  readonly dueDate: string;
  readonly paidDate: string | null;
  readonly status: PaymentStatus;
  /**
   * Iteration 9 — flexible installment schedules (plan §07.03 expansion).
   *
   * The education cycle the installment was generated for. Drives the
   * default due-date template (Primaire / CEM / Lycée each have their own
   * pattern), but the actual `dueDate` can be overridden per parent to
   * accommodate custom payment agreements.
   */
  readonly academicCycle?: AcademicCycle;
  /**
   * True when the due date has been manually overridden per parent.
   * False when the installment follows the standard cycle template.
   */
  readonly customSchedule?: boolean;
  /** Optional note describing the custom payment agreement (e.g. "Échelonnement exceptionnel"). */
  readonly customScheduleNote?: string | null;
  /**
   * Spec §1.3 — Tranche Period Mapping & Timestamp Visibility.
   *
   * The academic semester this tranche covers (1, 2, or 3).
   * Tranche 1 = Semester 1 (Sept–Oct–Nov)
   * Tranche 2 = Semester 2 (Dec–Jan–Feb)
   * Tranche 3 = Semester 3 (Mar–Apr–May)
   */
  readonly semester?: 1 | 2 | 3;
  /**
   * Human-readable month range covered by this tranche, e.g. "Sept–Oct–Nov".
   * Displayed on schedule cards and generated receipts so parents can see
   * exactly what period a tranche pays for.
   */
  readonly coveredMonths?: string;
  /**
   * Spec §1.4 — Dual Payment Modes & Partial Tranche Payments.
   *
   * The payment strategy chosen by the parent:
   *   - "full_annual": single up-front payment for the entire year (10% discount)
   *   - "tranches":    standard 3-tranche schedule (default)
   *
   * When undefined, defaults to "tranches" for backward compatibility.
   */
  readonly paymentMode?: PaymentMode;
  /**
   * Percentage of the tranche that has been paid (0–100).
   * Computed as `(amountPaid / amountDue) * 100`, clamped to [0, 100].
   * Stored on the installment so the UI doesn't recompute it everywhere.
   */
  readonly percentPaid?: number;
}

/**
 * Education cycle — used to drive cycle-based installment templates.
 * Each cycle can have its own default tranche dates and amounts.
 */
export type AcademicCycle = "primaire" | "cem" | "lycee";

/**
 * Spec §1.4 — Dual Payment Modes.
 *
 * Parents choose between paying the full annual fee up-front (with a 10%
 * discount per the official 2026–2027 schedule) or spreading payments
 * across the standard 3-tranche schedule.
 */
export type PaymentMode = "full_annual" | "tranches";

export const PAYMENT_MODE_LABELS_FR: Record<PaymentMode, string> = {
  full_annual: "Paiement annuel complet (−10%)",
  tranches: "Paiement par tranches (3 échéances)",
};

/**
 * Spec §1.3 — Tranche → Semester → Month-range mapping.
 *
 * Each tranche maps to a fixed academic semester and a 3-month range.
 * This eliminates ambiguity about what period a tranche covers.
 *
 * Tranche 1 = Semester 1 = Sept–Oct–Nov (start of school year)
 * Tranche 2 = Semester 2 = Dec–Jan–Feb
 * Tranche 3 = Semester 3 = Mar–Apr–May
 */
export const TRANCHE_SEMESTER_MAP: Readonly<Record<1 | 2 | 3, { semester: 1 | 2 | 3; months: string; monthRange: readonly [number, number, number] }>> = {
  1: { semester: 1, months: "Sept–Oct–Nov", monthRange: [9, 10, 11] },
  2: { semester: 2, months: "Dec–Jan–Feb", monthRange: [12, 1, 2] },
  3: { semester: 3, months: "Mar–Apr–May", monthRange: [3, 4, 5] },
};

/**
 * Derive the tranche number (1, 2, or 3) from an installment label.
 * Returns `null` if the label doesn't match the "Tranche N" pattern.
 */
export function trancheNumberFromLabel(label: string): 1 | 2 | 3 | null {
  const match = label.match(/tranche\s*([123])/i);
  if (!match) return null;
  return Number(match[1]) as 1 | 2 | 3;
}

/**
 * Resolve the semester + month-range metadata for an installment.
 *
 * Falls back to deriving from the label if `installment.semester` is not set,
 * so legacy installments (created before spec §1.3) still display correctly.
 */
export function resolveTranchePeriod(installment: Installment): { semester: 1 | 2 | 3 | null; months: string | null } {
  if (installment.semester && installment.coveredMonths) {
    return { semester: installment.semester, months: installment.coveredMonths };
  }
  const num = trancheNumberFromLabel(installment.label);
  if (!num) return { semester: null, months: null };
  const meta = TRANCHE_SEMESTER_MAP[num];
  return { semester: meta.semester, months: meta.months };
}

export const ACADEMIC_CYCLE_LABELS_FR: Record<AcademicCycle, string> = {
  primaire: "Primaire",
  cem: "CEM / Collège",
  lycee: "Lycée",
};

/**
 * Default tranche due-date templates per cycle (month-of-year, 1-indexed).
 *
 * These are the *starting point* for new installments; per-parent
 * overrides are applied via `InstallmentRepository.updateDueDate`.
 *
 * Source: legacy Excel workflow — September / December / March is the
 * historical default; CEM and Lycée shift the 3rd tranche later because
 * their school year ends later.
 */
export const DEFAULT_CYCLE_TRANCHE_MONTHS: Record<AcademicCycle, readonly [number, number, number]> = {
  primaire: [9, 12, 3],   // Sept / Dec / March
  cem: [9, 12, 4],         // Sept / Dec / April
  lycee: [9, 1, 5],        // Sept / Jan / May
};

/**
 * Input for updating an installment's due date (per-parent override).
 * Used by the flexible installment schedule editor.
 */
export interface UpdateInstallmentDueDateInput {
  readonly installmentId: string;
  readonly dueDate: string;
  readonly note?: string | null;
  readonly actorId: string;
  readonly actorName: string;
}

export interface AccountAdjustment {
  readonly id: string;
  readonly parentId: string;
  readonly amount: number; // + credit / - debit
  readonly reason: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly receiptRef: string | null;
}

export interface ParentFinancialProfile {
  readonly parentId: string;
  readonly parentName: string;
  readonly totalDue: number;
  readonly totalPaid: number;
  readonly totalOutstanding: number;
  readonly overdueAmount: number;
  readonly installments: readonly Installment[];
  readonly recentPayments: readonly Payment[];
  readonly adjustments: readonly AccountAdjustment[];
}

export type AgingBucket = "0_30" | "31_60" | "61_90" | "91_180" | "180_plus";

export interface DebtSummary {
  readonly parentId: string;
  readonly parentName: string;
  readonly parentPhone: string;
  readonly studentCount: number;
  readonly outstandingAmount: number;
  readonly daysOverdue: number;
  readonly bucket: AgingBucket;
}

export interface Receipt {
  readonly id: string;
  readonly paymentId: string;
  readonly receiptNumber: string;
  readonly pdfUrl: string | null;
  readonly generatedAt: string;
  readonly generatedBy: string;
}

export const PAYMENT_METHOD_LABELS_FR: Record<PaymentMethod, string> = {
  cash: "Espèces",
  check: "Chèque",
  transfer: "Virement",
};

export const PAYMENT_STATUS_LABELS_FR: Record<PaymentStatus, string> = {
  pending: "En attente",
  partial: "Partiel",
  paid: "Payé",
  overdue: "En retard",
  refunded: "Remboursé",
  cancelled: "Annulé",
};

export const PAYMENT_CATEGORY_LABELS_FR: Record<PaymentCategory, string> = {
  tuition: "Scolarité",
  transport: "Transport",
  canteen: "Cantine",
  uniform: "Uniforme",
  books: "Livres",
  extracurricular: "Activité parascolaire",
  other: "Autre",
};

export const AGING_BUCKET_LABELS_FR: Record<AgingBucket, string> = {
  "0_30": "0–30 j",
  "31_60": "31–60 j",
  "61_90": "61–90 j",
  "91_180": "91–180 j",
  "180_plus": "180+ j",
};

export interface CollectPaymentInput {
  readonly parentId: string;
  readonly studentId: string | null;
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly category: PaymentCategory;
  readonly installmentId: string | null;
  readonly proofUrl?: string | null;
  readonly notes?: string | null;
}

export function proofRequiredFor(method: PaymentMethod): boolean {
  return method !== "cash";
}

/* ================================================================== */
/*  Single-source-of-truth calculation helpers                         */
/*                                                                    */
/*  Every balance, debt, payment total, or remaining amount in the    */
/*  application MUST be computed through one of these helpers.        */
/*  Hardcoding the same formula in 2+ places is forbidden.            */
/*                                                                    */
/*  REFACTOR NOTE (iteration 1): The implementations now live in      */
/*  `@/domain/calc/payment/`. The exports below are thin re-exports   */
/*  so existing imports from `@/domain/model/payment` keep working.   */
/*  Once all call sites migrate to `@/domain/calc`, these re-exports  */
/*  can be removed.                                                   */
/* ================================================================== */

export {
  sumPaidPayments,
  sumInstallmentsDue,
  sumInstallmentsPaid,
} from "../calc/payment/sums";

export {
  installmentRemaining,
  totalOutstanding,
  overdueAmount,
  maxDaysOverdue,
  agingBucketFromDays,
  computePartialAmount,
  computePartialOfRemaining,
  computePercentageForAmount,
  applyPartialPayment,
  computeFullAnnualDiscountedTotal,
} from "../calc/payment/installments";

export {
  revenueByMonth,
  revenueByCategory,
  monthlyRevenue,
} from "../calc/payment/revenue";
