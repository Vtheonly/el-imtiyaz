/**
 * Formula Rule — a user-defined calculation rule persisted in the database.
 *
 * The Excel workbook's "code" lives inside cell formulas. To reproduce
 * that behaviour in-app — and to allow users to *create new* formulas
 * without writing code — we persist formula rules as first-class entities.
 *
 * A FormulaRule is:
 *   - A name (e.g. "DEVIS ANNUEL")
 *   - An expression in our safe mini-language (see FormulaEngine)
 *   - A scope: ledger | quote | student | global
 *   - An optional target field — where the result is written back
 *   - An optional trigger — when the rule auto-evaluates
 *
 * Examples (matching the Excel formulas):
 *   - name: "DEVIS ANNUEL"
 *     expression: "25000 + 205000 + 35000 + transport_premium - remise"
 *     scope: "ledger"
 *     targetField: "devisAnnuel"
 *
 *   - name: "TOTAL VERSEMENTS"
 *     expression: "fi + v2 + altV2 + v3 + t1 + t2 + t3"
 *     scope: "ledger"
 *     targetField: "totalVersements"
 *
 *   - name: "TOTAL CREANCE"
 *     expression: "devisAnnuel - totalVersements"
 *     scope: "ledger"
 *     targetField: "totalCreance"
 *
 *   - name: "Quote Net Payable"
 *     expression: "subTotal - advances - discounts"
 *     scope: "quote"
 *     targetField: "netPayable"
 *
 *   - name: "5% Tax on School Fees"
 *     expression: "sum(lineItems.fraisScolaireAmount) * 0.05"
 *     scope: "quote"
 *     targetField: "schoolFeeTax"
 *
 * Formula rules are evaluated by the FormulaEngine (see
 * src/services/formula/formula-engine.ts). The engine supports arithmetic,
 * conditionals (IF), aggregations (SUM, COUNT, AVG, MIN, MAX), and
 * named references resolved against the entry's fields.
 */

import { Identifier } from "../value-objects/identifier";

export type FormulaScope = "ledger" | "quote" | "student" | "global";

export type FormulaTrigger =
  | "manual"           // only when the user clicks "Evaluate"
  | "on_field_change"  // re-evaluate when a watched field changes
  | "on_save"          // re-evaluate when the parent entity is saved
  | "on_workflow";     // only via a workflow node

export interface FormulaRule {
  id: Identifier<"FormulaRule">;
  name: string;
  description?: string;
  /** Safe mini-language expression. Parsed by FormulaEngine. */
  expression: string;
  scope: FormulaScope;
  /** Target field on the parent entity to write the result to. */
  targetField?: string;
  /** When this rule auto-evaluates. */
  trigger: FormulaTrigger;
  /** Field paths that, when changed, trigger re-evaluation. */
  watchedFields: string[];
  /** Whether the rule is active. Inactive rules are skipped. */
  isActive: boolean;
  /** Optional: only apply to entries matching this filter (SQL-like fragment). */
  condition?: string;
  /** Optional: priority — lower numbers run first. Default 100. */
  priority: number;
  /** Last evaluation result (for debugging). */
  lastResult?: unknown;
  lastEvaluatedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFormulaRuleInput {
  name: string;
  description?: string;
  expression: string;
  scope: FormulaScope;
  targetField?: string;
  trigger?: FormulaTrigger;
  watchedFields?: string[];
  isActive?: boolean;
  condition?: string;
  priority?: number;
}

export type UpdateFormulaRuleInput = Partial<CreateFormulaRuleInput>;
