/**
 * Workflow node registry — catalog of all available node types.
 *
 * Each entry defines:
 *   - id (matches node.subtype)
 *   - type (trigger / condition / action / delay / transform)
 *   - label (display name)
 *   - description
 *   - icon (lucide-react name)
 *   - category (groups nodes in the palette)
 *   - inputs / outputs (port definitions)
 *   - configSchema (form fields for the inspector)
 *   - execute (the function that runs when the node fires)
 *
 * Adding a new node type = adding one entry here. The UI, execution engine,
 * and persistence layer all read from this registry.
 */

import type {
  NodeType,
  WorkflowNode,
  WorkflowNodePort,
} from "../../core/entities/workflow.entity";

export interface NodeConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "date" | "textarea" | "json";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
  required?: boolean;
  help?: string;
  /** Conditionally show this field based on another field's value. */
  visibleWhen?: { field: string; equals: unknown };
}

export interface NodeDefinition {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  category: "Triggers" | "Conditions" | "Actions" | "Delays" | "Transforms";
  inputs: WorkflowNodePort[];
  outputs: WorkflowNodePort[];
  configSchema: NodeConfigField[];
  execute: (ctx: NodeExecutionContext) => Promise<NodeExecutionResult>;
}

export interface NodeExecutionContext {
  nodeId: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  services: NodeServices;
  logger: (
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ) => void;
}

export interface NodeExecutionResult {
  outputs: Record<string, unknown>;
  branch?: "true" | "false";
  error?: string;
}

export interface NodeServices {
  getStudent: (id: string) => Promise<unknown>;
  getStudentPayments: (id: string) => Promise<unknown[]>;
  getStudentDebt: (id: string) => Promise<{ outstanding: number }>;
  sendEmail: (to: string, subject: string, body: string) => Promise<void>;
  applyDiscount: (
    studentId: string,
    percentage: number,
    reason: string,
  ) => Promise<void>;
  createInvoice: (input: unknown) => Promise<unknown>;
  logActivity: (action: string, payload: unknown) => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  // ── Excel-migration node services (added 2026-06) ──────────
  /** Evaluate a formula expression against a context (no persistence). */
  evalFormula: (
    expression: string,
    ctx: { fields: Record<string, unknown>; ranges?: Record<string, Array<Record<string, unknown>>> }
  ) => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>;
  /** Create a ledger entry (Excel ETAT row). */
  createLedgerEntry: (input: unknown) => Promise<unknown>;
  /** Update a ledger entry — recomputes derived fields. */
  updateLedgerEntry: (id: string, patch: unknown) => Promise<unknown>;
  /** List ledger entries with optional filter. */
  listLedgerEntries: (filter?: unknown) => Promise<unknown[]>;
  /** Recompute every ledger entry — call after fee schedule change. */
  recomputeLedger: () => Promise<{ recomputed: number; skipped: number; errors: unknown[] }>;
  /** Create a quote block (Excel Devis block). */
  createQuoteBlock: (input: unknown) => Promise<unknown>;
  /** Apply a fee schedule to a list of students (creates invoices + ledger entries). */
  applyFeeSchedule: (scheduleId: string, studentIds: string[]) => Promise<unknown>;
  /** List all active formula rules. */
  listFormulaRules: (scope?: string) => Promise<unknown[]>;
}

const anyIn = (id = "in"): WorkflowNodePort => ({
  id,
  label: "Input",
  type: "any",
});
const anyOut = (id = "out"): WorkflowNodePort => ({
  id,
  label: "Output",
  type: "any",
});
const trueOut = (): WorkflowNodePort => ({
  id: "true",
  label: "True",
  type: "any",
});
const falseOut = (): WorkflowNodePort => ({
  id: "false",
  label: "False",
  type: "any",
});

