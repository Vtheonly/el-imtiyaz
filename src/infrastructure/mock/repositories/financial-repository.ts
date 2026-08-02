/**
 * Mock financial repositories — Payment, Installment, Debt, Expense.
 *
 * Extracted from `mock-repositories.ts` in iteration 2 of the platform-wide
 * refactor. Behavior preserved verbatim — including:
 *   - Iteration 5: ledger entry append on every payment (canonical source).
 *   - Iteration 6: ledger reversal entry on refund.
 *   - Iteration 6: "no self-approval" rule for expenses.
 *   - Iteration 6: expense state machine (submitted → approved/rejected → disbursed → settled).
 *   - Iteration 9: flexible installment schedules (custom due dates, cycle regeneration).
 *
 * File length (~430 lines) exceeds the 200-line target but is justified by
 * the tight coupling between these 4 repositories (they share the ledger
 * and audit infrastructure). Splitting further would require exposing
 * `store.ledger` mutation as a public API, which would harm encapsulation.
 */
import type {
  PaymentRepository,
  InstallmentRepository,
  DebtRepository,
  ExpenseRepository,
  Observable,
} from "../../../domain/repository/repository";
import type { Result } from "../../../core/result";
import { Ok, Err } from "../../../core/result";
import { Errors } from "../../../core/app-error";
import { AuditActions } from "../../../core/audit-actions";
import { SubjectBehavior } from "../subject-behavior";
import type {
  Payment,
  Installment,
  AccountAdjustment,
  Receipt,
  CollectPaymentInput,
  ParentFinancialProfile,
  DebtSummary,
  PaymentStatus,
  AcademicCycle,
  UpdateInstallmentDueDateInput,
} from "../../../domain/model/payment";
import {
  ACADEMIC_CYCLE_LABELS_FR,
  DEFAULT_CYCLE_TRANCHE_MONTHS,
} from "../../../domain/model/payment";
import type { Expense, SubmitExpenseInput, ExpenseStatus } from "../../../domain/model/expense";
import type { LedgerEntry } from "../../../domain/model/ledger";
import {
  computeParentSummary,
  deriveAccountId,
  maxDaysOverdueFromLedger,
  buildOverdueDueDateMap,
} from "../../../domain/calc/ledger";
import { agingBucketFromDays } from "../../../domain/calc/payment";
import { store, TENANT_ID, appendAudit, nowIso, delay } from "./mock-store";

// ============================================================================
// Payments
// ============================================================================

