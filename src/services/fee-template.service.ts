/**
 * Fee template service — applies reusable charge plans to students.
 */

import { FeeTemplateRepository } from '../infrastructure/repositories/fee-template.repository';
import { InvoiceRepository } from '../infrastructure/repositories/payment.repository';
import type { FeeTemplate, CreateFeeTemplateInput } from '../core/entities/fee-template.entity';
import type { CreateInvoiceInput } from '../core/entities/payment.entity';
import { PaymentType } from '../core/enums';
import { NotFoundError, ValidationError } from '../infrastructure/error/app-error';
import { logger } from '../infrastructure/logger/logger';

export class FeeTemplateService {
  readonly serviceName = 'FeeTemplateService';

  constructor(
    private readonly templates: FeeTemplateRepository,
    private readonly invoices: InvoiceRepository
  ) {}

  async list(): Promise<FeeTemplate[]> {
    return this.templates.list();
  }

  async create(input: CreateFeeTemplateInput): Promise<FeeTemplate> {
    if (!input.items?.length) {
      throw new ValidationError('Fee template must contain at least one item');
    }
    return this.templates.create(input);
  }

  /** Applies a template to multiple students — generates invoices for each item. */
  async apply(templateId: string, studentIds: string[]): Promise<{
    applied: number;
    invoicesCreated: number;
    failed: number;
    errors: Array<{ studentId: string; error: string }>;
  }> {
    const template = await this.templates.findById(templateId);
    if (!template) throw new NotFoundError('FeeTemplate', templateId);

    let applied = 0;
    let invoicesCreated = 0;
    let failed = 0;
    const errors: Array<{ studentId: string; error: string }> = [];

    for (const studentId of studentIds) {
      try {
        for (const item of template.items) {
          const invoiceInput: CreateInvoiceInput = {
            studentId,
            type: item.type as PaymentType,
            description: `${item.label} — ${template.name}`,
            amountDue: item.amount,
            dueDate: undefined
          };
          await this.invoices.create(invoiceInput);
          invoicesCreated++;
        }
        applied++;
      } catch (err) {
        failed++;
        errors.push({ studentId, error: (err as Error).message });
      }
    }

    logger.info('fee-template.applied', {
      templateId,
      applied,
      invoicesCreated,
      failed
    });

    return { applied, invoicesCreated, failed, errors };
  }
}
