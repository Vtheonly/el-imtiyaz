/**
 * Payment & Invoice repositories — SQLite-backed.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { Payment, CreatePaymentInput, UpdatePaymentInput, Invoice, CreateInvoiceInput } from '../../core/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '../../core/enums';
import { Identifier } from '../../core/value-objects/identifier';
import { NotFoundError } from '../error/app-error';
import { BaseRepository } from './base.repository';

interface PaymentRow {
  id: string;
  receipt_number: string;
  student_id: string;
  parent_ids_json: string;
  invoice_ids_json: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  received_by_employee_id: string | null;
  notes: string | null;
  status: string;
  attachments_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  student_id: string;
  academic_year_id: string | null;
  term_id: string | null;
  type: string;
  description: string;
  amount_due: number;
  discount_amount: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
  issued_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PaymentQuery {
  search?: string;
  studentId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export class PaymentRepository extends BaseRepository<Payment, PaymentQuery> {
  constructor(db: DatabaseClient) {
    super(db, 'payments');
  }

  async findById(id: string): Promise<Payment | null> {
    const row = this.db.get<PaymentRow>(
      'SELECT * FROM payments WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async findByReceiptNumber(receiptNumber: string): Promise<Payment | null> {
    const row = this.db.get<PaymentRow>(
      'SELECT * FROM payments WHERE receipt_number = ?',
      [receiptNumber]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: PaymentQuery = {}): Promise<Payment[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: Record<string, unknown> = {};

    if (query.search) {
      conditions.push('(receipt_number LIKE @search)');
      params.search = `%${query.search}%`;
    }
    if (query.studentId) { conditions.push('student_id = @studentId'); params.studentId = query.studentId; }
    if (query.status) { conditions.push('status = @status'); params.status = query.status; }
    if (query.method) { conditions.push('payment_method = @method'); params.method = query.method; }
    if (query.from) { conditions.push('payment_date >= @from'); params.from = query.from; }
    if (query.to) { conditions.push('payment_date <= @to'); params.to = query.to; }

    const pageSize = query.pageSize ?? 100;
    const page = query.page ?? 1;
    const offset = (page - 1) * pageSize;

    const rows = this.db.all<PaymentRow>(
      `SELECT * FROM payments WHERE ${conditions.join(' AND ')}
       ORDER BY payment_date DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreatePaymentInput & { receiptNumber?: string }): Promise<Payment> {
    const id = Identifier.generate<'Payment'>().value;
    const receiptNumber = input.receiptNumber ?? await this.generateReceiptNumber();
    const now = this.now();
    const paymentDate = input.paymentDate ?? now;

    this.db.run(
      `INSERT INTO payments (id, receipt_number, student_id, parent_ids_json, invoice_ids_json,
        amount, payment_date, payment_method, reference, received_by_employee_id, notes,
        status, attachments_json, created_at, updated_at)
       VALUES (@id, @receiptNumber, @studentId, @parents, @invoices,
        @amount, @paymentDate, @method, @reference, @employeeId, @notes,
        @status, @attachments, @createdAt, @updatedAt)`,
      {
        id,
        receiptNumber,
        studentId: input.studentId,
        parents: this.stringifyJson(input.parentIds ?? []),
        invoices: this.stringifyJson(input.invoiceIds ?? []),
        amount: input.amount,
        paymentDate,
        method: input.paymentMethod,
        reference: input.reference ?? null,
        employeeId: input.receivedByEmployeeId ?? null,
        notes: input.notes ?? null,
        status: PaymentStatus.PAID,
        attachments: this.stringifyJson([]),
        createdAt: now,
        updatedAt: now
      }
    );

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('Payment', id);
    return created;
  }

  async update(id: string, patch: UpdatePaymentInput): Promise<Payment> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Payment', id);

    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.amount !== undefined) { sets.push('amount = @amount'); params.amount = patch.amount; }
    if (patch.paymentDate !== undefined) { sets.push('payment_date = @paymentDate'); params.paymentDate = patch.paymentDate; }
    if (patch.paymentMethod !== undefined) { sets.push('payment_method = @method'); params.method = patch.paymentMethod; }
    if (patch.reference !== undefined) { sets.push('reference = @reference'); params.reference = patch.reference; }
    if (patch.notes !== undefined) { sets.push('notes = @notes'); params.notes = patch.notes; }
    if (patch.status !== undefined) { sets.push('status = @status'); params.status = patch.status; }
    if (patch.invoiceIds !== undefined) { sets.push('invoice_ids_json = @invoices'); params.invoices = this.stringifyJson(patch.invoiceIds); }
    if (patch.parentIds !== undefined) { sets.push('parent_ids_json = @parents'); params.parents = this.stringifyJson(patch.parentIds); }

    this.db.run(`UPDATE payments SET ${sets.join(', ')} WHERE id = @id`, params);

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Payment', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      'UPDATE payments SET deleted_at = @now WHERE id = @id',
      { id, now: this.now() }
    );
  }

  async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const row = this.db.get<{ receipt_number: string }>(
      `SELECT receipt_number FROM payments
       WHERE receipt_number LIKE 'RCP-' || @year || '-%'
       ORDER BY receipt_number DESC LIMIT 1`,
      { year }
    );

    let next = 1;
    if (row?.receipt_number) {
      const match = row.receipt_number.match(/RCP-\d{4}-(\d+)/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `RCP-${year}-${String(next).padStart(5, '0')}`;
  }

  async sumAmounts(where: string, params: Record<string, unknown>): Promise<number> {
    const row = this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE deleted_at IS NULL AND ${where}`,
      params
    );
    return row?.total ?? 0;
  }

  private mapRow(row: PaymentRow): Payment {
    return {
      id: Identifier.from<'Payment'>(row.id),
      receiptNumber: row.receipt_number,
      studentId: row.student_id,
      parentIds: this.parseJson<string[]>(row.parent_ids_json, []),
      invoiceIds: this.parseJson<string[]>(row.invoice_ids_json, []),
      amount: row.amount,
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method as PaymentMethod,
      reference: row.reference ?? undefined,
      receivedByEmployeeId: row.received_by_employee_id ?? undefined,
      notes: row.notes ?? undefined,
      status: row.status as PaymentStatus,
      attachments: this.parseJson<string[]>(row.attachments_json, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };
  }
}

export class InvoiceRepository extends BaseRepository<Invoice, { studentId?: string; status?: PaymentStatus; type?: string }> {
  constructor(db: DatabaseClient) {
    super(db, 'invoices');
  }

  async findById(id: string): Promise<Invoice | null> {
    const row = this.db.get<InvoiceRow>(
      'SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: { studentId?: string; status?: PaymentStatus; type?: string } = {}): Promise<Invoice[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: Record<string, unknown> = {};

    if (query.studentId) { conditions.push('student_id = @studentId'); params.studentId = query.studentId; }
    if (query.status) { conditions.push('status = @status'); params.status = query.status; }
    if (query.type) { conditions.push('type = @type'); params.type = query.type; }

    const rows = this.db.all<InvoiceRow>(
      `SELECT * FROM invoices WHERE ${conditions.join(' AND ')} ORDER BY issued_at DESC`,
      params
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateInvoiceInput & { invoiceNumber?: string }): Promise<Invoice> {
    const id = Identifier.generate<'Invoice'>().value;
    const invoiceNumber = input.invoiceNumber ?? await this.generateInvoiceNumber();
    const now = this.now();

    this.db.run(
      `INSERT INTO invoices (id, invoice_number, student_id, academic_year_id, term_id,
        type, description, amount_due, discount_amount, amount_paid, status, due_date,
        issued_at, created_at, updated_at)
       VALUES (@id, @number, @studentId, @academicYearId, @termId,
        @type, @description, @amountDue, @discount, @amountPaid, @status, @dueDate,
        @issuedAt, @createdAt, @updatedAt)`,
      {
        id,
        number: invoiceNumber,
        studentId: input.studentId,
        academicYearId: input.academicYearId ?? null,
        termId: input.termId ?? null,
        type: input.type,
        description: input.description,
        amountDue: input.amountDue,
        discount: input.discountAmount ?? 0,
        amountPaid: 0,
        status: PaymentStatus.PENDING,
        dueDate: input.dueDate ?? null,
        issuedAt: now,
        createdAt: now,
        updatedAt: now
      }
    );

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('Invoice', id);
    return created;
  }

  async update(id: string, patch: Partial<Invoice>): Promise<Invoice> {
    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.amountPaid !== undefined) { sets.push('amount_paid = @amountPaid'); params.amountPaid = patch.amountPaid; }
    if (patch.amountDue !== undefined) { sets.push('amount_due = @amountDue'); params.amountDue = patch.amountDue; }
    if (patch.discountAmount !== undefined) { sets.push('discount_amount = @discount'); params.discount = patch.discountAmount; }
    if (patch.status !== undefined) { sets.push('status = @status'); params.status = patch.status; }
    if (patch.dueDate !== undefined) { sets.push('due_date = @dueDate'); params.dueDate = patch.dueDate; }
    if (patch.description !== undefined) { sets.push('description = @description'); params.description = patch.description; }

    this.db.run(`UPDATE invoices SET ${sets.join(', ')} WHERE id = @id`, params);

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Invoice', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      'UPDATE invoices SET deleted_at = @now WHERE id = @id',
      { id, now: this.now() }
    );
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const row = this.db.get<{ n: string }>(
      `SELECT invoice_number as n FROM invoices
       WHERE invoice_number LIKE 'INV-' || @year || '-%'
       ORDER BY invoice_number DESC LIMIT 1`,
      { year }
    );
    let next = 1;
    if (row?.n) {
      const match = row.n.match(/INV-\d{4}-(\d+)/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `INV-${year}-${String(next).padStart(5, '0')}`;
  }

  private mapRow(row: InvoiceRow): Invoice {
    return {
      id: Identifier.from<'Invoice'>(row.id),
      invoiceNumber: row.invoice_number,
      studentId: row.student_id,
      academicYearId: row.academic_year_id ?? undefined,
      termId: row.term_id ?? undefined,
      type: row.type as Invoice['type'],
      description: row.description,
      amountDue: row.amount_due,
      discountAmount: row.discount_amount,
      amountPaid: row.amount_paid,
      status: row.status as PaymentStatus,
      dueDate: row.due_date ?? undefined,
      issuedAt: row.issued_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };
  }
}
