/**
 * Academic year service — manages the school calendar.
 */

import { AcademicYearRepository } from '../infrastructure/repositories/academic-year.repository';
import type { AcademicYear, CreateAcademicYearInput, UpdateAcademicYearInput } from '../core/entities/academic-year.entity';
import { NotFoundError, BusinessRuleError } from '../infrastructure/error/app-error';

export class AcademicYearService {
  readonly serviceName = 'AcademicYearService';

  constructor(private readonly repo: AcademicYearRepository) {}

  async list(): Promise<AcademicYear[]> {
    return this.repo.list();
  }

  async getById(id: string): Promise<AcademicYear> {
    const year = await this.repo.findById(id);
    if (!year) throw new NotFoundError('AcademicYear', id);
    return year;
  }

  async getActive(): Promise<AcademicYear | null> {
    return this.repo.getActive();
  }

  async create(input: CreateAcademicYearInput): Promise<AcademicYear> {
    const existing = await this.repo.list();
    if (existing.some((y) => y.name === input.name)) {
      throw new BusinessRuleError(`Academic year "${input.name}" already exists`);
    }

    if (new Date(input.startDate) >= new Date(input.endDate)) {
      throw new BusinessRuleError('Start date must be before end date');
    }

    return this.repo.create(input);
  }

  async update(id: string, patch: UpdateAcademicYearInput): Promise<AcademicYear> {
    return this.repo.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    const year = await this.getById(id);
    if (year.isActive) {
      throw new BusinessRuleError('Cannot delete the active academic year');
    }
    return this.repo.delete(id);
  }

  async activate(id: string): Promise<AcademicYear> {
    return this.repo.update(id, { isActive: true });
  }
}