export class MockPaymentRepository implements PaymentRepository {
  observe(): Observable<Payment[]> {
    return store.payments$;
  }
  observeByParent(parentId: string): Observable<Payment[]> {
    return new SubjectBehavior(store.payments.filter((p) => p.parentId === parentId));
  }
  observeByStudent(studentId: string): Observable<Payment[]> {
    return new SubjectBehavior(store.payments.filter((p) => p.studentId === studentId));
  }
  observeById(id: string): Observable<Payment | null> {
    return new SubjectBehavior(store.payments.find((p) => p.id === id) ?? null);
  }
  async collect(input: CollectPaymentInput, collectedBy: string): Promise<Result<Payment>> {
    await delay(250);
    const year = new Date().getFullYear();
    const seq = store.payments.length + 1;
    const status: PaymentStatus = input.method === "cash" ? "paid" : "pending";
    const payment: Payment = {
      id: `pay-${String(seq).padStart(3, "0")}`,
      tenantId: TENANT_ID,
      receiptNumber: `REC-${year}-${String(seq).padStart(6, "0")}`,
      parentId: input.parentId,
      studentId: input.studentId,
      amount: input.amount,
      method: input.method,
      status,
      category: input.category,
      installmentId: input.installmentId,
      proofUrl: input.proofUrl ?? null,
      notes: input.notes ?? null,
      collectedBy,
      collectedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.payments.unshift(payment);
    store.notifyPayments();

    // Iteration 5: append the corresponding ledger entry. This is the
    // single source of truth for the payment's effect on the parent's
    // balance. The payment table is now a denormalized view; the ledger
    // is canonical.
    const ledgerEntry: LedgerEntry = {
      id: `led-${nowIso()}-${Math.random().toString(36).slice(2, 10)}`,
      tenantId: TENANT_ID,
      accountId: deriveAccountId(input.parentId, input.category, input.studentId),
      parentId: input.parentId,
      studentId: input.studentId,
      category: input.category,
      amount: -input.amount, // payments are credits (negative)
      type: "payment",
      sourceType: "payment",
      sourceId: payment.id,
      method: input.method,
      receiptNumber: payment.receiptNumber,
      paymentStatus: status,
      reversesId: null,
      description: `Encaissement ${payment.receiptNumber} — ${input.method} (${input.category})`,
      actorId: collectedBy,
      actorName: "Session courante",
      at: payment.collectedAt,
      metadata: Object.freeze({
        installmentId: input.installmentId ?? null,
        proofUrl: input.proofUrl ?? null,
      }),
    };
    store.ledger = [...store.ledger, ledgerEntry];
    store.notifyLedger();

    appendAudit({
      action: AuditActions.PaymentCreate,
      entityType: "payment",
      entityId: payment.id,
      actorId: collectedBy,
      actorName: "Session courante",
      diff: {
        before: null,
        after: {
          amount: payment.amount,
          method: payment.method,
          receipt: payment.receiptNumber,
          ledgerEntryId: ledgerEntry.id,
        },
      },
    });
    return Ok(payment);
  }

  async refund(id: string): Promise<Result<Payment>> {
    await delay(200);
    const idx = store.payments.findIndex((p) => p.id === id);
    if (idx < 0) return Err(Errors.notFound("Payment", id));
    const before = store.payments[idx];
    const after: Payment = { ...before, status: "refunded", updatedAt: nowIso() };
    store.payments[idx] = after;
    store.notifyPayments();

    // Iteration 6: Append a ledger reversal entry that negates the original
    // payment's ledger entry. The plan's accounting engine mandates that every
    // refund be traceable — the ledger must reflect the reversal so the parent's
    // balance is correctly re-computed by replay.
    const originalLedgerEntry = store.ledger.find(
      (e) => e.sourceType === "payment" && e.sourceId === id && e.type === "payment",
    );
    if (originalLedgerEntry) {
      const reversalEntry: LedgerEntry = {
        id: `led-${nowIso()}-${Math.random().toString(36).slice(2, 10)}`,
        tenantId: TENANT_ID,
        accountId: originalLedgerEntry.accountId,
        parentId: originalLedgerEntry.parentId,
        studentId: originalLedgerEntry.studentId,
        category: originalLedgerEntry.category,
        // Original payment entry stored a NEGATIVE amount (credit).
        // Reversal negates it → POSITIVE amount (debit; parent owes it back).
        amount: -originalLedgerEntry.amount,
        type: "reversal",
        sourceType: "payment",
        sourceId: id,
        method: originalLedgerEntry.method,
        receiptNumber: originalLedgerEntry.receiptNumber,
        paymentStatus: "refunded",
        reversesId: originalLedgerEntry.id,
        description: `Remboursement ${before.receiptNumber} — inversion de l'écriture de paiement`,
        actorId: "usr-current",
        actorName: "Session courante",
        at: nowIso(),
        metadata: Object.freeze({
          refundReason: "Remboursement manuel",
          originalPaymentId: id,
        }),
      };
      store.ledger = [...store.ledger, reversalEntry];
      store.notifyLedger();
      appendAudit({
        action: AuditActions.PaymentRefund,
        entityType: "payment",
        entityId: id,
        actorId: "usr-current",
        actorName: "Session courante",
        diff: {
          before: { status: before.status, ledgerEntryId: originalLedgerEntry.id },
          after: { status: "refunded", reversalEntryId: reversalEntry.id },
        },
      });
    } else {
      // No original ledger entry found — log a warning but still record the refund.
      appendAudit({
        action: AuditActions.PaymentRefund,
        entityType: "payment",
        entityId: id,
        actorId: "usr-current",
        actorName: "Session courante",
        diff: { before: { status: before.status }, after: { status: "refunded" } },
        note: "ATTENTION: aucune écriture de ledger correspondante trouvée pour le remboursement",
      });
    }
    return Ok(after);
  }

  async adjust(parentId: string, amount: number, reason: string, approvedBy: string): Promise<Result<AccountAdjustment>> {
    await delay(200);
    const adj: AccountAdjustment = {
      id: `adj-${Date.now()}`,
      parentId,
      amount,
      reason,
      approvedBy,
      approvedAt: nowIso(),
      receiptRef: null,
    };
    appendAudit({
      action: AuditActions.PaymentAdjust,
      entityType: "adjustment",
      entityId: adj.id,
      actorId: approvedBy,
      actorName: "Session courante",
      diff: { before: null, after: { amount, reason } },
    });
    return Ok(adj);
  }

  async generateReceipt(paymentId: string, generatedBy: string): Promise<Result<Receipt>> {
    await delay(180);
    const p = store.payments.find((x) => x.id === paymentId);
    if (!p) return Err(Errors.notFound("Payment", paymentId));
    const receipt: Receipt = {
      id: `rcp-${Date.now()}`,
      paymentId,
      receiptNumber: p.receiptNumber,
      pdfUrl: `mock://receipts/${p.receiptNumber}.pdf`,
      generatedAt: nowIso(),
      generatedBy,
    };
    appendAudit({
      action: AuditActions.ReceiptGenerate,
      entityType: "receipt",
      entityId: receipt.id,
      actorId: generatedBy,
      actorName: "Session courante",
    });
    return Ok(receipt);
  }
}

// ============================================================================
// Installments (with iteration 9 flexible schedule support)
// ============================================================================

export class MockInstallmentRepository implements InstallmentRepository {
  observeByParent(parentId: string): Observable<Installment[]> {
    return new SubjectBehavior(store.installments.filter((i) => i.parentId === parentId));
  }
  observeByStudent(studentId: string): Observable<Installment[]> {
    return new SubjectBehavior(store.installments.filter((i) => i.studentId === studentId));
  }
  observeById(id: string): Observable<Installment | null> {
    return new SubjectBehavior<Installment | null>(store.installments.find((i) => i.id === id) ?? null);
  }

