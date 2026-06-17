/**
 * Parent repository — SQLite-backed.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { Parent, CreateParentInput, UpdateParentInput } from '../../core/entities/parent.entity';
import { Identifier } from '../../core/value-objects/identifier';
import { NotFoundError } from '../error/app-error';
import { BaseRepository } from './base.repository';

interface ParentRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  occupation: string | null;
  relationship: string;
  address_json: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ParentQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export class ParentRepository extends BaseRepository<Parent, ParentQuery> {
  constructor(db: DatabaseClient) {
    super(db, 'parents');
  }

  async findById(id: string): Promise<Parent | null> {
    const row = this.db.get<ParentRow>(
      'SELECT * FROM parents WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapRow(row, []) : null;
  }

  async list(query: ParentQuery = {}): Promise<Parent[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: Record<string, unknown> = {};

    if (query.search) {
      conditions.push('(full_name LIKE @search OR phone LIKE @search)');
      params.search = `%${query.search}%`;
    }

    const pageSize = query.pageSize ?? 100;
    const page = query.page ?? 1;
    const offset = (page - 1) * pageSize;

    const rows = this.db.all<ParentRow>(
      `SELECT * FROM parents WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    // Denormalised studentIds — query students table to populate.
    return Promise.all(rows.map(async (r) => {
      const studentIds = await this.getStudentIds(r.id);
      return this.mapRow(r, studentIds);
    }));
  }

  async create(input: CreateParentInput): Promise<Parent> {
    const id = Identifier.generate<'Parent'>().value;
    const now = this.now();
    const fullName = `${input.firstName} ${input.lastName}`;

    this.db.run(
      `INSERT INTO parents (id, first_name, last_name, full_name, phone, alt_phone, email,
        occupation, relationship, address_json, notes, created_at, updated_at)
       VALUES (@id, @first, @last, @fullName, @phone, @altPhone, @email,
        @occupation, @relationship, @address, @notes, @createdAt, @updatedAt)`,
      {
        id,
        first: input.firstName,
        last: input.lastName,
        fullName,
        phone: input.phone,
        altPhone: input.altPhone ?? null,
        email: input.email ?? null,
        occupation: input.occupation ?? null,
        relationship: input.relationship,
        address: input.address ? this.stringifyJson(input.address) : null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now
      }
    );

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('Parent', id);
    return created;
  }

  async update(id: string, patch: UpdateParentInput): Promise<Parent> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Parent', id);

    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.firstName !== undefined) { sets.push('first_name = @firstName'); params.firstName = patch.firstName; }
    if (patch.lastName !== undefined) { sets.push('last_name = @lastName'); params.lastName = patch.lastName; }
    if (patch.phone !== undefined) { sets.push('phone = @phone'); params.phone = patch.phone; }
    if (patch.altPhone !== undefined) { sets.push('alt_phone = @altPhone'); params.altPhone = patch.altPhone; }
    if (patch.email !== undefined) { sets.push('email = @email'); params.email = patch.email; }
    if (patch.occupation !== undefined) { sets.push('occupation = @occupation'); params.occupation = patch.occupation; }
    if (patch.relationship !== undefined) { sets.push('relationship = @relationship'); params.relationship = patch.relationship; }
    if (patch.address !== undefined) { sets.push('address_json = @address'); params.address = this.stringifyJson(patch.address); }
    if (patch.notes !== undefined) { sets.push('notes = @notes'); params.notes = patch.notes; }

    if (patch.firstName || patch.lastName) {
      sets.push('full_name = @fullName');
      params.fullName = `${patch.firstName ?? existing.firstName} ${patch.lastName ?? existing.lastName}`;
    }

    this.db.run(`UPDATE parents SET ${sets.join(', ')} WHERE id = @id`, params);

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Parent', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      'UPDATE parents SET deleted_at = @now WHERE id = @id',
      { id, now: this.now() }
    );
  }

  async getStudentIds(parentId: string): Promise<string[]> {
    const rows = this.db.all<{ parent_ids_json: string }>(
      `SELECT parent_ids_json FROM students
       WHERE parent_ids_json LIKE @pattern AND deleted_at IS NULL`,
      { pattern: `%"${parentId}"%` }
    );
    const ids = new Set<string>();
    for (const row of rows) {
      const list = this.parseJson<string[]>(row.parent_ids_json, []);
      list.forEach((s) => ids.add(s));
    }
    return [...ids];
  }

  private mapRow(row: ParentRow, studentIds: string[]): Parent {
    return {
      id: Identifier.from<'Parent'>(row.id),
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      phone: row.phone,
      altPhone: row.alt_phone ?? undefined,
      email: row.email ?? undefined,
      occupation: row.occupation ?? undefined,
      relationship: row.relationship as Parent['relationship'],
      address: row.address_json ? this.parseJson<Parent['address']>(row.address_json, undefined as never) : undefined,
      notes: row.notes ?? undefined,
      studentIds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };
  }
}
