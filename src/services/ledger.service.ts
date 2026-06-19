import {
  LedgerRepository,
  LedgerQuery,
} from "../infrastructure/repositories/ledger-entry.repository";
import { FeeScheduleRepository } from "../infrastructure/repositories/fee-schedule.repository";
import { FormulaRuleRepository } from "../infrastructure/repositories/formula-rule.repository";
import { PaymentAuditCommentRepository } from "../infrastructure/repositories/payment-audit-comment.repository";
import type {
  LedgerEntry,
  CreateLedgerEntryInput,
  UpdateLedgerEntryInput,
} from "../core/entities/ledger-entry.entity";
import type {
  FeeSchedule,
  FeeScheduleLine,
} from "../core/entities/fee-schedule.entity";
import type { IEventBus } from "../core/interfaces/event-bus.interface";
import { SEPTEMBER_BALANCE_MAX } from "../core/enums";
import {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} from "../infrastructure/error/app-error";
import { logger } from "../infrastructure/logger/logger";
import { safeEvaluate } from "./formula/formula-engine";

export interface LedgerSummary {
  totalEntries: number;
  totalDevisAnnuel: number;
  totalVersements: number;
  totalCreance: number;
  totalGrandTotal: number;
  byClass: Array<{ classCode: string; count: number; creance: number }>;
  byLevel: Array<{ level: string; count: number; creance: number }>;
}

export class LedgerService {
  readonly serviceName = "LedgerService";

  constructor(
    private readonly ledger: LedgerRepository,
    private readonly feeSchedules: FeeScheduleRepository,
    private readonly formulaRules: FormulaRuleRepository,
    private readonly auditComments: PaymentAuditCommentRepository,
    private readonly eventBus: IEventBus,
  ) {
    this.registerEventSubscriptions();
  }

  private registerEventSubscriptions(): void {
    this.eventBus.subscribe("payment.recorded", async (event) => {
      const payment = event.payload as any;
      if (payment && payment.studentId) {
        await this.allocatePaymentToLedger(
          payment.studentId,
          payment.amount,
          payment.receiptNumber,
        );
      }
    });
  }

  async list(query: LedgerQuery = {}): Promise<LedgerEntry[]> {
    return this.ledger.list(query);
  }

  async getById(id: string): Promise<LedgerEntry> {
    const entry = await this.ledger.findById(id);
    if (!entry) throw new NotFoundError("LedgerEntry", id);
    return entry;
  }

  async getByStudent(studentId: string): Promise<LedgerEntry[]> {
    return this.ledger.list({ studentId });
  }

  async create(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    this.validateInput(input);
    const computed = await this.computeFields(input);
    const entry = await this.ledger.create({ ...input, ...computed });

    await this.eventBus.publish("ledger.entry.created", {
      entityId: entry.id.value,
      entityType: "LedgerEntry",
      after: entry,
      actor: { actorId: "system", actorName: "System" },
    });

    logger.info("ledger.entry.created", {
      id: entry.id.value,
      studentName: entry.studentName,
    });
    return entry;
  }

