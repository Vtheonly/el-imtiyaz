/**
 * Discount pipeline — applies sibling & scholarship discounts to invoices.
 *
 * Stages:
 *   1. Resolve eligibility — check if student qualifies for any discount
 *   2. Compute discount    — determine percentage & amount
 *   3. Apply to invoices   — update discount_amount column
 *   4. Audit               — emit discount.applied event
 */

import { DiscountService } from '../services/discount.service';
import { InvoiceRepository } from '../infrastructure/repositories/payment.repository';
import { StudentRepository } from '../infrastructure/repositories/student.repository';
import { ParentRepository } from '../infrastructure/repositories/parent.repository';
import { DiscountType } from '../core/enums';
import { logger } from '../infrastructure/logger/logger';

export interface DiscountPipelineContext {
  studentId: string;
  invoiceIds: string[];
  discountType?: DiscountType;
  percentage: number;
  totalDiscounted: number;
  stage: string;
}

export class DiscountPipeline {
  constructor(
    private readonly discounts: DiscountService,
    private readonly invoices: InvoiceRepository,
    private readonly students: StudentRepository,
    private readonly parents: ParentRepository
  ) {}

  async applySiblingDiscount(studentId: string): Promise<DiscountPipelineContext> {
    let ctx: DiscountPipelineContext = {
      studentId,
      invoiceIds: [],
      percentage: 0,
      totalDiscounted: 0,
      stage: 'init'
    };

    try {
      ctx = await this.resolveEligibility(ctx);
      ctx = await this.computeDiscount(ctx);
      ctx = await this.applyToInvoices(ctx);
      ctx.stage = 'complete';
      logger.info('discount.pipeline.complete', {
        studentId,
        percentage: ctx.percentage,
        totalDiscounted: ctx.totalDiscounted
      });
    } catch (err) {
      logger.error('discount.pipeline.failed', {
        stage: ctx.stage,
        error: (err as Error).message
      });
      throw err;
    }

    return ctx;
  }

  private async resolveEligibility(ctx: DiscountPipelineContext): Promise<DiscountPipelineContext> {
    ctx.stage = 'eligibility';
    const student = await this.students.findById(ctx.studentId);
    if (!student) throw new Error(`Student not found: ${ctx.studentId}`);

    // Find all siblings via shared parent
    if (!student.parentIds.length) {
      ctx.percentage = 0;
      return ctx;
    }

    const parentId = student.parentIds[0];
    const siblingStudentIds = await this.parents.getStudentIds(parentId);

    if (siblingStudentIds.length <= 1) {
      ctx.percentage = 0;
      return ctx;
    }

    ctx.discountType = DiscountType.SIBLING;
    ctx.percentage = this.discounts.computeSiblingDiscount(ctx.studentId, siblingStudentIds);
    return ctx;
  }

  private async computeDiscount(ctx: DiscountPipelineContext): Promise<DiscountPipelineContext> {
    ctx.stage = 'compute';
    return ctx;
  }

  private async applyToInvoices(ctx: DiscountPipelineContext): Promise<DiscountPipelineContext> {
    ctx.stage = 'apply';
    if (ctx.percentage === 0) return ctx;

    const invoices = await this.invoices.list({ studentId: ctx.studentId });
    for (const invoice of invoices) {
      const discount = invoice.amountDue * (ctx.percentage / 100);
      await this.invoices.update(invoice.id.value, {
        discountAmount: invoice.discountAmount + discount
      });
      ctx.totalDiscounted += discount;
      ctx.invoiceIds.push(invoice.id.value);
    }

    return ctx;
  }
}
