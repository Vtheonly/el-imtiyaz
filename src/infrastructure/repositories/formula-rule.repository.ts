/**
 * Formula Rule repository — persists user-defined calculation rules.
 *
 * Rules are stored as a flat table. Each row represents one formula
 * (e.g. "DEVIS ANNUEL = 25000 + 205000 + 35000 + transport - remise")
 * that the FormulaEngine evaluates against an entity's fields.
 */

import type { DatabaseClient } from "../database/sqlite-client";
import type {
  FormulaRule,
  CreateFormulaRuleInput,
  UpdateFormulaRuleInput,
  FormulaScope,
  FormulaTrigger,
} from "../../core/entities/formula-rule.entity";
import { Identifier } from "../../core/value-objects/identifier";
import { BaseRepository } from "./base.repository";

interface FormulaRuleRow {
  id: string;
  name: string;
  description: string | null;
  expression: string;
  scope: string;
  target_field: string | null;
  trigger: string;
  watched_fields_json: string;
  is_active: number;
  condition_expr: string | null;
  priority: number;
  last_result: string | null;
  last_evaluated_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormulaRuleQuery {
  scope?: FormulaScope;
  isActive?: boolean;
  trigger?: FormulaTrigger;
  search?: string;
}

export class FormulaRuleRepository extends BaseRepository<FormulaRule, FormulaRuleQuery> {
  constructor(db: DatabaseClient) {
    super(db, "formula_rules");
  }

  protected searchColumns(): string[] {
    return ["name", "description", "expression"];
  }

  async findById(id: string): Promise<FormulaRule | null> {
    const row = this.db.get<FormulaRuleRow>(
      "SELECT * FROM formula_rules WHERE id = ?",
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async list(query: FormulaRuleQuery = {}): Promise<FormulaRule[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.scope) {
      conditions.push("scope = @scope");
      params.scope = query.scope;
    }
    if (query.isActive !== undefined) {
      conditions.push("is_active = @active");
      params.active = query.isActive ? 1 : 0;
    }
    if (query.trigger) {
      conditions.push("trigger = @trigger");
      params.trigger = query.trigger;
    }
    if (query.search) {
      conditions.push(`(${this.searchColumns().map((c) => `${c} LIKE @search`).join(" OR ")})`);
      params.search = `%${query.search}%`;
    }

    const sql = `SELECT * FROM formula_rules
                 ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
                 ORDER BY priority ASC, name ASC`;
    const rows = this.db.all<FormulaRuleRow>(sql, params);
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateFormulaRuleInput): Promise<FormulaRule> {
    const id = Identifier.generate<"FormulaRule">().value;
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO formula_rules (
        id, name, description, expression, scope, target_field, trigger,
        watched_fields_json, is_active, condition_expr, priority,
        last_result, last_evaluated_at, last_error, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @expression, @scope, @targetField, @trigger,
        @watched, @active, @condition, @priority,
        NULL, NULL, NULL, @createdAt, @updatedAt
      )`,
      {
        id,
        name: input.name,
        description: input.description ?? null,
        expression: input.expression,
        scope: input.scope,
        targetField: input.targetField ?? null,
        trigger: input.trigger ?? "manual",
        watched: JSON.stringify(input.watchedFields ?? []),
        active: input.isActive === false ? 0 : 1,
        condition: input.condition ?? null,
        priority: input.priority ?? 100,
        createdAt: now,
        updatedAt: now,
      }
    );

    return (await this.findById(id))!;
  }

  async update(id: string, patch: UpdateFormulaRuleInput): Promise<FormulaRule> {
    const sets: string[] = ["updated_at = @updatedAt"];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

    if (patch.name !== undefined) { sets.push("name = @name"); params.name = patch.name; }
    if (patch.description !== undefined) { sets.push("description = @description"); params.description = patch.description; }
    if (patch.expression !== undefined) { sets.push("expression = @expression"); params.expression = patch.expression; }
    if (patch.scope !== undefined) { sets.push("scope = @scope"); params.scope = patch.scope; }
    if (patch.targetField !== undefined) { sets.push("target_field = @targetField"); params.targetField = patch.targetField; }
    if (patch.trigger !== undefined) { sets.push("trigger = @trigger"); params.trigger = patch.trigger; }
    if (patch.watchedFields !== undefined) {
      sets.push("watched_fields_json = @watched");
      params.watched = JSON.stringify(patch.watchedFields);
    }
    if (patch.isActive !== undefined) { sets.push("is_active = @active"); params.active = patch.isActive ? 1 : 0; }
    if (patch.condition !== undefined) { sets.push("condition_expr = @condition"); params.condition = patch.condition; }
    if (patch.priority !== undefined) { sets.push("priority = @priority"); params.priority = patch.priority; }

    this.db.run(`UPDATE formula_rules SET ${sets.join(", ")} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run("DELETE FROM formula_rules WHERE id = ?", [id]);
  }

  /** Persist the outcome of a single evaluation (for debugging UI). */
  async recordEvaluation(id: string, result: { value: unknown; error?: string }): Promise<void> {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE formula_rules
          SET last_result = @result,
              last_evaluated_at = @now,
              last_error = @error
        WHERE id = @id`,
      {
        id,
        result: result.error ? null : JSON.stringify(result.value),
        now,
        error: result.error ?? null,
      }
    );
  }

  private mapRow(row: FormulaRuleRow): FormulaRule {
    return {
      id: Identifier.from<"FormulaRule">(row.id),
      name: row.name,
      description: row.description ?? undefined,
      expression: row.expression,
      scope: row.scope as FormulaScope,
      targetField: row.target_field ?? undefined,
      trigger: row.trigger as FormulaTrigger,
      watchedFields: this.parseJson<string[]>(row.watched_fields_json, []),
      isActive: !!row.is_active,
      condition: row.condition_expr ?? undefined,
      priority: row.priority,
      lastResult: row.last_result ? this.parseJson(row.last_result, undefined) : undefined,
      lastEvaluatedAt: row.last_evaluated_at ?? undefined,
      lastError: row.last_error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
