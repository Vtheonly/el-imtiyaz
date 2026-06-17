/**
 * Payment pipeline — explicit stages for payment recording.
 *
 * Stages:
 *   1. Validate       — schema + business rules
 *   2. Persist        — write payment + invoice allocations
 *   3. Audit          — emit audit event
 *   4. Receipt        — generate PDF receipt
 *   5. Notify         — emit notification event (subscribed by NotificationService)
 *
 * Each stage receives the prior stage's output and returns enriched context.
 * Any stage can throw to abort the pipeline; earlier stages are NOT rolled
 * back automatically (transactional boundaries are inside the service).
 */

import { PaymentService } from '../services/payment.service';
import { ReceiptService } from '../services/receipt.service';
import type { CreatePaymentInput, Payment } from '../core/entities/payment.entity';
import { logger } from '../infrastructure/logger/logger';

export interface PaymentPipelineContext {
  input: CreatePaymentInput;
  payment?: Payment;
  receiptPath?: string;
  receiptNumber?: string;
  errors: string[];
  stage: string;
}

export class PaymentPipeline {
  constructor(
    private readonly payments: PaymentService,
    private readonly receipts: ReceiptService
  ) {}

  async run(input: CreatePaymentInput): Promise<PaymentPipelineContext> {
    let ctx: PaymentPipelineContext = { input, errors: [], stage: 'init' };

    try {
      ctx = await this.validate(ctx);
      ctx = await this.persist(ctx);
      ctx = await this.audit(ctx);
      ctx = await this.generateReceipt(ctx);
      ctx = await this.notify(ctx);
      ctx.stage = 'complete';
      logger.info('payment.pipeline.complete', {
        paymentId: ctx.payment?.id.value,
        receipt: ctx.receiptNumber
      });
    } catch (err) {
      ctx.errors.push((err as Error).message);
      logger.error('payment.pipeline.failed', {
        stage: ctx.stage,
        error: (err as Error).message
      });
      throw err;
    }

    return ctx;
  }

  private async validate(ctx: PaymentPipelineContext): Promise<PaymentPipelineContext> {
    ctx.stage = 'validate';
    if (!ctx.input.studentId) throw new Error('studentId required');
    if (ctx.input.amount <= 0) throw new Error('amount must be positive');
    return ctx;
  }

  private async persist(ctx: PaymentPipelineContext): Promise<PaymentPipelineContext> {
    ctx.stage = 'persist';
    ctx.payment = await this.payments.recordPayment(ctx.input);
    return ctx;
  }

  private async audit(ctx: PaymentPipelineContext): Promise<PaymentPipelineContext> {
    ctx.stage = 'audit';
    // Audit is emitted by the payment service via event bus.
    // Pipeline stage exists to make ordering explicit & observable.
    return ctx;
  }

  private async generateReceipt(ctx: PaymentPipelineContext): Promise<PaymentPipelineContext> {
    ctx.stage = 'receipt';
    if (!ctx.payment) return ctx;
    try {
      const receipt = await this.receipts.generate(ctx.payment.id.value);
      ctx.receiptPath = receipt.pdfPath;
      ctx.receiptNumber = receipt.receiptNumber;
    } catch (err) {
      logger.warn('payment.pipeline.receipt.failed', {
        paymentId: ctx.payment.id.value,
        error: (err as Error).message
      });
    }
    return ctx;
  }

  private async notify(ctx: PaymentPipelineContext): Promise<PaymentPipelineContext> {
    ctx.stage = 'notify';
    // NotificationService subscribes to payment.recorded events.
    // This stage is a placeholder for explicit notification composition.
    return ctx;
  }
}
