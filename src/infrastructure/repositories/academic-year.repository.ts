/**
 * Academic year repository — SQLite-backed.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { AcademicYear, CreateAcademicYearInput, UpdateAcademicYearInput, AcademicTerm, AcademicMonth } from '../../core/entities/academic-year.entity';
import { AcademicTermType } from '../../core/enums';
import { Identifier } from '../../core/value-objects/identifier';
import { NotFoundError } from '../error/app-error';
import { BaseRepository } from './base.repository';

interface AcademicYearRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  term_type: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface TermRow {
  id: string;
  academic_year_id: string;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  term_order: number;
}

interface MonthRow {
  id: string;
  term_id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
}

export class AcademicYearRepository extends BaseRepository<AcademicYear, { isActive?: boolean }> {
  constructor(db: DatabaseClient) {
    super(db, 'academic_years');
  }

  async findById(id: string): Promise<AcademicYear | null> {
    const row = this.db.get<AcademicYearRow>('SELECT * FROM academic_years WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async list(query: { isActive?: boolean } = {}): Promise<AcademicYear[]> {
    const sql = query.isActive
      ? 'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC'
      : 'SELECT * FROM academic_years ORDER BY start_date DESC';
    const rows = this.db.all<AcademicYearRow>(sql);
    return Promise.all(rows.map((r) => this.mapRow(r)));
  }

  async getActive(): Promise<AcademicYear | null> {
    const row = this.db.get<AcademicYearRow>(
      'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1'
    );
    return row ? this.mapRow(row) : null;
  }

  async create(input: CreateAcademicYearInput): Promise<AcademicYear> {
    const id = Identifier.generate<'AcademicYear'>().value;
    const now = this.now();

    this.db.run(
      `INSERT INTO academic_years (id, name, start_date, end_date, term_type, is_active, created_at, updated_at)
       VALUES (@id, @name, @start, @end, @termType, 0, @createdAt, @updatedAt)`,
      {
        id,
        name: input.name,
        start: input.startDate,
        end: input.endDate,
        termType: input.termType,
        createdAt: now,
        updatedAt: now
      }
    );

    // Auto-generate terms & months based on termType
    await this.generateTerms(id, input);

    const created = await this.findById(id);
    if (!created) throw new NotFoundError('AcademicYear', id);
    return created;
  }

  async update(id: string, patch: UpdateAcademicYearInput): Promise<AcademicYear> {
    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };

    if (patch.name !== undefined) { sets.push('name = @name'); params.name = patch.name; }
    if (patch.startDate !== undefined) { sets.push('start_date = @start'); params.start = patch.startDate; }
    if (patch.endDate !== undefined) { sets.push('end_date = @end'); params.end = patch.endDate; }
    if (patch.isActive !== undefined) { sets.push('is_active = @isActive'); params.isActive = patch.isActive ? 1 : 0; }

    this.db.run(`UPDATE academic_years SET ${sets.join(', ')} WHERE id = @id`, params);

    if (patch.isActive) {
      // Deactivate all other years
      this.db.run(
        'UPDATE academic_years SET is_active = 0, updated_at = @now WHERE id != @id',
        { id, now: this.now() }
      );
    }

    const updated = await this.findById(id);
    if (!updated) throw new NotFoundError('AcademicYear', id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.db.run('DELETE FROM academic_years WHERE id = ?', [id]);
  }

  private async generateTerms(yearId: string, input: CreateAcademicYearInput): Promise<void> {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    let termCount = 1;
    switch (input.termType) {
      case AcademicTermType.SEMESTER: termCount = 2; break;
      case AcademicTermType.TRIMESTER: termCount = 3; break;
      case AcademicTermType.QUARTER: termCount = 4; break;
      case AcademicTermType.MONTH: termCount = Math.max(1, Math.round(totalDays / 30)); break;
    }

    const daysPerTerm = totalDays / termCount;

    for (let i = 0; i < termCount; i++) {
      const termStart = new Date(start.getTime() + i * daysPerTerm * 24 * 60 * 60 * 1000);
      const termEnd = new Date(start.getTime() + (i + 1) * daysPerTerm * 24 * 60 * 60 * 1000);

      const termId = Identifier.generate<'Term'>().value;
      this.db.run(
        `INSERT INTO academic_terms (id, academic_year_id, name, type, start_date, end_date, term_order)
         VALUES (@id, @yearId, @name, @type, @start, @end, @order)`,
        {
          id: termId,
          yearId,
          name: `${input.termType.charAt(0).toUpperCase() + input.termType.slice(1)} ${i + 1}`,
          type: input.termType,
          start: termStart.toISOString().slice(0, 10),
          end: termEnd.toISOString().slice(0, 10),
          order: i + 1
        }
      );

      // Generate months inside this term
      this.generateMonths(termId, termStart, termEnd);
    }
  }

  private generateMonths(termId: string, start: Date, end: Date): void {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const monthName = cursor.toLocaleString('en-US', { month: 'long' });

      this.db.run(
        `INSERT INTO academic_months (id, term_id, name, year, start_date, end_date)
         VALUES (@id, @termId, @name, @year, @start, @end)`,
        {
          id: Identifier.generate<'Term'>().value,
          termId,
          name: monthName,
          year: cursor.getFullYear(),
          start: monthStart.toISOString().slice(0, 10),
          end: monthEnd.toISOString().slice(0, 10)
        }
      );

      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  private async mapRow(row: AcademicYearRow): Promise<AcademicYear> {
    const termsRows = this.db.all<TermRow>(
      'SELECT * FROM academic_terms WHERE academic_year_id = ? ORDER BY term_order',
      [row.id]
    );

    const terms: AcademicTerm[] = termsRows.map((t) => {
      const monthRows = this.db.all<MonthRow>(
        'SELECT * FROM academic_months WHERE term_id = ? ORDER BY start_date',
        [t.id]
      );
      const months: AcademicMonth[] = monthRows.map((m) => ({
        id: m.id,
        name: m.name,
        year: m.year,
        startDate: m.start_date,
        endDate: m.end_date
      }));

      return {
        id: Identifier.from<'Term'>(t.id),
        academicYearId: t.academic_year_id,
        name: t.name,
        type: t.type as AcademicTermType,
        startDate: t.start_date,
        endDate: t.end_date,
        months,
        order: t.term_order
      };
    });

    return {
      id: Identifier.from<'AcademicYear'>(row.id),
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      termType: row.term_type as AcademicTermType,
      isActive: !!row.is_active,
      terms,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