  async markPaid(id: string, paymentId: string): Promise<Result<Installment>> {
    await delay(180);
    const idx = store.installments.findIndex((i) => i.id === id);
    if (idx < 0) return Err(Errors.notFound("Installment", id));
    const after: Installment = {
      ...store.installments[idx],
      amountPaid: store.installments[idx].amountDue,
      paidDate: nowIso(),
      status: "paid",
    };
    store.installments[idx] = after;
    store.notifyInstallments();
    appendAudit({
      action: AuditActions.InstallmentMarkPaid,
      entityType: "installment",
      entityId: id,
      actorId: "usr-current",
      actorName: "Session courante",
      note: `Payment ${paymentId}`,
    });
    return Ok(after);
  }

  /**
   * Iteration 9 — flexible installment schedules.
   *
   * Overrides an installment's due date per parent. Marks the installment
   * `customSchedule: true` so the UI can badge it. Writes an audit entry
   * so the change is traceable.
   */
  async updateDueDate(input: UpdateInstallmentDueDateInput): Promise<Result<Installment>> {
    await delay(180);
    const idx = store.installments.findIndex((i) => i.id === input.installmentId);
    if (idx < 0) return Err(Errors.notFound("Installment", input.installmentId));
    const before = store.installments[idx];
    const after: Installment = {
      ...before,
      dueDate: input.dueDate,
      customSchedule: true,
      customScheduleNote: input.note ?? before.customScheduleNote ?? null,
    };
    store.installments[idx] = after;
    store.notifyInstallments();
    appendAudit({
      action: "installment.update_due_date",
      entityType: "installment",
      entityId: input.installmentId,
      actorId: input.actorId,
      actorName: input.actorName,
      diff: { before: { dueDate: before.dueDate }, after: { dueDate: input.dueDate, customSchedule: true } },
      note: input.note ?? null,
    });
    return Ok(after);
  }

