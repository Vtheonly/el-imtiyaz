/**
 * Payment Audit Comment — replicates the Excel column-AM audit trail.
 *
 * In the Excel file, the bookkeeper manually logs each received payment
 * as a free-text comment on column AM of the corresponding pupil row,
 * using the format:
 *
 *   <amount>/<day>/<month><batch>
 *
 * Examples:
 *   239500/05/05             — 239 500 DZD paid on 05/05
 *   250000/07/05B11          — 250 000 DZD paid on 07/05, batch B11
 *   149000/19/05B12
 *   6000/20/05B12            — two payments on one cell, one per line
 *
 * Some entries are suffixed with "=====" to mark the file as closed.
 *
 * In-app we persist each payment audit comment as its own row so it can
 * be queried, filtered, and reconciled — while preserving the original
 * free-text notation for backward compatibility.
 */

import { Identifier } from "../value-objects/identifier";

export interface PaymentAuditComment {
  id: Identifier<"PaymentAuditComment">;
  /** Linked ledger entry (one-to-many: an entry can have many comments). */
  ledgerEntryId: string;
  /** Optional linked student (denormalised for fast filtering). */
  studentId?: string;
  /** Optional linked payment (if the comment maps to a real Payment row). */
  paymentId?: string;
  /** Raw comment text as captured (e.g. "250000/07/05B11"). */
  rawText: string;
  /** Parsed amount in DZD (null if unparseable). */
  amount: number | null;
  /** Parsed day-of-month (1–31). */
  day: number | null;
  /** Parsed month-of-year (1–12). */
  month: number | null;
  /** Parsed year (null = current year). */
  year: number | null;
  /** Parsed batch code (e.g. "B11", "B01", "B2"). */
  batch?: string;
  /** Whether this comment marks the entry as closed (======== suffix). */
  isClosed: boolean;
  /** Excel cell reference (e.g. "AM17") for traceability. */
  excelCell?: string;
  /** Excel row number this comment was imported from. */
  sourceRow?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentAuditCommentInput {
  ledgerEntryId: string;
  studentId?: string;
  paymentId?: string;
  rawText: string;
  excelCell?: string;
  sourceRow?: number;
}

/** Result of parsing a raw comment like "250000/07/05B11". */
export interface ParsedAuditComment {
  amount: number | null;
  day: number | null;
  month: number | null;
  year: number | null;
  batch?: string;
  isClosed: boolean;
  /** If the cell contains multiple lines, each line is parsed separately. */
  lines: Array<{
    raw: string;
    amount: number | null;
    day: number | null;
    month: number | null;
    year: number | null;
    batch?: string;
  }>;
}
