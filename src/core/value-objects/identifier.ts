/**
 * Identifier — typed wrapper around UUID v4 strings.
 *
 * Carrying the entity type as a generic parameter prevents accidentally
 * passing a `Student` id where a `Payment` id is expected — the compiler
 * catches it instead of producing a silent data bug.
 */

import { v4 as uuidv4 } from 'uuid';

export type EntityTag = 'Student' | 'Parent' | 'Payment' | 'Invoice' | 'Class' |
  'Employee' | 'Attendance' | 'AcademicYear' | 'Receipt' | 'AuditLog' |
  'FeeTemplate' | 'Scholarship' | 'Term' | 'Workflow' | 'Notification' |
  // ── Excel-migration entities ─────────────────────────────────
  'LedgerEntry' | 'QuoteBlock' | 'FeeSchedule' | 'FormulaRule' |
  'PaymentAuditComment' | 'SpreadsheetTemplate';

export class Identifier<T extends EntityTag> {
  private constructor(public readonly value: string) {}

  static generate<T extends EntityTag>(): Identifier<T> {
    return new Identifier<T>(uuidv4());
  }

  static from<T extends EntityTag>(value: string): Identifier<T> {
    if (!value || typeof value !== 'string') {
      throw new Error(`Invalid identifier: ${value}`);
    }
    return new Identifier<T>(value);
  }

  equals(other: Identifier<T>): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
