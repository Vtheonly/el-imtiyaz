import {
  PaymentRepository,
  InvoiceRepository,
} from "../infrastructure/repositories/payment.repository";
import { StudentRepository } from "../infrastructure/repositories/student.repository";
import type {
  Payment,
  CreatePaymentInput,
  UpdatePaymentInput,
  Invoice,
  CreateInvoiceInput,
} from "../core/entities/payment.entity";
import type { IEventBus } from "../core/interfaces/event-bus.interface";
import { PaymentStatus } from "../core/enums";
import { Money } from "../core/value-objects/money";
import {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} from "../infrastructure/error/app-error";
import { logger } from "../infrastructure/logger/logger";

export class PaymentService {
  readonly serviceName = "PaymentService";

  constructor(
    private readonly payments: PaymentRepository,
    private readonly invoices: InvoiceRepository,
    private readonly students: StudentRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async list(query: any = {}): Promise<Payment[]> {
    return this.payments.list(query);
  }

  async getById(id: string): Promise<Payment> {
    const payment = await this.payments.findById(id);
    if (!payment) throw new NotFoundError("Payment", id);
    return payment;
  }

  async getByStudent(studentId: string): Promise<Payment[]> {
    return this.payments.list({ studentId, pageSize: 1000 });
  }

  async recordPayment(input: CreatePaymentInput): Promise<Payment> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError("Student", input.studentId);

    const amount = Money.from(input.amount);
    if (amount.isNegative() || amount.isZero()) {
      throw new ValidationError("Payment amount must be positive");
    }

    let invoiceIds = input.invoiceIds ?? [];
    if (invoiceIds.length === 0) {
      const outstanding = (
        await this.invoices.list({
          studentId: input.studentId,
          status: PaymentStatus.PENDING,
        })
      ).filter((i) => i.amountPaid < i.amountDue - i.discountAmount);

      invoiceIds = outstanding
        .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
        .map((i) => i.id.value);
    }

    const outstandingInvoices = await Promise.all(
      invoiceIds.map((id) => this.invoices.findById(id)),
    );
    const totalOutstanding = outstandingInvoices
      .filter((i): i is Invoice => i !== null)
      .reduce(
        (sum, i) => sum + (i.amountDue - i.discountAmount - i.amountPaid),
        0,
      );

    if (amount.amount > totalOutstanding && totalOutstanding > 0) {
      throw new BusinessRuleError(
        `Payment amount (${amount.format()}) exceeds outstanding balance (${Money.from(totalOutstanding).format()})`,
        { amount: amount.amount, outstanding: totalOutstanding },
      );
    }

    const payment = await this.payments.create({ ...input, invoiceIds });
    let remaining = amount.amount;

    for (const invoice of outstandingInvoices.filter(
      (i): i is Invoice => i !== null,
    )) {
      if (remaining <= 0) break;
      const outstanding =
        invoice.amountDue - invoice.discountAmount - invoice.amountPaid;
      if (outstanding <= 0) continue;

      const applied = Math.min(remaining, outstanding);
      const newPaidAmount = invoice.amountPaid + applied;
      const newStatus =
        newPaidAmount >= invoice.amountDue - invoice.discountAmount
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

      await this.invoices.update(invoice.id.value, {
        amountPaid: newPaidAmount,
        status: newStatus,
      });
      remaining -= applied;
    }

    if (remaining > 0) {
      await this.payments.update(payment.id.value, {
        status: PaymentStatus.OVERPAID,
      });
    }

    await this.eventBus.publish("payment.recorded", {
      entityId: payment.id.value,
      entityType: "Payment",
      after: {
        ...payment,
        amount: payment.amount,
        studentId: payment.studentId,
      },
      actor: { actorId: "system", actorName: "System" },
    });

    return payment;
  }

  async update(id: string, patch: UpdatePaymentInput): Promise<Payment> {
    const before = await this.getById(id);
    const updated = await this.payments.update(id, patch);

    await this.eventBus.publish("payment.updated", {
      entityId: id,
      entityType: "Payment",
      before,
      after: updated,
      actor: { actorId: "system", actorName: "System" },
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const before = await this.getById(id);
    await this.payments.delete(id);

    await this.eventBus.publish("payment.deleted", {
      entityId: id,
      entityType: "Payment",
      before,
      actor: { actorId: "system", actorName: "System" },
    });
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError("Student", input.studentId);
    if (input.amountDue <= 0) {
      throw new ValidationError("Invoice amount must be positive");
    }

    const invoice = await this.invoices.create(input);
    await this.eventBus.publish("invoice.created", {
      entityId: invoice.id.value,
      entityType: "Invoice",
      after: invoice,
      actor: { actorId: "system", actorName: "System" },
    });

    return invoice;
  }

  async bulkUpdate(
    operations: Array<{ id: string; patch: UpdatePaymentInput }>,
  ): Promise<{
    updated: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    let updated = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const op of operations) {
      try {
        await this.update(op.id, op.patch);
        updated++;
      } catch (err) {
        failed++;
        errors.push({ id: op.id, error: (err as Error).message });
      }
    }

    return { updated, failed, errors };
  }
}
