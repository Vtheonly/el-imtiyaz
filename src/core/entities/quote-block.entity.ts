/**
 * Quote Block — one "devis" block from the Excel `Devis` sheet.
 *
 * The Devis sheet contains 10 repeating quote blocks, each ~50 rows tall.
 * Each block computes:
 *   - Per-line totals:  =SUM(A{r}:H{r})
 *   - Sub-total:        =SUM(I{top}:I{bottom})
 *   - Net payable:      =subtotal − advances − discounts
 *   - 5% tax on school fees: =SUM(F{top}:F{bottom}) * 0.05
 *   - Block date:       =TODAY()
 *
 * The block also has 5 dropdown columns per line item:
 *   D = CLASSE, E = FI, F = FRAISSCOLAIRE, G = SERVICE, H = transport
 *
 * In-app, each block is a persistent record with its line items stored as
 * a JSON array — mirroring how the Excel rows form a visual block.
 */

import { Identifier } from "../value-objects/identifier";

/** One line item within a quote block — Excel rows 15..26 of a block. */
export interface QuoteLineItem {
  /** Stable client-side id (uuid). */
  id: string;
  label: string;
  /** Class dropdown value (Excel col D). */
  classe?: string;
  /** Registration fee dropdown value (Excel col E). */
  fi?: string;
  /** School fee dropdown value (Excel col F). */
  fraisScolaire?: string;
  /** Service dropdown value (Excel col G). */
  service?: string;
  /** Transport dropdown value (Excel col H). */
  transport?: string;
  /** 8 amount columns (Excel A..H) collapsed to an array. */
  amounts: number[];   // length 8
  /** Computed: SUM(amounts). The service refreshes this. */
  lineTotal: number;
}

export interface QuoteBlock {
  id: Identifier<"QuoteBlock">;
  name: string;
  description?: string;
  /** Linked student (optional). */
  studentId?: string;
  /** Linked academic year. */
  academicYearId?: string;
  /** The line items in this block (typically 10). */
  items: QuoteLineItem[];
  /** Advances already paid (Excel I29 etc.) — subtracted from subtotal. */
  advances: number;
  /** Discounts applied (Excel I30 etc.) — subtracted from subtotal. */
  discounts: number;
  /** Computed sub-total (Excel I27). */
  subTotal: number;
  /** Computed net payable (Excel I31 = I27 − I29). */
  netPayable: number;
  /** Computed 5% tax on school fees (Excel D35 = SUM(F15:F26) * 0.05). */
  schoolFeeTax: number;
  /** Block date (Excel I9 = TODAY()). */
  blockDate: string;
  /** Optional template this block was generated from. */
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateQuoteBlockInput {
  name: string;
  description?: string;
  studentId?: string;
  academicYearId?: string;
  items?: Array<Omit<QuoteLineItem, "id" | "lineTotal">>;
  advances?: number;
  discounts?: number;
  templateId?: string;
  blockDate?: string;
}

export type UpdateQuoteBlockInput = Partial<CreateQuoteBlockInput>;