  async update(
    id: string,
    patch: UpdateLedgerEntryInput,
  ): Promise<LedgerEntry> {
    const before = await this.getById(id);
    this.validateInput({ ...before, ...patch });

    const merged = { ...before, ...patch } as CreateLedgerEntryInput;
    const computed = await this.computeFields(merged);
    const updated = await this.ledger.update(id, { ...patch, ...computed });

    await this.eventBus.publish("ledger.entry.updated", {
      entityId: id,
      entityType: "LedgerEntry",
      before,
      after: updated,
      actor: { actorId: "system", actorName: "System" },
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const before = await this.getById(id);
    await this.ledger.delete(id);
    await this.eventBus.publish("ledger.entry.deleted", {
      entityId: id,
      entityType: "LedgerEntry",
      before,
      actor: { actorId: "system", actorName: "System" },
    });
  }

  async computeFields(
    input: CreateLedgerEntryInput,
  ): Promise<Partial<LedgerEntry>> {
    const schedule = await this.feeSchedules.findActive();
    const ctx = this.buildFormulaContext(input, schedule);
    const rules = await this.formulaRules.list({
      scope: "ledger",
      isActive: true,
    });
    rules.sort((a, b) => a.priority - b.priority);

    const devisRule = rules.find((r) => r.targetField === "devisAnnuel");
    const devisAnnuel = devisRule
      ? this.evalNumeric(devisRule, ctx)
      : (input.fi ?? 25000) +
        205000 +
        (input.optionCode === "TRNSP" ? 35000 : 0) -
        (input.remise ?? 0);

    const versementsRule = rules.find(
      (r) => r.targetField === "totalVersements",
    );
    const totalVersements = versementsRule
      ? this.evalNumeric(versementsRule, ctx)
      : (input.fi ?? 0) +
        (input.v2 ?? 0) +
        (input.altV2 ?? 0) +
        (input.v3 ?? 0) +
        (input.t1 ?? 0) +
        (input.t2 ?? 0) +
        (input.t3 ?? 0);

    const creanceRule = rules.find((r) => r.targetField === "totalCreance");
    const totalCreance = creanceRule
      ? this.evalNumeric(creanceRule, ctx)
      : devisAnnuel - totalVersements;

    const grandTotalRule = rules.find((r) => r.targetField === "grandTotal");
    const grandTotal = grandTotalRule
      ? this.evalNumeric(grandTotalRule, ctx)
      : totalVersements +
        (input.psy1 ?? 0) +
        (input.psy2 ?? 0) +
        (input.orth1 ?? 0) +
        (input.orth2 ?? 0) +
        (input.ePlant ?? 0) +
        (input.ratrapage ?? 0) +
        (input.september ?? 0) +
        (input.december ?? 0) +
        (input.march ?? 0);

    return { devisAnnuel, totalVersements, totalCreance, grandTotal };
  }

  async recomputeAll(): Promise<{
    recomputed: number;
    skipped: number;
    errors: any[];
  }> {
    const entries = await this.ledger.list({ pageSize: 10000 });
    let recomputed = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const entry of entries) {
      try {
        const computed = await this.computeFields(entry);
        await this.ledger.update(entry.id.value, computed);
        recomputed++;
      } catch (err) {
        skipped++;
        errors.push({ id: entry.id.value, error: (err as Error).message });
      }
    }
    return { recomputed, skipped, errors };
  }

  async allocatePaymentToLedger(
    studentId: string,
    amount: number,
    rcp: string,
  ): Promise<void> {
    const entries = await this.ledger.list({ studentId });
    if (entries.length === 0) return;
    const entry = entries[0];

    let remaining = amount;
    const updates: Partial<LedgerEntry> = {};

    const slots = [
      { key: "fi", max: 25000 },
      { key: "v2", max: 71500 },
      { key: "altV2", max: 71500 },
      { key: "v3", max: 71500 },
      { key: "t1", max: 30000 },
      { key: "t2", max: 15000 },
      { key: "t3", max: 10000 },
    ] as const;

    for (const slot of slots) {
      if (remaining <= 0) break;
      const currentVal = (entry as any)[slot.key] as number;
      const cap = slot.max;
      if (currentVal < cap) {
        const fill = Math.min(remaining, cap - currentVal);
        (updates as any)[slot.key] = currentVal + fill;
        remaining -= fill;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.update(entry.id.value, updates);
      await this.auditComments.create({
        ledgerEntryId: entry.id.value,
        studentId,
        rawText: `${amount}/${new Date().getDate()}/${new Date().getMonth() + 1} Batch: ${rcp}`,
      });
    }
  }

  async getSummary(): Promise<LedgerSummary> {
    const entries = await this.ledger.list({ pageSize: 10000 });
    const byClassMap = new Map<string, { count: number; creance: number }>();
    const byLevelMap = new Map<string, { count: number; creance: number }>();
    let totalDevisAnnuel = 0,
      totalVersements = 0,
      totalCreance = 0,
      totalGrandTotal = 0;

    for (const e of entries) {
      totalDevisAnnuel += e.devisAnnuel;
      totalVersements += e.totalVersements;
      totalCreance += e.totalCreance;
      totalGrandTotal += e.grandTotal;

      const ck = e.classCode ?? "(unassigned)";
      const lk = e.level ?? "(unassigned)";
      const c = byClassMap.get(ck) ?? { count: 0, creance: 0 };
      const l = byLevelMap.get(lk) ?? { count: 0, creance: 0 };

      byClassMap.set(ck, {
        count: c.count + 1,
        creance: c.creance + e.totalCreance,
      });
      byLevelMap.set(lk, {
        count: l.count + 1,
        creance: l.creance + e.totalCreance,
      });
    }

    return {
      totalEntries: entries.length,
      totalDevisAnnuel,
      totalVersements,
      totalCreance,
      totalGrandTotal,
      byClass: Array.from(byClassMap.entries()).map(([classCode, v]) => ({
        classCode,
        ...v,
      })),
      byLevel: Array.from(byLevelMap.entries()).map(([level, v]) => ({
        level,
        ...v,
      })),
    };
  }

  async listAuditComments(ledgerEntryId: string): Promise<any[]> {
    return this.auditComments.list({ ledgerEntryId });
  }

  async addAuditComment(input: {
    ledgerEntryId: string;
    rawText: string;
    studentId?: string;
    paymentId?: string;
    excelCell?: string;
    sourceRow?: number;
  }): Promise<any> {
    return this.auditComments.create(input);
  }

  private validateInput(input: any) {
    if (input.studentName !== undefined && !String(input.studentName).trim()) {
      throw new ValidationError("NOM (Student Name) is required.");
    }
    if (input.remise !== undefined && input.remise < 0) {
      throw new ValidationError("Remise cannot be negative.");
    }
    if (
      input.septemberBalance !== undefined &&
      input.septemberBalance !== null
    ) {
      if (input.septemberBalance >= SEPTEMBER_BALANCE_MAX) {
        throw new BusinessRuleError(
          `September balance limit violation: ${input.septemberBalance} exceeds maximum permitted.`,
        );
      }
    }
  }

  private buildFormulaContext(
    input: CreateLedgerEntryInput,
    schedule: FeeSchedule | null,
  ) {
    const fields: Record<string, unknown> = {
      remise: input.remise ?? 0,
      fi: input.fi ?? 0,
      v2: input.v2 ?? 0,
      altV2: input.altV2 ?? 0,
      v3: input.v3 ?? 0,
      t1: input.t1 ?? 0,
      t2: input.t2 ?? 0,
      t3: input.t3 ?? 0,
      psy1: input.psy1 ?? 0,
      psy2: input.psy2 ?? 0,
      orth1: input.orth1 ?? 0,
      orth2: input.orth2 ?? 0,
      ePlant: input.ePlant ?? 0,
      ratrapage: input.ratrapage ?? 0,
      september: input.september ?? 0,
      december: input.december ?? 0,
      march: input.march ?? 0,
      reimbursement: input.reimbursement ?? 0,
      priorDebt: input.priorDebt ?? 0,
      debtSettlement: input.debtSettlement ?? 0,
    };

    const lines: FeeScheduleLine[] = schedule?.lines ?? [];
    const findLine = (type: string) =>
      lines.find((l) => l.type === type)?.amount ?? 0;

    fields.registration = findLine("registration") || 25000;
    fields.baseTuition = findLine("tuition") || 205000;
    fields.transportBase = findLine("transport_base") || 35000;
    fields.transportPremium = findLine("transport_premium") || 55000;

    return { fields };
  }

  private evalNumeric(
    rule: any,
    ctx: { fields: Record<string, unknown> },
  ): number {
    const result = safeEvaluate(
      rule.expression,
      ctx,
      `ledger.rule.${rule.name}`,
    );
    return result.ok
      ? typeof result.value === "number"
        ? result.value
        : Number(result.value) || 0
      : 0;
  }
}
