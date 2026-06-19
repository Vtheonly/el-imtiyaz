/**
 * Ledger Service — the in-app equivalent of the Excel `ETAT 20262027` sheet.
 *
 * Reproduces the three Excel "code" columns:
 *
 *   L  (DEVIS ANNUEL)      = reg + tuition + transport + extras − remise
 *   P  (TOTAL VERSEMENTS)  = fi + v2 + altV2 + v3 + t1 + t2 + t3
 *   Q  (TOTAL*CREANCE)     = L − P            (balance owed)
 *
 * Also enforces the one data-validation rule from the Excel file:
 *   september_balance < 10000 DZD
 *
 * And the conditional formatting rule (color scale) is reproduced
 * visually by the renderer (Payments page).
 */

import { LedgerRepository, LedgerQuery } from "../infrastructure/repositories/ledger-entry.repository";
import { FeeScheduleRepository } from "../infrastructure/repositories/fee-schedule.repository";
import { FormulaRuleRepository } from "../infrastructure/repositories/formula-rule.repository";
import { PaymentAuditCommentRepository } from "../infrastructure/repositories/payment-audit-comment.repository";
import type {
  LedgerEntry,
  CreateLedgerEntryInput,
  UpdateLedgerEntryInput,
} from "../core/entities/ledger-entry.entity";
import type { FeeSchedule, FeeScheduleLine } from "../core/entities/fee-schedule.entity";
import type { FormulaRule } from "../core/entities/formula-rule.entity";
import type { IEventBus } from "../core/interfaces/event-bus.interface";
import { SEPTEMBER_BALANCE_MAX } from "../core/enums";
import {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} from "../infrastructure/error/app-error";
import { logger } from "../infrastructure/logger/logger";
import { evaluate, safeEvaluate, extractFieldRefs } from "./formula/formula-engine";

export interface LedgerSummary {
  totalEntries: number;
  totalDevisAnnuel: number;
  totalVersements: number;
  totalCreance: number;
  totalGrandTotal: number;
  byClass: Array<{ classCode: string; count: number; creance: number }>;
  byLevel: Array<{ level: string; count: number; creance: number }>;
}

export interface LedgerRecomputeResult {
  recomputed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

/** Default Excel formula constants (mirroring `=25000+205000+35000-J2`). */
export const DEFAULT_LEDGER_FORMULAS = {
  devisAnnuel: "registration + baseTuition + transportBase - remise",
  totalVersements: "fi + v2 + altV2 + v3 + t1 + t2 + t3",
  totalCreance: "devisAnnuel - totalVersements",
  grandTotal: "totalVersements + psy1 + psy2 + orth1 + orth2 + ePlant + ratrapage + september + december + march",
} as const;

export class LedgerService {
  readonly serviceName = "LedgerService";

  constructor(
    private readonly ledger: LedgerRepository,
    private readonly feeSchedules: FeeScheduleRepository,
    private readonly formulaRules: FormulaRuleRepository,
    private readonly auditComments: PaymentAuditCommentRepository,
    private readonly eventBus?: IEventBus
  ) {}

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

  /**
   * Create a new ledger entry. Computes `devisAnnuel`, `totalVersements`,
   * and `totalCreance` from the input before persisting — so the row is
   * always in a consistent state, exactly like Excel does on cell edit.
   */
  async create(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    this.validateInput(input);
    const computed = await this.computeFields(input);

    const entry = await this.ledger.create({ ...input, ...computed });

    if (this.eventBus) {
      await this.eventBus.publish("ledger.entry.created", {
        entityId: entry.id.value,
        entityType: "LedgerEntry",
        after: entry,
        actor: { actorId: "system", actorName: "System" },
      });
    }

    logger.info("ledger.entry.created", {
      id: entry.id.value,
      studentName: entry.studentName,
      devisAnnuel: entry.devisAnnuel,
      totalCreance: entry.totalCreance,
    });

    return entry;
  }

