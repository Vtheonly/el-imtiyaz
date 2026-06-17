/**
 * Discount service — manages scholarships & sibling discounts.
 *
 * Sibling discounts are computed automatically when a parent has multiple
 * enrolled students, per the tiers defined in discount-type.ts.
 */

import { ScholarshipRepository } from '../infrastructure/repositories/scholarship.repository';
import { InvoiceRepository } from '../infrastructure/repositories/payment.repository';
import { StudentRepository } from '../infrastructure/repositories/student.repository';
import { ParentRepository } from '../infrastructure/repositories/parent.repository';
import { SIBLING_DISCOUNT_TIERS, DiscountType } from '../core/enums';
import type { Scholarship } from '../core/entities/fee-template.entity';
import { NotFoundError, ValidationError } from '../infrastructure/error/app-error';
import { logger } from '../infrastructure/logger/logger';

export interface GrantScholarshipInput {
  studentId: string;
  type: DiscountType;
  percentage: number;
  reason: string;
  grantedByEmployeeId: string;
  validFrom: string;
  validUntil?: string;
}

export class DiscountService {
  readonly serviceName = 'DiscountService';

  constructor(
    private readonly scholarships: ScholarshipRepository,
    private readonly invoices: InvoiceRepository,
    private readonly students: StudentRepository,
    private readonly parents: ParentRepository
  ) {}

  async listScholarships(): Promise<Scholarship[]> {
    return this.scholarships.list();
  }

  async grantScholarship(input: GrantScholarshipInput): Promise<Scholarship> {
    if (input.percentage < 0 || input.percentage > 100) {
      throw new ValidationError('Scholarship percentage must be between 0 and 100');
    }

    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError('Student', input.studentId);

    const scholarship = await this.scholarships.create({
      studentId: input.studentId,
      type: input.type,
      percentage: input.percentage,
      reason: input.reason,
      grantedByEmployeeId: input.grantedByEmployeeId,
      validFrom: input.validFrom,
      validUntil: input.validUntil
    } as any);

    logger.info('scholarship.granted', {
      scholarshipId: scholarship.id.value,
      studentId: input.studentId,
      percentage: input.percentage
    });

    return scholarship;
  }

  async revokeScholarship(id: string, reason: string): Promise<Scholarship> {
    const scholarship = await this.scholarships.findById(id);
    if (!scholarship) throw new NotFoundError('Scholarship', id);

    return this.scholarships.update(id, {
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
      isActive: false
    });
  }

  /** Computes the sibling discount percentage for a student based on enrolment order. */
  computeSiblingDiscount(studentId: string, allSiblingsStudentIds: string[]): number {
    const sorted = [...allSiblingsStudentIds].sort();
    const order = sorted.indexOf(studentId) + 1;

    if (order === 0) return 0;

    const tier = SIBLING_DISCOUNT_TIERS.find((t) => t.order === order)
      ?? SIBLING_DISCOUNT_TIERS[SIBLING_DISCOUNT_TIERS.length - 1];

    return tier.percentage;
  }
}
