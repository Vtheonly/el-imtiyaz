/**
 * Class service — manages classes & enforces capacity constraints.
 */

import { ClassRepository } from '../infrastructure/repositories/class.repository';
import { StudentRepository } from '../infrastructure/repositories/student.repository';
import type { Class, CreateClassInput, UpdateClassInput } from '../core/entities/class.entity';
import { NotFoundError, BusinessRuleError, ValidationError } from '../infrastructure/error/app-error';

export class ClassService {
  readonly serviceName = 'ClassService';

  constructor(
    private readonly classes: ClassRepository,
    private readonly students: StudentRepository
  ) {}

  async list(): Promise<Class[]> {
    return this.classes.list();
  }

  async getById(id: string): Promise<Class> {
    const cls = await this.classes.findById(id);
    if (!cls) throw new NotFoundError('Class', id);
    return cls;
  }

  async create(input: CreateClassInput): Promise<Class> {
    if (!input.grade?.trim()) throw new ValidationError('Grade is required');
    if (!input.section?.trim()) throw new ValidationError('Section is required');
    if (input.capacity <= 0) throw new ValidationError('Capacity must be positive');

    // Check for duplicate (grade, section)
    const existing = await this.classes.list({ grade: input.grade });
    if (existing.some((c) => c.section === input.section)) {
      throw new BusinessRuleError(`Class ${input.grade} ${input.section} already exists`);
    }

    return this.classes.create(input);
  }

  async update(id: string, patch: UpdateClassInput): Promise<Class> {
    return this.classes.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    const cls = await this.getById(id);
    if (cls.enrolledCount > 0) {
      throw new BusinessRuleError(
        `Cannot delete class with ${cls.enrolledCount} enrolled student(s)`
      );
    }
    return this.classes.delete(id);
  }

  async enrollStudent(studentId: string, classId: string): Promise<void> {
    const cls = await this.getById(classId);
    if (cls.enrolledCount >= cls.capacity) {
      throw new BusinessRuleError(`Class ${cls.name} is at capacity (${cls.capacity})`);
    }

    await this.students.update(studentId, { classId });
    await this.classes.incrementEnrollment(classId, 1);
  }

  async unenrollStudent(studentId: string, previousClassId: string): Promise<void> {
    await this.classes.incrementEnrollment(previousClassId, -1);
  }
}
