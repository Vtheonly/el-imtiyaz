import { ipcMain, IpcMainInvokeEvent } from "electron";
import { IPC } from "./channels";
import { logger } from "../../infrastructure/logger/logger";
import { sendEmailWithResend } from "../../infrastructure/email/resend";
import { AppError, toAppError } from "../../infrastructure/error/app-error";
import { DatabaseClient } from "../../infrastructure/database/sqlite-client";
import { EventBus } from "../../infrastructure/event-bus/event-bus";

// Repositories
import { StudentRepository } from "../../infrastructure/repositories/student.repository";
import { ParentRepository } from "../../infrastructure/repositories/parent.repository";
import { PaymentRepository } from "../../infrastructure/repositories/payment.repository";
import { InvoiceRepository } from "../../infrastructure/repositories/payment.repository";
import { ClassRepository } from "../../infrastructure/repositories/class.repository";
import { EmployeeRepository } from "../../infrastructure/repositories/employee.repository";
import { AttendanceRepository } from "../../infrastructure/repositories/attendance.repository";
import { AcademicYearRepository } from "../../infrastructure/repositories/academic-year.repository";
import { ReceiptRepository } from "../../infrastructure/repositories/receipt.repository";
import { AuditLogRepository } from "../../infrastructure/repositories/audit-log.repository";
import { FeeTemplateRepository } from "../../infrastructure/repositories/fee-template.repository";
import { ScholarshipRepository } from "../../infrastructure/repositories/fee-template.repository";
import { WorkflowRepository } from "../../infrastructure/repositories/workflow.repository";
import { NotificationRepository } from "../../infrastructure/repositories/notification.repository";
// Excel repositories
import { LedgerRepository } from "../../infrastructure/repositories/ledger-entry.repository";
import { QuoteBlockRepository } from "../../infrastructure/repositories/quote-block.repository";
import { FeeScheduleRepository } from "../../infrastructure/repositories/fee-schedule.repository";
import { FormulaRuleRepository } from "../../infrastructure/repositories/formula-rule.repository";
import { PaymentAuditCommentRepository } from "../../infrastructure/repositories/payment-audit-comment.repository";
import { SpreadsheetTemplateRepository } from "../../infrastructure/repositories/spreadsheet-template.repository";

// Services
import { StudentService } from "../../services/student.service";
import { PaymentService } from "../../services/payment.service";
import { DebtService } from "../../services/debt.service";
import { ReceiptService } from "../../services/receipt.service";
import { ReportService } from "../../services/report.service";
import { AuditService } from "../../services/audit.service";
import { AttendanceService } from "../../services/attendance.service";
import { AcademicYearService } from "../../services/academic-year.service";
import { FeeTemplateService } from "../../services/fee-template.service";
import { DiscountService } from "../../services/discount.service";
import { EmployeeService } from "../../services/employee.service";
import { ParentService } from "../../services/parent.service";
import { ClassService } from "../../services/class.service";
import { WorkflowService } from "../../services/workflow.service";
import { NotificationService } from "../../services/notification.service";
import { NODE_REGISTRY } from "../../services/workflow/node-registry";
import type { NodeServices } from "../../services/workflow/node-registry";
// Excel services
import { LedgerService } from "../../services/ledger.service";
import { QuoteService } from "../../services/quote.service";
import { FeeScheduleService } from "../../services/fee-schedule.service";
import {
  FormulaRuleService,
  getStarterFormulaRules,
} from "../../services/formula-rule.service";
import { ExcelIngestionService } from "../../services/excel-ingestion.service";
import { safeEvaluate } from "../../services/formula/formula-engine";

interface RegistryDependencies {
  database: DatabaseClient;
  eventBus: EventBus;
}

