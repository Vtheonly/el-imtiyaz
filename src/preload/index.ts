/**
 * Preload script — the ONLY bridge between the sandboxed renderer and the
 * Node-capable main process.
 *
 * Security rules enforced here:
 *  - contextIsolation: true (renderer cannot touch Node globals directly)
 *  - nodeIntegration: false
 *  - Only whitelisted channels can be invoked from the renderer
 *  - Every call is wrapped to return a typed Promise that rejects on error
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '../main/ipc/channels';

/**
 * Invoke a main-process handler and unwrap the standardised response.
 * Throws the original AppError message if `ok === false`.
 */
async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const response = await ipcRenderer.invoke(channel, ...args);
  if (response && typeof response === 'object' && 'ok' in response) {
    if (response.ok) return response.data as T;
    const err = (response as { error?: { message: string; code: string } }).error;
    throw new Error(err?.message ?? `IPC call failed: ${channel}`);
  }
  return response as T;
}

const api = {
  // ── Students ─────────────────────────────────────────────
  students: {
    list: (query?: unknown) => invoke('students:list', query),
    get: (id: string) => invoke('students:get', id),
    create: (input: unknown) => invoke('students:create', input),
    update: (id: string, patch: unknown) => invoke('students:update', id, patch),
    delete: (id: string) => invoke('students:delete', id),
    search: (term: string) => invoke('students:search', term),
    import: (rows: unknown[]) => invoke('students:import', rows),
    export: (query?: unknown) => invoke('students:export', query),
    profile: (id: string) => invoke('students:profile', id),
    timeline: (id: string) => invoke('students:timeline', id)
  },

  // ── Parents ──────────────────────────────────────────────
  parents: {
    list: (query?: unknown) => invoke('parents:list', query),
    get: (id: string) => invoke('parents:get', id),
    create: (input: unknown) => invoke('parents:create', input),
    update: (id: string, patch: unknown) => invoke('parents:update', id, patch),
    delete: (id: string) => invoke('parents:delete', id)
  },

  // ── Payments ─────────────────────────────────────────────
  payments: {
    list: (query?: unknown) => invoke('payments:list', query),
    get: (id: string) => invoke('payments:get', id),
    create: (input: unknown) => invoke('payments:create', input),
    update: (id: string, patch: unknown) => invoke('payments:update', id, patch),
    delete: (id: string) => invoke('payments:delete', id),
    byStudent: (studentId: string) => invoke('payments:by-student', studentId),
    bulk: (ops: unknown[]) => invoke('payments:bulk', ops)
  },

  // ── Invoices ─────────────────────────────────────────────
  invoices: {
    list: (query?: unknown) => invoke('invoices:list', query),
    get: (id: string) => invoke('invoices:get', id),
    create: (input: unknown) => invoke('invoices:create', input),
    update: (id: string, patch: unknown) => invoke('invoices:update', id, patch)
  },

  // ── Debt ─────────────────────────────────────────────────
  debt: {
    summary: () => invoke('debt:summary'),
    students: (query?: unknown) => invoke('debt:students', query),
    overdue: () => invoke('debt:overdue')
  },

  // ── Receipts ─────────────────────────────────────────────
  receipts: {
    generate: (paymentId: string) => invoke('receipts:generate', paymentId),
    list: (query?: unknown) => invoke('receipts:list', query),
    get: (id: string) => invoke('receipts:get', id)
  },

  // ── Classes ──────────────────────────────────────────────
  classes: {
    list: () => invoke('classes:list'),
    create: (input: unknown) => invoke('classes:create', input),
    update: (id: string, patch: unknown) => invoke('classes:update', id, patch),
    delete: (id: string) => invoke('classes:delete', id)
  },

  // ── Attendance ───────────────────────────────────────────
  attendance: {
    list: (query?: unknown) => invoke('attendance:list', query),
    record: (input: unknown) => invoke('attendance:record', input),
    report: (classId: string, from: string, to: string) =>
      invoke('attendance:report', classId, from, to)
  },

  // ── Employees ────────────────────────────────────────────
  employees: {
    list: () => invoke('employees:list'),
    create: (input: unknown) => invoke('employees:create', input),
    update: (id: string, patch: unknown) => invoke('employees:update', id, patch),
    delete: (id: string) => invoke('employees:delete', id)
  },

  // ── Academic Years ───────────────────────────────────────
  academicYears: {
    list: () => invoke('academic-years:list'),
    create: (input: unknown) => invoke('academic-years:create', input),
    update: (id: string, patch: unknown) => invoke('academic-years:update', id, patch),
    delete: (id: string) => invoke('academic-years:delete', id)
  },

  // ── Fee Templates & Scholarships ─────────────────────────
  feeTemplates: {
    list: () => invoke('fee-templates:list'),
    create: (input: unknown) => invoke('fee-templates:create', input),
    apply: (templateId: string, studentIds: string[]) =>
      invoke('fee-templates:apply', templateId, studentIds)
  },
  scholarships: {
    list: () => invoke('scholarships:list'),
    create: (input: unknown) => invoke('scholarships:create', input),
    revoke: (id: string, reason: string) => invoke('scholarships:revoke', id, reason)
  },

  // ── Workflows ─────────────────────────────────────────────
  workflows: {
    list: (query?: unknown) => invoke('workflows:list', query),
    get: (id: string) => invoke('workflows:get', id),
    create: (input: unknown) => invoke('workflows:create', input),
    update: (id: string, patch: unknown) => invoke('workflows:update', id, patch),
    delete: (id: string) => invoke('workflows:delete', id),
    publish: (id: string) => invoke('workflows:publish', id),
    enable: (id: string) => invoke('workflows:enable', id),
    disable: (id: string) => invoke('workflows:disable', id),
    run: (id: string, payload?: unknown) => invoke('workflows:run', id, payload),
    executions: (id: string) => invoke('workflows:executions', id),
    nodeRegistry: () => invoke('workflows:node-registry')
  },

  // ── Notifications ─────────────────────────────────────────
  notifications: {
    list: (query?: unknown) => invoke('notifications:list', query),
    get: (id: string) => invoke('notifications:get', id),
    create: (input: unknown) => invoke('notifications:create', input),
    markRead: (id: string) => invoke('notifications:mark-read', id),
    markAllRead: (recipientId?: string) => invoke('notifications:mark-all-read', recipientId),
    delete: (id: string) => invoke('notifications:delete', id),
    unreadCount: (recipientId?: string) => invoke('notifications:unread-count', recipientId)
  },

  // ── Reports ──────────────────────────────────────────────
  reports: {
    revenue: (range: unknown) => invoke('reports:revenue', range),
    outstanding: () => invoke('reports:outstanding'),
    student: (id: string) => invoke('reports:student', id),
    export: (type: string, query?: unknown) => invoke('reports:export', type, query)
  },

  // ── Audit ────────────────────────────────────────────────
  audit: {
    list: (query?: unknown) => invoke('audit:list', query),
    get: (id: string) => invoke('audit:get', id)
  },

  // ── System ───────────────────────────────────────────────
  system: {
    info: () => invoke('system:info'),
    backup: () => invoke('system:backup')
  },

  // ── File uploads ─────────────────────────────────────────
  fs: {
    upload: (filename: string, base64: string, mime: string) =>
      invoke('fs:upload', { filename, data: base64, mime })
  },

  // ── Menu command listener (renderer subscribes) ─────────
  onMenuCommand: (handler: (command: { id: string; payload?: unknown }) => void) => {
    const listener = (_event: IpcRendererEvent, command: { id: string; payload?: unknown }) =>
      handler(command);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  },

  // ════════════════════════════════════════════════════════════════════════
  // ── Excel-Migration API (added 2026-06) ───────────────────────────────
  // Reproduces the Suivis clients.xlsx workbook behaviour in-app.
  // ════════════════════════════════════════════════════════════════════════

  // ── Ledger (ETAT 20262027 sheet) ─────────────────────────
  ledger: {
    list: (query?: unknown) => invoke('ledger:list', query),
    get: (id: string) => invoke('ledger:get', id),
    create: (input: unknown) => invoke('ledger:create', input),
    update: (id: string, patch: unknown) => invoke('ledger:update', id, patch),
    delete: (id: string) => invoke('ledger:delete', id),
    byStudent: (studentId: string) => invoke('ledger:by-student', studentId),
    summary: () => invoke('ledger:summary'),
    recompute: () => invoke('ledger:recompute'),
    auditComments: {
      list: (ledgerEntryId: string) => invoke('ledger:audit-comments:list', ledgerEntryId),
      create: (input: unknown) => invoke('ledger:audit-comments:create', input)
    }
  },

  // ── Quote Blocks (Devis sheet) ───────────────────────────
  quotes: {
    list: (query?: unknown) => invoke('quotes:list', query),
    get: (id: string) => invoke('quotes:get', id),
    create: (input: unknown) => invoke('quotes:create', input),
    update: (id: string, patch: unknown) => invoke('quotes:update', id, patch),
    delete: (id: string) => invoke('quotes:delete', id),
    byStudent: (studentId: string) => invoke('quotes:by-student', studentId),
    recompute: (id: string) => invoke('quotes:recompute', id)
  },

  // ── Fee Schedules ────────────────────────────────────────
  feeSchedules: {
    list: (query?: unknown) => invoke('fee-schedules:list', query),
    get: (id: string) => invoke('fee-schedules:get', id),
    create: (input: unknown) => invoke('fee-schedules:create', input),
    update: (id: string, patch: unknown) => invoke('fee-schedules:update', id, patch),
    delete: (id: string) => invoke('fee-schedules:delete', id),
    apply: (scheduleId: string, studentIds: string[]) =>
      invoke('fee-schedules:apply', scheduleId, studentIds),
    ensureDefault: () => invoke('fee-schedules:ensure-default')
  },

  // ── Formula Rules ────────────────────────────────────────
  formulaRules: {
    list: (query?: unknown) => invoke('formula-rules:list', query),
    get: (id: string) => invoke('formula-rules:get', id),
    create: (input: unknown) => invoke('formula-rules:create', input),
    update: (id: string, patch: unknown) => invoke('formula-rules:update', id, patch),
    delete: (id: string) => invoke('formula-rules:delete', id),
    test: (expression: string, sampleContext?: unknown) =>
      invoke('formula-rules:test', expression, sampleContext),
    evaluate: (ruleId: string, ctx?: unknown) =>
      invoke('formula-rules:evaluate', ruleId, ctx),
    seedStarters: () => invoke('formula-rules:seed-starters')
  },

  // ── Spreadsheet Templates (imported workbook metadata) ───
  spreadsheets: {
    list: () => invoke('spreadsheet-templates:list'),
    get: (id: string) => invoke('spreadsheet-templates:get', id),
    delete: (id: string) => invoke('spreadsheet-templates:delete', id),
    analyze: (filePath: string) => invoke('spreadsheet-templates:analyze', filePath),
    importLedger: (filePath: string, sheetName: string, academicYearId?: string) =>
      invoke('spreadsheet-templates:import-ledger', filePath, sheetName, academicYearId),
    importComments: (filePath: string, sheetName: string) =>
      invoke('spreadsheet-templates:import-comments', filePath, sheetName)
  },

  // Channel reference (for advanced use)
  channels: IPC
} as const;

// Expose the typed API to the renderer via contextBridge.
contextBridge.exposeInMainWorld('elImtiyaz', api);

// Type declaration export for the renderer (consumed via `window.elImtiyaz`)
export type ElImtiyazApi = typeof api;
