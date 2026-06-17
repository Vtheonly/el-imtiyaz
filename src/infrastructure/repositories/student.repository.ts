/**
 * Student repository — SQLite-backed implementation.
 *
 * Stores complex fields (parentIds, phoneNumbers, address, emergencyContacts,
 * documents, metadata) as JSON columns to avoid an explosion of join tables
 * while keeping reads simple. The trade-off is that fields queryable in
 * WHERE clauses (status, classId) are still real columns.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { Student, CreateStudentInput, UpdateStudentInput } from '../../core/entities/student.entity';
import { Gender, StudentStatus } from '../../core/enums';
import { Identifier } from '../../core/value-objects/identifier';
import { NotFoundError } from '../error/app-error';
import { BaseRepository } from './base.repository';
import { v4 as uuidv4 } from 'uuid';

interface StudentRow {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  full_name: string;
  photo_path: string | null;
  date_of_birth: string;
  place_of_birth: string | null;
  gender: string;
  parent_ids_json: string;
  primary_parent_id: string | null;
  phone_numbers_json: string;
  address_json: string;
  emergency_contacts_json: string;
  registered_at: string;
  status: string;
  class_id: string | null;
  academic_year_id: string | null;
  notes: string | null;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface StudentQuery {
  search?: string;
  status?: StudentStatus;
  classId?: string;
  parent_id?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export class StudentRepository extends BaseRepository<Student, StudentQuery> {
  constructor(db: DatabaseClient) {
    super(db, 'students');
  }

  async findById(id: string): Promise<Student | null> {
    const row = this.db.get<StudentRow>(
      'SELECT * FROM students WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async findByCode(code: string): Promise<Student | null> {
    const row = this.db.get<StudentRow>(
      'SELECT * FROM students WHERE student_code = ? AND deleted_at IS NULL',
      [code]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: StudentQuery = {}): Promise<Student[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: Record<string, unknown> = {};

    if (query.search) {
      conditions.push('(full_name LIKE @search OR student_code LIKE @search)');
      params.search = `%${query.search}%`;
    }
    if (query.status) {
      conditions.push('status = @status');
      params.status = query.status;
    }
    if (query.classId) {
      conditions.push('class_id = @classId');
      params.classId = query.classId;
    }
    if (query.parent_id) {
      conditions.push('parent_ids_json LIKE @parentId');
      params.parentId = `%"${query.parent_id}"%`;
    }

    const pageSize = query.pageSize ?? 100;
    const page = query.page ?? 1;
    const offset = (page - 1) * pageSize;

    const rows = this.db.all<StudentRow>(
      `SELECT * FROM students WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateStudentInput & { studentCode?: string }): Promise<Student> {
    const id = Identifier.generate<'Student'>().value;
    const code = input.studentCode ?? await this.generateStudentCode();
    const now = this.now();
    const fullName = [input.firstName, input.middleName, input.lastName]
      .filter(Boolean)
      .join(' ');

    this.db.run(
      `INSERT INTO students (
        id, student_code, first_name, last_name, middle_name, full_name,
        photo_path, date_of_birth, place_of_birth, gender,
        parent_ids_json, primary_parent_id, phone_numbers_json, address_json,
        emergency_contacts_json, registered_at, status, class_id, academic_year_id,
        notes, metadata_json, created_at, updated_at
      ) VALUES (
        @id, @code, @first, @last, @middle, @fullName,
        @photo, @dob, @pob, @gender,
        @parents, @primaryParent, @phones, @address,
        @emergency, @registered, @status, @classId, @academicYearId,
        @notes, @metadata, @createdAt, @updatedAt
      )`,
      {
        id,
        code,
        first: input.firstName,
        last: input.lastName,
        middle: input.middleName ?? null,
        fullName,
        photo: input.photoPath ?? null,
        dob: input.dateOfBirth,
        pob: null,
        gender: input.gender,
        parents: this.stringifyJson(input.parentIds),
        primaryParent: input.primaryParentId ?? null,
        phones: this.stringifyJson(input.phoneNumbers ?? []),
        address: this.stringifyJson(input.address),
        emergency: this.stringifyJson(input.emergencyContacts ?? []),
        registered: now,
        status: StudentStatus.PENDING,
        classId: input.classId ?? null,
        academicYearId: input.academicYearId ?? null,
        notes: input.notes ?? null,
        metadata: this.stringifyJson({}),
        createdAt: now,
        updatedAt: now
      }
    );

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('Student', id);
    return created;
  }

  async update(id: string, patch: UpdateStudentInput): Promise<Student> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Student', id);

    const sets: string[] = [];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.firstName !== undefined) { sets.push('first_name = @firstName'); params.firstName = patch.firstName; }
    if (patch.lastName !== undefined) { sets.push('last_name = @lastName'); params.lastName = patch.lastName; }
    if (patch.middleName !== undefined) { sets.push('middle_name = @middleName'); params.middleName = patch.middleName; }
    if (patch.dateOfBirth !== undefined) { sets.push('date_of_birth = @dob'); params.dob = patch.dateOfBirth; }
    if (patch.gender !== undefined) { sets.push('gender = @gender'); params.gender = patch.gender; }
    if (patch.parentIds !== undefined) { sets.push('parent_ids_json = @parents'); params.parents = this.stringifyJson(patch.parentIds); }
    if (patch.primaryParentId !== undefined) { sets.push('primary_parent_id = @primaryParent'); params.primaryParent = patch.primaryParentId; }
    if (patch.phoneNumbers !== undefined) { sets.push('phone_numbers_json = @phones'); params.phones = this.stringifyJson(patch.phoneNumbers); }
    if (patch.address !== undefined) { sets.push('address_json = @address'); params.address = this.stringifyJson(patch.address); }
    if (patch.emergencyContacts !== undefined) { sets.push('emergency_contacts_json = @emergency'); params.emergency = this.stringifyJson(patch.emergencyContacts); }
    if (patch.classId !== undefined) { sets.push('class_id = @classId'); params.classId = patch.classId; }
    if (patch.academicYearId !== undefined) { sets.push('academic_year_id = @academicYearId'); params.academicYearId = patch.academicYearId; }
    if (patch.status !== undefined) { sets.push('status = @status'); params.status = patch.status; }
    if (patch.notes !== undefined) { sets.push('notes = @notes'); params.notes = patch.notes; }
    if (patch.photoPath !== undefined) { sets.push('photo_path = @photo'); params.photo = patch.photoPath; }

    // Always recompute full_name
    const first = patch.firstName ?? existing.firstName;
    const middle = patch.middleName ?? existing.middleName;
    const last = patch.lastName ?? existing.lastName;
    sets.push('full_name = @fullName');
    params.fullName = [first, middle, last].filter(Boolean).join(' ');

    sets.push('updated_at = @updatedAt');

    this.db.run(
      `UPDATE students SET ${sets.join(', ')} WHERE id = @id`,
      params
    );

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('Student', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      'UPDATE students SET deleted_at = @now, status = @status WHERE id = @id',
      { id, now: this.now(), status: StudentStatus.LEFT }
    );
  }

  async generateStudentCode(): Promise<string> {
    const year = new Date().getFullYear();
    const row = this.db.get<{ code: string }>(
      `SELECT student_code as code FROM students
       WHERE student_code LIKE 'STU-' || @year || '-%'
       ORDER BY student_code DESC LIMIT 1`,
      { year }
    );

    let next = 1;
    if (row?.code) {
      const match = row.code.match(/STU-\d{4}-(\d+)/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `STU-${year}-${String(next).padStart(4, '0')}`;
  }

  async addDocument(studentId: string, document: Student['documents'][number]): Promise<void> {
    this.db.run(
      `INSERT INTO student_documents (id, student_id, type, filename, path, mime_type, size, uploaded_at)
       VALUES (@id, @studentId, @type, @filename, @path, @mime, @size, @uploadedAt)`,
      {
        id: uuidv4(),
        studentId,
        type: document.type,
        filename: document.filename,
        path: document.path,
        mime: document.mimeType,
        size: document.size,
        uploadedAt: document.uploadedAt
      }
    );
  }

  async getDocuments(studentId: string): Promise<Student['documents']> {
    const rows = this.db.all<{ id: string; type: string; filename: string; path: string; mime_type: string; size: number; uploaded_at: string }>(
      'SELECT * FROM student_documents WHERE student_id = ? ORDER BY uploaded_at DESC',
      [studentId]
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type as Student['documents'][number]['type'],
      filename: r.filename,
      path: r.path,
      mimeType: r.mime_type,
      size: r.size,
      uploadedAt: r.uploaded_at
    }));
  }

  private mapRow(row: StudentRow): Student {
    return {
      id: Identifier.from<'Student'>(row.id),
      studentCode: row.student_code,
      firstName: row.first_name,
      lastName: row.last_name,
      middleName: row.middle_name ?? undefined,
      fullName: row.full_name,
      photoPath: row.photo_path ?? undefined,
      dateOfBirth: row.date_of_birth,
      placeOfBirth: row.place_of_birth ?? undefined,
      gender: row.gender as Gender,
      parentIds: this.parseJson<string[]>(row.parent_ids_json, []),
      primaryParentId: row.primary_parent_id ?? undefined,
      phoneNumbers: this.parseJson<string[]>(row.phone_numbers_json, []),
      address: this.parseJson<Student['address']>(row.address_json, {
        line1: '', city: '', country: ''
      }),
      emergencyContacts: this.parseJson<Student['emergencyContacts']>(row.emergency_contacts_json, []),
      registeredAt: row.registered_at,
      status: row.status as StudentStatus,
      classId: row.class_id ?? undefined,
      academicYearId: row.academic_year_id ?? undefined,
      notes: row.notes ?? undefined,
      documents: [],
      metadata: this.parseJson<Record<string, unknown>>(row.metadata_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined
    };
  }
}
