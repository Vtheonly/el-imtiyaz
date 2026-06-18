/**
 * Attendance repository — SQLite-backed. Leverages the UNIQUE constraint
 * on (student_id, class_id, date) to support upserts.
 */

import type { DatabaseClient } from "../database/sqlite-client";
import type {
  Attendance,
  CreateAttendanceInput,
  UpdateAttendanceInput,
} from "../../core/entities/attendance.entity";
import { AttendanceStatus } from "../../core/enums";
import { Identifier } from "../../core/value-objects/identifier";
import { BaseRepository } from "./base.repository";

interface AttendanceRow {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: string;
  arrived_at: string | null;
  left_early_at: string | null;
  notes: string | null;
  recorded_by_employee_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceQuery {
  studentId?: string;
  classId?: string;
  date?: string;
  from?: string;
  to?: string;
  status?: AttendanceStatus;
}

export class AttendanceRepository extends BaseRepository<
  Attendance,
  AttendanceQuery
> {
  constructor(db: DatabaseClient) {
    super(db, "attendance");
  }

  async findById(id: string): Promise<Attendance | null> {
    const row = this.db.get<AttendanceRow>(
      "SELECT * FROM attendance WHERE id = ?",
      [id],
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: AttendanceQuery = {}): Promise<Attendance[]> {
    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];

    if (query.studentId) {
      conditions.push("student_id = ?");
      params.push(query.studentId);
    }
    if (query.classId) {
      conditions.push("class_id = ?");
      params.push(query.classId);
    }
    if (query.date) {
      conditions.push("date = ?");
      params.push(query.date);
    }
    if (query.from) {
      conditions.push("date >= ?");
      params.push(query.from);
    }
    if (query.to) {
      conditions.push("date <= ?");
      params.push(query.to);
    }
    if (query.status) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    const rows = this.db.all<AttendanceRow>(
      `SELECT * FROM attendance WHERE ${conditions.join(" AND ")} ORDER BY date DESC, created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateAttendanceInput): Promise<Attendance> {
    const id = Identifier.generate<"Attendance">().value;
    const now = this.now();

    this.db.run(
      `INSERT INTO attendance (id, student_id, class_id, date, status, arrived_at,
        left_early_at, notes, recorded_by_employee_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, class_id, date) DO UPDATE SET
        status = excluded.status,
        arrived_at = excluded.arrived_at,
        left_early_at = excluded.left_early_at,
        notes = excluded.notes,
        recorded_by_employee_id = excluded.recorded_by_employee_id,
        updated_at = excluded.updated_at`,
      [
        id,
        input.studentId,
        input.classId,
        input.date,
        input.status,
        input.arrivedAt ?? null,
        input.leftEarlyAt ?? null,
        input.notes ?? null,
        input.recordedByEmployeeId ?? null,
        now,
        now,
      ],
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: UpdateAttendanceInput): Promise<Attendance> {
    const sets: string[] = ["updated_at = ?"];
    const params: unknown[] = [this.now()];

    if (patch.status !== undefined) {
      sets.push("status = ?");
      params.push(patch.status);
    }
    if (patch.arrivedAt !== undefined) {
      sets.push("arrived_at = ?");
      params.push(patch.arrivedAt);
    }
    if (patch.leftEarlyAt !== undefined) {
      sets.push("left_early_at = ?");
      params.push(patch.leftEarlyAt);
    }
    if (patch.notes !== undefined) {
      sets.push("notes = ?");
      params.push(patch.notes);
    }

    params.push(id);
    this.db.run(
      `UPDATE attendance SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run("DELETE FROM attendance WHERE id = ?", [id]);
  }

  private mapRow(row: AttendanceRow): Attendance {
    return {
      id: Identifier.from<"Attendance">(row.id),
      studentId: row.student_id,
      classId: row.class_id,
      date: row.date,
      status: row.status as AttendanceStatus,
      arrivedAt: row.arrived_at ?? undefined,
      leftEarlyAt: row.left_early_at ?? undefined,
      notes: row.notes ?? undefined,
      recordedByEmployeeId: row.recorded_by_employee_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