  /**
   * Iteration 9 — cycle-based installment regeneration.
   *
   * For each pending/partial installment of the parent, re-derive the due
   * date from the cycle's default tranche template (Primaire=9/12/3,
   * CEM=9/12/4, Lycée=9/1/5). Paid installments are preserved as-is.
   * Clears the `customSchedule` flag (back to template).
   */
  async regenerateForCycle(parentId: string, cycle: AcademicCycle, actorId: string, actorName: string): Promise<Result<readonly Installment[]>> {
    await delay(220);
    const months = DEFAULT_CYCLE_TRANCHE_MONTHS[cycle];
    const currentYear = new Date().getFullYear();
    let changed = 0;
    for (let i = 0; i < store.installments.length; i++) {
      const ins = store.installments[i];
      if (ins.parentId !== parentId) continue;
      if (ins.status === "paid") continue;
      // Tranche 1/2/3 → months[0]/[1]/[2]
      const trancheNum = ins.label.startsWith("Tranche ") ? parseInt(ins.label.slice(8), 10) : 1;
      const month = months[Math.min(Math.max(trancheNum - 1, 0), 2)];
      // Academic year starts in September — tranche 1 is in current year, tranche 2+ might roll to next year.
      const year = month >= 9 ? currentYear : currentYear + 1;
      const day = 15;
      const newDue = new Date(year, month - 1, day).toISOString();
      store.installments[i] = {
        ...ins,
        dueDate: newDue,
        academicCycle: cycle,
        customSchedule: false,
        customScheduleNote: null,
      };
      changed++;
    }
    if (changed > 0) {
      store.notifyInstallments();
      appendAudit({
        action: "installment.regenerate_for_cycle",
        entityType: "parent",
        entityId: parentId,
        actorId: actorId,
        actorName: actorName,
        diff: { before: { cycle: "previous" }, after: { cycle, installmentsChanged: changed } },
        note: `Régénération selon le cycle ${ACADEMIC_CYCLE_LABELS_FR[cycle]}`,
      });
    }
    return Ok(store.installments.filter((i) => i.parentId === parentId));
  }

  /**
   * Iteration 9 — find overdue installments.
   *
   * Returns installments whose dueDate < now AND status !== "paid".
   * Used by the automated overdue alert generator.
   */
  async findOverdue(now: Date = new Date()): Promise<Result<readonly Installment[]>> {
    const nowMs = now.getTime();
    const overdue = store.installments.filter(
      (i) => i.status !== "paid" && new Date(i.dueDate).getTime() < nowMs,
    );
    return Ok(overdue);
  }
}

// ============================================================================
// Debt (computed from ledger replay — iteration 5)
// ============================================================================

export class MockDebtRepository implements DebtRepository {
  /**
   * Iteration 5: debt summary is now computed from the ledger via replay.
   * No hardcoded arrays. Every parent's `outstandingAmount` is the sum
   * of their account balances (computed from ledger entries).
   */
  observeSummary(): Observable<DebtSummary[]> {
    const summaries: DebtSummary[] = store.parents.map((p) => {
      const parentEntries = store.ledger.filter((e) => e.parentId === p.id);
      const dueDateMap = buildOverdueDueDateMap(parentEntries);
      const summary = computeParentSummary(parentEntries, p.id, `${p.firstName} ${p.lastName}`, dueDateMap);
      const days = maxDaysOverdueFromLedger(parentEntries);
      return {
        id: `debt-${p.id}`,
        parentId: p.id,
        parentName: `${p.firstName} ${p.lastName}`,
        parentPhone: p.phone,
        studentCount: store.students.filter((s) => s.parentId === p.id).length,
        outstandingAmount: summary.totalOutstanding,
        daysOverdue: days,
        bucket: agingBucketFromDays(days),
      };
    });
    // Only include parents with a non-zero outstanding balance.
    return new SubjectBehavior(summaries.filter((s) => s.outstandingAmount > 0.001));
  }

