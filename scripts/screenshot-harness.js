/**
 * Screenshot harness — drives the renderer with Playwright and captures
 * screenshots of every page/interaction.
 *
 * Strategy:
 *   1. Start a static HTTP server serving dist/renderer/
 *   2. Inject a mock window.elImtiyaz that reads from the seeded SQLite DB
 *   3. For each route, navigate, wait for content, screenshot
 *   4. For interactive flows (modals, palette), click and screenshot again
 *   5. Save all PNGs to screenshots/
 */

const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const Database = require('better-sqlite3');
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

const ROOT = '/home/z/my-project/el-imtiyaz';
const DB_FILE = path.join(ROOT, '.dev-data/el-imtiyaz.db');
const SHOTS_DIR = path.join(ROOT, 'screenshots');
const RENDERER_DIR = path.join(ROOT, 'dist/renderer');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

const db = new Database(DB_FILE, { readonly: true });
db.pragma('journal_mode = WAL');

// ── Mock window.elImtiyaz API ────────────────────────────────────────
// Each method runs the corresponding SQL against the seeded DB and returns
// a Promise matching the shape the renderer expects.
const api = {
  students: {
    list: async (q = {}) => {
      let sql = 'SELECT * FROM students WHERE deleted_at IS NULL';
      const params = [];
      if (q.search) { sql += ' AND (full_name LIKE ? OR student_code LIKE ?)'; params.push(`%${q.search}%`, `%${q.search}%`); }
      if (q.status) { sql += ' AND status = ?'; params.push(q.status); }
      if (q.classId) { sql += ' AND class_id = ?'; params.push(q.classId); }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(q.pageSize || 100);
      return db.prepare(sql).all(...params).map(mapStudent);
    },
    get: async (id) => mapStudent(db.prepare('SELECT * FROM students WHERE id = ?').get(id)),
    search: async (term) => db.prepare('SELECT * FROM students WHERE deleted_at IS NULL AND (full_name LIKE ? OR student_code LIKE ?) LIMIT 20').all(`%${term}%`, `%${term}%`).map(mapStudent),
    create: async () => { throw new Error('create disabled in screenshot mode'); },
    update: async () => { throw new Error('update disabled'); },
    delete: async () => { throw new Error('delete disabled'); },
    import: async () => ({ imported: 0, failed: 0, errors: [] }),
    export: async () => [],
    profile: async (id) => {
      const student = mapStudent(db.prepare('SELECT * FROM students WHERE id = ?').get(id));
      const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? AND deleted_at IS NULL').all(id);
      const invoices = db.prepare('SELECT * FROM invoices WHERE student_id = ? AND deleted_at IS NULL').all(id);
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      const totalOwed = invoices.reduce((s, i) => s + (i.amount_due - i.discount_amount), 0);
      return {
        student,
        totalPaid,
        totalOwed,
        outstandingBalance: Math.max(0, totalOwed - totalPaid),
        lastPayment: payments[0] ? { amount: payments[0].amount, date: payments[0].payment_date, receiptNumber: payments[0].receipt_number } : undefined,
        paymentCount: payments.length,
        scholarshipActive: false
      };
    },
    timeline: async (id) => {
      return db.prepare(`SELECT strftime('%Y-%m', issued_at) as period, strftime('%Y-%m', issued_at) as label,
                            SUM(amount_due - discount_amount) as amount_due, SUM(amount_paid) as amount_paid
                         FROM invoices WHERE student_id = ? AND deleted_at IS NULL GROUP BY period ORDER BY period`).all(id)
        .map(r => ({
          period: r.period, label: r.label,
          amountDue: r.amount_due, amountPaid: r.amount_paid,
          status: r.amount_paid >= r.amount_due ? 'paid' : r.amount_paid > 0 ? 'partial' : 'missing'
        }));
    }
  },
  parents: {
    list: async (q = {}) => {
      let sql = 'SELECT * FROM parents WHERE deleted_at IS NULL';
      const params = [];
      if (q.search) { sql += ' AND (full_name LIKE ? OR phone LIKE ?)'; params.push(`%${q.search}%`, `%${q.search}%`); }
      sql += ' LIMIT ?';
      params.push(q.pageSize || 100);
      return db.prepare(sql).all(...params).map(mapParent);
    },
    get: async (id) => mapParent(db.prepare('SELECT * FROM parents WHERE id = ?').get(id)),
    create: async () => { throw new Error('disabled'); },
    update: async () => { throw new Error('disabled'); },
    delete: async () => { throw new Error('disabled'); }
  },
  payments: {
    list: async (q = {}) => {
      let sql = 'SELECT * FROM payments WHERE deleted_at IS NULL';
      const params = [];
      if (q.studentId) { sql += ' AND student_id = ?'; params.push(q.studentId); }
      if (q.from) { sql += ' AND payment_date >= ?'; params.push(q.from); }
      if (q.to) { sql += ' AND payment_date <= ?'; params.push(q.to); }
      sql += ' ORDER BY payment_date DESC LIMIT ?';
      params.push(q.pageSize || 200);
      return db.prepare(sql).all(...params).map(mapPayment);
    },
    get: async (id) => mapPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id)),
    byStudent: async (sid) => db.prepare('SELECT * FROM payments WHERE student_id = ? AND deleted_at IS NULL ORDER BY payment_date DESC').all(sid).map(mapPayment),
    create: async () => { throw new Error('disabled'); },
    update: async () => { throw new Error('disabled'); },
    delete: async () => { throw new Error('disabled'); },
    bulk: async () => ({ updated: 0, failed: 0, errors: [] })
  },
  invoices: {
    list: async (q = {}) => {
      let sql = 'SELECT * FROM invoices WHERE deleted_at IS NULL';
      const params = [];
      if (q.studentId) { sql += ' AND student_id = ?'; params.push(q.studentId); }
      sql += ' ORDER BY issued_at DESC LIMIT 500';
      return db.prepare(sql).all(...params).map(mapInvoice);
    },
    get: async (id) => mapInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)),
    create: async () => { throw new Error('disabled'); },
    update: async () => { throw new Error('disabled'); }
  },
  debt: {
    summary: async () => {
      const outstanding = db.prepare(`SELECT COALESCE(SUM(amount_due - discount_amount - amount_paid), 0) as total FROM invoices WHERE deleted_at IS NULL`).get().total;
      const debtors = db.prepare(`SELECT COUNT(DISTINCT student_id) as count FROM invoices WHERE deleted_at IS NULL AND (amount_due - discount_amount - amount_paid) > 0`).get().count;
      const overdue = db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NULL AND due_date < date('now') AND (amount_due - discount_amount - amount_paid) > 0`).get().count;
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const collectedYear = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE deleted_at IS NULL AND status = 'paid' AND payment_date >= ?`).get(yearStart).total;
      const collectedMonth = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE deleted_at IS NULL AND status = 'paid' AND payment_date >= ?`).get(monthStart).total;
      return {
        totalOutstanding: outstanding,
        totalCollectedThisYear: collectedYear,
        totalCollectedThisMonth: collectedMonth,
        studentsWithDebtCount: debtors,
        overduePaymentsCount: overdue
      };
    },
    students: async () => {
      return db.prepare(`SELECT s.*, SUM(i.amount_due - i.discount_amount) as total_invoiced, SUM(i.amount_paid) as total_paid,
                            SUM(i.amount_due - i.discount_amount - i.amount_paid) as outstanding
                         FROM invoices i JOIN students s ON s.id = i.student_id
                         WHERE i.deleted_at IS NULL AND s.deleted_at IS NULL
                         GROUP BY s.id HAVING outstanding > 0 ORDER BY outstanding DESC LIMIT 100`).all()
        .map(r => ({
          student: mapStudent(r),
          totalInvoiced: r.total_invoiced, totalPaid: r.total_paid, outstanding: r.outstanding,
          overdueAmount: 0, oldestUnpaidInvoiceDate: r.registered_at
        }));
    },
    overdue: async () => {
      return db.prepare(`SELECT i.id as invoice_id, i.student_id, s.full_name as student_name,
                            (i.amount_due - i.discount_amount - i.amount_paid) as amount,
                            i.due_date, CAST(julianday(date('now')) - julianday(i.due_date) AS INTEGER) as days_overdue
                         FROM invoices i LEFT JOIN students s ON s.id = i.student_id
                         WHERE i.deleted_at IS NULL AND i.due_date < date('now')
                           AND (i.amount_due - i.discount_amount - i.amount_paid) > 0
                         ORDER BY days_overdue DESC`).all()
        .map(r => ({ invoiceId: r.invoice_id, studentId: r.student_id, studentName: r.student_name, amount: r.amount, dueDate: r.due_date, daysOverdue: r.days_overdue }));
    }
  },
  receipts: {
    list: async () => [],
    get: async () => null,
    generate: async () => { throw new Error('disabled'); }
  },
  classes: {
    list: async () => db.prepare('SELECT * FROM classes WHERE deleted_at IS NULL ORDER BY grade, section').all().map(mapClass),
    create: async () => { throw new Error('disabled'); },
    update: async () => { throw new Error('disabled'); },
    delete: async () => { throw new Error('disabled'); }
  },
  attendance: {
    list: async () => [],
    record: async () => { throw new Error('disabled'); },
    report: async () => ({ classId: '', fromDate: '', toDate: '', totalRecords: 0, byStatus: { present: 0, absent: 0, excused: 0, late: 0 }, byStudent: [] })
  },
  employees: {
    list: async () => db.prepare('SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY created_at DESC').all().map(mapEmployee),
    create: async () => { throw new Error('disabled'); },
    update: async () => { throw new Error('disabled'); },
    delete: async () => { throw new Error('disabled'); }
  },
  academicYears: {
    list: async () => db.prepare('SELECT * FROM academic_years ORDER BY start_date DESC').all().map(mapYear),
    create: async () => { throw new Error('disabled'); },
    update: async () => { throw new Error('disabled'); },
    delete: async () => { throw new Error('disabled'); }
  },
  feeTemplates: {
    list: async () => db.prepare('SELECT * FROM fee_templates WHERE is_active = 1 ORDER BY grade_level').all().map(mapTemplate),
    create: async () => { throw new Error('disabled'); },
    apply: async () => ({ applied: 0, invoicesCreated: 0, failed: 0, errors: [] })
  },
  scholarships: {
    list: async () => db.prepare('SELECT * FROM scholarships WHERE is_active = 1 ORDER BY granted_at DESC').all().map(mapScholarship),
    create: async () => { throw new Error('disabled'); },
    revoke: async () => { throw new Error('disabled'); }
  },
  workflows: {
    list: async () => [],
    get: async () => null,
    create: async () => ({ id: { value: 'wf-mock' }, name: 'New Workflow', description: '', category: 'custom', nodes: [], edges: [], status: 'draft', version: 1, enabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    update: async () => null,
    delete: async () => {},
    publish: async () => null,
    enable: async () => null,
    disable: async () => null,
    run: async () => ({ id: 'exec-mock', workflowId: '', workflowVersion: 1, startedAt: new Date().toISOString(), status: 'success', nodeResults: [] }),
    executions: async () => [],
    nodeRegistry: async () => []
  },
  notifications: {
    list: async (q = {}) => {
      let sql = 'SELECT * FROM notifications WHERE 1=1';
      const params = [];
      if (q.unreadOnly) sql += ' AND read_at IS NULL';
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(q.limit || 100);
      return db.prepare(sql).all(...params).map(mapNotification);
    },
    get: async (id) => mapNotification(db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)),
    create: async () => { throw new Error('disabled'); },
    markRead: async () => null,
    markAllRead: async () => {},
    delete: async () => {},
    unreadCount: async () => db.prepare("SELECT COUNT(*) as count FROM notifications WHERE read_at IS NULL AND status IN ('sent','delivered')").get().count
  },
  reports: {
    revenue: async (rangeInput) => {
      const range = rangeInput && rangeInput.start
        ? rangeInput
        : { start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(), end: new Date().toISOString() };
      const rows = db.prepare(`SELECT date(payment_date) as date, payment_method as method,
                                      SUM(amount) as total, COUNT(*) as count
                               FROM payments WHERE deleted_at IS NULL AND status = 'paid'
                                 AND payment_date >= ? AND payment_date <= ?
                               GROUP BY date, method ORDER BY date`).all(range.start, range.end);
      const byMethod = {}; const byDayMap = new Map(); let grandTotal = 0;
      for (const r of rows) {
        byMethod[r.method] = (byMethod[r.method] ?? 0) + r.total;
        const day = byDayMap.get(r.date) ?? { total: 0, count: 0 };
        day.total += r.total; day.count += r.count; byDayMap.set(r.date, day);
        grandTotal += r.total;
      }
      return {
        range,
        total: grandTotal,
        byMethod,
        byDay: Array.from(byDayMap.entries()).map(([date, v]) => ({ date, total: v.total, count: v.count })).sort((a, b) => a.date.localeCompare(b.date))
      };
    },
    outstanding: async () => {
      const total = db.prepare(`SELECT COALESCE(SUM(amount_due - discount_amount - amount_paid), 0) as total FROM invoices WHERE deleted_at IS NULL`).get().total;
      const byClass = db.prepare(`SELECT s.class_id as classId, COALESCE(c.name, 'Unassigned') as className,
                                          SUM(i.amount_due - i.discount_amount - i.amount_paid) as outstanding,
                                          COUNT(DISTINCT s.id) as studentCount
                                   FROM invoices i JOIN students s ON s.id = i.student_id
                                   LEFT JOIN classes c ON c.id = s.class_id
                                   WHERE i.deleted_at IS NULL AND s.deleted_at IS NULL
                                   GROUP BY s.class_id HAVING outstanding > 0 ORDER BY outstanding DESC`).all();
      return { totalOutstanding: total, byClass };
    },
    student: async (id) => {
      const payments = db.prepare('SELECT * FROM payments WHERE student_id = ? AND deleted_at IS NULL').all(id);
      const invoices = db.prepare('SELECT * FROM invoices WHERE student_id = ? AND deleted_at IS NULL').all(id);
      return {
        studentId: id,
        totalPaid: payments.reduce((s, p) => s + p.amount, 0),
        totalInvoiced: invoices.reduce((s, i) => s + (i.amount_due - i.discount_amount), 0),
        outstanding: 0,
        paymentCount: payments.length,
        attendanceRate: 95,
        recentPayments: payments.slice(0, 10).map(p => ({ date: p.payment_date, amount: p.amount, receiptNumber: p.receipt_number, method: p.payment_method }))
      };
    },
    export: async () => ({ path: '/tmp/export.xlsx' })
  },
  audit: {
    list: async (q = {}) => db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(q.limit || 100).map(mapAudit),
    get: async (id) => mapAudit(db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id))
  },
  system: {
    info: async () => ({ version: '1.0.0', platform: 'linux', electron: '32.0.0', node: '24.0.0', timestamp: new Date().toISOString() }),
    backup: async () => ({ path: '/tmp/backup.db' })
  },
  fs: {
    upload: async () => ({ path: '/tmp/upload', size: 0, mime: 'application/octet-stream' })
  },
  onMenuCommand: () => () => {},
  channels: {}
};

// ── Row mappers ──────────────────────────────────────────────────────
function mapStudent(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    studentCode: r.student_code,
    firstName: r.first_name,
    lastName: r.last_name,
    middleName: r.middle_name ?? undefined,
    fullName: r.full_name,
    photoPath: r.photo_path ?? undefined,
    dateOfBirth: r.date_of_birth,
    gender: r.gender,
    parentIds: JSON.parse(r.parent_ids_json || '[]'),
    primaryParentId: r.primary_parent_id ?? undefined,
    phoneNumbers: JSON.parse(r.phone_numbers_json || '[]'),
    address: JSON.parse(r.address_json || '{}'),
    emergencyContacts: JSON.parse(r.emergency_contacts_json || '[]'),
    registeredAt: r.registered_at,
    status: r.status,
    classId: r.class_id ?? undefined,
    academicYearId: r.academic_year_id ?? undefined,
    notes: r.notes ?? undefined,
    documents: [],
    metadata: JSON.parse(r.metadata_json || '{}'),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
function mapParent(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    firstName: r.first_name,
    lastName: r.last_name,
    fullName: r.full_name,
    phone: r.phone,
    altPhone: r.alt_phone ?? undefined,
    email: r.email ?? undefined,
    occupation: r.occupation ?? undefined,
    relationship: r.relationship,
    address: r.address_json ? JSON.parse(r.address_json) : undefined,
    notes: r.notes ?? undefined,
    studentIds: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
function mapPayment(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    receiptNumber: r.receipt_number,
    studentId: r.student_id,
    parentIds: JSON.parse(r.parent_ids_json || '[]'),
    invoiceIds: JSON.parse(r.invoice_ids_json || '[]'),
    amount: r.amount,
    paymentDate: r.payment_date,
    paymentMethod: r.payment_method,
    reference: r.reference ?? undefined,
    receivedByEmployeeId: r.received_by_employee_id ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status,
    attachments: JSON.parse(r.attachments_json || '[]'),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
function mapInvoice(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    invoiceNumber: r.invoice_number,
    studentId: r.student_id,
    academicYearId: r.academic_year_id ?? undefined,
    termId: r.term_id ?? undefined,
    type: r.type,
    description: r.description,
    amountDue: r.amount_due,
    discountAmount: r.discount_amount,
    amountPaid: r.amount_paid,
    status: r.status,
    dueDate: r.due_date ?? undefined,
    issuedAt: r.issued_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
function mapClass(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    grade: r.grade, section: r.section, name: r.name,
    classroom: r.classroom ?? undefined, capacity: r.capacity,
    homeroomTeacherId: r.homeroom_teacher_id ?? undefined,
    academicYearId: r.academic_year_id ?? undefined,
    enrolledCount: r.enrolled_count,
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function mapEmployee(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    employeeCode: r.employee_code,
    firstName: r.first_name, lastName: r.last_name, fullName: r.full_name,
    email: r.email ?? undefined, phone: r.phone ?? undefined,
    role: r.role, title: r.title ?? undefined,
    classIds: JSON.parse(r.class_ids_json || '[]'),
    salary: r.salary ?? undefined,
    hiredAt: r.hired_at, leftAt: r.left_at ?? undefined,
    isActive: !!r.is_active,
    permissions: JSON.parse(r.permissions_json || '[]'),
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function mapYear(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    name: r.name, startDate: r.start_date, endDate: r.end_date,
    termType: r.term_type, isActive: !!r.is_active,
    terms: [], createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function mapTemplate(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    name: r.name, description: r.description ?? undefined,
    gradeLevel: r.grade_level, items: JSON.parse(r.items_json || '[]'),
    isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function mapScholarship(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    studentId: r.student_id, type: r.type, percentage: r.percentage,
    reason: r.reason, grantedByEmployeeId: r.granted_by_employee_id,
    grantedAt: r.granted_at, validFrom: r.valid_from, validUntil: r.valid_until ?? undefined,
    revokedAt: r.revoked_at ?? undefined, revokedReason: r.revoked_reason ?? undefined,
    isActive: !!r.is_active
  };
}
function mapNotification(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    recipientId: r.recipient_id ?? undefined,
    recipientType: r.recipient_type,
    channel: r.channel, category: r.category, priority: r.priority,
    subject: r.subject, body: r.body ?? undefined,
    payload: r.payload_json ? JSON.parse(r.payload_json) : undefined,
    status: r.status,
    scheduledFor: r.scheduled_for ?? undefined,
    sentAt: r.sent_at ?? undefined,
    deliveredAt: r.delivered_at ?? undefined,
    readAt: r.read_at ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function mapAudit(r) {
  if (!r) return null;
  return {
    id: { value: r.id },
    timestamp: r.timestamp,
    actorId: r.actor_id, actorName: r.actor_name,
    action: r.action, entityType: r.entity_type, entityId: r.entity_id,
    before: r.before_json ? JSON.parse(r.before_json) : undefined,
    after: r.after_json ? JSON.parse(r.after_json) : undefined,
    ipAddress: r.ip_address ?? undefined,
    userAgent: r.user_agent ?? undefined,
    correlationId: r.correlation_id ?? undefined,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined
  };
}

// ── Static HTTP server ───────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  // Handle API endpoint
  if (req.url === '/__api__') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { method, args } = JSON.parse(body);
        const [ns, fn] = method.split('.');
        const impl = api[ns]?.[fn];
        if (!impl) throw new Error(`Unknown method: ${method}`);
        const data = await impl(...(args || []));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static file serving
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.join(RENDERER_DIR, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// ── Routes to screenshot ─────────────────────────────────────────────
const ROUTES = [
  { name: '01-dashboard', path: '#/dashboard', wait: '.el-page', desc: 'Main dashboard with KPIs and charts' },
  { name: '02-students', path: '#/students', wait: '.el-datagrid', desc: 'Student list with DataGrid' },
  { name: '03-student-profile', path: '#/students', wait: '.el-datagrid', desc: 'Student financial profile',
    pre: async (page) => {
      // Click first student row
      await page.waitForSelector('.el-datagrid__table tbody tr', { timeout: 5000 });
      await page.click('.el-datagrid__table tbody tr:first-child');
      await page.waitForSelector('.el-stat__value', { timeout: 5000 });
    } },
  { name: '04-payments', path: '#/payments', wait: '.el-datagrid', desc: 'Payments list' },
  { name: '05-payments-new-modal', path: '#/payments', wait: '.el-datagrid', desc: 'Record Payment modal',
    pre: async (page) => {
      await page.waitForTimeout(800);
      const btn = await page.$('button.el-btn--primary');
      if (btn) await btn.click();
      await page.waitForSelector('.el-modal', { timeout: 3000 });
    } },
  { name: '06-debt-dashboard', path: '#/debt', wait: '.el-stat__value', desc: 'Debt dashboard' },
  { name: '07-classes', path: '#/classes', wait: '.el-datagrid', desc: 'Classes list' },
  { name: '08-parents', path: '#/parents', wait: '.el-datagrid', desc: 'Parents list' },
  { name: '09-employees', path: '#/employees', wait: '.el-datagrid', desc: 'Employees list' },
  { name: '10-attendance', path: '#/attendance', wait: '.el-page', desc: 'Attendance page' },
  { name: '11-academic-years', path: '#/academic-years', wait: '.el-datagrid', desc: 'Academic years' },
  { name: '12-fee-templates', path: '#/fee-templates', wait: '.el-page', desc: 'Fee templates' },
  { name: '13-scholarships', path: '#/scholarships', wait: '.el-datagrid', desc: 'Scholarships' },
  { name: '14-reports', path: '#/reports', wait: '.el-page', desc: 'Reports with charts' },
  { name: '15-receipts', path: '#/receipts', wait: '.el-datagrid', desc: 'Receipts list' },
  { name: '16-audit-logs', path: '#/audit', wait: '.el-timeline', desc: 'Audit logs timeline' },
  { name: '17-notifications', path: '#/notifications', wait: '.el-page', desc: 'Notification center' },
  { name: '18-settings', path: '#/settings', wait: '.el-page', desc: 'Settings page' },
  { name: '19-workflows', path: '#/workflows', wait: '.el-page', desc: 'Workflows list' },
  { name: '20-command-palette', path: '#/dashboard', wait: '.el-page', desc: 'Command Palette (Cmd+K)',
    pre: async (page) => {
      await page.waitForTimeout(500);
      await page.keyboard.press('Control+k');
      await page.waitForSelector('.el-command-palette', { timeout: 3000 });
    } },
  { name: '21-global-search', path: '#/dashboard', wait: '.el-page', desc: 'Global Search (Cmd+Shift+F)',
    pre: async (page) => {
      await page.waitForTimeout(500);
      await page.keyboard.press('Control+Shift+F');
      await page.waitForSelector('.el-command-palette', { timeout: 3000 });
      await page.fill('.el-command-palette__input', 'amina');
      await page.waitForTimeout(500);
    } },
  { name: '22-loading-screen', path: '#/dashboard', wait: '.el-page', desc: 'Loading screen with particle logo',
    pre: async (page) => {
      // Trigger reload to show loading screen
      await page.evaluate(() => {
        // Inject a fake loading screen for screenshot purposes
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle at center, #2e3033 0%, #242526 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999';
        overlay.innerHTML = `
          <div style="width:240px;height:240px;border-radius:50%;border:6px solid rgba(52,155,212,0.15);border-top:6px solid #349bd4;animation:spin 0.8s linear infinite;box-shadow:0 0 30px rgba(52,155,212,0.4)"></div>
          <div style="margin-top:24px;font-size:24px;font-weight:700;color:#eff2f3;letter-spacing:-0.5px">El-Imtiyaz</div>
          <div style="margin-top:4px;font-size:13px;color:#8a9499;letter-spacing:1px">School System v1.0.0</div>
          <div style="margin-top:24px;width:320px;height:6px;background:rgba(52,155,212,0.15);border-radius:99px;overflow:hidden">
            <div style="width:75%;height:100%;background:linear-gradient(90deg,#2b7fb0,#349bd4,#6ec1e4);border-radius:99px;box-shadow:0 0 8px rgba(52,155,212,0.6)"></div>
          </div>
          <div style="margin-top:16px;font-family:monospace;font-size:11px;color:#6b7785">Preparing workspace…</div>
        `;
        document.body.appendChild(overlay);
      });
      await page.waitForTimeout(500);
    } }
];

// ── Main ─────────────────────────────────────────────────────────────
(async () => {
  await new Promise(r => server.listen(7654, r));
  console.log('[harness] HTTP server on http://localhost:7654');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    darkMode: undefined
  });

  // Inject the mock API as init script
  await context.addInitScript((apiSrc) => {
    window.__injectElImtiyaz = (impl) => { window.elImtiyaz = impl; };
  });

  const page = await context.newPage();

  // Inject the mock API once the page loads — we set window.elImtiyaz before app boots.
  // The trick: load the page, immediately set window.elImtiyaz before main.tsx runs.
  // We do this by intercepting the navigation and using addInitScript.
  const apiJson = JSON.stringify(api).replace(/</g, '\\u003c');
  // The API has function values — JSON.stringify drops them. We need a different approach:
  // serialize the API as a function-string and eval it.

  // Actually: use addInitScript to define the API in the page context.
  // We pass the DB rows via fetch endpoints instead.
  // Simpler: re-implement the API inside addInitScript by querying endpoints.

  // The cleanest approach: serve /__api__/* endpoints from our HTTP server,
  // and the init script replaces window.elImtiyaz methods with fetch calls.

  await context.addInitScript(() => {
    // Helper to call our backend
    async function call(method, ...args) {
      const res = await fetch('/__api__', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, args })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json.data;
    }

    window.elImtiyaz = {
      students: {
        list: (...a) => call('students.list', ...a),
        get: (...a) => call('students.get', ...a),
        search: (...a) => call('students.search', ...a),
        profile: (...a) => call('students.profile', ...a),
        timeline: (...a) => call('students.timeline', ...a),
        create: () => Promise.reject(new Error('disabled')),
        update: () => Promise.reject(new Error('disabled')),
        delete: () => Promise.reject(new Error('disabled')),
        import: () => Promise.resolve({ imported: 0, failed: 0, errors: [] }),
        export: () => Promise.resolve([])
      },
      parents: {
        list: (...a) => call('parents.list', ...a),
        get: (...a) => call('parents.get', ...a),
        create: () => Promise.reject(new Error('disabled')),
        update: () => Promise.reject(new Error('disabled')),
        delete: () => Promise.reject(new Error('disabled'))
      },
      payments: {
        list: (...a) => call('payments.list', ...a),
        get: (...a) => call('payments.get', ...a),
        byStudent: (...a) => call('payments.byStudent', ...a),
        create: () => Promise.reject(new Error('disabled')),
        update: () => Promise.reject(new Error('disabled')),
        delete: () => Promise.reject(new Error('disabled')),
        bulk: () => Promise.resolve({ updated: 0, failed: 0, errors: [] })
      },
      invoices: {
        list: (...a) => call('invoices.list', ...a),
        get: (...a) => call('invoices.get', ...a),
        create: () => Promise.reject(new Error('disabled')),
        update: () => Promise.reject(new Error('disabled'))
      },
      debt: {
        summary: (...a) => call('debt.summary', ...a),
        students: (...a) => call('debt.students', ...a),
        overdue: (...a) => call('debt.overdue', ...a)
      },
      receipts: { list: (...a) => call('receipts.list', ...a), get: (...a) => call('receipts.get', ...a), generate: () => Promise.reject(new Error('disabled')) },
      classes: {
        list: (...a) => call('classes.list', ...a),
        create: () => Promise.reject(new Error('disabled')),
        update: () => Promise.reject(new Error('disabled')),
        delete: () => Promise.reject(new Error('disabled'))
      },
      attendance: {
        list: () => Promise.resolve([]),
        record: () => Promise.reject(new Error('disabled')),
        report: () => Promise.resolve({ classId: '', fromDate: '', toDate: '', totalRecords: 0, byStatus: { present: 0, absent: 0, excused: 0, late: 0 }, byStudent: [] })
      },
      employees: {
        list: (...a) => call('employees.list', ...a),
        create: () => Promise.reject(new Error('disabled')),
        update: () => Promise.reject(new Error('disabled')),
        delete: () => Promise.reject(new Error('disabled'))
      },
      academicYears: {
        list: (...a) => call('academicYears.list', ...a),
        create: () => Promise.reject(new Error('disabled')),
        update: () => Promise.reject(new Error('disabled')),
        delete: () => Promise.reject(new Error('disabled'))
      },
      feeTemplates: {
        list: (...a) => call('feeTemplates.list', ...a),
        create: () => Promise.reject(new Error('disabled')),
        apply: () => Promise.resolve({ applied: 0, invoicesCreated: 0, failed: 0, errors: [] })
      },
      scholarships: {
        list: (...a) => call('scholarships.list', ...a),
        create: () => Promise.reject(new Error('disabled')),
        revoke: () => Promise.reject(new Error('disabled'))
      },
      workflows: {
        list: () => Promise.resolve([]),
        get: () => Promise.resolve(null),
        create: async () => ({ id: { value: 'wf-mock' }, name: 'New Workflow', description: '', category: 'custom', nodes: [], edges: [], status: 'draft', version: 1, enabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        update: async (id, patch) => ({ id: { value: id }, ...patch, nodes: patch.nodes || [], edges: patch.edges || [], status: 'draft', version: 1, enabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        delete: async () => {},
        publish: async (id) => ({ id: { value: id }, status: 'published', enabled: true }),
        enable: async (id) => ({ id: { value: id }, enabled: true }),
        disable: async (id) => ({ id: { value: id }, enabled: false }),
        run: async () => ({ id: 'exec-mock', workflowId: 'wf-mock', workflowVersion: 1, startedAt: new Date().toISOString(), status: 'success', nodeResults: [] }),
        executions: async () => [],
        nodeRegistry: async () => {
          // Return a minimal node registry so the WorkflowBuilder renders
          return [
            { id: 'trigger.payment.overdue', type: 'trigger', label: 'Payment Overdue', description: 'Fires when payment becomes overdue', icon: 'AlertCircle', category: 'Triggers', inputs: [], outputs: [{ id: 'out', label: 'Invoice', type: 'invoice' }], configSchema: [{ key: 'daysOverdue', label: 'Days overdue', type: 'number', default: 1 }] },
            { id: 'trigger.student.enrolled', type: 'trigger', label: 'Student Enrolled', description: 'Fires on new enrolment', icon: 'UserPlus', category: 'Triggers', inputs: [], outputs: [{ id: 'out', label: 'Student', type: 'student' }], configSchema: [] },
            { id: 'trigger.manual', type: 'trigger', label: 'Manual', description: 'Fires only when run manually', icon: 'Play', category: 'Triggers', inputs: [], outputs: [{ id: 'out', label: 'Run', type: 'any' }], configSchema: [] },
            { id: 'condition.debt.threshold', type: 'condition', label: 'Debt > Threshold', description: 'Branches based on outstanding debt', icon: 'GitBranch', category: 'Conditions', inputs: [{ id: 'in', label: 'Input', type: 'any' }], outputs: [{ id: 'true', label: 'True', type: 'any' }, { id: 'false', label: 'False', type: 'any' }], configSchema: [{ key: 'threshold', label: 'Threshold (DZD)', type: 'number', default: 1000 }] },
            { id: 'action.send.email', type: 'action', label: 'Send Email', description: 'Sends an email notification', icon: 'Mail', category: 'Actions', inputs: [{ id: 'in', label: 'Input', type: 'any' }], outputs: [{ id: 'out', label: 'Output', type: 'any' }], configSchema: [{ key: 'to', label: 'To', type: 'text' }, { key: 'subject', label: 'Subject', type: 'text' }, { key: 'body', label: 'Body', type: 'textarea' }] },
            { id: 'action.send.sms', type: 'action', label: 'Send SMS', description: 'Sends an SMS', icon: 'MessageSquare', category: 'Actions', inputs: [{ id: 'in', label: 'Input', type: 'any' }], outputs: [{ id: 'out', label: 'Output', type: 'any' }], configSchema: [{ key: 'to', label: 'To', type: 'text' }, { key: 'message', label: 'Message', type: 'textarea' }] },
            { id: 'action.apply.discount', type: 'action', label: 'Apply Discount', description: 'Applies a discount', icon: 'Percent', category: 'Actions', inputs: [{ id: 'in', label: 'Input', type: 'any' }], outputs: [{ id: 'out', label: 'Output', type: 'any' }], configSchema: [{ key: 'percentage', label: 'Percentage', type: 'number', default: 10 }] },
            { id: 'delay.duration', type: 'delay', label: 'Wait', description: 'Pauses execution', icon: 'Hourglass', category: 'Delays', inputs: [{ id: 'in', label: 'Input', type: 'any' }], outputs: [{ id: 'out', label: 'Output', type: 'any' }], configSchema: [{ key: 'value', label: 'Duration', type: 'number', default: 30 }] }
          ];
        }
      },
      notifications: {
        list: (...a) => call('notifications.list', ...a),
        get: (...a) => call('notifications.get', ...a),
        create: () => Promise.reject(new Error('disabled')),
        markRead: async (id) => call('notifications.markRead', id),
        markAllRead: async () => call('notifications.markAllRead'),
        delete: async () => {},
        unreadCount: (...a) => call('notifications.unreadCount', ...a)
      },
      reports: {
        revenue: (...a) => call('reports.revenue', ...a),
        outstanding: (...a) => call('reports.outstanding', ...a),
        student: (...a) => call('reports.student', ...a),
        export: async () => Promise.resolve({ path: '/tmp/export.xlsx' })
      },
      audit: {
        list: (...a) => call('audit.list', ...a),
        get: (...a) => call('audit.get', ...a)
      },
      system: {
        info: async () => ({ version: '1.0.0', platform: 'linux', electron: '32.0.0', node: '24.0.0', timestamp: new Date().toISOString() }),
        backup: async () => ({ path: '/tmp/backup.db' })
      },
      fs: { upload: async () => ({ path: '/tmp/upload', size: 0, mime: 'application/octet-stream' }) },
      onMenuCommand: () => () => {},
      channels: {}
    };
  });

  // ── Navigate + screenshot each route ─────────────────────────────
  for (const route of ROUTES) {
    try {
      console.log(`[harness] Capturing ${route.name} (${route.desc})…`);
      await page.goto(`http://localhost:7654/${route.path}`, { waitUntil: 'networkidle' });

      // Wait for the app to boot past the loading screen
      await page.waitForSelector('.el-page, .el-sidebar', { timeout: 10000 });
      await page.waitForTimeout(1500);  // extra time for data to load + charts to render

      // Run pre-screenshot interaction (modal open, click row, etc.)
      if (route.pre) {
        await route.pre(page);
        await page.waitForTimeout(800);
      }

      await page.screenshot({
        path: path.join(SHOTS_DIR, `${route.name}.png`),
        fullPage: false
      });
      console.log(`[harness]    ${route.name}.png`);
    } catch (err) {
      console.error(`[harness]    ${route.name}: ${err.message}`);
      // Still try to take a screenshot to capture the error state
      try {
        await page.screenshot({ path: path.join(SHOTS_DIR, `${route.name}-error.png`) });
      } catch {}
    }
  }

  await browser.close();
  server.close();
  console.log(`[harness] Done. Screenshots in ${SHOTS_DIR}`);
})().catch(err => {
  console.error('[harness] FATAL:', err);
  process.exit(1);
});
