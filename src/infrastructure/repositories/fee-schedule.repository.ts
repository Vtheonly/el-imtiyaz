/**
 * Fee Schedule repository — persists editable pricing tiers.
 */

import type { DatabaseClient } from "../database/sqlite-client";
import type {
  FeeSchedule,
  FeeScheduleLine,
  CreateFeeScheduleInput,
  UpdateFeeScheduleInput,
} from "../../core/entities/fee-schedule.entity";
import { Identifier } from "../../core/value-objects/identifier";
import { BaseRepository } from "./base.repository";

interface FeeScheduleRow {
  id: string;
  name: string;
  description: string | null;
  grade_level: string;
  academic_year_id: string | null;
  lines_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface FeeScheduleQuery {
  gradeLevel?: string;
  academicYearId?: string;
  isActive?: boolean;
  search?: string;
}

export class FeeScheduleRepository extends BaseRepository<FeeSchedule, FeeScheduleQuery> {
  constructor(db: DatabaseClient) {
    super(db, "fee_schedules");
  }

  protected searchColumns(): string[] {
    return ["name", "description", "grade_level"];
  }

  async findById(id: string): Promise<FeeSchedule | null> {
    const row = this.db.get<FeeScheduleRow>(
      "SELECT * FROM fee_schedules WHERE id = ?",
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: FeeScheduleQuery = {}): Promise<FeeSchedule[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.gradeLevel) {
      conditions.push("(grade_level = @grade OR grade_level = 'ALL')");
      params.grade = query.gradeLevel;
    }
    if (query.academicYearId) {
      conditions.push("(academic_year_id = @ayid OR academic_year_id IS NULL)");
      params.ayid = query.academicYearId;
    }
    if (query.isActive !== undefined) {
      conditions.push("is_active = @active");
      params.active = query.isActive ? 1 : 0;
    }
    if (query.search) {
      conditions.push(`(${this.searchColumns().map((c) => `${c} LIKE @search`).join(" OR ")})`);
      params.search = `%${query.search}%`;
    }

    const sql = `SELECT * FROM fee_schedules
                 ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
                 ORDER BY grade_level, name`;
    const rows = this.db.all<FeeScheduleRow>(sql, params);
    return rows.map((r) => this.mapRow(r));
  }

  async findActive(): Promise<FeeSchedule | null> {
    const rows = this.db.all<FeeScheduleRow>(
      "SELECT * FROM fee_schedules WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1"
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(input: CreateFeeScheduleInput | Partial<FeeSchedule>): Promise<FeeSchedule> {
    const typed = input as CreateFeeScheduleInput;
    const id = Identifier.generate<"FeeSchedule">().value;
    const now = new Date().toISOString();
    const lines: FeeScheduleLine[] = typed.lines.map((l) => ({
      ...(l as object),
      id: Identifier.generate<"FeeSchedule">().value,
    }) as FeeScheduleLine);

    this.db.run(
      `INSERT INTO fee_schedules (id, name, description, grade_level, academic_year_id, lines_json, is_active, created_at, updated_at)
       VALUES (@id, @name, @description, @grade, @ayid, @lines, @active, @createdAt, @updatedAt)`,
      {
        id,
        name: typed.name,
        description: typed.description ?? null,
        grade: typed.gradeLevel,
        ayid: typed.academicYearId ?? null,
        lines: JSON.stringify(lines),
        active: typed.isActive === false ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: UpdateFeeScheduleInput | Partial<FeeSchedule>): Promise<FeeSchedule> {
    const sets: string[] = ["updated_at = @updatedAt"];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };
    const p = patch as UpdateFeeScheduleInput;

    if (p.name !== undefined) { sets.push("name = @name"); params.name = p.name; }
    if (p.description !== undefined) { sets.push("description = @description"); params.description = p.description; }
    if (p.gradeLevel !== undefined) { sets.push("grade_level = @grade"); params.grade = p.gradeLevel; }
    if (p.academicYearId !== undefined) { sets.push("academic_year_id = @ayid"); params.ayid = p.academicYearId; }
    if (p.lines !== undefined) {
      const lines = p.lines.map((l) => ({ ...(l as object), id: (l as { id?: string }).id || Identifier.generate<"FeeSchedule">().value }) as FeeScheduleLine);
      sets.push("lines_json = @lines");
      params.lines = JSON.stringify(lines);
    }
    if (p.isActive !== undefined) { sets.push("is_active = @active"); params.active = p.isActive ? 1 : 0; }

    this.db.run(`UPDATE fee_schedules SET ${sets.join(", ")} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run("DELETE FROM fee_schedules WHERE id = ?", [id]);
  }

  private mapRow(row: FeeScheduleRow): FeeSchedule {
    return {
      id: Identifier.from<"FeeSchedule">(row.id),
      name: row.name,
      description: row.description ?? undefined,
      gradeLevel: row.grade_level,
      academicYearId: row.academic_year_id ?? undefined,
      lines: this.parseJson<FeeScheduleLine[]>(row.lines_json, []),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
