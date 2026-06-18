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

import type { NodeType, WorkflowNode, WorkflowNodePort } from '../../core/entities/workflow.entity';

export interface NodeConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date' | 'textarea' | 'json';
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
  category: 'Triggers' | 'Conditions' | 'Actions' | 'Delays' | 'Transforms';
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
  logger: (level: string, message: string, meta?: Record<string, unknown>) => void;
}

export interface NodeExecutionResult {
  outputs: Record<string, unknown>;
  branch?: 'true' | 'false';
  error?: string;
}

export interface NodeServices {
  getStudent: (id: string) => Promise<unknown>;
  getStudentPayments: (id: string) => Promise<unknown[]>;
  getStudentDebt: (id: string) => Promise<{ outstanding: number }>;
  sendEmail: (to: string, subject: string, body: string) => Promise<void>;
  sendSms: (to: string, message: string) => Promise<void>;
  applyDiscount: (studentId: string, percentage: number, reason: string) => Promise<void>;
  createInvoice: (input: unknown) => Promise<unknown>;
  logActivity: (action: string, payload: unknown) => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
}

const anyIn = (id = 'in'): WorkflowNodePort => ({ id, label: 'Input', type: 'any' });
const anyOut = (id = 'out'): WorkflowNodePort => ({ id, label: 'Output', type: 'any' });
const trueOut = (): WorkflowNodePort => ({ id: 'true', label: 'True', type: 'any' });
const falseOut = (): WorkflowNodePort => ({ id: 'false', label: 'False', type: 'any' });