  /**
   * Iteration 5: parent financial profile is computed from the ledger.
   * `totalDue` = sum of charge entries.
   * `totalPaid` = sum of cleared payment entries (status === "paid").
   * `totalOutstanding` = totalDue - totalPaid.
   * `overdueAmount` = sum of unpaid past-due charges.
   */
  observeParentProfile(parentId: string): Observable<ParentFinancialProfile | null> {
    const parent = store.parents.find((p) => p.id === parentId);
    if (!parent) return new SubjectBehavior<ParentFinancialProfile | null>(null);
    const parentEntries = store.ledger.filter((e) => e.parentId === parentId);
    const dueDateMap = buildOverdueDueDateMap(parentEntries);
    const summary = computeParentSummary(parentEntries, parentId, `${parent.firstName} ${parent.lastName}`, dueDateMap);
    const installments = store.installments.filter((i) => i.parentId === parentId);
    const payments = store.payments
      .filter((p) => p.parentId === parentId)
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
      .slice(0, 10);
    return new SubjectBehavior<ParentFinancialProfile | null>({
      parentId,
      parentName: `${parent.firstName} ${parent.lastName}`,
      totalDue: summary.totalCharged,
      totalPaid: summary.totalCleared,
      totalOutstanding: summary.totalOutstanding,
      overdueAmount: summary.totalOverdue,
      installments,
      recentPayments: payments,
      adjustments: [],
    });
  }

  async sendReminder(parentId: string): Promise<Result<void>> {
    await delay(150);
    appendAudit({
      action: AuditActions.DebtReminderSent,
      entityType: "parent",
      entityId: parentId,
      actorId: "usr-current",
      actorName: "Session courante",
      note: "Rappel envoyé",
    });
    return Ok(undefined);
  }
}

// ============================================================================
// Expenses (with iteration 6 state machine + self-approval rule)
// ============================================================================

export class MockExpenseRepository implements ExpenseRepository {
  observe(): Observable<Expense[]> {
    return store.expenses$;
  }
  observeByStatus(status: string): Observable<Expense[]> {
    return new SubjectBehavior(store.expenses.filter((e) => e.status === status));
  }
  observeById(id: string): Observable<Expense | null> {
    return new SubjectBehavior(store.expenses.find((e) => e.id === id) ?? null);
  }

  async submit(input: SubmitExpenseInput, submittedBy: string): Promise<Result<Expense>> {
    await delay(220);
    const seq = store.expenses.length + 1;
    const exp: Expense = {
      ...input,
      id: `exp-${String(seq).padStart(3, "0")}`,
      tenantId: TENANT_ID,
      requestCode: `EXP-2025-${String(seq).padStart(3, "0")}`,
      status: "submitted",
      submittedBy,
      submittedAt: nowIso(),
      approvedBy: null, approvedAt: null, approvalNote: null,
      disbursedBy: null, disbursedAt: null,
      proofUrl: null, proofUploadedBy: null, proofUploadedAt: null,
      anomalyScore: null, anomalyNote: null,
    };
    store.expenses.unshift(exp);
    store.notifyExpenses();
    appendAudit({
      action: AuditActions.ExpenseSubmit,
      entityType: "expense",
      entityId: exp.id,
      actorId: submittedBy,
      actorName: "Session courante",
    });
    return Ok(exp);
  }

