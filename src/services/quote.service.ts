/**
 * Quote Service — reproduces the Excel `Devis` sheet behaviour in-app.
 *
 * Each quote block contains line items and computes:
 *   - Per-line total:  =SUM(A{r}:H{r})     →  item.lineTotal
 *   - Sub-total:       =SUM(I{top}:I{bot}) →  block.subTotal
 *   - Net payable:     =I27 − I29 − I30    →  block.netPayable
 *   - 5% tax on school fees: =SUM(F) * 0.05 →  block.schoolFeeTax
 *   - Block date:      =TODAY()            →  block.blockDate
 *
 * The sheet has 10 repeating blocks per print page; we expose them as
 * individual QuoteBlock entities that can be linked to students.
 */

import { QuoteBlockRepository, QuoteBlockQuery } from "../infrastructure/repositories/quote-block.repository";
import type {
  QuoteBlock,
  QuoteLineItem,
  CreateQuoteBlockInput,
  UpdateQuoteBlockInput,
} from "../core/entities/quote-block.entity";
import type { IEventBus } from "../core/interfaces/event-bus.interface";
import { QUOTE_SCHOOL_FEE_TAX_RATE } from "../core/enums";
import { NotFoundError, ValidationError } from "../infrastructure/error/app-error";
import { logger } from "../infrastructure/logger/logger";

export interface QuoteComputationResult {
  subTotal: number;
  netPayable: number;
  schoolFeeTax: number;
  items: QuoteLineItem[];
}

export class QuoteService {
  readonly serviceName = "QuoteService";

  constructor(
    private readonly quotes: QuoteBlockRepository,
    private readonly eventBus?: IEventBus
  ) {}

  async list(query: QuoteBlockQuery = {}): Promise<QuoteBlock[]> {
    return this.quotes.list(query);
  }

  async getById(id: string): Promise<QuoteBlock> {
    const q = await this.quotes.findById(id);
    if (!q) throw new NotFoundError("QuoteBlock", id);
    return q;
  }

  async getByStudent(studentId: string): Promise<QuoteBlock[]> {
    return this.quotes.list({ studentId });
  }

  /**
   * Create a new quote block. Per-line totals, sub-total, net payable
   * and school-fee tax are all computed automatically — same as Excel.
   */
  async create(input: CreateQuoteBlockInput): Promise<QuoteBlock> {
    if (!input.name?.trim()) throw new ValidationError("Quote name is required");
    if (input.items && input.items.length > 0) {
      for (const it of input.items) {
        if (it.amounts.length !== 8) {
          throw new ValidationError(
            `Line item "${it.label}" must have exactly 8 amount columns (A..H) — got ${it.amounts.length}`
          );
        }
      }
    }

    const computed = this.compute(input.items ?? [], input.advances ?? 0, input.discounts ?? 0);
    const quote = await this.quotes.create({
      ...input,
      ...computed,
      blockDate: input.blockDate ?? new Date().toISOString().slice(0, 10),
    });

    if (this.eventBus) {
      await this.eventBus.publish("quote.created", {
        entityId: quote.id.value,
        entityType: "QuoteBlock",
        after: quote,
        actor: { actorId: "system", actorName: "System" },
      });
    }

    logger.info("quote.created", {
      id: quote.id.value,
      name: quote.name,
      subTotal: quote.subTotal,
      netPayable: quote.netPayable,
    });

    return quote;
  }

  async update(id: string, patch: UpdateQuoteBlockInput): Promise<QuoteBlock> {
    const before = await this.getById(id);

    const mergedItems = patch.items ?? before.items;
    const mergedAdvances = patch.advances ?? before.advances;
    const mergedDiscounts = patch.discounts ?? before.discounts;

    const computed = this.compute(mergedItems, mergedAdvances, mergedDiscounts);
    const updated = await this.quotes.update(id, { ...patch, ...computed });

    if (this.eventBus) {
      await this.eventBus.publish("quote.updated", {
        entityId: id,
        entityType: "QuoteBlock",
        before,
        after: updated,
        actor: { actorId: "system", actorName: "System" },
      });
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const before = await this.getById(id);
    await this.quotes.delete(id);
    if (this.eventBus) {
      await this.eventBus.publish("quote.deleted", {
        entityId: id,
        entityType: "QuoteBlock",
        before,
        actor: { actorId: "system", actorName: "System" },
      });
    }
  }

  /**
   * Compute the Excel-mirroring totals for a quote block:
   *   - Refresh each item's lineTotal: =SUM(amounts)
   *   - subTotal:    =SUM(lineItems.lineTotal)
   *   - netPayable:  =subTotal − advances − discounts
   *   - schoolFeeTax:=SUM(lineItems.fraisScolaire) * 0.05
   *
   * The "fraisScolaireAmount" is the 6th column (index 5) of the amounts
   * array — mirroring how Excel column F holds the school-fee amount.
   */
  compute(
    items: Array<Omit<QuoteLineItem, "id" | "lineTotal"> & Partial<Pick<QuoteLineItem, "id" | "lineTotal">>>,
    advances: number,
    discounts: number
  ): QuoteComputationResult {
    const refreshedItems: QuoteLineItem[] = items.map((it) => ({
      id: it.id ?? generateItemId(),
      label: it.label,
      classe: it.classe,
      fi: it.fi,
      fraisScolaire: it.fraisScolaire,
      service: it.service,
      transport: it.transport,
      amounts: it.amounts,
      lineTotal: it.amounts.reduce((s, a) => s + (Number(a) || 0), 0),
    }));

    const subTotal = refreshedItems.reduce((s, it) => s + it.lineTotal, 0);
    const netPayable = subTotal - (Number(advances) || 0) - (Number(discounts) || 0);

    // School-fee tax: 5% of column F (index 5).
    const schoolFeeSum = refreshedItems.reduce((s, it) => s + (Number(it.amounts[5]) || 0), 0);
    const schoolFeeTax = schoolFeeSum * QUOTE_SCHOOL_FEE_TAX_RATE;

    return { subTotal, netPayable, schoolFeeTax, items: refreshedItems };
  }

  /**
   * Recompute and persist the totals for an existing quote — useful after
   * editing line items via the UI.
   */
  async recompute(id: string): Promise<QuoteBlock> {
    const quote = await this.getById(id);
    const computed = this.compute(quote.items, quote.advances, quote.discounts);
    return this.quotes.update(id, computed);
  }
}

let _itemCounter = 0;
function generateItemId(): string {
  _itemCounter += 1;
  return `li_${Date.now().toString(36)}_${_itemCounter}`;
}
