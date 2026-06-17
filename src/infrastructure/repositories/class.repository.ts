/**
 * Class repository — SQLite-backed.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { Class, CreateClassInput, UpdateClassInput } from '../../core/entities/class.entity';
import { Identifier } from '../../core/value-objects/identifier';
import { NotFoundError } from '../error/app-error';
import { BaseRepository } from './base.repository';

interface ClassRow {
  id: string;
  grade: string;
  section: string;
  name: string;
  classroom: string | null;
  capacity: number;
  homeroom_teacher_id: string | null;
  academic_year_id: string | null;
  enrolled_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ClassQuery {
  search?: string;
  grade?: string;
  academicYearId?: string;
  includeDeleted?: boolean;
}

export class ClassRepository extends BaseRepository<Class, ClassQuery> {
  constructor(db: DatabaseClient) {
    super(db, 'classes');
  }

  async findById(id: string): Promise<Class | null> {
    const row = this.db.get<ClassRow>(
      'SELECT * FROM classes WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: ClassQuery = {}): Promise<Class[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: Record<string, unknown> = {};

    if (query.search) {
      conditions.push('(name LIKE @search OR grade LIKE @search)');
      params.search = `%${query.search}%`;
    }
    if (query.grade) { conditions.push('grade = @grade'); params.grade = query.grade; }
    if (query.academicYearId) {
      conditions.push('academic_year_id = @academicYearId');
      params.academicYearId = query.academicYearId;
    }

    const rows = this.db.all<ClassRow>(
      `SELECT * FROM classes WHERE ${conditions.join(' AND ')} ORDER BY grade, section`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateClassInput): Promise<Class> {
    const id = Identifier.generate<'Class'>().value;
    const now = this.now();
    const name = `${input.grade} ${input.section}`;

    this.db.run(
      `INSERT INTO classes (id, grade, section, name, classroom, capacity,
        homeroom_teacher_id, academic_year_id, enrolled_count, created_at, updated_at)
       VALUES (@id, @grade, @section, @name, @classroom, @capacity,
        @teacher, @academicYearId, 0, @createdAt, @updatedAt)`,
      {
        id,
        grade: input.grade,
        section: input.section,
        name,
        classroom: input.classroom ?? null,
        capacity: input.capacity,
        teacher: input.homeroomTeacherId ?? null,
        academicYearId: input.academicYearId ?? null,
        createdAt: now,
        updatedAt: now
      }
    );

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('Class', id);
    return created;
  }

  async update(id: string, patch: UpdateClassInput): Promise<Class> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Class', id);

    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.grade !== undefined) { sets.push('grade = @grade'); params.grade = patch.grade; }
    if (patch.section !== undefined) { sets.push('section = @section'); params.section = patch.section; }
    if (patch.classroom !== undefined) { sets.push('classroom = @classroom'); params.classroom = patch.classroom; }
    if (patch.capacity !== undefined) { sets.push('capacity = @capacity'); params.capacity = patch.capacity; }
    if (patch.homeroomTeacherId !== undefined) { sets.push('homeroom_teacher_id = @teacher'); params.teacher = patch.homeroomTeacherId; }
    if (patch.academicYearId !== undefined) { sets.push('academic_year_id = @academicYearId'); params.academicYearId = patch.academicYearId; }

    if (patch.grade || patch.section) {
      sets.push('name = @name');
      params.name = `${patch.grade ?? existing.grade} ${patch.section ?? existing.section}`;
    }

    this.db.run(`UPDATE classes SET ${sets.join(', ')} WHERE id = @id`, params);

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Class', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      'UPDATE classes SET deleted_at = @now WHERE id = @id',
      { id, now: this.now() }
    );
  }

  async incrementEnrollment(classId: string, delta: number): Promise<void> {
    this.db.run(
      `UPDATE classes SET enrolled_count = MAX(0, enrolled_count + @delta), updated_at = @now
       WHERE id = @id`,
      { id: classId, delta, now: this.now() }
    );
  }

  private mapRow(row: ClassRow): Class {
    return {
      id: Identifier.from<'Class'>(row.id),
      grade: row.grade,
      section: row.section,
      name: row.name,
      classroom: row.classroom ?? undefined,
      capacity: row.capacity,
      homeroomTeacherId: row.homeroom_teacher_id ?? undefined,
      academicYearId: row.academic_year_id ?? undefined,
      enrolledCount: row.enrolled_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };
  }
}
