/**
 * Student service — orchestrates student CRUD, parent linkage, financial
 * profile aggregation, and audit event emission.
 */

import { StudentRepository } from "../infrastructure/repositories/student.repository";
import { ParentRepository } from "../infrastructure/repositories/parent.repository";
import type {
  Student,
  CreateStudentInput,
  UpdateStudentInput,
  StudentDocument,
} from "../core/entities/student.entity";
import type { IEventBus } from "../core/interfaces/event-bus.interface";
import { StudentStatus } from "../core/enums";
import {
  ValidationError,
  NotFoundError,
} from "../infrastructure/error/app-error";
import { logger } from "../infrastructure/logger/logger";

interface ListQuery {
  search?: string;
  status?: StudentStatus;
  classId?: string;
  parentId?: string;
  page?: number;
  pageSize?: number;
}

export interface StudentFinancialProfile {
  student: Student;
  totalPaid: number;
  totalOwed: number;
  outstandingBalance: number;
  lastPayment?: { amount: number; date: string; receiptNumber: string };
  paymentCount: number;
  scholarshipActive: boolean;
}

export interface PaymentTimelineEntry {
  period: string;
  label: string;
  amountDue: number;
  amountPaid: number;
  status: "paid" | "partial" | "missing";
}

export class StudentService {
  readonly serviceName = "StudentService";

  constructor(
    private readonly students: StudentRepository,
    private readonly parents: ParentRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async list(query: ListQuery): Promise<Student[]> {
    return this.students.list({
      search: query.search,
      status: query.status,
      classId: query.classId,
      parent_id: query.parentId,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async getById(id: string): Promise<Student> {
    const student = await this.students.findById(id);
    if (!student) throw new NotFoundError("Student", id);
    return student as Student;
  }

  async search(term: string): Promise<Student[]> {
    if (!term || term.trim().length < 2) {
      throw new ValidationError("Search term must be at least 2 characters");
    }
    return this.students.list({ search: term, pageSize: 20 });
  }

  async create(input: CreateStudentInput): Promise<Student> {
    this.validateInput(input);

    // Verify all referenced parents exist
    for (const parentId of input.parentIds) {
      const parent = await this.parents.findById(parentId);
      if (!parent) throw new NotFoundError("Parent", parentId);
    }

    const student = await this.students.create(input);
    await this.students.update(student.id.value, {
      status: StudentStatus.ACTIVE,
    });

    await this.eventBus.publish("student.created", {
      entityId: student.id.value,
      entityType: "Student",
      after: student,
      actor: { actorId: "system", actorName: "System" },
    });

    logger.info("student.created", {
      id: student.id.value,
      code: student.studentCode,
    });
    return student;
  }

  async update(id: string, patch: UpdateStudentInput): Promise<Student> {
    const before = await this.getById(id);
    const updated = await this.students.update(id, patch);

    await this.eventBus.publish("student.updated", {
      entityId: id,
      entityType: "Student",
      before,
      after: updated,
      actor: { actorId: "system", actorName: "System" },
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const before = await this.getById(id);
    await this.students.delete(id);

    await this.eventBus.publish("student.deleted", {
      entityId: id,
      entityType: "Student",
      before,
      actor: { actorId: "system", actorName: "System" },
    });
  }

  async addDocument(
    studentId: string,
    document: StudentDocument,
  ): Promise<void> {
    await this.students.addDocument(studentId, document);
    logger.info("student.document.added", {
      studentId,
      filename: document.filename,
    });
  }

  async getDocuments(studentId: string): Promise<StudentDocument[]> {
    return this.students.getDocuments(studentId);
  }

  async bulkImport(rows: Partial<CreateStudentInput>[]): Promise<{
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    let imported = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (
          !row.firstName ||
          !row.lastName ||
          !row.dateOfBirth ||
          !row.parentIds?.length
        ) {
          throw new ValidationError(`Row ${i + 1}: missing required fields`);
        }
        await this.create(row as CreateStudentInput);
        imported++;
      } catch (err) {
        failed++;
        errors.push({ row: i + 1, error: (err as Error).message });
        logger.warn("student.import.row.failed", {
          row: i + 1,
          error: (err as Error).message,
        });
      }
    }

    logger.info("student.bulk-import.complete", { imported, failed });
    return { imported, failed, errors };
  }

  async export(query: ListQuery): Promise<Student[]> {
    return this.list({ ...query, pageSize: 10000 });
  }

  async getFinancialProfile(id: string): Promise<StudentFinancialProfile> {
    const student = (await this.getById(id)) as Student;

    const payments = this.students.raw.all<{
      amount: number;
      payment_date: string;
      receipt_number: string;
    }>(
      `SELECT amount, payment_date, receipt_number FROM payments
       WHERE student_id = ? AND deleted_at IS NULL AND status = 'paid'
       ORDER BY payment_date DESC`,
      [id],
    );

    const invoices = this.students.raw.all<{
      amount_due: number;
      discount_amount: number;
      amount_paid: number;
    }>(
      `SELECT amount_due, discount_amount, amount_paid FROM invoices
       WHERE student_id = ? AND deleted_at IS NULL`,
      [id],
    );

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalOwed = invoices.reduce(
      (s, i) => s + (i.amount_due - i.discount_amount),
      0,
    );
    const outstandingBalance = totalOwed - totalPaid;

    return {
      student,
      totalPaid,
      totalOwed,
      outstandingBalance,
      lastPayment: payments[0]
        ? {
            amount: payments[0].amount,
            date: payments[0].payment_date,
            receiptNumber: payments[0].receipt_number,
          }
        : undefined,
      paymentCount: payments.length,
      scholarshipActive: false,
    };
  }

  async getPaymentTimeline(id: string): Promise<PaymentTimelineEntry[]> {
    const rows = this.students.raw.all<{
      period: string;
      label: string;
      amount_due: number;
      amount_paid: number;
    }>(
      `SELECT
         strftime('%Y-%m', issued_at) as period,
         strftime('%Y-%m', issued_at) as label,
         SUM(amount_due - discount_amount) as amount_due,
         SUM(amount_paid) as amount_paid
       FROM invoices
       WHERE student_id = ? AND deleted_at IS NULL
       GROUP BY period ORDER BY period`,
      [id],
    );

    return rows.map((r) => ({
      period: r.period,
      label: r.label,
      amountDue: r.amount_due,
      amountPaid: r.amount_paid,
      status:
        r.amount_paid >= r.amount_due
          ? "paid"
          : r.amount_paid > 0
            ? "partial"
            : "missing",
    }));
  }

  private validateInput(input: CreateStudentInput): void {
    if (!input.firstName?.trim())
      throw new ValidationError("First name is required");
    if (!input.lastName?.trim())
      throw new ValidationError("Last name is required");
    if (!input.dateOfBirth)
      throw new ValidationError("Date of birth is required");
    if (!input.parentIds?.length)
      throw new ValidationError("At least one parent is required");
    if (!input.address?.line1)
      throw new ValidationError("Address line 1 is required");
    if (!input.address?.city)
      throw new ValidationError("Address city is required");
  }
}
