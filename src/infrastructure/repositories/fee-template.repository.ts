/**
 * Fee template & scholarship repositories.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { FeeTemplate, CreateFeeTemplateInput, Scholarship } from '../../core/entities/fee-template.entity';
import { DiscountType } from '../../core/enums';
import { Identifier } from '../../core/value-objects/identifier';
import { BaseRepository } from './base.repository';

interface FeeTemplateRow {
  id: string;
  name: string;
  description: string | null;
  grade_level: string;
  items_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export class FeeTemplateRepository extends BaseRepository<FeeTemplate> {
  constructor(db: DatabaseClient) {
    super(db, 'fee_templates');
  }

  async findById(id: string): Promise<FeeTemplate | null> {
    const row = this.db.get<FeeTemplateRow>('SELECT * FROM fee_templates WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async list(): Promise<FeeTemplate[]> {
    const rows = this.db.all<FeeTemplateRow>(
      'SELECT * FROM fee_templates WHERE is_active = 1 ORDER BY grade_level, name'
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateFeeTemplateInput): Promise<FeeTemplate> {
    const id = Identifier.generate<'FeeTemplate'>().value;
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO fee_templates (id, name, description, grade_level, items_json, is_active, created_at, updated_at)
       VALUES (@id, @name, @description, @grade, @items, 1, @createdAt, @updatedAt)`,
      {
        id,
        name: input.name,
        description: input.description ?? null,
        grade: input.gradeLevel,
        items: JSON.stringify(input.items),
        createdAt: now,
        updatedAt: now
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<CreateFeeTemplateInput>): Promise<FeeTemplate> {
    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

    if (patch.name !== undefined) { sets.push('name = @name'); params.name = patch.name; }
    if (patch.description !== undefined) { sets.push('description = @description'); params.description = patch.description; }
    if (patch.gradeLevel !== undefined) { sets.push('grade_level = @grade'); params.grade = patch.gradeLevel; }
    if (patch.items !== undefined) { sets.push('items_json = @items'); params.items = JSON.stringify(patch.items); }

    this.db.run(`UPDATE fee_templates SET ${sets.join(', ')} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run('UPDATE fee_templates SET is_active = 0 WHERE id = ?', [id]);
  }

  private mapRow(row: FeeTemplateRow): FeeTemplate {
    return {
      id: Identifier.from<'FeeTemplate'>(row.id),
      name: row.name,
      description: row.description ?? undefined,
      gradeLevel: row.grade_level,
      items: JSON.parse(row.items_json),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

interface ScholarshipRow {
  id: string;
  student_id: string;
  type: string;
  percentage: number;
  reason: string;
  granted_by_employee_id: string | null;
  granted_at: string;
  valid_from: string;
  valid_until: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  is_active: number;
}

export class ScholarshipRepository extends BaseRepository<Scholarship> {
  constructor(db: DatabaseClient) {
    super(db, 'scholarships');
  }

  async findById(id: string): Promise<Scholarship | null> {
    const row = this.db.get<ScholarshipRow>('SELECT * FROM scholarships WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async list(): Promise<Scholarship[]> {
    const rows = this.db.all<ScholarshipRow>(
      'SELECT * FROM scholarships WHERE is_active = 1 ORDER BY granted_at DESC'
    );
    return rows.map((r) => this.mapRow(r));
  }

  async findByStudent(studentId: string): Promise<Scholarship[]> {
    const rows = this.db.all<ScholarshipRow>(
      'SELECT * FROM scholarships WHERE student_id = ? AND is_active = 1 ORDER BY granted_at DESC',
      [studentId]
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: Omit<Scholarship, 'id' | 'grantedAt' | 'isActive'>): Promise<Scholarship> {
    const id = Identifier.generate<'Scholarship'>().value;
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO scholarships (id, student_id, type, percentage, reason, granted_by_employee_id,
        granted_at, valid_from, valid_until, revoked_at, revoked_reason, is_active)
       VALUES (@id, @studentId, @type, @percentage, @reason, @grantedBy,
        @grantedAt, @validFrom, @validUntil, NULL, NULL, 1)`,
      {
        id,
        studentId: input.studentId,
        type: input.type,
        percentage: input.percentage,
        reason: input.reason,
        grantedBy: input.grantedByEmployeeId ?? null,
        grantedAt: now,
        validFrom: input.validFrom,
        validUntil: input.validUntil ?? null
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<Scholarship>): Promise<Scholarship> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };

    if (patch.revokedAt !== undefined) { sets.push('revoked_at = @revokedAt'); params.revokedAt = patch.revokedAt; }
    if (patch.revokedReason !== undefined) { sets.push('revoked_reason = @revokedReason'); params.revokedReason = patch.revokedReason; }
    if (patch.isActive !== undefined) { sets.push('is_active = @isActive'); params.isActive = patch.isActive ? 1 : 0; }

    if (sets.length > 0) {
      this.db.run(`UPDATE scholarships SET ${sets.join(', ')} WHERE id = @id`, params);
    }
    return (await this.findById(id))!;
  }

  async delete(_id: string): Promise<void> {
    throw new Error('Scholarships are revoked, not deleted (audit trail).');
  }

  private mapRow(row: ScholarshipRow): Scholarship {
    return {
      id: Identifier.from<'Scholarship'>(row.id),
      studentId: row.student_id,
      type: row.type as DiscountType,
      percentage: row.percentage,
      reason: row.reason,
      grantedByEmployeeId: row.granted_by_employee_id ?? '',
      grantedAt: row.granted_at,
      validFrom: row.valid_from,
      validUntil: row.valid_until ?? undefined,
      revokedAt: row.revoked_at ?? undefined,
      revokedReason: row.revoked_reason ?? undefined,
      isActive: !!row.is_active
    };
  }
}
