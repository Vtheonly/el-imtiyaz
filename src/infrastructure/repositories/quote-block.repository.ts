/**
 * Quote Block repository — persists Devis-sheet-style quote blocks.
 */

import type { DatabaseClient } from "../database/sqlite-client";
import type {
  QuoteBlock,
  QuoteLineItem,
  CreateQuoteBlockInput,
  UpdateQuoteBlockInput,
} from "../../core/entities/quote-block.entity";
import { Identifier } from "../../core/value-objects/identifier";
import { BaseRepository } from "./base.repository";

interface QuoteBlockRow {
  id: string;
  name: string;
  description: string | null;
  student_id: string | null;
  academic_year_id: string | null;
  items_json: string;
  advances: number;
  discounts: number;
  sub_total: number;
  net_payable: number;
  school_fee_tax: number;
  block_date: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface QuoteBlockQuery {
  studentId?: string;
  academicYearId?: string;
  search?: string;
  includeDeleted?: boolean;
}

export class QuoteBlockRepository extends BaseRepository<QuoteBlock, QuoteBlockQuery> {
  constructor(db: DatabaseClient) {
    super(db, "quote_blocks");
  }

  protected searchColumns(): string[] {
    return ["name", "description"];
  }

  async findById(id: string): Promise<QuoteBlock | null> {
    const row = this.db.get<QuoteBlockRow>(
      "SELECT * FROM quote_blocks WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: QuoteBlockQuery = {}): Promise<QuoteBlock[]> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: Record<string, unknown> = {};

    if (query.studentId) {
      conditions.push("student_id = @studentId");
      params.studentId = query.studentId;
    }
    if (query.academicYearId) {
      conditions.push("academic_year_id = @academicYearId");
      params.academicYearId = query.academicYearId;
    }
    if (query.search) {
      conditions.push(`(${this.searchColumns().map((c) => `${c} LIKE @search`).join(" OR ")})`);
      params.search = `%${query.search}%`;
    }

    const sql = `SELECT * FROM quote_blocks WHERE ${conditions.join(" AND ")}
                 ORDER BY block_date DESC, created_at DESC`;
    const rows = this.db.all<QuoteBlockRow>(sql, params);
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateQuoteBlockInput & Partial<QuoteBlock>): Promise<QuoteBlock> {
    const id = (input.id ?? Identifier.generate<"QuoteBlock">()).value;
    const now = new Date().toISOString();
    const items = (input.items ?? []).map((it, _idx) => {
      const i = it as Omit<QuoteLineItem, "id" | "lineTotal"> & Partial<Pick<QuoteLineItem, "id" | "lineTotal">>;
      return {
        ...i,
        id: i.id ?? Identifier.generate<"QuoteBlock">().value,
        lineTotal: i.amounts.reduce((s, a) => s + (Number(a) || 0), 0),
      } as QuoteLineItem;
    });

    this.db.run(
      `INSERT INTO quote_blocks (
        id, name, description, student_id, academic_year_id, items_json,
        advances, discounts, sub_total, net_payable, school_fee_tax,
        block_date, template_id, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @studentId, @academicYearId, @items,
        @advances, @discounts, @subTotal, @netPayable, @schoolFeeTax,
        @blockDate, @templateId, @createdAt, @updatedAt
      )`,
      {
        id,
        name: input.name,
        description: input.description ?? null,
        studentId: input.studentId ?? null,
        academicYearId: input.academicYearId ?? null,
        items: JSON.stringify(items),
        advances: input.advances ?? 0,
        discounts: input.discounts ?? 0,
        subTotal: 0,
        netPayable: 0,
        schoolFeeTax: 0,
        blockDate: input.blockDate ?? now,
        templateId: input.templateId ?? null,
        createdAt: now,
        updatedAt: now,
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: UpdateQuoteBlockInput & Partial<QuoteBlock>): Promise<QuoteBlock> {
    const sets: string[] = ["updated_at = @updatedAt"];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

    if (patch.name !== undefined) { sets.push("name = @name"); params.name = patch.name; }
    if (patch.description !== undefined) { sets.push("description = @description"); params.description = patch.description; }
    if (patch.studentId !== undefined) { sets.push("student_id = @studentId"); params.studentId = patch.studentId; }
    if (patch.academicYearId !== undefined) { sets.push("academic_year_id = @academicYearId"); params.academicYearId = patch.academicYearId; }
    if (patch.items !== undefined) {
      const items = patch.items.map((it) => {
        const i = it as Omit<QuoteLineItem, "id" | "lineTotal"> & Partial<Pick<QuoteLineItem, "id" | "lineTotal">>;
        return {
          ...i,
          id: i.id ?? Identifier.generate<"QuoteBlock">().value,
          lineTotal: i.amounts.reduce((s, a) => s + (Number(a) || 0), 0),
        } as QuoteLineItem;
      });
      sets.push("items_json = @items");
      params.items = JSON.stringify(items);
    }
    if (patch.advances !== undefined) { sets.push("advances = @advances"); params.advances = patch.advances; }
    if (patch.discounts !== undefined) { sets.push("discounts = @discounts"); params.discounts = patch.discounts; }
    if (patch.subTotal !== undefined) { sets.push("sub_total = @subTotal"); params.subTotal = patch.subTotal; }
    if (patch.netPayable !== undefined) { sets.push("net_payable = @netPayable"); params.netPayable = patch.netPayable; }
    if (patch.schoolFeeTax !== undefined) { sets.push("school_fee_tax = @schoolFeeTax"); params.schoolFeeTax = patch.schoolFeeTax; }
    if (patch.blockDate !== undefined) { sets.push("block_date = @blockDate"); params.blockDate = patch.blockDate; }
    if (patch.templateId !== undefined) { sets.push("template_id = @templateId"); params.templateId = patch.templateId; }

    this.db.run(`UPDATE quote_blocks SET ${sets.join(", ")} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run(
      "UPDATE quote_blocks SET deleted_at = @now WHERE id = @id",
      { id, now: new Date().toISOString() }
    );
  }

  private mapRow(row: QuoteBlockRow): QuoteBlock {
    const items: QuoteLineItem[] = this.parseJson(row.items_json, []);
    const subTotal = items.reduce((s, it) => s + it.lineTotal, 0);
    return {
      id: Identifier.from<"QuoteBlock">(row.id),
      name: row.name,
      description: row.description ?? undefined,
      studentId: row.student_id ?? undefined,
      academicYearId: row.academic_year_id ?? undefined,
      items,
      advances: row.advances,
      discounts: row.discounts,
      subTotal: row.sub_total || subTotal,
      netPayable: row.net_payable,
      schoolFeeTax: row.school_fee_tax,
      blockDate: row.block_date,
      templateId: row.template_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
