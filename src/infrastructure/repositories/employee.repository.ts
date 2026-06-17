/**
 * Employee repository — SQLite-backed.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { Employee, CreateEmployeeInput, UpdateEmployeeInput } from '../../core/entities/employee.entity';
import { UserRole } from '../../core/enums';
import { Identifier } from '../../core/value-objects/identifier';
import { NotFoundError } from '../error/app-error';
import { BaseRepository } from './base.repository';

interface EmployeeRow {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  title: string | null;
  class_ids_json: string;
  salary: number | null;
  hired_at: string;
  left_at: string | null;
  is_active: number;
  permissions_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface EmployeeQuery {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export class EmployeeRepository extends BaseRepository<Employee, EmployeeQuery> {
  constructor(db: DatabaseClient) {
    super(db, 'employees');
  }

  async findById(id: string): Promise<Employee | null> {
    const row = this.db.get<EmployeeRow>(
      'SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: EmployeeQuery = {}): Promise<Employee[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: Record<string, unknown> = {};

    if (query.search) {
      conditions.push('(full_name LIKE @search OR employee_code LIKE @search)');
      params.search = `%${query.search}%`;
    }
    if (query.role) { conditions.push('role = @role'); params.role = query.role; }
    if (query.isActive !== undefined) {
      conditions.push('is_active = @isActive');
      params.isActive = query.isActive ? 1 : 0;
    }

    const rows = this.db.all<EmployeeRow>(
      `SELECT * FROM employees WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateEmployeeInput & { employeeCode?: string }): Promise<Employee> {
    const id = Identifier.generate<'Employee'>().value;
    const code = input.employeeCode ?? await this.generateEmployeeCode();
    const now = this.now();
    const fullName = `${input.firstName} ${input.lastName}`;

    this.db.run(
      `INSERT INTO employees (id, employee_code, first_name, last_name, full_name,
        email, phone, role, title, class_ids_json, salary, hired_at, is_active,
        permissions_json, created_at, updated_at)
       VALUES (@id, @code, @first, @last, @fullName, @email, @phone, @role, @title,
        @classIds, @salary, @hiredAt, 1, '[]', @createdAt, @updatedAt)`,
      {
        id,
        code,
        first: input.firstName,
        last: input.lastName,
        fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        role: input.role,
        title: input.title ?? null,
        classIds: this.stringifyJson(input.classIds ?? []),
        salary: input.salary ?? null,
        hiredAt: input.hiredAt ?? now,
        createdAt: now,
        updatedAt: now
      }
    );

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('Employee', id);
    return created;
  }

  async update(id: string, patch: UpdateEmployeeInput): Promise<Employee> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Employee', id);

    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.firstName !== undefined) { sets.push('first_name = @firstName'); params.firstName = patch.firstName; }
    if (patch.lastName !== undefined) { sets.push('last_name = @lastName'); params.lastName = patch.lastName; }
    if (patch.email !== undefined) { sets.push('email = @email'); params.email = patch.email; }
    if (patch.phone !== undefined) { sets.push('phone = @phone'); params.phone = patch.phone; }
    if (patch.role !== undefined) { sets.push('role = @role'); params.role = patch.role; }
    if (patch.title !== undefined) { sets.push('title = @title'); params.title = patch.title; }
    if (patch.classIds !== undefined) { sets.push('class_ids_json = @classIds'); params.classIds = this.stringifyJson(patch.classIds); }
    if (patch.salary !== undefined) { sets.push('salary = @salary'); params.salary = patch.salary; }
    if (patch.isActive !== undefined) { sets.push('is_active = @isActive'); params.isActive = patch.isActive ? 1 : 0; }
    if (patch.leftAt !== undefined) { sets.push('left_at = @leftAt'); params.leftAt = patch.leftAt; }
    if (patch.permissions !== undefined) { sets.push('permissions_json = @perms'); params.perms = this.stringifyJson(patch.permissions); }

    if (patch.firstName || patch.lastName) {
      sets.push('full_name = @fullName');
      params.fullName = `${patch.firstName ?? existing.firstName} ${patch.lastName ?? existing.lastName}`;
    }

    this.db.run(`UPDATE employees SET ${sets.join(', ')} WHERE id = @id`, params);

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Employee', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      'UPDATE employees SET deleted_at = @now, is_active = 0 WHERE id = @id',
      { id, now: this.now() }
    );
  }

  async generateEmployeeCode(): Promise<string> {
    const year = new Date().getFullYear();
    const row = this.db.get<{ code: string }>(
      `SELECT employee_code as code FROM employees
       WHERE employee_code LIKE 'EMP-' || @year || '-%'
       ORDER BY employee_code DESC LIMIT 1`,
      { year }
    );
    let next = 1;
    if (row?.code) {
      const match = row.code.match(/EMP-\d{4}-(\d+)/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `EMP-${year}-${String(next).padStart(4, '0')}`;
  }

  private mapRow(row: EmployeeRow): Employee {
    return {
      id: Identifier.from<'Employee'>(row.id),
      employeeCode: row.employee_code,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      role: row.role as UserRole,
      title: row.title ?? undefined,
      classIds: this.parseJson<string[]>(row.class_ids_json, []),
      salary: row.salary ?? undefined,
      hiredAt: row.hired_at,
      leftAt: row.left_at ?? undefined,
      isActive: !!row.is_active,
      permissions: this.parseJson<string[]>(row.permissions_json, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };
  }
}
