/**
 * Ledger Entry repository — persistence for Excel-style ledger rows.
 *
 * Each row maps to one row of the Excel `ETAT 20262027` sheet. The
 * repository is intentionally a thin CRUD layer — the calculation of
 * `devis_annuel`, `total_versements`, and `total_creance` lives in the
 * LedgerService (which calls this repo to persist results).
 */

import type { DatabaseClient } from "../database/sqlite-client";
import type {
  LedgerEntry,
  CreateLedgerEntryInput,
  UpdateLedgerEntryInput,
} from "../../core/entities/ledger-entry.entity";
import { Identifier } from "../../core/value-objects/identifier";
import { BaseRepository } from "./base.repository";

interface LedgerRow {
  id: string;
  student_id: string | null;
  academic_year_id: string | null;
  source_row: number | null;
  infos: string | null;
  email: string | null;
  phone_numbers: string | null;
  tutor_name: string | null;
  student_name: string;
  level: string | null;
  class_code: string | null;
  option_code: string | null;
  remise: number;
  justification: string | null;
  devis_annuel: number;
  total_versements: number;
  total_creance: number;
  reimbursement: number;
  prior_debt: number;
  debt_settlement: number;
  fi: number;
  v2: number;
  alt_v2: number;
  v3: number;
  destination: string | null;
  t1: number;
  t2: number;
  t3: number;
  psy1: number;
  psy2: number;
  orth1: number;
  orth2: number;
  e_plant: number;
  ratrapage: number;
  september: number;
  september_balance: number | null;
  december: number;
  december_balance: number | null;
  march: number;
  march_balance: number | null;
  grand_total: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LedgerQuery {
  studentId?: string;
  academicYearId?: string;
  classCode?: string;
  level?: string;
  search?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export class LedgerRepository extends BaseRepository<LedgerEntry, LedgerQuery> {
  constructor(db: DatabaseClient) {
    super(db, "ledger_entries");
  }

  protected searchColumns(): string[] {
    return ["student_name", "tutor_name", "phone_numbers", "infos"];
  }

  async findById(id: string): Promise<LedgerEntry | null> {
    const row = this.db.get<LedgerRow>(
      "SELECT * FROM ledger_entries WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: LedgerQuery = {}): Promise<LedgerEntry[]> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (query.studentId) {
      conditions.push("student_id = ?");
      params.push(query.studentId);
    }
    if (query.academicYearId) {
      conditions.push("academic_year_id = ?");
      params.push(query.academicYearId);
    }
    if (query.classCode) {
      conditions.push("class_code = ?");
      params.push(query.classCode);
    }
    if (query.level) {
      conditions.push("level = ?");
      params.push(query.level);
    }
    if (query.search) {
      conditions.push(
        `(${this.searchColumns().map((c) => `${c} LIKE ?`).join(" OR ")})`
      );
      params.push(`%${query.search}%`);
    }

    const pageSize = query.pageSize ?? 500;
    const offset = ((query.page ?? 1) - 1) * pageSize;
    const sql = `SELECT * FROM ledger_entries WHERE ${conditions.join(" AND ")}
                 ORDER BY student_name ASC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);
    const rows = this.db.all<LedgerRow>(sql, params);
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateLedgerEntryInput & Partial<LedgerEntry>): Promise<LedgerEntry> {
    const id = (input.id ?? Identifier.generate<"LedgerEntry">()).value;
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO ledger_entries (
        id, student_id, academic_year_id, source_row,
        infos, email, phone_numbers, tutor_name, student_name, level, class_code, option_code,
        remise, justification, devis_annuel, total_versements, total_creance,
        reimbursement, prior_debt, debt_settlement,
        fi, v2, alt_v2, v3, destination, t1, t2, t3,
        psy1, psy2, orth1, orth2, e_plant, ratrapage,
        september, september_balance, december, december_balance, march, march_balance,
        grand_total, created_at, updated_at
      ) VALUES (
        @id, @studentId, @academicYearId, @sourceRow,
        @infos, @email, @phoneNumbers, @tutorName, @studentName, @level, @classCode, @optionCode,
        @remise, @justification, @devisAnnuel, @totalVersements, @totalCreance,
        @reimbursement, @priorDebt, @debtSettlement,
        @fi, @v2, @altV2, @v3, @destination, @t1, @t2, @t3,
        @psy1, @psy2, @orth1, @orth2, @ePlant, @ratrapage,
        @september, @septemberBalance, @december, @decemberBalance, @march, @marchBalance,
        @grandTotal, @createdAt, @updatedAt
      )`,
      {
        id,
        studentId: input.studentId ?? null,
        academicYearId: input.academicYearId ?? null,
        sourceRow: input.sourceRow ?? null,
        infos: input.infos ?? null,
        email: input.email ?? null,
        phoneNumbers: input.phoneNumbers ?? "",
        tutorName: input.tutorName ?? null,
        studentName: input.studentName,
        level: input.level ?? null,
        classCode: input.classCode ?? null,
        optionCode: input.optionCode ?? null,
        remise: input.remise ?? 0,
        justification: input.justification ?? null,
        devisAnnuel: input.devisAnnuel ?? 0,
        totalVersements: input.totalVersements ?? 0,
        totalCreance: input.totalCreance ?? 0,
        reimbursement: input.reimbursement ?? 0,
        priorDebt: input.priorDebt ?? 0,
        debtSettlement: input.debtSettlement ?? 0,
        fi: input.fi ?? 0,
        v2: input.v2 ?? 0,
        altV2: input.altV2 ?? 0,
        v3: input.v3 ?? 0,
        destination: input.destination ?? null,
        t1: input.t1 ?? 0,
        t2: input.t2 ?? 0,
        t3: input.t3 ?? 0,
        psy1: input.psy1 ?? 0,
        psy2: input.psy2 ?? 0,
        orth1: input.orth1 ?? 0,
        orth2: input.orth2 ?? 0,
        ePlant: input.ePlant ?? 0,
        ratrapage: input.ratrapage ?? 0,
        september: input.september ?? 0,
        septemberBalance: input.septemberBalance ?? null,
        december: input.december ?? 0,
        decemberBalance: input.decemberBalance ?? null,
        march: input.march ?? 0,
        marchBalance: input.marchBalance ?? null,
        grandTotal: input.grandTotal ?? 0,
        createdAt: now,
        updatedAt: now,
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: UpdateLedgerEntryInput & Partial<LedgerEntry>): Promise<LedgerEntry> {
    const sets: string[] = ["updated_at = @updatedAt"];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

    const fieldMap: Record<string, string> = {
      studentId: "student_id",
      academicYearId: "academic_year_id",
      sourceRow: "source_row",
      infos: "infos",
      email: "email",
      phoneNumbers: "phone_numbers",
      tutorName: "tutor_name",
      studentName: "student_name",
      level: "level",
      classCode: "class_code",
      optionCode: "option_code",
      remise: "remise",
      justification: "justification",
      devisAnnuel: "devis_annuel",
      totalVersements: "total_versements",
      totalCreance: "total_creance",
      reimbursement: "reimbursement",
      priorDebt: "prior_debt",
      debtSettlement: "debt_settlement",
      fi: "fi",
      v2: "v2",
      altV2: "alt_v2",
      v3: "v3",
      destination: "destination",
      t1: "t1",
      t2: "t2",
      t3: "t3",
      psy1: "psy1",
      psy2: "psy2",
      orth1: "orth1",
      orth2: "orth2",
      ePlant: "e_plant",
      ratrapage: "ratrapage",
      september: "september",
      septemberBalance: "september_balance",
      december: "december",
      decemberBalance: "december_balance",
      march: "march",
      marchBalance: "march_balance",
      grandTotal: "grand_total",
    };

    for (const [jsField, sqlCol] of Object.entries(fieldMap)) {
      if (patch[jsField as keyof typeof patch] !== undefined) {
        sets.push(`${sqlCol} = @${jsField}`);
        params[jsField] = patch[jsField as keyof typeof patch];
      }
    }

    this.db.run(`UPDATE ledger_entries SET ${sets.join(", ")} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      "UPDATE ledger_entries SET deleted_at = @now WHERE id = @id",
      { id, now: new Date().toISOString() }
    );
  }

  /** Bulk recompute & persist `devis_annuel`/`total_versements`/`total_creance`. */
  async bulkUpdateComputed(
    updates: Array<{ id: string; devisAnnuel: number; totalVersements: number; totalCreance: number; grandTotal?: number }>
  ): Promise<number> {
    let touched = 0;
    const now = new Date().toISOString();
    for (const u of updates) {
      this.db.run(
        `UPDATE ledger_entries
           SET devis_annuel = @devisAnnuel,
               total_versements = @totalVersements,
               total_creance = @totalCreance,
               grand_total = COALESCE(@grandTotal, grand_total),
               updated_at = @now
         WHERE id = @id`,
        {
          id: u.id,
          devisAnnuel: u.devisAnnuel,
          totalVersements: u.totalVersements,
          totalCreance: u.totalCreance,
          grandTotal: u.grandTotal ?? null,
          now,
        }
      );
      touched++;
    }
    return touched;
  }

  private mapRow(row: LedgerRow): LedgerEntry {
    return {
      id: Identifier.from<"LedgerEntry">(row.id),
      studentId: row.student_id ?? undefined,
      academicYearId: row.academic_year_id ?? undefined,
      sourceRow: row.source_row ?? undefined,
      infos: row.infos ?? undefined,
      email: row.email ?? undefined,
      phoneNumbers: row.phone_numbers ?? "",
      tutorName: row.tutor_name ?? undefined,
      studentName: row.student_name,
      level: row.level ?? undefined,
      classCode: row.class_code ?? undefined,
      optionCode: row.option_code ?? undefined,
      remise: row.remise,
      justification: row.justification ?? undefined,
      devisAnnuel: row.devis_annuel,
      totalVersements: row.total_versements,
      totalCreance: row.total_creance,
      reimbursement: row.reimbursement,
      priorDebt: row.prior_debt,
      debtSettlement: row.debt_settlement,
      fi: row.fi,
      v2: row.v2,
      altV2: row.alt_v2,
      v3: row.v3,
      destination: row.destination ?? undefined,
      t1: row.t1,
      t2: row.t2,
      t3: row.t3,
      psy1: row.psy1,
      psy2: row.psy2,
      orth1: row.orth1,
      orth2: row.orth2,
      ePlant: row.e_plant,
      ratrapage: row.ratrapage,
      september: row.september,
      septemberBalance: row.september_balance ?? undefined,
      december: row.december,
      decemberBalance: row.december_balance ?? undefined,
      march: row.march,
      marchBalance: row.march_balance ?? undefined,
      grandTotal: row.grand_total,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
