/**
 * IPC channel registry — single source of truth for channel names.
 *
 * Using string constants everywhere prevents typos and makes refactorings
 * surface as compile errors instead of silent runtime failures.
 *
 * Naming convention: `<domain>:<action>` (e.g. `students:list`, `payments:create`).
 */

export const IPC = {
  // ── Students ────────────────────────────────────────────────
  STUDENTS_LIST: 'students:list',
  STUDENTS_GET: 'students:get',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_DELETE: 'students:delete',
  STUDENTS_SEARCH: 'students:search',
  STUDENTS_IMPORT: 'students:import',
  STUDENTS_EXPORT: 'students:export',
  STUDENTS_PROFILE: 'students:profile',
  STUDENTS_TIMELINE: 'students:timeline',

  // ── Parents ─────────────────────────────────────────────────
  PARENTS_LIST: 'parents:list',
  PARENTS_GET: 'parents:get',
  PARENTS_CREATE: 'parents:create',
  PARENTS_UPDATE: 'parents:update',
  PARENTS_DELETE: 'parents:delete',

  // ── Payments ────────────────────────────────────────────────
  PAYMENTS_LIST: 'payments:list',
  PAYMENTS_GET: 'payments:get',
  PAYMENTS_CREATE: 'payments:create',
  PAYMENTS_UPDATE: 'payments:update',
  PAYMENTS_DELETE: 'payments:delete',
  PAYMENTS_BY_STUDENT: 'payments:by-student',
  PAYMENTS_BULK: 'payments:bulk',

  // ── Invoices / Charges ──────────────────────────────────────
  INVOICES_LIST: 'invoices:list',
  INVOICES_CREATE: 'invoices:create',
  INVOICES_GET: 'invoices:get',
  INVOICES_UPDATE: 'invoices:update',

  // ── Debt ────────────────────────────────────────────────────
  DEBT_SUMMARY: 'debt:summary',
  DEBT_STUDENTS: 'debt:students',
  DEBT_OVERDUE: 'debt:overdue',

  // ── Receipts ───────────────────────────────────────────────
  RECEIPTS_GENERATE: 'receipts:generate',
  RECEIPTS_LIST: 'receipts:list',
  RECEIPTS_GET: 'receipts:get',

  // ── Classes ─────────────────────────────────────────────────
  CLASSES_LIST: 'classes:list',
  CLASSES_CREATE: 'classes:create',
  CLASSES_UPDATE: 'classes:update',
  CLASSES_DELETE: 'classes:delete',

  // ── Attendance ──────────────────────────────────────────────
  ATTENDANCE_LIST: 'attendance:list',
  ATTENDANCE_RECORD: 'attendance:record',
  ATTENDANCE_REPORT: 'attendance:report',

  // ── Employees ───────────────────────────────────────────────
  EMPLOYEES_LIST: 'employees:list',
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_UPDATE: 'employees:update',
  EMPLOYEES_DELETE: 'employees:delete',

  // ── Academic Years ──────────────────────────────────────────
  ACADEMIC_YEARS_LIST: 'academic-years:list',
  ACADEMIC_YEARS_CREATE: 'academic-years:create',
  ACADEMIC_YEARS_UPDATE: 'academic-years:update',
  ACADEMIC_YEARS_DELETE: 'academic-years:delete',

  // ── Fee Templates / Discounts ───────────────────────────────
  FEE_TEMPLATES_LIST: 'fee-templates:list',
  FEE_TEMPLATES_CREATE: 'fee-templates:create',
  FEE_TEMPLATES_APPLY: 'fee-templates:apply',
  SCHOLARSHIPS_LIST: 'scholarships:list',
  SCHOLARSHIPS_CREATE: 'scholarships:create',
  SCHOLARSHIPS_REVOKE: 'scholarships:revoke',

  // ── Workflows ───────────────────────────────────────────────
  WORKFLOWS_LIST: 'workflows:list',
  WORKFLOWS_GET: 'workflows:get',
  WORKFLOWS_CREATE: 'workflows:create',
  WORKFLOWS_UPDATE: 'workflows:update',
  WORKFLOWS_DELETE: 'workflows:delete',
  WORKFLOWS_PUBLISH: 'workflows:publish',
  WORKFLOWS_ENABLE: 'workflows:enable',
  WORKFLOWS_DISABLE: 'workflows:disable',
  WORKFLOWS_RUN: 'workflows:run',
  WORKFLOWS_EXECUTIONS: 'workflows:executions',
  WORKFLOWS_NODE_REGISTRY: 'workflows:node-registry',

  // ── Notifications ───────────────────────────────────────────
  NOTIFICATIONS_LIST: 'notifications:list',
  NOTIFICATIONS_GET: 'notifications:get',
  NOTIFICATIONS_CREATE: 'notifications:create',
  NOTIFICATIONS_MARK_READ: 'notifications:mark-read',
  NOTIFICATIONS_MARK_ALL_READ: 'notifications:mark-all-read',
  NOTIFICATIONS_DELETE: 'notifications:delete',
  NOTIFICATIONS_UNREAD_COUNT: 'notifications:unread-count',

  // ── Reports ─────────────────────────────────────────────────
  REPORTS_REVENUE: 'reports:revenue',
  REPORTS_OUTSTANDING: 'reports:outstanding',
  REPORTS_STUDENT: 'reports:student',
  REPORTS_EXPORT: 'reports:export',

  // ── Audit Logs ──────────────────────────────────────────────
  AUDIT_LIST: 'audit:list',
  AUDIT_GET: 'audit:get',

  // ── System ──────────────────────────────────────────────────
  SYSTEM_INFO: 'system:info',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',

  // ── File System (for uploads/exports) ───────────────────────
  FS_UPLOAD: 'fs:upload',
  FS_READ_FILE: 'fs:read-file',

  // ── Menu commands (renderer → main → renderer loopback) ────
  MENU_COMMAND: 'menu:command',

  // ════════════════════════════════════════════════════════════════════════
  // ── Excel-Migration Channels (added 2026-06) ───────────────────────────
  // Reproduce the Suivis clients.xlsx workbook behaviour in-app.
  // ════════════════════════════════════════════════════════════════════════

  // ── Ledger (ETAT 20262027 sheet) ─────────────────────────
  LEDGER_LIST: 'ledger:list',
  LEDGER_GET: 'ledger:get',
  LEDGER_CREATE: 'ledger:create',
  LEDGER_UPDATE: 'ledger:update',
  LEDGER_DELETE: 'ledger:delete',
  LEDGER_BY_STUDENT: 'ledger:by-student',
  LEDGER_SUMMARY: 'ledger:summary',
  LEDGER_RECOMPUTE: 'ledger:recompute',
  LEDGER_AUDIT_COMMENTS_LIST: 'ledger:audit-comments:list',
  LEDGER_AUDIT_COMMENTS_CREATE: 'ledger:audit-comments:create',

  // ── Quote Blocks (Devis sheet) ───────────────────────────
  QUOTES_LIST: 'quotes:list',
  QUOTES_GET: 'quotes:get',
  QUOTES_CREATE: 'quotes:create',
  QUOTES_UPDATE: 'quotes:update',
  QUOTES_DELETE: 'quotes:delete',
  QUOTES_BY_STUDENT: 'quotes:by-student',
  QUOTES_RECOMPUTE: 'quotes:recompute',

  // ── Fee Schedules ────────────────────────────────────────
  FEE_SCHEDULES_LIST: 'fee-schedules:list',
  FEE_SCHEDULES_GET: 'fee-schedules:get',
  FEE_SCHEDULES_CREATE: 'fee-schedules:create',
  FEE_SCHEDULES_UPDATE: 'fee-schedules:update',
  FEE_SCHEDULES_DELETE: 'fee-schedules:delete',
  FEE_SCHEDULES_APPLY: 'fee-schedules:apply',
  FEE_SCHEDULES_ENSURE_DEFAULT: 'fee-schedules:ensure-default',

  // ── Formula Rules ────────────────────────────────────────
  FORMULA_RULES_LIST: 'formula-rules:list',
  FORMULA_RULES_GET: 'formula-rules:get',
  FORMULA_RULES_CREATE: 'formula-rules:create',
  FORMULA_RULES_UPDATE: 'formula-rules:update',
  FORMULA_RULES_DELETE: 'formula-rules:delete',
  FORMULA_RULES_TEST: 'formula-rules:test',
  FORMULA_RULES_EVALUATE: 'formula-rules:evaluate',
  FORMULA_RULES_SEED_STARTERS: 'formula-rules:seed-starters',

  // ── Spreadsheet Templates (imported workbook metadata) ───
  SPREADSHEET_TEMPLATES_LIST: 'spreadsheet-templates:list',
  SPREADSHEET_TEMPLATES_GET: 'spreadsheet-templates:get',
  SPREADSHEET_TEMPLATES_DELETE: 'spreadsheet-templates:delete',
  SPREADSHEET_TEMPLATES_ANALYZE: 'spreadsheet-templates:analyze',
  SPREADSHEET_IMPORT_LEDGER: 'spreadsheet-templates:import-ledger',
  SPREADSHEET_IMPORT_COMMENTS: 'spreadsheet-templates:import-comments'
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
