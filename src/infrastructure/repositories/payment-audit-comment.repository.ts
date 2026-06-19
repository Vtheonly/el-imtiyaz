/**
 * Payment Audit Comment repository — persists the Excel column-AM trail.
 */

import type { DatabaseClient } from "../database/sqlite-client";
import type {
  PaymentAuditComment,
  CreatePaymentAuditCommentInput,
} from "../../core/entities/payment-audit-comment.entity";
import { Identifier } from "../../core/value-objects/identifier";
import { BaseRepository } from "./base.repository";

interface AuditCommentRow {
  id: string;
  ledger_entry_id: string;
  student_id: string | null;
  payment_id: string | null;
  raw_text: string;
  amount: number | null;
  day: number | null;
  month: number | null;
  year: number | null;
  batch: string | null;
  is_closed: number;
  excel_cell: string | null;
  source_row: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditCommentQuery {
  ledgerEntryId?: string;
  studentId?: string;
  paymentId?: string;
  batch?: string;
  isClosed?: boolean;
  search?: string;
}

export class PaymentAuditCommentRepository extends BaseRepository<PaymentAuditComment, AuditCommentQuery> {
  constructor(db: DatabaseClient) {
    super(db, "payment_audit_comments");
  }

  protected searchColumns(): string[] {
    return ["raw_text", "batch"];
  }

  async findById(id: string): Promise<PaymentAuditComment | null> {
    const row = this.db.get<AuditCommentRow>(
      "SELECT * FROM payment_audit_comments WHERE id = ?",
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: AuditCommentQuery = {}): Promise<PaymentAuditComment[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.ledgerEntryId) {
      conditions.push("ledger_entry_id = @ledgerEntryId");
      params.ledgerEntryId = query.ledgerEntryId;
    }
    if (query.studentId) {
      conditions.push("student_id = @studentId");
      params.studentId = query.studentId;
    }
    if (query.paymentId) {
      conditions.push("payment_id = @paymentId");
      params.paymentId = query.paymentId;
    }
    if (query.batch) {
      conditions.push("batch = @batch");
      params.batch = query.batch;
    }
    if (query.isClosed !== undefined) {
      conditions.push("is_closed = @closed");
      params.closed = query.isClosed ? 1 : 0;
    }
    if (query.search) {
      conditions.push(`(${this.searchColumns().map((c) => `${c} LIKE @search`).join(" OR ")})`);
      params.search = `%${query.search}%`;
    }

    const sql = `SELECT * FROM payment_audit_comments
                 ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
                 ORDER BY created_at DESC`;
    const rows = this.db.all<AuditCommentRow>(sql, params);
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreatePaymentAuditCommentInput & Partial<PaymentAuditComment>): Promise<PaymentAuditComment> {
    const id = (input.id ?? Identifier.generate<"PaymentAuditComment">()).value;
    const now = new Date().toISOString();

    // Pre-parse the raw text into structured fields.
    const parsed = parseAuditComment(input.rawText);

    this.db.run(
      `INSERT INTO payment_audit_comments (
        id, ledger_entry_id, student_id, payment_id, raw_text,
        amount, day, month, year, batch, is_closed,
        excel_cell, source_row, created_at, updated_at
      ) VALUES (
        @id, @ledgerEntryId, @studentId, @paymentId, @rawText,
        @amount, @day, @month, @year, @batch, @closed,
        @excelCell, @sourceRow, @createdAt, @updatedAt
      )`,
      {
        id,
        ledgerEntryId: input.ledgerEntryId,
        studentId: input.studentId ?? null,
        paymentId: input.paymentId ?? null,
        rawText: input.rawText,
        amount: parsed.amount,
        day: parsed.day,
        month: parsed.month,
        year: parsed.year,
        batch: parsed.batch ?? null,
        closed: parsed.isClosed ? 1 : 0,
        excelCell: input.excelCell ?? null,
        sourceRow: input.sourceRow ?? null,
        createdAt: now,
        updatedAt: now,
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<PaymentAuditComment>): Promise<PaymentAuditComment> {
    const sets: string[] = ["updated_at = @updatedAt"];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

    if (patch.rawText !== undefined) {
      const parsed = parseAuditComment(patch.rawText);
      sets.push("raw_text = @rawText");
      sets.push("amount = @amount");
      sets.push("day = @day");
      sets.push("month = @month");
      sets.push("year = @year");
      sets.push("batch = @batch");
      sets.push("is_closed = @closed");
      params.rawText = patch.rawText;
      params.amount = parsed.amount;
      params.day = parsed.day;
      params.month = parsed.month;
      params.year = parsed.year;
      params.batch = parsed.batch ?? null;
      params.closed = parsed.isClosed ? 1 : 0;
    }
    if (patch.paymentId !== undefined) { sets.push("payment_id = @paymentId"); params.paymentId = patch.paymentId; }
    if (patch.studentId !== undefined) { sets.push("student_id = @studentId"); params.studentId = patch.studentId; }

    this.db.run(`UPDATE payment_audit_comments SET ${sets.join(", ")} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run("DELETE FROM payment_audit_comments WHERE id = ?", [id]);
  }

  private mapRow(row: AuditCommentRow): PaymentAuditComment {
    return {
      id: Identifier.from<"PaymentAuditComment">(row.id),
      ledgerEntryId: row.ledger_entry_id,
      studentId: row.student_id ?? undefined,
      paymentId: row.payment_id ?? undefined,
      rawText: row.raw_text,
      amount: row.amount,
      day: row.day,
      month: row.month,
      year: row.year,
      batch: row.batch ?? undefined,
      isClosed: !!row.is_closed,
      excelCell: row.excel_cell ?? undefined,
      sourceRow: row.source_row ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Parse a raw audit-comment string like:
 *   "250000/07/05B11"
 *   "149000/19/05B12\n6000/20/05B12"
 *   "50000/19/09 ======"
 * Returns structured fields plus a `lines` array (one entry per newline).
 * The aggregate `amount` is the sum of all lines.
 */
export function parseAuditComment(raw: string): {
  amount: number | null;
  day: number | null;
  month: number | null;
  year: number | null;
  batch?: string;
  isClosed: boolean;
} {
  const isClosed = /={3,}/.test(raw);
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/={3,}.*$/, "").trim()).filter(Boolean);

  let totalAmount = 0;
  let hasAmount = false;
  let firstDay: number | null = null;
  let firstMonth: number | null = null;
  let firstYear: number | null = null;
  let lastBatch: string | undefined;

  // Regex: <amount>/<day>/<month>(/<year>)?<batch?>
  const re = /(\d+)\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\s*(B\d+)?/i;

  for (const line of lines) {
    const m = re.exec(line);
    if (m) {
      const amount = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      const month = parseInt(m[3], 10);
      let year = m[4] ? parseInt(m[4], 10) : null;
      if (year !== null && year < 100) year += 2000;
      const batch = m[5];

      totalAmount += amount;
      hasAmount = true;
      if (firstDay === null) firstDay = day;
      if (firstMonth === null) firstMonth = month;
      if (firstYear === null) firstYear = year;
      if (batch) lastBatch = batch;
    }
  }

  return {
    amount: hasAmount ? totalAmount : null,
    day: firstDay,
    month: firstMonth,
    year: firstYear,
    batch: lastBatch,
    isClosed,
  };
}
