/**
 * IPC handler registry.
 *
 * Each handler wraps a service call with:
 *   - Structured logging
 *   - Error normalisation (AppError → typed payload)
 *   - Optional audit emission
 *
 * The handler returns `{ ok: true, data }` or `{ ok: false, error }` to the
 * renderer. The preload bridge unwraps these and either resolves or rejects
 * the renderer-side promise.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC } from './channels';
import { logger } from '../../infrastructure/logger/logger';
import { sendEmailWithResend } from '../../infrastructure/email/resend';
import { AppError, toAppError } from '../../infrastructure/error/app-error';
import { DatabaseClient } from '../../infrastructure/database/sqlite-client';
import { EventBus } from '../../infrastructure/event-bus/event-bus';

// Repositories
import { StudentRepository } from '../../infrastructure/repositories/student.repository';
import { ParentRepository } from '../../infrastructure/repositories/parent.repository';
import { PaymentRepository } from '../../infrastructure/repositories/payment.repository';
import { InvoiceRepository } from '../../infrastructure/repositories/invoice.repository';
import { ClassRepository } from '../../infrastructure/repositories/class.repository';
import { EmployeeRepository } from '../../infrastructure/repositories/employee.repository';
import { AttendanceRepository } from '../../infrastructure/repositories/attendance.repository';
import { AcademicYearRepository } from '../../infrastructure/repositories/academic-year.repository';
import { ReceiptRepository } from '../../infrastructure/repositories/receipt.repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log.repository';
import { FeeTemplateRepository } from '../../infrastructure/repositories/fee-template.repository';
import { ScholarshipRepository } from '../../infrastructure/repositories/scholarship.repository';
import { WorkflowRepository } from '../../infrastructure/repositories/workflow.repository';
import { NotificationRepository } from '../../infrastructure/repositories/notification.repository';

// Services
import { StudentService } from '../../services/student.service';
import { PaymentService } from '../../services/payment.service';
import { DebtService } from '../../services/debt.service';
import { ReceiptService } from '../../services/receipt.service';
import { ReportService } from '../../services/report.service';
import { AuditService } from '../../services/audit.service';
import { AttendanceService } from '../../services/attendance.service';
import { AcademicYearService } from '../../services/academic-year.service';
import { FeeTemplateService } from '../../services/fee-template.service';
import { DiscountService } from '../../services/discount.service';
import { EmployeeService } from '../../services/employee.service';
import { ParentService } from '../../services/parent.service';
import { ClassService } from '../../services/class.service';
import { WorkflowService } from '../../services/workflow.service';
import { NotificationService } from '../../services/notification.service';
import { NODE_REGISTRY, NodeServices } from '../../services/workflow/node-registry';

interface RegistryDependencies {
  database: DatabaseClient;
  eventBus: EventBus;
}

interface IpcResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export function registerIpcHandlers(deps: RegistryDependencies): void {
  const { database, eventBus } = deps;

  // ── Repository instantiation ──────────────────────────────
  const repos = {
    students: new StudentRepository(database),
    parents: new ParentRepository(database),
    payments: new PaymentRepository(database),
    invoices: new InvoiceRepository(database),
    classes: new ClassRepository(database),
    employees: new EmployeeRepository(database),
    attendance: new AttendanceRepository(database),
    academicYears: new AcademicYearRepository(database),
    receipts: new ReceiptRepository(database),
    audit: new AuditLogRepository(database),
    feeTemplates: new FeeTemplateRepository(database),
    scholarships: new ScholarshipRepository(database),
    workflows: new WorkflowRepository(database),
    notifications: new NotificationRepository(database)
  };

  // ── Node services injection (for workflow execution engine) ──
  const nodeServices: NodeServices = {
    getStudent: async (id: string) => {
      const s = await repos.students.findById(id);
      return s;
    },
    getStudentPayments: async (id: string) => repos.payments.list({ studentId: id }),
    getStudentDebt: async (id: string) => {
      const invoices = await repos.invoices.list({ studentId: id });
      const payments = await repos.payments.list({ studentId: id });
      const owed = invoices.reduce((s, i) => s + (i.amountDue - i.discountAmount), 0);
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      return { outstanding: Math.max(0, owed - paid) };
    },
    sendEmail: async (_to: string, _subject: string, _body: string) => {
      const res = await sendEmailWithResend({ to: _to, subject: _subject, body: _body });
      if (!res.success) {
        throw new Error(`Resend email sending failed: ${res.error}`);
      }
    },
    applyDiscount: async (studentId: string, percentage: number, reason: string) => {
      const invoices = await repos.invoices.list({ studentId });
      for (const inv of invoices) {
        const discount = inv.amountDue * (percentage / 100);
        await repos.invoices.update(inv.id.value, {
          discountAmount: inv.discountAmount + discount
        });
      }
      logger.info('workflow.node.apply_discount.applied', { studentId, percentage, reason });
    },
    createInvoice: async (input: unknown) => {
      const i = input as { studentId: string; type: string; amountDue: number; description: string };
      return repos.invoices.create({
        studentId: i.studentId,
        type: i.type as any,
        description: i.description,
        amountDue: i.amountDue
      });
    },
    logActivity: async (action: string, payload: unknown) => {
      await repos.audit.create({
        timestamp: new Date().toISOString(),
        actorId: 'workflow',
        actorName: 'Workflow Engine',
        action,
        entityType: 'Workflow',
        entityId: 'workflow',
        after: payload
      });
    },
    query: async (sql: string, params: unknown[] = []) => {
      return database.all(sql, params);
    }
  };

  // ── Service instantiation ─────────────────────────────────
  const services = {
    student: new StudentService(repos.students, repos.parents, eventBus),
    parent: new ParentService(repos.parents, repos.students),
    payment: new PaymentService(repos.payments, repos.invoices, repos.students, eventBus),
    debt: new DebtService(repos.payments, repos.invoices, repos.students),
    receipt: new ReceiptService(repos.receipts, repos.payments),
    report: new ReportService(repos.payments, repos.invoices, repos.students, repos.attendance),
    audit: new AuditService(repos.audit),
    attendance: new AttendanceService(repos.attendance),
    academicYear: new AcademicYearService(repos.academicYears),
    feeTemplate: new FeeTemplateService(repos.feeTemplates, repos.invoices),
    discount: new DiscountService(repos.scholarships, repos.invoices, repos.students, repos.parents),
    employee: new EmployeeService(repos.employees),
    class: new ClassService(repos.classes, repos.students),
    workflow: new WorkflowService(repos.workflows, nodeServices),
    notification: new NotificationService(repos.notifications)
  };

  // Auto-subscribe notification + audit listeners to the event bus
  services.audit.registerListeners(eventBus);
  services.notification.registerListeners(eventBus);

  // ── Helper: wrap any handler with logging + error normalisation ──
  const wrap = <TArgs extends any[], TResult>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult>
  ) => {
    ipcMain.handle(channel, async (event, ...args) => {
      const correlationId = `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const start = Date.now();

      try {
        logger.debug('ipc.request.start', { channel, correlationId, args });
        const data = await handler(event, ...(args as TArgs));
        const durationMs = Date.now() - start;
        logger.info('ipc.request.success', { channel, correlationId, durationMs });
        return { ok: true, data } as IpcResult<TResult>;
      } catch (err) {
        const error = toAppError(err);
        const durationMs = Date.now() - start;
        logger.error('ipc.request.error', {
          channel,
          correlationId,
          durationMs,
          code: error.code,
          message: error.message
        });
        return {
          ok: false,
          error: { code: error.code, message: error.message, details: error.details }
        } as IpcResult;
      }
    });
  };

  // ── Students ──────────────────────────────────────────────
  wrap(IPC.STUDENTS_LIST, (_e, query) => services.student.list(query ?? {}));
  wrap(IPC.STUDENTS_GET, (_e, id) => services.student.getById(id));
  wrap(IPC.STUDENTS_CREATE, (_e, input) => services.student.create(input));
  wrap(IPC.STUDENTS_UPDATE, (_e, id, patch) => services.student.update(id, patch));
  wrap(IPC.STUDENTS_DELETE, (_e, id) => services.student.delete(id));
  wrap(IPC.STUDENTS_SEARCH, (_e, term) => services.student.search(term));
  wrap(IPC.STUDENTS_IMPORT, (_e, rows) => services.student.bulkImport(rows));
  wrap(IPC.STUDENTS_EXPORT, (_e, query) => services.student.export(query));
  wrap(IPC.STUDENTS_PROFILE, (_e, id) => services.student.getFinancialProfile(id));
  wrap(IPC.STUDENTS_TIMELINE, (_e, id) => services.student.getPaymentTimeline(id));

  // ── Parents ───────────────────────────────────────────────
  wrap(IPC.PARENTS_LIST, (_e, query) => services.parent.list(query ?? {}));
  wrap(IPC.PARENTS_GET, (_e, id) => services.parent.getById(id));
  wrap(IPC.PARENTS_CREATE, (_e, input) => services.parent.create(input));
  wrap(IPC.PARENTS_UPDATE, (_e, id, patch) => services.parent.update(id, patch));
  wrap(IPC.PARENTS_DELETE, (_e, id) => services.parent.delete(id));

  // ── Payments ──────────────────────────────────────────────
  wrap(IPC.PAYMENTS_LIST, (_e, query) => services.payment.list(query ?? {}));
  wrap(IPC.PAYMENTS_GET, (_e, id) => services.payment.getById(id));
  wrap(IPC.PAYMENTS_CREATE, (_e, input) => services.payment.recordPayment(input));
  wrap(IPC.PAYMENTS_UPDATE, (_e, id, patch) => services.payment.update(id, patch));
  wrap(IPC.PAYMENTS_DELETE, (_e, id) => services.payment.delete(id));
  wrap(IPC.PAYMENTS_BY_STUDENT, (_e, studentId) => services.payment.getByStudent(studentId));
  wrap(IPC.PAYMENTS_BULK, (_e, ops) => services.payment.bulkUpdate(ops));

  // ── Invoices ──────────────────────────────────────────────
  wrap(IPC.INVOICES_LIST, (_e, query) => repos.invoices.list(query ?? {}));
  wrap(IPC.INVOICES_CREATE, (_e, input) => services.payment.createInvoice(input));
  wrap(IPC.INVOICES_GET, (_e, id) => repos.invoices.findById(id));
  wrap(IPC.INVOICES_UPDATE, (_e, id, patch) => repos.invoices.update(id, patch));

  // ── Debt ──────────────────────────────────────────────────
  wrap(IPC.DEBT_SUMMARY, () => services.debt.getSchoolSummary());
  wrap(IPC.DEBT_STUDENTS, (_e, query) => services.debt.getStudentsWithDebt(query ?? {}));
  wrap(IPC.DEBT_OVERDUE, () => services.debt.getOverduePayments());

  // ── Receipts ──────────────────────────────────────────────
  wrap(IPC.RECEIPTS_GENERATE, (_e, paymentId) => services.receipt.generate(paymentId));
  wrap(IPC.RECEIPTS_LIST, (_e, query) => services.receipt.list(query ?? {}));
  wrap(IPC.RECEIPTS_GET, (_e, id) => services.receipt.getById(id));

  // ── Classes ───────────────────────────────────────────────
  wrap(IPC.CLASSES_LIST, () => services.class.list());
  wrap(IPC.CLASSES_CREATE, (_e, input) => services.class.create(input));
  wrap(IPC.CLASSES_UPDATE, (_e, id, patch) => services.class.update(id, patch));
  wrap(IPC.CLASSES_DELETE, (_e, id) => services.class.delete(id));

  // ── Attendance ────────────────────────────────────────────
  wrap(IPC.ATTENDANCE_LIST, (_e, query) => services.attendance.list(query ?? {}));
  wrap(IPC.ATTENDANCE_RECORD, (_e, input) => services.attendance.record(input));
  wrap(IPC.ATTENDANCE_REPORT, (_e, classId, from, to) =>
    services.attendance.getReport(classId, from, to)
  );

  // ── Employees ─────────────────────────────────────────────
  wrap(IPC.EMPLOYEES_LIST, () => services.employee.list());
  wrap(IPC.EMPLOYEES_CREATE, (_e, input) => services.employee.create(input));
  wrap(IPC.EMPLOYEES_UPDATE, (_e, id, patch) => services.employee.update(id, patch));
  wrap(IPC.EMPLOYEES_DELETE, (_e, id) => services.employee.delete(id));

  // ── Academic Years ────────────────────────────────────────
  wrap(IPC.ACADEMIC_YEARS_LIST, () => services.academicYear.list());
  wrap(IPC.ACADEMIC_YEARS_CREATE, (_e, input) => services.academicYear.create(input));
  wrap(IPC.ACADEMIC_YEARS_UPDATE, (_e, id, patch) => services.academicYear.update(id, patch));
  wrap(IPC.ACADEMIC_YEARS_DELETE, (_e, id) => services.academicYear.delete(id));

  // ── Fee Templates / Scholarships ──────────────────────────
  wrap(IPC.FEE_TEMPLATES_LIST, () => services.feeTemplate.list());
  wrap(IPC.FEE_TEMPLATES_CREATE, (_e, input) => services.feeTemplate.create(input));
  wrap(IPC.FEE_TEMPLATES_APPLY, (_e, templateId, studentIds) =>
    services.feeTemplate.apply(templateId, studentIds)
  );
  wrap(IPC.SCHOLARSHIPS_LIST, () => services.discount.listScholarships());
  wrap(IPC.SCHOLARSHIPS_CREATE, (_e, input) => services.discount.grantScholarship(input));
  wrap(IPC.SCHOLARSHIPS_REVOKE, (_e, id, reason) => services.discount.revokeScholarship(id, reason));

  // ── Workflows ─────────────────────────────────────────────
  wrap(IPC.WORKFLOWS_LIST, (_e, query) => services.workflow.list(query ?? {}));
  wrap(IPC.WORKFLOWS_GET, (_e, id) => services.workflow.getById(id));
  wrap(IPC.WORKFLOWS_CREATE, (_e, input) => services.workflow.create(input));
  wrap(IPC.WORKFLOWS_UPDATE, (_e, id, patch) => services.workflow.update(id, patch));
  wrap(IPC.WORKFLOWS_DELETE, (_e, id) => services.workflow.delete(id));
  wrap(IPC.WORKFLOWS_PUBLISH, (_e, id) => services.workflow.publish(id));
  wrap(IPC.WORKFLOWS_ENABLE, (_e, id) => services.workflow.enable(id));
  wrap(IPC.WORKFLOWS_DISABLE, (_e, id) => services.workflow.disable(id));
  wrap(IPC.WORKFLOWS_RUN, (_e, id, payload) => services.workflow.run(id, payload));
  wrap(IPC.WORKFLOWS_EXECUTIONS, (_e, id) => services.workflow.listExecutions(id));
  wrap(IPC.WORKFLOWS_NODE_REGISTRY, async () => NODE_REGISTRY.map((n) => ({
    id: n.id, type: n.type, label: n.label, description: n.description,
    icon: n.icon, category: n.category, inputs: n.inputs, outputs: n.outputs,
    configSchema: n.configSchema
  })));

  // ── Notifications ─────────────────────────────────────────
  wrap(IPC.NOTIFICATIONS_LIST, (_e, query) => services.notification.list(query ?? {}));
  wrap(IPC.NOTIFICATIONS_GET, (_e, id) => services.notification.getById(id));
  wrap(IPC.NOTIFICATIONS_CREATE, (_e, input) => services.notification.create(input));
  wrap(IPC.NOTIFICATIONS_MARK_READ, (_e, id) => services.notification.markRead(id));
  wrap(IPC.NOTIFICATIONS_MARK_ALL_READ, (_e, recipientId) => services.notification.markAllRead(recipientId));
  wrap(IPC.NOTIFICATIONS_DELETE, (_e, id) => services.notification.delete(id));
  wrap(IPC.NOTIFICATIONS_UNREAD_COUNT, (_e, recipientId) => services.notification.countUnread(recipientId));

  // ── Reports ───────────────────────────────────────────────
  wrap(IPC.REPORTS_REVENUE, (_e, range) => services.report.revenue(range));
  wrap(IPC.REPORTS_OUTSTANDING, () => services.report.outstanding());
  wrap(IPC.REPORTS_STUDENT, (_e, id) => services.report.student(id));
  wrap(IPC.REPORTS_EXPORT, (_e, type, query) => services.report.export(type, query));

  // ── Audit ─────────────────────────────────────────────────
  wrap(IPC.AUDIT_LIST, (_e, query) => services.audit.list(query ?? {}));
  wrap(IPC.AUDIT_GET, (_e, id) => services.audit.getById(id));

  // ── System ────────────────────────────────────────────────
  wrap(IPC.SYSTEM_INFO, async () => ({
    version: '1.0.0',
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node,
    timestamp: new Date().toISOString()
  }));

  wrap(IPC.SYSTEM_BACKUP, async () => {
    const targetPath = await database.backup();
    return { path: targetPath };
  });

  // ── File System (for uploads/exports) ─────────────────────
  // NOTE: file uploads are handled in a dedicated handler because
  // they stream bytes through IPC rather than a single payload.
  ipcMain.handle(IPC.FS_UPLOAD, async (_event, payload: { filename: string; data: string; mime: string }) => {
    try {
      const { AppPaths } = require('../system/app-paths');
      const paths = AppPaths.resolve();
      const fs = require('node:fs') as typeof import('node:fs');
      const path = require('node:path') as typeof import('node:path');
      const safeName = payload.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const target = path.join(paths.uploads, `${Date.now()}-${safeName}`);
      const buffer = Buffer.from(payload.data, 'base64');
      await fs.promises.writeFile(target, buffer);
      logger.info('fs.upload.written', { path: target, bytes: buffer.length });
      return { ok: true, data: { path: target, size: buffer.length, mime: payload.mime } };
    } catch (err) {
      const error = toAppError(err);
      logger.error('fs.upload.error', { message: error.message });
      return { ok: false, error: { code: error.code, message: error.message } };
    }
  });

  logger.info('ipc.handlers.registered', { channels: Object.keys(IPC).length });
}
