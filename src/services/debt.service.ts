/**
 * Debt service — computes debt aggregates & overdue flags.
 *
 * "Debt" in this system = (sum of invoice amountDue − discountAmount) − (sum of payments).
 * A debt becomes "overdue" when its due date is in the past AND the balance is positive.
 */

import { PaymentRepository, InvoiceRepository } from '../infrastructure/repositories/payment.repository';
import { StudentRepository } from '../infrastructure/repositories/student.repository';
import type { Student } from '../core/entities/student.entity';
import { Money } from '../core/value-objects/money';
import { logger } from '../infrastructure/logger/logger';

export interface SchoolDebtSummary {
  totalOutstanding: number;          // DZD
  totalCollectedThisYear: number;
  totalCollectedThisMonth: number;
  studentsWithDebtCount: number;
  overduePaymentsCount: number;
  largestDebtor?: { student: Student; amount: number };
}

export interface StudentDebt {
  student: Student;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  overdueAmount: number;
  oldestUnpaidInvoiceDate?: string;
}

export interface OverduePayment {
  invoiceId: string;
  studentId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

export class DebtService {
  readonly serviceName = 'DebtService';

  constructor(
    private readonly payments: PaymentRepository,
    private readonly invoices: InvoiceRepository,
    private readonly students: StudentRepository
  ) {}

  async getSchoolSummary(): Promise<SchoolDebtSummary> {
    const outstandingRow = this.invoices.raw.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_due - discount_amount - amount_paid), 0) as total
       FROM invoices WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'refunded')`
    )!;

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const collectedYearRow = this.payments.raw.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE deleted_at IS NULL AND status = 'paid' AND payment_date >= ?`,
      [yearStart]
    )!;

    const collectedMonthRow = this.payments.raw.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE deleted_at IS NULL AND status = 'paid' AND payment_date >= ?`,
      [monthStart]
    )!;

    const debtorsRow = this.invoices.raw.get<{ count: number }>(
      `SELECT COUNT(DISTINCT student_id) as count FROM invoices
       WHERE deleted_at IS NULL AND (amount_due - discount_amount - amount_paid) > 0`
    )!;

    const overdueRow = this.invoices.raw.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM invoices
       WHERE deleted_at IS NULL
         AND due_date < date('now')
         AND (amount_due - discount_amount - amount_paid) > 0`
    )!;

    // Largest debtor
    const largestDebtorRow = this.invoices.raw.get<{ student_id: string; debt: number }>(
      `SELECT student_id, SUM(amount_due - discount_amount - amount_paid) as debt
       FROM invoices WHERE deleted_at IS NULL
       GROUP BY student_id ORDER BY debt DESC LIMIT 1`
    );

    let largestDebtor: SchoolDebtSummary['largestDebtor'] | undefined;
    if (largestDebtorRow && largestDebtorRow.student_id) {
      const student = await this.students.findById(largestDebtorRow.student_id);
      if (student) {
        largestDebtor = { student, amount: largestDebtorRow.debt };
      }
    }

    return {
      totalOutstanding: outstandingRow.total,
      totalCollectedThisYear: collectedYearRow.total,
      totalCollectedThisMonth: collectedMonthRow.total,
      studentsWithDebtCount: debtorsRow.count,
      overduePaymentsCount: overdueRow.count,
      largestDebtor
    };
  }

  async getStudentsWithDebt(query: { limit?: number } = {}): Promise<StudentDebt[]> {
    const limit = query.limit ?? 100;

    const rows = this.invoices.raw.all<{
      student_id: string;
      total_invoiced: number;
      total_paid: number;
      outstanding: number;
      oldest_invoice: string;
    }>(
      `SELECT student_id,
              SUM(amount_due - discount_amount) as total_invoiced,
              SUM(amount_paid) as total_paid,
              SUM(amount_due - discount_amount - amount_paid) as outstanding,
              MIN(issued_at) as oldest_invoice
       FROM invoices WHERE deleted_at IS NULL
       GROUP BY student_id
       HAVING outstanding > 0
       ORDER BY outstanding DESC
       LIMIT ?`,
      [limit]
    );

    const results: StudentDebt[] = [];
    for (const row of rows) {
      const student = await this.students.findById(row.student_id);
      if (!student) continue;

      const overdueRow = this.invoices.raw.get<{ total: number }>(
        `SELECT COALESCE(SUM(amount_due - discount_amount - amount_paid), 0) as total
         FROM invoices
         WHERE deleted_at IS NULL AND student_id = ?
           AND due_date < date('now')
           AND (amount_due - discount_amount - amount_paid) > 0`,
        [row.student_id]
      )!;

      results.push({
        student,
        totalInvoiced: row.total_invoiced,
        totalPaid: row.total_paid,
        outstanding: row.outstanding,
        overdueAmount: overdueRow.total,
        oldestUnpaidInvoiceDate: row.oldest_invoice
      });
    }

    return results;
  }

  async getOverduePayments(): Promise<OverduePayment[]> {
    const rows = this.invoices.raw.all<{
      invoice_id: string;
      student_id: string;
      student_name: string;
      amount: number;
      due_date: string;
      days_overdue: number;
    }>(
      `SELECT i.id as invoice_id, i.student_id, s.full_name as student_name,
              (i.amount_due - i.discount_amount - i.amount_paid) as amount,
              i.due_date,
              CAST(julianday(date('now')) - julianday(i.due_date) AS INTEGER) as days_overdue
       FROM invoices i
       LEFT JOIN students s ON s.id = i.student_id
       WHERE i.deleted_at IS NULL
         AND i.due_date < date('now')
         AND (i.amount_due - i.discount_amount - i.amount_paid) > 0
       ORDER BY days_overdue DESC`
    );

    logger.info('debt.overdue.fetched', { count: rows.length });

    return rows.map((r) => ({
      invoiceId: r.invoice_id,
      studentId: r.student_id,
      studentName: r.student_name,
      amount: r.amount,
      dueDate: r.due_date,
      daysOverdue: r.days_overdue
    }));
  }
}

/** Re-export Money to keep imports tidy in callers. */
export { Money };