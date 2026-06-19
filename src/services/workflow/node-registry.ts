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
  visibleWhen?: { field: string; equals: unknown };
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
  // ── Excel-migration node services
  evalFormula: (
    expression: string,
    ctx: {
      fields: Record<string, unknown>;
      ranges?: Record<string, Array<Record<string, unknown>>>;
    },
  ) => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>;
  createLedgerEntry: (input: unknown) => Promise<unknown>;
  updateLedgerEntry: (id: string, patch: unknown) => Promise<unknown>;
  listLedgerEntries: (filter?: unknown) => Promise<unknown[]>;
  recomputeLedger: () => Promise<{
    recomputed: number;
    skipped: number;
    errors: unknown[];
  }>;
  createQuoteBlock: (input: unknown) => Promise<unknown>;
  applyFeeSchedule: (
    scheduleId: string,
    studentIds: string[],
  ) => Promise<unknown>;
  listFormulaRules: (scope?: string) => Promise<unknown[]>;
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
  // ── Triggers
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
      },
    ],
    execute: async (ctx) => ({ outputs: ctx.inputs }),
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
        placeholder: "0 9 * * 1",
        required: true,
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

  // ── Custom Triggers
  {
    id: "trigger.ledger.balance_limit",
    type: "trigger",
    label: "Ledger Balance Limit",
    description:
      "Fires when a pupil's ledger outstanding balance exceeds a threshold",
    icon: "AlertCircle",
    category: "Triggers",
    inputs: [],
    outputs: [{ id: "out", label: "Ledger Row", type: "ledger" }],
    configSchema: [
      {
        key: "limit",
        label: "Outstanding Balance limit (DZD)",
        type: "number",
        default: 50000,
        required: true,
      },
    ],
    execute: async (ctx) => ({ outputs: ctx.inputs }),
  },
  {
    id: "trigger.attendance.absent_limit",
    type: "trigger",
    label: "Absence Limit Exceeded",
    description: "Fires when a student records repeated absences",
    icon: "Calendar",
    category: "Triggers",
    inputs: [],
    outputs: [{ id: "out", label: "Student", type: "student" }],
    configSchema: [
      {
        key: "limit",
        label: "Absence count limit",
        type: "number",
        default: 3,
        required: true,
      },
    ],
    execute: async (ctx) => ({ outputs: ctx.inputs }),
  },

  // ── Conditions
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
      },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as any;
      const studentId = input?.studentId ?? input?.id ?? input;
      if (!studentId)
        return { outputs: {}, branch: "false", error: "No student ID context" };
      const debt = await ctx.services.getStudentDebt(studentId);
      const threshold = Number(ctx.config.threshold ?? 1000);
      const branch = debt.outstanding > threshold ? "true" : "false";
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
      },
      { key: "value", label: "Equals value", type: "text", required: true },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as any;
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
        ],
      },
    ],
    execute: async (ctx) => {
      const payment = ctx.inputs.in as any;
      const method = String(ctx.config.method ?? "");
      const branch = payment?.paymentMethod === method ? "true" : "false";
      return { outputs: { true: payment, false: payment }, branch };
    },
  },

  // ── Actions
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
      { key: "to", label: "To (email)", type: "text", required: true },
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "body", label: "Body", type: "textarea", required: true },
    ],
    execute: async (ctx) => {
      const to = String(ctx.config.to ?? "");
      const subject = String(ctx.config.subject ?? "");
      const body = String(ctx.config.body ?? "");
      if (!to) return { outputs: {}, error: 'Missing "to"' };
      await ctx.services.sendEmail(to, subject, body);
      return { outputs: { sent: true } };
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
      },
      { key: "reason", label: "Reason", type: "text", required: true },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as any;
      const studentId = input?.studentId ?? input?.id ?? input;
      if (!studentId) return { outputs: {}, error: "No studentId" };
      await ctx.services.applyDiscount(
        studentId,
        Number(ctx.config.percentage),
        String(ctx.config.reason),
      );
      return { outputs: { applied: true } };
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
      { key: "studentId", label: "Student ID", type: "text" },
      {
        key: "type",
        label: "Invoice type",
        type: "select",
        required: true,
        options: [{ value: "monthly_tuition", label: "Tuition" }],
      },
      { key: "amount", label: "Amount", type: "number", required: true },
      {
        key: "description",
        label: "Description",
        type: "text",
        required: true,
      },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as any;
      const studentId =
        String(ctx.config.studentId ?? "") ||
        input?.studentId ||
        input?.id ||
        input;
      if (!studentId) return { outputs: {}, error: "No studentId" };
      const invoice = await ctx.services.createInvoice({
        studentId,
        type: ctx.config.type,
        amountDue: Number(ctx.config.amount),
        description: String(ctx.config.description),
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
      { key: "action", label: "Action name", type: "text", required: true },
      { key: "message", label: "Message", type: "textarea", required: true },
    ],
    execute: async (ctx) => {
      await ctx.services.logActivity(String(ctx.config.action), {
        message: ctx.config.message,
        input: ctx.inputs.in,
      });
      return { outputs: { logged: true } };
    },
  },

  // ── Delays & Transforms
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
        options: [{ value: "minutes", label: "Minutes" }],
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
      const ms = Number(ctx.config.value) * 60000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5000)));
      return { outputs: ctx.inputs };
    },
  },
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
      { key: "field", label: "Field path", type: "text", required: true },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as any;
      const value = input?.[String(ctx.config.field)];
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
      },
      {
        key: "params",
        label: "Parameters (JSON array)",
        type: "json",
        default: "[]",
      },
    ],
    execute: async (ctx) => {
      const sql = String(ctx.config.sql);
      if (!sql.trim().toLowerCase().startsWith("select")) {
        return { outputs: {}, error: "Only SELECT queries are allowed" };
      }
      const rows = await ctx.services.query(sql, []);
      return { outputs: { out: rows } };
    },
  },

  // ── Custom Actions
  {
    id: "action.ledger.add_comment",
    type: "action",
    label: "Write Audit Comment",
    description:
      "Appends an automated tracking comment to a pupil's row in column-AM format",
    icon: "MessageSquare",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "commentText",
        label: "Comment Text",
        type: "text",
        required: true,
      },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as any;
      const entryId = input?.id?.value || input?.id;
      if (!entryId) return { outputs: {}, error: "No ledger entry ID" };
      await ctx.services.query(
        "INSERT INTO payment_audit_comments (id, ledger_entry_id, raw_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [
          `comment-${Date.now()}`,
          entryId,
          String(ctx.config.commentText),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
      return { outputs: { out: ctx.inputs.in } };
    },
  },
  {
    id: "action.ledger.flag_unpaid",
    type: "action",
    label: "Flag Unpaid Status",
    description:
      "Modifies the pupil ledger 'infos' column to signal high outstanding debt",
    icon: "Filter",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "flagText",
        label: "Flag text to write",
        type: "text",
        default: "[ALERT: UNPAID FEES]",
      },
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as any;
      const entryId = input?.id?.value || input?.id;
      if (!entryId) return { outputs: {}, error: "No ledger entry ID" };
      await ctx.services.query(
        "UPDATE ledger_entries SET infos = ? || COALESCE(infos, ''), updated_at = ? WHERE id = ?",
        [String(ctx.config.flagText) + " ", new Date().toISOString(), entryId],
      );
      return { outputs: { out: ctx.inputs.in } };
    },
  },
  {
    id: "action.notification.sms_mock",
    type: "action",
    label: "Simulate SMS Dispatch",
    description: "Mocks the transmission of an SMS alert to parents",
    icon: "Mail",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "message",
        label: "SMS Body",
        type: "textarea",
        required: true,
        default: "El-Imtiyaz Alert: Outstanding fees require payment.",
      },
    ],
    execute: async (ctx) => {
      ctx.logger("info", "sms_mock.dispatch_simulated", {
        message: ctx.config.message,
      });
      return { outputs: { out: ctx.inputs.in, dispatched: true } };
    },
  },
  {
    id: "action.notification.whatsapp_mock",
    type: "action",
    label: "Simulate WhatsApp Alert",
    description:
      "Mocks a WhatsApp notification for billing, schedules, or updates",
    icon: "MessageSquare",
    category: "Actions",
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      {
        key: "message",
        label: "WhatsApp Message Template",
        type: "textarea",
        required: true,
      },
    ],
    execute: async (ctx) => {
      ctx.logger("info", "whatsapp_mock.dispatch_simulated", {
        message: ctx.config.message,
      });
      return { outputs: { out: ctx.inputs.in, dispatched: true } };
    },
  },
];

export function getNodeDefinition(subtype: string): NodeDefinition | undefined {
  return NODE_REGISTRY.find((n) => n.id === subtype);
}