  /**
   * Update a ledger entry. Re-computes the three computed fields after
   * applying the patch, then persists. Optional `runFormulas` flag
   * (default true) re-evaluates any active formula rules of scope=ledger
   * after the update — mirroring Excel's auto-recalc.
   */
  async update(id: string, patch: UpdateLedgerEntryInput): Promise<LedgerEntry> {
    const before = await this.getById(id);
    this.validateInput({ ...before, ...patch });

    const merged: CreateLedgerEntryInput = {
      ...before,
      ...patch,
    } as CreateLedgerEntryInput;

    const computed = await this.computeFields(merged);
    const updated = await this.ledger.update(id, { ...patch, ...computed });

    if (this.eventBus) {
      await this.eventBus.publish("ledger.entry.updated", {
        entityId: id,
        entityType: "LedgerEntry",
        before,
        after: updated,
        actor: { actorId: "system", actorName: "System" },
      });
    }

    // Re-evaluate any active on_save ledger formulas.
    await this.runFormulasForEntry(updated, "on_save");

    logger.info("ledger.entry.updated", {
      id: updated.id.value,
      devisAnnuel: updated.devisAnnuel,
      totalCreance: updated.totalCreance,
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const before = await this.getById(id);
    await this.ledger.delete(id);
    if (this.eventBus) {
      await this.eventBus.publish("ledger.entry.deleted", {
        entityId: id,
        entityType: "LedgerEntry",
        before,
        actor: { actorId: "system", actorName: "System" },
      });
    }
    logger.info("ledger.entry.deleted", { id });
  }

  /**
   * Compute `devisAnnuel`, `totalVersements`, `totalCreance` and
   * `grandTotal` from an input. Tries active ledger-scope formula rules
   * first (so user-defined rules win); falls back to the Excel defaults.
   */
  async computeFields(input: CreateLedgerEntryInput): Promise<Partial<LedgerEntry>> {
    const schedule = await this.getActiveSchedule();
    const ctx = this.buildFormulaContext(input, schedule);

    const rules = await this.formulaRules.list({ scope: "ledger", isActive: true });
    rules.sort((a, b) => a.priority - b.priority);

    const result: Partial<LedgerEntry> = {};

    // If we have an active rule for devisAnnuel, use it; else default formula.
    const devisRule = rules.find((r) => r.targetField === "devisAnnuel");
    result.devisAnnuel = devisRule
      ? this.evalNumeric(devisRule, ctx)
      : this.evalDefaultFormula(DEFAULT_LEDGER_FORMULAS.devisAnnuel, ctx, "devisAnnuel");

    const versementsRule = rules.find((r) => r.targetField === "totalVersements");
    result.totalVersements = versementsRule
      ? this.evalNumeric(versementsRule, ctx)
      : this.evalDefaultFormula(DEFAULT_LEDGER_FORMULAS.totalVersements, ctx, "totalVersements");

    const creanceRule = rules.find((r) => r.targetField === "totalCreance");
    result.totalCreance = creanceRule
      ? this.evalNumeric(creanceRule, ctx)
      : this.evalDefaultFormula(DEFAULT_LEDGER_FORMULAS.totalCreance, ctx, "totalCreance");

    const grandTotalRule = rules.find((r) => r.targetField === "grandTotal");
    result.grandTotal = grandTotalRule
      ? this.evalNumeric(grandTotalRule, ctx)
      : this.evalDefaultFormula(DEFAULT_LEDGER_FORMULAS.grandTotal, ctx, "grandTotal");

    return result;
  }

  /**
   * Recompute every ledger entry in the database. Useful after editing
   * a fee schedule or formula rule.
   */
  async recomputeAll(): Promise<LedgerRecomputeResult> {
    const entries = await this.ledger.list({ pageSize: 10000 });
    let recomputed = 0;
    let skipped = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const entry of entries) {
      try {
        const computed = await this.computeFields(entry as unknown as CreateLedgerEntryInput);
        await this.ledger.update(entry.id.value, computed);
        recomputed++;
      } catch (err) {
        skipped++;
        errors.push({ id: entry.id.value, error: (err as Error).message });
      }
    }

    logger.info("ledger.recomputeAll.complete", { recomputed, skipped, errorCount: errors.length });
    return { recomputed, skipped, errors };
  }

  /**
   * Get a summary of the ledger — totals and per-class / per-level
   * breakdowns. Used by the Reports page and the Dashboard.
   */
  async getSummary(): Promise<LedgerSummary> {
    const entries = await this.ledger.list({ pageSize: 10000 });
    const byClassMap = new Map<string, { count: number; creance: number }>();
    const byLevelMap = new Map<string, { count: number; creance: number }>();

    let totalDevisAnnuel = 0;
    let totalVersements = 0;
    let totalCreance = 0;
    let totalGrandTotal = 0;

    for (const e of entries) {
      totalDevisAnnuel += e.devisAnnuel;
      totalVersements += e.totalVersements;
      totalCreance += e.totalCreance;
      totalGrandTotal += e.grandTotal;

      const ck = e.classCode ?? "(none)";
      const lk = e.level ?? "(none)";
      const c = byClassMap.get(ck) ?? { count: 0, creance: 0 };
      const l = byLevelMap.get(lk) ?? { count: 0, creance: 0 };
      byClassMap.set(ck, { count: c.count + 1, creance: c.creance + e.totalCreance });
      byLevelMap.set(lk, { count: l.count + 1, creance: l.creance + e.totalCreance });
    }

    return {
      totalEntries: entries.length,
      totalDevisAnnuel,
      totalVersements,
      totalCreance,
      totalGrandTotal,
      byClass: Array.from(byClassMap.entries()).map(([classCode, v]) => ({ classCode, ...v })),
      byLevel: Array.from(byLevelMap.entries()).map(([level, v]) => ({ level, ...v })),
    };
  }

  // ── Payment Audit Comments ─────────────────────────────────
  async listAuditComments(ledgerEntryId: string) {
    return this.auditComments.list({ ledgerEntryId });
  }

  async addAuditComment(input: {
    ledgerEntryId: string;
    rawText: string;
    studentId?: string;
    paymentId?: string;
    excelCell?: string;
    sourceRow?: number;
  }) {
    return this.auditComments.create(input);
  }

  // ── Private helpers ───────────────────────────────────────
  private validateInput(input: CreateLedgerEntryInput | UpdateLedgerEntryInput) {
    if ("studentName" in input && input.studentName !== undefined) {
      if (typeof input.studentName === "string" && !input.studentName.trim()) {
        throw new ValidationError("Student name is required for a ledger entry");
      }
    }
    if (input.remise !== undefined && input.remise < 0) {
      throw new ValidationError("Remise (discount) cannot be negative");
    }
    const septBal = (input as UpdateLedgerEntryInput).septemberBalance;
    if (septBal !== undefined && septBal !== null) {
      if (septBal >= SEPTEMBER_BALANCE_MAX) {
        throw new BusinessRuleError(
          `September balance must be less than ${SEPTEMBER_BALANCE_MAX} DZD (Excel data-validation rule)`,
          { value: septBal, max: SEPTEMBER_BALANCE_MAX }
        );
      }
    }
  }

  private async getActiveSchedule(): Promise<FeeSchedule | null> {
    return this.feeSchedules.findActive();
  }

  private buildFormulaContext(input: CreateLedgerEntryInput, schedule: FeeSchedule | null) {
    const fields: Record<string, unknown> = {
      // Raw inputs
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

    // Excel "constants" from the active fee schedule (or defaults).
    const lines: FeeScheduleLine[] = schedule?.lines ?? [];
    const findLine = (type: string) => lines.find((l) => l.type === type)?.amount ?? 0;

    fields.registration = findLine("registration") || 25000;
    fields.baseTuition = findLine("tuition") || 205000;
    fields.transportBase = findLine("transport_base") || 35000;
    fields.transportPremium = findLine("transport_premium") || 55000;

    // Already-computed values (so dependent formulas like Q = L - P resolve).
    // These come from UpdateLedgerEntryInput when patching an existing entry.
    const ext = input as UpdateLedgerEntryInput & { totalVersements?: number };
    if (input.devisAnnuel !== undefined) fields.devisAnnuel = input.devisAnnuel;
    if (ext.totalVersements !== undefined) fields.totalVersements = ext.totalVersements;

    return { fields };
  }

  private evalDefaultFormula(
    expression: string,
    ctx: { fields: Record<string, unknown> },
    fieldName: string
  ): number {
    const result = safeEvaluate(expression, ctx, `ledger.default.${fieldName}`);
    if (!result.ok) {
      const err = (result as { error: string }).error;
      logger.warn("ledger.default.formula.error", { fieldName, expression, error: err });
      return 0;
    }
    return typeof result.value === "number" ? result.value : Number(result.value) || 0;
  }

  private evalNumeric(
    rule: FormulaRule,
    ctx: { fields: Record<string, unknown> }
  ): number {
    const result = safeEvaluate(rule.expression, ctx, `ledger.rule.${rule.name}`);
    if (!result.ok) {
      const err = (result as { error: string }).error;
      // Record the error on the rule for UI debugging.
      this.formulaRules.recordEvaluation(rule.id.value, { value: null, error: err });
      logger.warn("ledger.rule.error", { ruleId: rule.id.value, name: rule.name, error: err });
      return 0;
    }
    const numeric = typeof result.value === "number" ? result.value : Number(result.value) || 0;
    this.formulaRules.recordEvaluation(rule.id.value, { value: numeric });
    return numeric;
  }

  /**
   * Re-evaluate all formula rules matching a trigger for a single entry.
   * If a rule has a targetField, the result is written back to the entry.
   */
  private async runFormulasForEntry(entry: LedgerEntry, trigger: string): Promise<void> {
    const rules = await this.formulaRules.list({ scope: "ledger", isActive: true });
    const matching = rules.filter((r) => r.trigger === trigger);
    if (matching.length === 0) return;

    const ctx = { fields: entry as unknown as Record<string, unknown> };
    const patch: Partial<LedgerEntry> = {};

    for (const rule of matching) {
      const result = safeEvaluate(rule.expression, ctx, `ledger.onSave.${rule.name}`);
      if (!result.ok) {
        const err = (result as { error: string }).error;
        await this.formulaRules.recordEvaluation(rule.id.value, { value: null, error: err });
        continue;
      }
      await this.formulaRules.recordEvaluation(rule.id.value, { value: result.value });
      if (rule.targetField) {
        (patch as Record<string, unknown>)[rule.targetField] = result.value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await this.ledger.update(entry.id.value, patch);
    }
  }
}