  async approve(id: string, approver: string, note?: string): Promise<Result<Expense>> {
    await delay(180);
    // Iteration 6: enforce "no self-approval" rule (plan §08).
    const expense = store.expenses.find((e) => e.id === id);
    if (!expense) return Err(Errors.notFound("Expense", id));
    if (expense.submittedBy === approver) {
      appendAudit({
        action: AuditActions.ExpenseApprove,
        entityType: "expense",
        entityId: id,
        actorId: approver,
        actorName: "Session courante",
        diff: { before: { status: expense.status }, after: { status: expense.status } },
        note: "Tentative d'auto-approbation bloquée — le demandeur ne peut pas approuver sa propre dépense",
      });
      return Err(Errors.forbidden("Un demandeur ne peut pas approuver sa propre dépense (règle d'auto-approbation)"));
    }
    return this.transition(id, "approved", { approvedBy: approver, approvedAt: nowIso(), approvalNote: note ?? null }, AuditActions.ExpenseApprove, approver);
  }

  async reject(id: string, approver: string, note: string): Promise<Result<Expense>> {
    await delay(180);
    // Iteration 6: enforce "no self-approval" rule (plan §08) — applies to reject too.
    const expense = store.expenses.find((e) => e.id === id);
    if (!expense) return Err(Errors.notFound("Expense", id));
    if (expense.submittedBy === approver) {
      return Err(Errors.forbidden("Un demandeur ne peut pas rejeter sa propre dépense (règle d'auto-approbation)"));
    }
    return this.transition(id, "rejected", { approvedBy: approver, approvedAt: nowIso(), approvalNote: note }, AuditActions.ExpenseReject, approver);
  }

  async disburse(id: string, disbursedBy: string): Promise<Result<Expense>> {
    await delay(180);
    return this.transition(id, "disbursed", { disbursedBy, disbursedAt: nowIso() }, AuditActions.ExpenseDisburse, disbursedBy);
  }

  async settleProof(id: string, proofUrl: string, uploadedBy: string): Promise<Result<Expense>> {
    await delay(200);
    return this.transition(id, "settled", { proofUrl, proofUploadedBy: uploadedBy, proofUploadedAt: nowIso() }, AuditActions.ExpenseSettle, uploadedBy);
  }

  private transition(id: string, status: ExpenseStatus, patches: Partial<Expense>, action: string, actorId: string): Promise<Result<Expense>> {
    const idx = store.expenses.findIndex((e) => e.id === id);
    if (idx < 0) return Promise.resolve(Err(Errors.notFound("Expense", id)));
    const before = store.expenses[idx];
    // Iteration 6: enforce state machine — submitted → approved/rejected, approved → disbursed, disbursed → settled.
    const allowedTransitions: Record<ExpenseStatus, ExpenseStatus[]> = {
      draft: ["submitted"],
      submitted: ["approved", "rejected"],
      approved: ["disbursed"],
      rejected: [],
      disbursed: ["settled"],
      settled: [],
    };
    const allowed = allowedTransitions[before.status] ?? [];
    if (!allowed.includes(status)) {
      return Promise.resolve(Err(Errors.conflict(`Transition non autorisée: ${before.status} → ${status}`)));
    }
    const after: Expense = { ...before, ...patches, status };
    store.expenses[idx] = after;
    store.notifyExpenses();
    appendAudit({
      action,
      entityType: "expense",
      entityId: id,
      actorId,
      actorName: "Session courante",
      diff: { before: { status: before.status }, after: { status } },
    });
    return Promise.resolve(Ok(after));
  }
}

// ============================================================================
// Singletons — exported for the barrel re-export in `mock-repositories.ts`.
// ============================================================================

export const mockPaymentRepository: PaymentRepository = new MockPaymentRepository();
export const mockInstallmentRepository: InstallmentRepository = new MockInstallmentRepository();
export const mockDebtRepository: DebtRepository = new MockDebtRepository();
export const mockExpenseRepository: ExpenseRepository = new MockExpenseRepository();

// Re-export Observable so consumers of this file don't need a second import.
export type { Observable };