export const NODE_REGISTRY: NodeDefinition[] = [
  // ── Triggers ──────────────────────────────────────────────────────────────
  {
    id: "trigger.payment.overdue",
    type: "trigger",
    label: "Payment Overdue",
    description:
      "Fires when a payment becomes overdue (due date passed, balance > 0)",
    icon: "AlertCircle",
    category: "Triggers",
    inputs: [],
    outputs: [{ id: "out", label: "Invoice", type: "invoice" }],
    configSchema: [
      {
        key: "daysOverdue",
        label: "Days overdue threshold",
        type: "number",
        default: 1,
        required: true,
        help: "Minimum days past due date before this fires",
      },
    ],
    execute: async (ctx) => {
      ctx.logger("info", "trigger.payment.overdue.fired", {
        nodeId: ctx.nodeId,
      });
      return { outputs: ctx.inputs };
    },
  },
  {
    id: "trigger.student.enrolled",
    type: "trigger",
    label: "Student Enrolled",
    description: "Fires when a new student is enrolled",
    icon: "UserPlus",
    category: "Triggers",
    inputs: [],
    outputs: [{ id: "out", label: "Student", type: "student" }],
    configSchema: [],
    execute: async (ctx) => ({ outputs: ctx.inputs }),
  },
  {
    id: "trigger.payment.recorded",
    type: "trigger",
    label: "Payment Recorded",
    description: "Fires when any payment is recorded",
    icon: "DollarSign",
    category: "Triggers",
    inputs: [],
    outputs: [{ id: "out", label: "Payment", type: "payment" }],
    configSchema: [
      {
        key: "minAmount",
        label: "Minimum amount (DZD)",
        type: "number",
        default: 0,
        help: "Only fire for payments >= this amount",
      },
    ],
    execute: async (ctx) => ({ outputs: ctx.inputs }),
  },
  {
    id: "trigger.schedule",
    type: "trigger",
    label: "Schedule",
    description: "Fires on a recurring schedule (cron-like)",
    icon: "Clock",
    category: "Triggers",
    inputs: [],
    outputs: [{ id: "out", label: "Tick", type: "any" }],
    configSchema: [
      {
        key: "cron",
        label: "Schedule expression",
        type: "text",
        placeholder: "0 9 * * 1  (every Monday 9am)",
        required: true,
        help: "Standard cron format: minute hour day month weekday",
      },
    ],
    execute: async (ctx) => ({ outputs: {} }),
  },
  {
    id: "trigger.manual",
    type: "trigger",
    label: "Manual",
    description: "Fires only when run manually from the UI",
    icon: "Play",
    category: "Triggers",
    inputs: [],
    outputs: [{ id: "out", label: "Run", type: "any" }],
    configSchema: [],
    execute: async (ctx) => ({ outputs: {} }),
  },

  // ── Conditions ────────────────────────────────────────────────────────────
  {
    id: "condition.debt.threshold",
    type: "condition",
    label: "Debt > Threshold",
    description: "Branches based on student outstanding debt amount",
    icon: "GitBranch",
    category: "Conditions",
    inputs: [anyIn()],
    outputs: [trueOut(), falseOut()],
    configSchema: [
      {
        key: "threshold",
        label: "Threshold (DZD)",
        type: "number",
        required: true,
        default: 1000,
        help: "Branches TRUE if outstanding debt exceeds this amount",
      },
    ],
    execute: async (ctx) => {
      const studentId =
        (ctx.inputs.in as { studentId?: string })?.studentId ??
        (ctx.inputs.in as { id?: string })?.id ??
        (ctx.inputs.in as string);
      if (!studentId)
        return { outputs: {}, branch: "false", error: "No studentId in input" };
      const debt = await ctx.services.getStudentDebt(studentId);
      const threshold = Number(ctx.config.threshold ?? 1000);
      const branch = debt.outstanding > threshold ? "true" : "false";
      ctx.logger("info", "condition.debt.threshold.evaluated", {
        studentId,
        outstanding: debt.outstanding,
        threshold,
        branch,
      });
      return { outputs: { true: ctx.inputs.in, false: ctx.inputs.in }, branch };
    },
  },
  {
    id: "condition.status",
    type: "condition",
    label: "Status Match",
    description: "Branches based on entity status field",
    icon: "Filter",
    category: "Conditions",
    inputs: [anyIn()],
    outputs: [trueOut(), falseOut()],
    configSchema: [
      {
        key: "field",
        label: "Field path",
        type: "text",
        default: "status",
        required: true,
        placeholder: "status",
      },
      {
        key: "value",
        label: "Equals value",
        type: "text",
        required: true,
        placeholder: "active",
      },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as Record<string, unknown>;
      const field = String(ctx.config.field ?? "status");
      const value = String(ctx.config.value ?? "");
      const actual = String(input?.[field] ?? "");
      const branch = actual === value ? "true" : "false";
      return { outputs: { true: input, false: input }, branch };
    },
  },
  {
    id: "condition.payment.method",
    type: "condition",
    label: "Payment Method",
    description: "Branches based on payment method",
    icon: "CreditCard",
    category: "Conditions",
    inputs: [anyIn()],
    outputs: [trueOut(), falseOut()],
    configSchema: [
      {
        key: "method",
        label: "Payment method",
        type: "select",
        required: true,
        options: [
          { value: "cash", label: "Cash" },
          { value: "bank_transfer", label: "Bank Transfer" },
          { value: "cheque", label: "Cheque" },
          { value: "card", label: "Card" },
          { value: "baridimob", label: "BaridiMob" },
        ],
      },
    ],
    execute: async (ctx) => {
      const payment = ctx.inputs.in as { paymentMethod?: string };
      const method = String(ctx.config.method ?? "");
      const branch = payment?.paymentMethod === method ? "true" : "false";
      return { outputs: { true: payment, false: payment }, branch };
    },
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  {
    id: "action.send.email",
    type: "action",
    label: "Send Email",
    description: "Sends an email notification via Resend",
    icon: "Mail",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "to",
        label: "To (email)",
        type: "text",
        required: true,
        placeholder: "parent@example.com",
      },
      {
        key: "subject",
        label: "Subject",
        type: "text",
        required: true,
        placeholder: "Payment reminder",
      },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        required: true,
        placeholder: "Dear parent, …",
      },
    ],
    execute: async (ctx) => {
      const to = String(ctx.config.to ?? "");
      const subject = String(ctx.config.subject ?? "");
      const body = String(ctx.config.body ?? "");
      if (!to) return { outputs: {}, error: 'Missing "to" email' };
      await ctx.services.sendEmail(to, subject, body);
      ctx.logger("info", "action.send.email.sent", { to, subject });
      return { outputs: { sent: true, to, subject } };
    },
  },
  {
    id: "action.apply.discount",
    type: "action",
    label: "Apply Discount",
    description: "Applies a percentage discount to outstanding invoices",
    icon: "Percent",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "percentage",
        label: "Percentage",
        type: "number",
        required: true,
        default: 10,
        placeholder: "10",
      },
      {
        key: "reason",
        label: "Reason",
        type: "text",
        required: true,
        placeholder: "Sibling discount",
      },
    ],
    execute: async (ctx) => {
      const studentId =
        (ctx.inputs.in as { studentId?: string })?.studentId ??
        (ctx.inputs.in as { id?: string })?.id ??
        (ctx.inputs.in as string);
      if (!studentId) return { outputs: {}, error: "No studentId in input" };
      const percentage = Number(ctx.config.percentage ?? 0);
      const reason = String(ctx.config.reason ?? "Workflow-applied discount");
      await ctx.services.applyDiscount(studentId, percentage, reason);
      ctx.logger("info", "action.apply.discount.applied", {
        studentId,
        percentage,
        reason,
      });
      return { outputs: { applied: true, studentId, percentage } };
    },
  },
  {
    id: "action.create.invoice",
    type: "action",
    label: "Create Invoice",
    description: "Creates a new invoice for a student",
    icon: "FileText",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "studentId",
        label: "Student ID (or use input)",
        type: "text",
        placeholder: "leave empty to use input",
      },
      {
        key: "type",
        label: "Invoice type",
        type: "select",
        required: true,
        options: [
          { value: "monthly_tuition", label: "Monthly Tuition" },
          { value: "registration", label: "Registration" },
          { value: "transportation", label: "Transportation" },
          { value: "books", label: "Books" },
          { value: "uniform", label: "Uniform" },
          { value: "custom", label: "Custom" },
        ],
      },
      {
        key: "amount",
        label: "Amount (DZD)",
        type: "number",
        required: true,
        placeholder: "5000",
      },
      {
        key: "description",
        label: "Description",
        type: "text",
        required: true,
        placeholder: "Monthly tuition — September",
      },
    ],
    execute: async (ctx) => {
      const studentId =
        String(ctx.config.studentId ?? "") ||
        (ctx.inputs.in as { studentId?: string })?.studentId ||
        (ctx.inputs.in as { id?: string })?.id ||
        (ctx.inputs.in as string);
      if (!studentId) return { outputs: {}, error: "No studentId" };
      const invoice = await ctx.services.createInvoice({
        studentId,
        type: ctx.config.type,
        amountDue: Number(ctx.config.amount),
        description: String(ctx.config.description),
      });
      ctx.logger("info", "action.create.invoice.created", {
        studentId,
        invoice,
      });
      return { outputs: { invoice } };
    },
  },
  {
    id: "action.log.activity",
    type: "action",
    label: "Log Activity",
    description: "Writes a custom entry to the audit log",
    icon: "Database",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "action",
        label: "Action name",
        type: "text",
        required: true,
        placeholder: "workflow.custom",
      },
      { key: "message", label: "Message", type: "textarea", required: true },
    ],
    execute: async (ctx) => {
      await ctx.services.logActivity(
        String(ctx.config.action ?? "workflow.custom"),
        { message: ctx.config.message, input: ctx.inputs.in },
      );
      return { outputs: { logged: true } };
    },
  },

  // ── Delays ────────────────────────────────────────────────────────────────
  {
    id: "delay.duration",
    type: "delay",
    label: "Wait",
    description: "Pauses execution for a fixed duration",
    icon: "Hourglass",
    category: "Delays",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "unit",
        label: "Unit",
        type: "select",
        default: "minutes",
        options: [
          { value: "seconds", label: "Seconds" },
          { value: "minutes", label: "Minutes" },
          { value: "hours", label: "Hours" },
          { value: "days", label: "Days" },
        ],
      },
      {
        key: "value",
        label: "Duration",
        type: "number",
        required: true,
        default: 30,
      },
    ],
    execute: async (ctx) => {
      const value = Number(ctx.config.value ?? 0);
      const unit = String(ctx.config.unit ?? "minutes");
      const multipliers: Record<string, number> = {
        seconds: 1000,
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
      };
      const ms = value * (multipliers[unit] ?? 60000);
      ctx.logger("info", "delay.duration.waiting", { value, unit, ms });
      await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5000)));
      return { outputs: ctx.inputs };
    },
  },

  // ── Transforms ────────────────────────────────────────────────────────────
  {
    id: "transform.extract.field",
    type: "transform",
    label: "Extract Field",
    description: "Extracts a single field from the input payload",
    icon: "Scissors",
    category: "Transforms",
    inputs: [anyIn()],
    outputs: [{ id: "out", label: "Field Value", type: "any" }],
    configSchema: [
      {
        key: "field",
        label: "Field path",
        type: "text",
        required: true,
        placeholder: "studentId",
      },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as Record<string, unknown>;
      const field = String(ctx.config.field ?? "");
      const value = input?.[field];
      return { outputs: { out: value } };
    },
  },
  {
    id: "transform.query.database",
    type: "transform",
    label: "Database Query",
    description: "Runs a SQL query and outputs the rows",
    icon: "Database",
    category: "Transforms",
    inputs: [anyIn()],
    outputs: [{ id: "out", label: "Rows", type: "rows" }],
    configSchema: [
      {
        key: "sql",
        label: "SQL query (read-only)",
        type: "textarea",
        required: true,
        placeholder: "SELECT id, full_name FROM students WHERE status = ?",
      },
      {
        key: "params",
        label: "Parameters (JSON array)",
        type: "json",
        default: "[]",
        help: "Values for ? placeholders",
      },
    ],
    execute: async (ctx) => {
      const sql = String(ctx.config.sql ?? "");
      if (!sql.trim().toLowerCase().startsWith("select")) {
        return {
          outputs: {},
          error: "Only SELECT queries are allowed in workflows",
        };
      }
      let params: unknown[] = [];
      try {
        params =
          typeof ctx.config.params === "string"
            ? JSON.parse(ctx.config.params as string)
            : ((ctx.config.params as unknown[]) ?? []);
      } catch {
        return { outputs: {}, error: "Invalid params JSON" };
      }
      const rows = await ctx.services.query(sql, params);
      return { outputs: { out: rows } };
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // ── Excel-Migration Nodes (added 2026-06) ────────────────────────────────
  // These nodes reproduce the Excel workbook's behaviour inside the visual
  // workflow builder. They let users compose new calculations or data
  // insertions without writing code.
  // ════════════════════════════════════════════════════════════════════════

  {
    id: "transform.formula.eval",
    type: "transform",
    label: "Evaluate Formula",
    description:
      "Evaluates a safe mini-language formula (Excel-like: arithmetic, IF, SUM, VLOOKUP). " +
      "Reproduces Excel cell formulas as a workflow step. Use this to define custom calculations.",
    icon: "Sigma",
    category: "Transforms",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "expression",
        label: "Formula expression",
        type: "textarea",
        placeholder: "fi + v2 + altV2 + v3 + t1 + t2 + t3",
        required: true,
        help:
          "Excel-like expression. Supports + - * / %, IF(cond, a, b), SUM(...), " +
          "VLOOKUP(key, range, col, exact), field references via dot notation.",
      },
      {
        key: "contextSource",
        label: "Where do field values come from?",
        type: "select",
        options: [
          { value: "input", label: "From incoming node input" },
          { value: "custom", label: "Custom JSON context below" },
        ],
        default: "input",
      },
      {
        key: "customContext",
        label: "Custom context (JSON)",
        type: "json",
        placeholder: '{ "fields": { "fi": 25000, "v2": 71500 } }',
        visibleWhen: { field: "contextSource", equals: "custom" },
        help: "Provide a JSON object with a `fields` map and optional `ranges`.",
      },
    ],
    execute: async (ctx) => {
      const expression = String(ctx.config.expression ?? "");
      if (!expression.trim()) {
        return { outputs: {}, error: "Expression is required" };
      }
      let evalCtx: { fields: Record<string, unknown>; ranges?: Record<string, Array<Record<string, unknown>>> };
      if (ctx.config.contextSource === "custom") {
        try {
          evalCtx = JSON.parse(String(ctx.config.customContext ?? "{ \"fields\": {} }"));
        } catch {
          return { outputs: {}, error: "Invalid custom context JSON" };
        }
      } else {
        // Use incoming input as the field map directly.
        const input = (ctx.inputs.in ?? {}) as Record<string, unknown>;
        evalCtx = { fields: input };
      }
      const result = await ctx.services.evalFormula(expression, evalCtx);
      if (!result.ok) {
        return { outputs: {}, error: (result as { error: string }).error };
      }
      ctx.logger("info", "transform.formula.eval.evaluated", {
        expression,
        result: result.value,
      });
      return { outputs: { out: result.value, original: ctx.inputs.in } };
    },
  },

  {
    id: "transform.aggregate.ledger",
    type: "transform",
    label: "Aggregate Ledger",
    description:
      "Runs an aggregation across ledger entries (sum, count, avg, min, max) " +
      "optionally filtered by class, level, or academic year. Reproduces Excel " +
      "summary formulas like =SUM(P2:P1032).",
    icon: "Calculator",
    category: "Transforms",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "operation",
        label: "Aggregation",
        type: "select",
        options: [
          { value: "sum", label: "Sum" },
          { value: "count", label: "Count" },
          { value: "avg", label: "Average" },
          { value: "min", label: "Minimum" },
          { value: "max", label: "Maximum" },
        ],
        default: "sum",
        required: true,
      },
      {
        key: "field",
        label: "Field to aggregate",
        type: "select",
        options: [
          { value: "devisAnnuel", label: "DEVIS ANNUEL (col L)" },
          { value: "totalVersements", label: "TOTAL VERSEMENTS (col P)" },
          { value: "totalCreance", label: "TOTAL CREANCE (col Q)" },
          { value: "grandTotal", label: "GRAND TOTAL (col AL)" },
          { value: "remise", label: "REMISE (col J)" },
        ],
        default: "totalCreance",
        required: true,
      },
      {
        key: "filterClass",
        label: "Filter by class code (optional)",
        type: "text",
        placeholder: "CE1",
      },
      {
        key: "filterLevel",
        label: "Filter by level (optional)",
        type: "text",
        placeholder: "PRIM",
      },
    ],
    execute: async (ctx) => {
      const op = String(ctx.config.operation ?? "sum");
      const field = String(ctx.config.field ?? "totalCreance");
      const filter: { classCode?: string; level?: string } = {};
      if (ctx.config.filterClass) filter.classCode = String(ctx.config.filterClass);
      if (ctx.config.filterLevel) filter.level = String(ctx.config.filterLevel);

      const entries = (await ctx.services.listLedgerEntries(filter)) as Array<Record<string, unknown>>;
      const values = entries.map((e) => Number(e[field]) || 0);

      let result = 0;
      switch (op) {
        case "sum":   result = values.reduce((s, v) => s + v, 0); break;
        case "count": result = values.length; break;
        case "avg":   result = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0; break;
        case "min":   result = values.length ? Math.min(...values) : 0; break;
        case "max":   result = values.length ? Math.max(...values) : 0; break;
      }

      ctx.logger("info", "transform.aggregate.ledger.complete", {
        op, field, filter, count: entries.length, result,
      });
      return { outputs: { out: result, count: entries.length } };
    },
  },

  {
    id: "transform.reconcile.balance",
    type: "transform",
    label: "Reconcile Balances",
    description:
      "Recomputes DEVIS ANNUEL, TOTAL VERSEMENTS, TOTAL CREANCE and GRAND TOTAL " +
      "for every ledger entry. Use this after a fee schedule change or after " +
      "importing new data — exactly like pressing F9 in Excel.",
    icon: "RefreshCw",
    category: "Transforms",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [],
    execute: async (ctx) => {
      const result = await ctx.services.recomputeLedger();
      ctx.logger("info", "transform.reconcile.balance.complete", result);
      return { outputs: { out: result } };
    },
  },

  {
    id: "action.create.ledger.entry",
    type: "action",
    label: "Create Ledger Entry",
    description:
      "Creates a new row in the master ledger (ETAT 20262027 equivalent). " +
      "Computes derived fields automatically.",
    icon: "FilePlus",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      { key: "studentName", label: "Student name", type: "text", required: true },
      { key: "phoneNumbers", label: "Phone numbers (slash-separated)", type: "text" },
      { key: "tutorName", label: "Tutor name", type: "text" },
      { key: "level", label: "Level (PRIM, MAT, ...)", type: "text" },
      { key: "classCode", label: "Class code (CE1, CM2, ...)", type: "text" },
      { key: "optionCode", label: "Option (TRNSP, ...)", type: "text" },
      { key: "destination", label: "Transport destination", type: "text" },
      { key: "remise", label: "Discount (DZD)", type: "number", default: 0 },
      { key: "fi", label: "Registration fee paid (col R)", type: "number", default: 0 },
      { key: "v2", label: "Installment V2 (col S)", type: "number", default: 0 },
      { key: "altV2", label: "Alt 2V (col T)", type: "number", default: 0 },
      { key: "v3", label: "Installment V3 (col U)", type: "number", default: 0 },
      { key: "t1", label: "Transport T1 (col W)", type: "number", default: 0 },
      { key: "t2", label: "Transport T2 (col X)", type: "number", default: 0 },
      { key: "t3", label: "Transport T3 (col Y)", type: "number", default: 0 },
      {
        key: "linkStudentId",
        label: "Link to existing student ID (optional)",
        type: "text",
        help: "If provided, the ledger entry will be linked to this student record.",
      },
    ],
    execute: async (ctx) => {
      const cfg = ctx.config as Record<string, unknown>;
      const input: Record<string, unknown> = { ...cfg, studentId: cfg.linkStudentId || undefined };
      delete input.linkStudentId;
      // Allow input passthrough (e.g. student from trigger).
      if (ctx.inputs.in && typeof ctx.inputs.in === "object") {
        const incoming = ctx.inputs.in as Record<string, unknown>;
        if (incoming.studentId && !input.studentId) input.studentId = incoming.studentId;
        if (incoming.studentName && !input.studentName) input.studentName = incoming.studentName;
      }
      const entry = await ctx.services.createLedgerEntry(input);
      ctx.logger("info", "action.create.ledger.entry.created", { entry });
      return { outputs: { out: entry } };
    },
  },

  {
    id: "action.apply.fee.schedule",
    type: "action",
    label: "Apply Fee Schedule",
    description:
      "Applies a fee schedule to a list of students. For each student, creates " +
      "the appropriate invoices and a ledger entry pre-populated with the " +
      "schedule's fees. Reproduces the Excel workflow of pasting a fee tier " +
      "into column L for a class of pupils.",
    icon: "Layers",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "scheduleId",
        label: "Fee schedule ID",
        type: "text",
        required: true,
        help: "The UUID of the FeeSchedule to apply.",
      },
      {
        key: "studentIds",
        label: "Student IDs (comma-separated)",
        type: "textarea",
        placeholder: "uuid1, uuid2, uuid3",
        help: "Comma-separated list. If omitted, uses the incoming node input.",
      },
    ],
    execute: async (ctx) => {
      const scheduleId = String(ctx.config.scheduleId ?? "");
      let studentIds: string[] = [];
      if (ctx.config.studentIds) {
        studentIds = String(ctx.config.studentIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (Array.isArray(ctx.inputs.in)) {
        studentIds = (ctx.inputs.in as unknown[]).map((s) =>
          typeof s === "string" ? s : (s as { id?: string; studentId?: string }).id ?? (s as { studentId?: string }).studentId ?? ""
        ).filter(Boolean);
      }
      if (!scheduleId || studentIds.length === 0) {
        return { outputs: {}, error: "scheduleId and at least one studentId are required" };
      }
      const result = await ctx.services.applyFeeSchedule(scheduleId, studentIds);
      ctx.logger("info", "action.apply.fee.schedule.applied", {
        scheduleId,
        studentCount: studentIds.length,
        result,
      });
      return { outputs: { out: result } };
    },
  },

  {
    id: "action.create.quote.block",
    type: "action",
    label: "Create Quote Block",
    description:
      "Creates a new Devis-style quote block. Computes per-line totals, " +
      "sub-total, net payable, and 5% school-fee tax automatically. " +
      "Reproduces the Excel Devis sheet block behaviour.",
    icon: "FileText",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      { key: "name", label: "Quote name", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "studentId", label: "Student ID (optional)", type: "text" },
      {
        key: "itemsJson",
        label: "Line items (JSON array)",
        type: "json",
        placeholder:
          '[{"label":"Tuition","amounts":[0,0,205000,0,0,0,0,0]}]',
        help:
          "Each item: { label, amounts: number[8], classe?, fi?, fraisScolaire?, service?, transport? }",
      },
      { key: "advances", label: "Advances (DZD)", type: "number", default: 0 },
      { key: "discounts", label: "Discounts (DZD)", type: "number", default: 0 },
    ],
    execute: async (ctx) => {
      let items: unknown[] = [];
      try {
        items = ctx.config.itemsJson
          ? JSON.parse(String(ctx.config.itemsJson))
          : [];
      } catch {
        return { outputs: {}, error: "Invalid itemsJson" };
      }
      const input = {
        name: ctx.config.name,
        description: ctx.config.description,
        studentId: ctx.config.studentId || undefined,
        items,
        advances: Number(ctx.config.advances) || 0,
        discounts: Number(ctx.config.discounts) || 0,
      };
      const quote = await ctx.services.createQuoteBlock(input);
      ctx.logger("info", "action.create.quote.block.created", { quote });
      return { outputs: { out: quote } };
    },
  },

  {
    id: "condition.formula.evaluate",
    type: "condition",
    label: "Formula Condition",
    description:
      "Branches based on a user-defined formula that evaluates to true/false. " +
      "Lets you build arbitrary conditional logic in workflows — e.g. " +
      "IF(totalCreance > 10000 AND classCode = \"CE1\").",
    icon: "GitBranch",
    category: "Conditions",
    inputs: [anyIn()],
    outputs: [trueOut(), falseOut()],
    configSchema: [
      {
        key: "expression",
        label: "Boolean expression",
        type: "textarea",
        placeholder: "totalCreance > 10000 AND classCode = \"CE1\"",
        required: true,
        help:
          "Use field names from the incoming input. Comparison operators: " +
          "= <> < > <= >=. Logical: AND, OR, NOT. Returns true/false.",
      },
    ],
    execute: async (ctx) => {
      const expression = String(ctx.config.expression ?? "");
      const input = (ctx.inputs.in ?? {}) as Record<string, unknown>;
      const result = await ctx.services.evalFormula(expression, { fields: input });
      if (!result.ok) {
        return { outputs: {}, branch: "false", error: (result as { error: string }).error };
      }
      const branch = (result.value === true || result.value === "true" || Number(result.value) > 0)
        ? "true"
        : "false";
      ctx.logger("info", "condition.formula.evaluate.evaluated", {
        expression, value: result.value, branch,
      });
      return { outputs: { true: ctx.inputs.in, false: ctx.inputs.in }, branch };
    },
  },
];

export function getNodeDefinition(subtype: string): NodeDefinition | undefined {
  return NODE_REGISTRY.find((n) => n.id === subtype);
}

export function getNodesByCategory(): Record<string, NodeDefinition[]> {
  const groups: Record<string, NodeDefinition[]> = {};
  for (const node of NODE_REGISTRY) {
    if (!groups[node.category]) groups[node.category] = [];
    groups[node.category].push(node);
  }
  return groups;
}

export function createNodeFromDefinition(
  def: NodeDefinition,
  position: { x: number; y: number },
): WorkflowNode {
  const config: Record<string, unknown> = {};
  for (const field of def.configSchema) {
    if (field.default !== undefined) config[field.key] = field.default;
  }
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: def.type,
    subtype: def.id,
    label: def.label,
    config,
    position,
    inputs: def.inputs.map((p) => ({ ...p })),
    outputs: def.outputs.map((p) => ({ ...p })),
  };
}
