/**
 * Receipt repository — SQLite-backed. Stores receipt metadata + path to the
 * generated PDF on disk.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { Receipt } from '../../core/entities/receipt.entity';
import { Identifier } from '../../core/value-objects/identifier';
import { BaseRepository } from './base.repository';

interface ReceiptRow {
  id: string;
  receipt_number: string;
  payment_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  generated_at: string;
  generated_by_employee_id: string | null;
  pdf_path: string;
  qr_payload: string;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
}

export class ReceiptRepository extends BaseRepository<Receipt> {
  constructor(db: DatabaseClient) {
    super(db, 'receipts');
  }

  async findById(id: string): Promise<Receipt | null> {
    const row = this.db.get<ReceiptRow>('SELECT * FROM receipts WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async list(query: { studentId?: string; paymentId?: string; from?: string; to?: string } = {}): Promise<Receipt[]> {
    const conditions: string[] = ['1=1'];
    const params: Record<string, unknown> = {};

    if (query.studentId) { conditions.push('student_id = @studentId'); params.studentId = query.studentId; }
    if (query.paymentId) { conditions.push('payment_id = @paymentId'); params.paymentId = query.paymentId; }
    if (query.from) { conditions.push('generated_at >= @from'); params.from = query.from; }
    if (query.to) { conditions.push('generated_at <= @to'); params.to = query.to; }

    const rows = this.db.all<ReceiptRow>(
      `SELECT * FROM receipts WHERE ${conditions.join(' AND ')} ORDER BY generated_at DESC`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Receipt> {
    const id = Identifier.generate<'Receipt'>().value;
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO receipts (id, receipt_number, payment_id, student_id, amount, payment_date,
        generated_at, generated_by_employee_id, pdf_path, qr_payload, voided_at, voided_by,
        created_at, updated_at)
       VALUES (@id, @number, @paymentId, @studentId, @amount, @paymentDate,
        @generatedAt, @generatedBy, @pdfPath, @qrPayload, NULL, NULL, @createdAt, @updatedAt)`,
      {
        id,
        number: input.receiptNumber,
        paymentId: input.paymentId,
        studentId: input.studentId,
        amount: input.amount,
        paymentDate: input.paymentDate,
        generatedAt: input.generatedAt,
        generatedBy: input.generatedByEmployeeId ?? null,
        pdfPath: input.pdfPath,
        qrPayload: input.qrPayload,
        createdAt: now,
        updatedAt: now
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<Receipt>): Promise<Receipt> {
    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

    if (patch.voidedAt !== undefined) { sets.push('voided_at = @voidedAt'); params.voidedAt = patch.voidedAt; }
    if (patch.voidedBy !== undefined) { sets.push('voided_by = @voidedBy'); params.voidedBy = patch.voidedBy; }

    this.db.run(`UPDATE receipts SET ${sets.join(', ')} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run('DELETE FROM receipts WHERE id = ?', [id]);
  }

  private mapRow(row: ReceiptRow): Receipt {
    return {
      id: Identifier.from<'Receipt'>(row.id),
      receiptNumber: row.receipt_number,
      paymentId: row.payment_id,
      studentId: row.student_id,
      amount: row.amount,
      paymentDate: row.payment_date,
      generatedAt: row.generated_at,
      generatedByEmployeeId: row.generated_by_employee_id ?? undefined,
      pdfPath: row.pdf_path,
      qrPayload: row.qr_payload,
      voidedAt: row.voided_at ?? undefined,
      voidedBy: row.voided_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