export const NODE_REGISTRY: NodeDefinition[] = [
  // ── Triggers ──────────────────────────────────────────────────────────────
  {
    id: 'trigger.payment.overdue',
    type: 'trigger',
    label: 'Payment Overdue',
    description: 'Fires when a payment becomes overdue (due date passed, balance > 0)',
    icon: 'AlertCircle',
    category: 'Triggers',
    inputs: [],
    outputs: [{ id: 'out', label: 'Invoice', type: 'invoice' }],
    configSchema: [
      { key: 'daysOverdue', label: 'Days overdue threshold', type: 'number', default: 1, required: true, help: 'Minimum days past due date before this fires' }
    ],
    execute: async (ctx) => {
      ctx.logger('info', 'trigger.payment.overdue.fired', { nodeId: ctx.nodeId });
      return { outputs: ctx.inputs };
    }
  },
  {
    id: 'trigger.student.enrolled',
    type: 'trigger',
    label: 'Student Enrolled',
    description: 'Fires when a new student is enrolled',
    icon: 'UserPlus',
    category: 'Triggers',
    inputs: [],
    outputs: [{ id: 'out', label: 'Student', type: 'student' }],
    configSchema: [],
    execute: async (ctx) => ({ outputs: ctx.inputs })
  },
  {
    id: 'trigger.payment.recorded',
    type: 'trigger',
    label: 'Payment Recorded',
    description: 'Fires when any payment is recorded',
    icon: 'DollarSign',
    category: 'Triggers',
    inputs: [],
    outputs: [{ id: 'out', label: 'Payment', type: 'payment' }],
    configSchema: [
      { key: 'minAmount', label: 'Minimum amount (DZD)', type: 'number', default: 0, help: 'Only fire for payments >= this amount' }
    ],
    execute: async (ctx) => ({ outputs: ctx.inputs })
  },
  {
    id: 'trigger.schedule',
    type: 'trigger',
    label: 'Schedule',
    description: 'Fires on a recurring schedule (cron-like)',
    icon: 'Clock',
    category: 'Triggers',
    inputs: [],
    outputs: [{ id: 'out', label: 'Tick', type: 'any' }],
    configSchema: [
      { key: 'cron', label: 'Schedule expression', type: 'text', placeholder: '0 9 * * 1  (every Monday 9am)', required: true, help: 'Standard cron format: minute hour day month weekday' }
    ],
    execute: async (ctx) => ({ outputs: {} })
  },
  {
    id: 'trigger.manual',
    type: 'trigger',
    label: 'Manual',
    description: 'Fires only when run manually from the UI',
    icon: 'Play',
    category: 'Triggers',
    inputs: [],
    outputs: [{ id: 'out', label: 'Run', type: 'any' }],
    configSchema: [],
    execute: async (ctx) => ({ outputs: {} })
  },

  // ── Conditions ────────────────────────────────────────────────────────────
  {
    id: 'condition.debt.threshold',
    type: 'condition',
    label: 'Debt > Threshold',
    description: 'Branches based on student outstanding debt amount',
    icon: 'GitBranch',
    category: 'Conditions',
    inputs: [anyIn()],
    outputs: [trueOut(), falseOut()],
    configSchema: [
      { key: 'threshold', label: 'Threshold (DZD)', type: 'number', required: true, default: 1000, help: 'Branches TRUE if outstanding debt exceeds this amount' }
    ],
    execute: async (ctx) => {
      const studentId = (ctx.inputs.in as { studentId?: string })?.studentId
        ?? (ctx.inputs.in as { id?: string })?.id
        ?? (ctx.inputs.in as string);
      if (!studentId) return { outputs: {}, branch: 'false', error: 'No studentId in input' };
      const debt = await ctx.services.getStudentDebt(studentId);
      const threshold = Number(ctx.config.threshold ?? 1000);
      const branch = debt.outstanding > threshold ? 'true' : 'false';
      ctx.logger('info', 'condition.debt.threshold.evaluated', { studentId, outstanding: debt.outstanding, threshold, branch });
      return { outputs: { true: ctx.inputs.in, false: ctx.inputs.in }, branch };
    }
  },
  {
    id: 'condition.status',
    type: 'condition',
    label: 'Status Match',
    description: 'Branches based on entity status field',
    icon: 'Filter',
    category: 'Conditions',
    inputs: [anyIn()],
    outputs: [trueOut(), falseOut()],
    configSchema: [
      { key: 'field', label: 'Field path', type: 'text', default: 'status', required: true, placeholder: 'status' },
      { key: 'value', label: 'Equals value', type: 'text', required: true, placeholder: 'active' }
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as Record<string, unknown>;
      const field = String(ctx.config.field ?? 'status');
      const value = String(ctx.config.value ?? '');
      const actual = String(input?.[field] ?? '');
      const branch = actual === value ? 'true' : 'false';
      return { outputs: { true: input, false: input }, branch };
    }
  },
  {
    id: 'condition.payment.method',
    type: 'condition',
    label: 'Payment Method',
    description: 'Branches based on payment method',
    icon: 'CreditCard',
    category: 'Conditions',
    inputs: [anyIn()],
    outputs: [trueOut(), falseOut()],
    configSchema: [
      { key: 'method', label: 'Payment method', type: 'select', required: true, options: [
        { value: 'cash', label: 'Cash' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'cheque', label: 'Cheque' },
        { value: 'card', label: 'Card' },
        { value: 'baridimob', label: 'BaridiMob' }
      ]}
    ],
    execute: async (ctx) => {
      const payment = ctx.inputs.in as { paymentMethod?: string };
      const method = String(ctx.config.method ?? '');
      const branch = payment?.paymentMethod === method ? 'true' : 'false';
      return { outputs: { true: payment, false: payment }, branch };
    }
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  {
    id: 'action.send.email',
    type: 'action',
    label: 'Send Email',
    description: 'Sends an email notification',
    icon: 'Mail',
    category: 'Actions',
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      { key: 'to', label: 'To (email)', type: 'text', required: true, placeholder: 'parent@example.com' },
      { key: 'subject', label: 'Subject', type: 'text', required: true, placeholder: 'Payment reminder' },
      { key: 'body', label: 'Body', type: 'textarea', required: true, placeholder: 'Dear parent, …' }
    ],
    execute: async (ctx) => {
      const to = String(ctx.config.to ?? '');
      const subject = String(ctx.config.subject ?? '');
      const body = String(ctx.config.body ?? '');
      if (!to) return { outputs: {}, error: 'Missing "to" email' };
      await ctx.services.sendEmail(to, subject, body);
      ctx.logger('info', 'action.send.email.sent', { to, subject });
      return { outputs: { sent: true, to, subject } };
    }
  },
  {
    id: 'action.apply.discount',
    type: 'action',
    label: 'Apply Discount',
    description: 'Applies a percentage discount to outstanding invoices',
    icon: 'Percent',
    category: 'Actions',
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      { key: 'percentage', label: 'Percentage', type: 'number', required: true, default: 10, placeholder: '10' },
      { key: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'Sibling discount' }
    ],
    execute: async (ctx) => {
      const studentId = (ctx.inputs.in as { studentId?: string })?.studentId
        ?? (ctx.inputs.in as { id?: string })?.id
        ?? (ctx.inputs.in as string);
      if (!studentId) return { outputs: {}, error: 'No studentId in input' };
      const percentage = Number(ctx.config.percentage ?? 0);
      const reason = String(ctx.config.reason ?? 'Workflow-applied discount');
      await ctx.services.applyDiscount(studentId, percentage, reason);
      ctx.logger('info', 'action.apply.discount.applied', { studentId, percentage, reason });
      return { outputs: { applied: true, studentId, percentage } };
    }
  },
  {
    id: 'action.create.invoice',
    type: 'action',
    label: 'Create Invoice',
    description: 'Creates a new invoice for a student',
    icon: 'FileText',
    category: 'Actions',
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      { key: 'studentId', label: 'Student ID (or use input)', type: 'text', placeholder: 'leave empty to use input' },
      { key: 'type', label: 'Invoice type', type: 'select', required: true, options: [
        { value: 'monthly_tuition', label: 'Monthly Tuition' },
        { value: 'registration', label: 'Registration' },
        { value: 'transportation', label: 'Transportation' },
        { value: 'books', label: 'Books' },
        { value: 'uniform', label: 'Uniform' },
        { value: 'custom', label: 'Custom' }
      ]},
      { key: 'amount', label: 'Amount (DZD)', type: 'number', required: true, placeholder: '5000' },
      { key: 'description', label: 'Description', type: 'text', required: true, placeholder: 'Monthly tuition — September' }
    ],
    execute: async (ctx) => {
      const studentId = String(ctx.config.studentId ?? '')
        || (ctx.inputs.in as { studentId?: string })?.studentId
        || (ctx.inputs.in as { id?: string })?.id
        || (ctx.inputs.in as string);
      if (!studentId) return { outputs: {}, error: 'No studentId' };
      const invoice = await ctx.services.createInvoice({
        studentId,
        type: ctx.config.type,
        amountDue: Number(ctx.config.amount),
        description: String(ctx.config.description)
      });
      ctx.logger('info', 'action.create.invoice.created', { studentId, invoice });
      return { outputs: { invoice } };
    }
  },
  {
    id: 'action.log.activity',
    type: 'action',
    label: 'Log Activity',
    description: 'Writes a custom entry to the audit log',
    icon: 'Database',
    category: 'Actions',
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      { key: 'action', label: 'Action name', type: 'text', required: true, placeholder: 'workflow.custom' },
      { key: 'message', label: 'Message', type: 'textarea', required: true }
    ],
    execute: async (ctx) => {
      await ctx.services.logActivity(
        String(ctx.config.action ?? 'workflow.custom'),
        { message: ctx.config.message, input: ctx.inputs.in }
      );
      return { outputs: { logged: true } };
    }
  },

  // ── Delays ────────────────────────────────────────────────────────────────
  {
    id: 'delay.duration',
    type: 'delay',
    label: 'Wait',
    description: 'Pauses execution for a fixed duration',
    icon: 'Hourglass',
    category: 'Delays',
    inputs: [anyIn()],
    outputs: [anyOut()],
    configSchema: [
      { key: 'unit', label: 'Unit', type: 'select', default: 'minutes', options: [
        { value: 'seconds', label: 'Seconds' },
        { value: 'minutes', label: 'Minutes' },
        { value: 'hours', label: 'Hours' },
        { value: 'days', label: 'Days' }
      ]},
      { key: 'value', label: 'Duration', type: 'number', required: true, default: 30 }
    ],
    execute: async (ctx) => {
      const value = Number(ctx.config.value ?? 0);
      const unit = String(ctx.config.unit ?? 'minutes');
      const multipliers: Record<string, number> = {
        seconds: 1000, minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000
      };
      const ms = value * (multipliers[unit] ?? 60000);
      ctx.logger('info', 'delay.duration.waiting', { value, unit, ms });
      await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5000)));
      return { outputs: ctx.inputs };
    }
  },

  // ── Transforms ────────────────────────────────────────────────────────────
  {
    id: 'transform.extract.field',
    type: 'transform',
    label: 'Extract Field',
    description: 'Extracts a single field from the input payload',
    icon: 'Scissors',
    category: 'Transforms',
    inputs: [anyIn()],
    outputs: [{ id: 'out', label: 'Field Value', type: 'any' }],
    configSchema: [
      { key: 'field', label: 'Field path', type: 'text', required: true, placeholder: 'studentId' }
    ],
    execute: async (ctx) => {
      const input = ctx.inputs.in as Record<string, unknown>;
      const field = String(ctx.config.field ?? '');
      const value = input?.[field];
      return { outputs: { out: value } };
    }
  },
  {
    id: 'transform.query.database',
    type: 'transform',
    label: 'Database Query',
    description: 'Runs a SQL query and outputs the rows',
    icon: 'Database',
    category: 'Transforms',
    inputs: [anyIn()],
    outputs: [{ id: 'out', label: 'Rows', type: 'rows' }],
    configSchema: [
      { key: 'sql', label: 'SQL query (read-only)', type: 'textarea', required: true, placeholder: 'SELECT id, full_name FROM students WHERE status = ?' },
      { key: 'params', label: 'Parameters (JSON array)', type: 'json', default: '[]', help: 'Values for ? placeholders' }
    ],
    execute: async (ctx) => {
      const sql = String(ctx.config.sql ?? '');
      if (!sql.trim().toLowerCase().startsWith('select')) {
        return { outputs: {}, error: 'Only SELECT queries are allowed in workflows' };
      }
      let params: unknown[] = [];
      try {
        params = typeof ctx.config.params === 'string'
          ? JSON.parse(ctx.config.params as string)
          : (ctx.config.params as unknown[]) ?? [];
      } catch {
        return { outputs: {}, error: 'Invalid params JSON' };
      }
      const rows = await ctx.services.query(sql, params);
      return { outputs: { out: rows } };
    }
  }
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

export function createNodeFromDefinition(def: NodeDefinition, position: { x: number; y: number }): WorkflowNode {
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
    outputs: def.outputs.map((p) => ({ ...p }))
  };
}