export function registerIpcHandlers(deps: RegistryDependencies): void {
  const { database, eventBus } = deps;

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
    notifications: new NotificationRepository(database),
    ledger: new LedgerRepository(database),
    quoteBlocks: new QuoteBlockRepository(database),
    feeSchedules: new FeeScheduleRepository(database),
    formulaRules: new FormulaRuleRepository(database),
    auditComments: new PaymentAuditCommentRepository(database),
    spreadsheetTemplates: new SpreadsheetTemplateRepository(database),
  };

  const services = {
    student: new StudentService(repos.students, repos.parents, eventBus),
    parent: new ParentService(repos.parents, repos.students),
    payment: new PaymentService(
      repos.payments,
      repos.invoices,
      repos.students,
      eventBus,
    ),
    debt: new DebtService(repos.payments, repos.invoices, repos.students),
    receipt: new ReceiptService(repos.receipts, repos.payments),
    report: new ReportService(
      repos.payments,
      repos.invoices,
      repos.students,
      repos.attendance,
    ),
    audit: new AuditService(repos.audit),
    attendance: new AttendanceService(repos.attendance, eventBus),
    academicYear: new AcademicYearService(repos.academicYears),
    feeTemplate: new FeeTemplateService(repos.feeTemplates, repos.invoices),
    discount: new DiscountService(
      repos.scholarships,
      repos.invoices,
      repos.students,
      repos.parents,
    ),
    employee: new EmployeeService(repos.employees),
    class: new ClassService(repos.classes, repos.students),
    workflow: null as unknown as WorkflowService,
    notification: new NotificationService(repos.notifications),
    ledger: null as unknown as LedgerService,
    quote: new QuoteService(repos.quoteBlocks, eventBus),
    feeSchedule: new FeeScheduleService(repos.feeSchedules),
    formulaRule: new FormulaRuleService(repos.formulaRules),
    excelIngestion: null as unknown as ExcelIngestionService,
  };

  services.ledger = new LedgerService(
    repos.ledger,
    repos.feeSchedules,
    repos.formulaRules,
    repos.auditComments,
    eventBus,
  );
  services.feeSchedule["ledger"] = services.ledger;
  services.excelIngestion = new ExcelIngestionService(
    repos.spreadsheetTemplates,
    repos.ledger,
    repos.auditComments,
  );

  const nodeServices: NodeServices = {
    getStudent: async (id: string) => repos.students.findById(id),
    getStudentPayments: async (id: string) =>
      repos.payments.list({ studentId: id }),
    getStudentDebt: async (id: string) => {
      const invoices = await repos.invoices.list({ studentId: id });
      const payments = await repos.payments.list({ studentId: id });
      const owed = invoices.reduce(
        (s, i) => s + (i.amountDue - i.discountAmount),
        0,
      );
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      return { outstanding: Math.max(0, owed - paid) };
    },
    sendEmail: async (to: string, subject: string, body: string) => {
      const res = await sendEmailWithResend({ to, subject, body });
      if (!res.success) throw new Error(`Email failed: ${res.error}`);
    },
    applyDiscount: async (
      studentId: string,
      percentage: number,
      reason: string,
    ) => {
      const invoices = await repos.invoices.list({ studentId });
      for (const inv of invoices) {
        const discount = inv.amountDue * (percentage / 100);
        await repos.invoices.update(inv.id.value, {
          discountAmount: inv.discountAmount + discount,
        });
      }
    },
    createInvoice: async (input: any) =>
      repos.invoices.create({
        studentId: input.studentId,
        type: input.type,
        description: input.description,
        amountDue: input.amountDue,
      }),
    logActivity: async (action: string, payload: any) => {
      await repos.audit.create({
        timestamp: new Date().toISOString(),
        actorId: "workflow",
        actorName: "Workflow Engine",
        action,
        entityType: "Workflow",
        entityId: "workflow",
        after: payload,
      });
    },
    query: async (sql: string, params?: any[]) =>
      database.all(sql, params || []),
    evalFormula: async (expression, ctx) => {
      const result = safeEvaluate(expression, ctx, "workflow");
      return result.ok
        ? { ok: true, value: result.value }
        : { ok: false, error: (result as any).error };
    },
    createLedgerEntry: async (input) => services.ledger.create(input as any),
    updateLedgerEntry: async (id, patch) =>
      services.ledger.update(id, patch as any),
    listLedgerEntries: async (filter) => services.ledger.list(filter as any),
    recomputeLedger: async () => services.ledger.recomputeAll(),
    createQuoteBlock: async (input) => services.quote.create(input as any),
    applyFeeSchedule: async (scheduleId, studentIds) =>
      services.feeSchedule.update(scheduleId, {}),
    listFormulaRules: async (scope) =>
      services.formulaRule.list(scope ? { scope: scope as any } : {}),
  };

  services.workflow = new WorkflowService(repos.workflows, nodeServices);

  services.audit.registerListeners(eventBus);
  services.notification.registerListeners(eventBus);

  const wrap = <TArgs extends any[], TResult>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult>,
  ) => {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        const data = await handler(event, ...(args as TArgs));
        return { ok: true, data };
      } catch (err) {
        const error = toAppError(err);
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }
    });
  };

  wrap(IPC.STUDENTS_LIST, (_e, query) => services.student.list(query ?? {}));
  wrap(IPC.STUDENTS_GET, (_e, id) => services.student.getById(id));
  wrap(IPC.STUDENTS_CREATE, (_e, input) => services.student.create(input));
  wrap(IPC.STUDENTS_UPDATE, (_e, id, patch) =>
    services.student.update(id, patch),
  );
  wrap(IPC.STUDENTS_DELETE, (_e, id) => services.student.delete(id));
  wrap(IPC.STUDENTS_SEARCH, (_e, term) => services.student.search(term));
  wrap(IPC.STUDENTS_IMPORT, (_e, rows) => services.student.bulkImport(rows));
  wrap(IPC.STUDENTS_EXPORT, (_e, query) => services.student.export(query));
  wrap(IPC.STUDENTS_PROFILE, (_e, id) =>
    services.student.getFinancialProfile(id),
  );
  wrap(IPC.STUDENTS_TIMELINE, (_e, id) =>
    services.student.getPaymentTimeline(id),
  );

  wrap(IPC.PARENTS_LIST, (_e, query) => services.parent.list(query ?? {}));
  wrap(IPC.PARENTS_GET, (_e, id) => services.parent.getById(id));
  wrap(IPC.PARENTS_CREATE, (_e, input) => services.parent.create(input));
  wrap(IPC.PARENTS_UPDATE, (_e, id, patch) =>
    services.parent.update(id, patch),
  );
  wrap(IPC.PARENTS_DELETE, (_e, id) => services.parent.delete(id));

  wrap(IPC.PAYMENTS_LIST, (_e, query) => services.payment.list(query ?? {}));
  wrap(IPC.PAYMENTS_GET, (_e, id) => services.payment.getById(id));
  wrap(IPC.PAYMENTS_CREATE, (_e, input) =>
    services.payment.recordPayment(input),
  );
  wrap(IPC.PAYMENTS_UPDATE, (_e, id, patch) =>
    services.payment.update(id, patch),
  );
  wrap(IPC.PAYMENTS_DELETE, (_e, id) => services.payment.delete(id));
  wrap(IPC.PAYMENTS_BY_STUDENT, (_e, studentId) =>
    services.payment.getByStudent(studentId),
  );
  wrap(IPC.PAYMENTS_BULK, (_e, ops) => services.payment.bulkUpdate(ops as any));

  wrap(IPC.INVOICES_LIST, (_e, query) => repos.invoices.list(query ?? {}));
  wrap(IPC.INVOICES_CREATE, (_e, input) =>
    services.payment.createInvoice(input),
  );
  wrap(IPC.INVOICES_GET, (_e, id) => repos.invoices.findById(id));
  wrap(IPC.INVOICES_UPDATE, (_e, id, patch) =>
    repos.invoices.update(id, patch),
  );

  wrap(IPC.DEBT_SUMMARY, () => services.debt.getSchoolSummary());
  wrap(IPC.DEBT_STUDENTS, (_e, query) =>
    services.debt.getStudentsWithDebt(query ?? {}),
  );
  wrap(IPC.DEBT_OVERDUE, () => services.debt.getOverduePayments());

  wrap(IPC.RECEIPTS_GENERATE, (_e, paymentId) =>
    services.receipt.generate(paymentId),
  );
  wrap(IPC.RECEIPTS_LIST, (_e, query) => services.receipt.list(query ?? {}));
  wrap(IPC.RECEIPTS_GET, (_e, id) => services.receipt.getById(id));

  wrap(IPC.CLASSES_LIST, () => services.class.list());
  wrap(IPC.CLASSES_CREATE, (_e, input) => services.class.create(input));
  wrap(IPC.CLASSES_UPDATE, (_e, id, patch) => services.class.update(id, patch));
  wrap(IPC.CLASSES_DELETE, (_e, id) => services.class.delete(id));

  wrap(IPC.ATTENDANCE_LIST, (_e, query) =>
    services.attendance.list(query ?? {}),
  );
  wrap(IPC.ATTENDANCE_RECORD, (_e, input) => services.attendance.record(input));
  wrap(IPC.ATTENDANCE_REPORT, (_e, classId, from, to) =>
    services.attendance.getReport(classId, from, to),
  );

  wrap(IPC.EMPLOYEES_LIST, () => services.employee.list());
  wrap(IPC.EMPLOYEES_CREATE, (_e, input) => services.employee.create(input));
  wrap(IPC.EMPLOYEES_UPDATE, (_e, id, patch) =>
    services.employee.update(id, patch),
  );
  wrap(IPC.EMPLOYEES_DELETE, (_e, id) => services.employee.delete(id));

  wrap(IPC.ACADEMIC_YEARS_LIST, () => services.academicYear.list());
  wrap(IPC.ACADEMIC_YEARS_CREATE, (_e, input) =>
    services.academicYear.create(input),
  );
  wrap(IPC.ACADEMIC_YEARS_UPDATE, (_e, id, patch) =>
    services.academicYear.update(id, patch),
  );
  wrap(IPC.ACADEMIC_YEARS_DELETE, (_e, id) => services.academicYear.delete(id));

  wrap(IPC.FEE_TEMPLATES_LIST, () => services.feeTemplate.list());
  wrap(IPC.FEE_TEMPLATES_CREATE, (_e, input) =>
    services.feeTemplate.create(input),
  );
  wrap(IPC.FEE_TEMPLATES_APPLY, (_e, templateId, studentIds) =>
    services.feeTemplate.apply(templateId, studentIds),
  );
  wrap(IPC.SCHOLARSHIPS_LIST, () => services.discount.listScholarships());
  wrap(IPC.SCHOLARSHIPS_CREATE, (_e, input) =>
    services.discount.grantScholarship(input),
  );
  wrap(IPC.SCHOLARSHIPS_REVOKE, (_e, id, reason) =>
    services.discount.revokeScholarship(id, reason),
  );

  wrap(IPC.WORKFLOWS_LIST, (_e, query) => services.workflow.list(query ?? {}));
  wrap(IPC.WORKFLOWS_GET, (_e, id) => services.workflow.getById(id));
  wrap(IPC.WORKFLOWS_CREATE, (_e, input) => services.workflow.create(input));
  wrap(IPC.WORKFLOWS_UPDATE, (_e, id, patch) =>
    services.workflow.update(id, patch),
  );
  wrap(IPC.WORKFLOWS_DELETE, (_e, id) => services.workflow.delete(id));
  wrap(IPC.WORKFLOWS_PUBLISH, (_e, id) => services.workflow.publish(id));
  wrap(IPC.WORKFLOWS_ENABLE, (_e, id) => services.workflow.enable(id));
  wrap(IPC.WORKFLOWS_DISABLE, (_e, id) => services.workflow.disable(id));
  wrap(IPC.WORKFLOWS_RUN, (_e, id, payload) =>
    services.workflow.run(id, payload),
  );
  wrap(IPC.WORKFLOWS_EXECUTIONS, (_e, id) =>
    services.workflow.listExecutions(id),
  );
  wrap(IPC.WORKFLOWS_NODE_REGISTRY, async () =>
    NODE_REGISTRY.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      description: n.description,
      icon: n.icon,
      category: n.category,
      inputs: n.inputs,
      outputs: n.outputs,
      configSchema: n.configSchema,
    })),
  );

  wrap(IPC.NOTIFICATIONS_LIST, (_e, query) =>
    services.notification.list(query ?? {}),
  );
  wrap(IPC.NOTIFICATIONS_GET, (_e, id) => services.notification.getById(id));
  wrap(IPC.NOTIFICATIONS_CREATE, (_e, input) =>
    services.notification.create(input),
  );
  wrap(IPC.NOTIFICATIONS_MARK_READ, (_e, id) =>
    services.notification.markRead(id),
  );
  wrap(IPC.NOTIFICATIONS_MARK_ALL_READ, (_e, recipientId) =>
    services.notification.markAllRead(recipientId),
  );
  wrap(IPC.NOTIFICATIONS_DELETE, (_e, id) => services.notification.delete(id));
  wrap(IPC.NOTIFICATIONS_UNREAD_COUNT, (_e, recipientId) =>
    services.notification.countUnread(recipientId),
  );

  wrap(IPC.REPORTS_REVENUE, (_e, range) => services.report.revenue(range));
  wrap(IPC.REPORTS_OUTSTANDING, () => services.report.outstanding());
  wrap(IPC.REPORTS_STUDENT, (_e, id) => services.report.student(id));
  wrap(IPC.REPORTS_EXPORT, (_e, type, query) =>
    services.report.export(type, query),
  );

  wrap(IPC.AUDIT_LIST, (_e, query) => services.audit.list(query ?? {}));
  wrap(IPC.AUDIT_GET, (_e, id) => services.audit.getById(id));

  wrap(IPC.SYSTEM_INFO, async () => ({
    version: "1.0.0",
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node,
    timestamp: new Date().toISOString(),
  }));

  wrap(IPC.SYSTEM_BACKUP, async () => {
    const targetPath = await database.backup();
    return { path: targetPath };
  });

  wrap(IPC.LEDGER_LIST, (_e, query) => services.ledger.list(query ?? {}));
  wrap(IPC.LEDGER_GET, (_e, id) => services.ledger.getById(id));
  wrap(IPC.LEDGER_CREATE, (_e, input) => services.ledger.create(input));
  wrap(IPC.LEDGER_UPDATE, (_e, id, patch) => services.ledger.update(id, patch));
  wrap(IPC.LEDGER_DELETE, (_e, id) => services.ledger.delete(id));
  wrap(IPC.LEDGER_BY_STUDENT, (_e, studentId) =>
    services.ledger.getByStudent(studentId),
  );
  wrap(IPC.LEDGER_SUMMARY, () => services.ledger.getSummary());
  wrap(IPC.LEDGER_RECOMPUTE, () => services.ledger.recomputeAll());
  wrap(IPC.LEDGER_AUDIT_COMMENTS_LIST, (_e, ledgerEntryId) =>
    services.ledger.listAuditComments(ledgerEntryId),
  );
  wrap(IPC.LEDGER_AUDIT_COMMENTS_CREATE, (_e, input) =>
    services.ledger.addAuditComment(input),
  );

  wrap(IPC.QUOTES_LIST, (_e, query) => services.quote.list(query ?? {}));
  wrap(IPC.QUOTES_GET, (_e, id) => services.quote.getById(id));
  wrap(IPC.QUOTES_CREATE, (_e, input) => services.quote.create(input));
  wrap(IPC.QUOTES_UPDATE, (_e, id, patch) => services.quote.update(id, patch));
  wrap(IPC.QUOTES_DELETE, (_e, id) => services.quote.delete(id));
  wrap(IPC.QUOTES_BY_STUDENT, (_e, studentId) =>
    services.quote.getByStudent(studentId),
  );
  wrap(IPC.QUOTES_RECOMPUTE, (_e, id) => services.quote.recompute(id));

  wrap(IPC.FEE_SCHEDULES_LIST, (_e, query) =>
    services.feeSchedule.list(query ?? {}),
  );
  wrap(IPC.FEE_SCHEDULES_GET, (_e, id) => services.feeSchedule.getById(id));
  wrap(IPC.FEE_SCHEDULES_CREATE, (_e, input) =>
    services.feeSchedule.create(input),
  );
  wrap(IPC.FEE_SCHEDULES_UPDATE, (_e, id, patch) =>
    services.feeSchedule.update(id, patch),
  );
  wrap(IPC.FEE_SCHEDULES_DELETE, (_e, id) => services.feeSchedule.delete(id));
  wrap(IPC.FEE_SCHEDULES_ENSURE_DEFAULT, () =>
    services.feeSchedule.ensureDefaultExists(),
  );

  wrap(IPC.FORMULA_RULES_LIST, (_e, query) =>
    services.formulaRule.list(query ?? {}),
  );
  wrap(IPC.FORMULA_RULES_GET, (_e, id) => services.formulaRule.getById(id));
  wrap(IPC.FORMULA_RULES_CREATE, (_e, input) =>
    services.formulaRule.create(input),
  );
  wrap(IPC.FORMULA_RULES_UPDATE, (_e, id, patch) =>
    services.formulaRule.update(id, patch),
  );
  wrap(IPC.FORMULA_RULES_DELETE, (_e, id) => services.formulaRule.delete(id));
  wrap(IPC.FORMULA_RULES_TEST, (_e, expression, sampleContext) =>
    services.formulaRule.test(expression, sampleContext ?? { fields: {} }),
  );
  wrap(IPC.FORMULA_RULES_EVALUATE, (_e, ruleId, ctx) =>
    services.formulaRule.evaluateAndRecord(ruleId, ctx ?? { fields: {} }),
  );
  wrap(IPC.FORMULA_RULES_SEED_STARTERS, async () => {
    const starters = getStarterFormulaRules();
    const created = [];
    for (const s of starters) {
      const existing = await services.formulaRule.list({ search: s.name });
      if (existing.some((r) => r.name === s.name)) continue;
      created.push(await services.formulaRule.create(s));
    }
    return { seeded: created.length, created };
  });

  wrap(IPC.SPREADSHEET_TEMPLATES_LIST, () => repos.spreadsheetTemplates.list());
  wrap(IPC.SPREADSHEET_TEMPLATES_GET, (_e, id) =>
    repos.spreadsheetTemplates.findById(id),
  );
  wrap(IPC.SPREADSHEET_TEMPLATES_DELETE, (_e, id) =>
    repos.spreadsheetTemplates.delete(id),
  );
  wrap(IPC.SPREADSHEET_TEMPLATES_ANALYZE, (_e, filePath) =>
    services.excelIngestion.analyzeWorkbook(filePath),
  );
  wrap(
    IPC.SPREADSHEET_IMPORT_LEDGER,
    (_e, filePath, sheetName, academicYearId) =>
      services.excelIngestion.importLedger(filePath, sheetName, academicYearId),
  );
  wrap(IPC.SPREADSHEET_IMPORT_COMMENTS, (_e, filePath, sheetName) =>
    services.excelIngestion.importAuditComments(filePath, sheetName),
  );
}
