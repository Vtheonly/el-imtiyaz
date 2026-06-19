/**
 * Fee Schedule Service — manages the school's pricing tiers.
 *
 * The Excel workbook encodes fees implicitly inside cell formulas
 * (e.g. =25000+205000+35000-J2). This service makes those tiers
 * explicit & editable. When a schedule changes, every linked ledger
 * entry should re-evaluate — that orchestration happens via the
 * LedgerService.recomputeAll() method, which this service calls.
 */

import { FeeScheduleRepository, FeeScheduleQuery } from "../infrastructure/repositories/fee-schedule.repository";
import type {
  FeeSchedule,
  FeeScheduleLine,
  CreateFeeScheduleInput,
  UpdateFeeScheduleInput,
} from "../core/entities/fee-schedule.entity";
import { DEFAULT_FEE_SCHEDULE } from "../core/entities/fee-schedule.entity";
import { LedgerService } from "./ledger.service";
import { NotFoundError, ValidationError } from "../infrastructure/error/app-error";
import { logger } from "../infrastructure/logger/logger";

export class FeeScheduleService {
  readonly serviceName = "FeeScheduleService";

  /** Late-injected ledger reference (avoids circular constructor dep). */
  public ledger: LedgerService | null = null;

  constructor(
    private readonly schedules: FeeScheduleRepository,
    ledger?: LedgerService
  ) {
    if (ledger) this.ledger = ledger;
  }

  async list(query: FeeScheduleQuery = {}): Promise<FeeSchedule[]> {
    return this.schedules.list(query);
  }

  async getById(id: string): Promise<FeeSchedule> {
    const s = await this.schedules.findById(id);
    if (!s) throw new NotFoundError("FeeSchedule", id);
    return s;
  }

  async getActive(): Promise<FeeSchedule | null> {
    return this.schedules.findActive();
  }

  async create(input: CreateFeeScheduleInput): Promise<FeeSchedule> {
    if (!input.name?.trim()) throw new ValidationError("Schedule name is required");
    if (!input.gradeLevel?.trim()) throw new ValidationError("Grade level is required");
    if (!input.lines?.length) throw new ValidationError("Schedule must have at least one line");

    const schedule = await this.schedules.create(input);

    logger.info("feeSchedule.created", {
      id: schedule.id.value,
      name: schedule.name,
      gradeLevel: schedule.gradeLevel,
      lineCount: schedule.lines.length,
    });

    return schedule;
  }

  async update(id: string, patch: UpdateFeeScheduleInput): Promise<FeeSchedule> {
    const before = await this.getById(id);
    const updated = await this.schedules.update(id, patch);

    // If pricing changed, recompute every ledger entry that uses this schedule.
    if (
      patch.lines !== undefined ||
      (patch.isActive === true && !before.isActive)
    ) {
      logger.info("feeSchedule.changed.recompute", { id });
      if (this.ledger) {
        await this.ledger.recomputeAll();
      }
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.schedules.delete(id);
    logger.info("feeSchedule.deleted", { id });
  }

  /**
   * Bootstrap a default schedule from the Excel constants if none exists.
   * Called on first run by the bootstrap pipeline.
   */
  async ensureDefaultExists(): Promise<FeeSchedule> {
    const existing = await this.schedules.findActive();
    if (existing) return existing;

    return this.create({
      name: "Default (Excel 2026-2027)",
      description: "Auto-created from the implicit pricing in the Suivis clients.xlsx workbook",
      gradeLevel: "ALL",
      lines: DEFAULT_FEE_SCHEDULE.map((l) => ({ ...l })),
      isActive: true,
    });
  }

  /**
   * Resolve the fee for a specific line type from a schedule (or from
   * the default if none provided). Used by the LedgerService.
   */
  resolveLineAmount(
    schedule: FeeSchedule | null,
    type: FeeScheduleLine["type"]
  ): number {
    if (!schedule) {
      const def = DEFAULT_FEE_SCHEDULE.find((l) => l.type === type);
      return def?.amount ?? 0;
    }
    return schedule.lines.find((l) => l.type === type)?.amount ?? 0;
  }
}
