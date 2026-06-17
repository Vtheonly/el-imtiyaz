/**
 * Parent service — manages parent/guardian records.
 */

import { ParentRepository } from '../infrastructure/repositories/parent.repository';
import { StudentRepository } from '../infrastructure/repositories/student.repository';
import type { Parent, CreateParentInput, UpdateParentInput } from '../core/entities/parent.entity';
import { NotFoundError, ValidationError, BusinessRuleError } from '../infrastructure/error/app-error';

interface ParentQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

export class ParentService {
  readonly serviceName = 'ParentService';

  constructor(
    private readonly parents: ParentRepository,
    private readonly students: StudentRepository
  ) {}

  async list(query: ParentQuery): Promise<Parent[]> {
    return this.parents.list(query);
  }

  async getById(id: string): Promise<Parent> {
    const parent = await this.parents.findById(id);
    if (!parent) throw new NotFoundError('Parent', id);
    return parent;
  }

  async create(input: CreateParentInput): Promise<Parent> {
    if (!input.firstName?.trim()) throw new ValidationError('First name is required');
    if (!input.lastName?.trim()) throw new ValidationError('Last name is required');
    if (!input.phone?.trim()) throw new ValidationError('Phone is required');
    return this.parents.create(input);
  }

  async update(id: string, patch: UpdateParentInput): Promise<Parent> {
    return this.parents.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    // Verify parent has no active students
    const studentIds = await this.parents.getStudentIds(id);
    if (studentIds.length > 0) {
      throw new BusinessRuleError(
        `Cannot delete parent: still linked to ${studentIds.length} student(s)`
      );
    }
    return this.parents.delete(id);
  }
}
