/**
 * Seed script — populates the database with realistic dummy data so the app
 * is usable immediately for demos and screenshots.
 *
 * Run with:  node dist-main/scripts/seed.js
 *
 * Creates:
 *   - 1 academic year (2025-2026) with auto-generated terms
 *   - 4 classes (Grade 1A, Grade 2A, Grade 3A, Kindergarten A)
 *   - 8 parents (Algerian names)
 *   - 24 students across the classes (mixed genders, statuses, ages)
 *   - 3 employees (admin, accountant, teacher)
 *   - 60+ invoices (registration + monthly tuition + transport)
 *   - 40+ payments (mix of paid/partial/missing months)
 *   - 1 fee template (Kindergarten plan)
 *   - 2 scholarships
 *   - Audit log entries for every creation
 *
 * Idempotent: if data exists, it adds a fresh batch and reports counts.
 */

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

// Use the user-data directory just like the main app does
// NOTE: We avoid importing 'electron' here because this script runs in plain Node.

// We can't use `app.getPath` from a plain script — fall back to a local dev folder
const DATA_DIR = process.env.EL_IMTIYAZ_DATA_DIR
  || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.el-imtiyaz-dev');
const DB_FILE = path.join(DATA_DIR, 'el-imtiyaz.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log(`[seed] Using database at: ${DB_FILE}`);

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Run migrations inline (same SQL as in src/infrastructure/database/migrations) ──
const { DatabaseClient } = require('../infrastructure/database/sqlite-client');
const { MigrationsRunner } = require('../infrastructure/database/migrations/migrations-runner');
const { migrations } = require('../infrastructure/database/migrations/migrations');

const client = new DatabaseClient({ filePath: DB_FILE });
(async () => {
  await client.open();
  const runner = new MigrationsRunner(client);
  await runner.runAll(migrations);
  console.log('[seed] Migrations applied');
  await seed();
  await client.close();
})().catch(err => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});

const ALGERIAN_FIRST_NAMES_M = ['Yacine', 'Amine', 'Karim', 'Riad', 'Sofiane', 'Bilal', 'Nabil', 'Walid', 'Mehdi', 'Anis'];
const ALGERIAN_FIRST_NAMES_F = ['Amina', 'Yasmine', 'Lina', 'Sarah', 'Imene', 'Nour', 'Sara', 'Manel', 'Rania', 'Wassila'];
const ALGERIAN_LAST_NAMES = ['Benali', 'Haddad', 'Khelifi', 'Boumediene', 'Zerrouki', 'Cherif', 'Belkacem', 'Mansouri', 'Saadi', 'Bouchama', 'Ferhat', 'Larbi', 'Soltani', 'Toumi'];
const CITIES = ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Setif', 'Batna'];

function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDate(startYear: number, endYear: number): string {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start)).toISOString().slice(0, 10);
}
function randomPhone(): string {
  return `+213 5${randomInt(10, 99)} ${randomInt(100, 999)} ${randomInt(100, 999)}`;
}

async function seed() {
  const now = new Date().toISOString();

  // ── Academic year ────────────────────────────────────────────
  let yearId = db.prepare('SELECT id FROM academic_years WHERE name = ?').get('2025-2026')?.id;
  if (!yearId) {
    yearId = uuidv4();
    db.prepare(`INSERT INTO academic_years (id, name, start_date, end_date, term_type, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
      .run(yearId, '2025-2026', '2025-09-01', '2026-06-30', 'semester', now, now);
    console.log('[seed] Created academic year 2025-2026');
  }

  // Generate terms
  const terms = [
    { name: 'Semester 1', start: '2025-09-01', end: '2026-01-31', order: 1 },
    { name: 'Semester 2', start: '2026-02-01', end: '2026-06-30', order: 2 }
  ];
  for (const t of terms) {
    const exists = db.prepare('SELECT id FROM academic_terms WHERE academic_year_id = ? AND name = ?').get(yearId, t.name);
    if (!exists) {
      const termId = uuidv4();
      db.prepare(`INSERT INTO academic_terms (id, academic_year_id, name, type, start_date, end_date, term_order)
                  VALUES (?, ?, ?, 'semester', ?, ?, ?)`)
        .run(termId, yearId, t.name, t.start, t.end, t.order);
    }
  }

  // ── Employees ────────────────────────────────────────────────
  const employees = [
    { id: uuidv4(), code: 'EMP-2025-0001', firstName: 'Mohamed', lastName: 'Bensalem', role: 'super_admin', title: 'Director' },
    { id: uuidv4(), code: 'EMP-2025-0002', firstName: 'Fatima', lastName: 'Zohra', role: 'accountant', title: 'Senior Accountant' },
    { id: uuidv4(), code: 'EMP-2025-0003', firstName: 'Ahmed', lastName: 'Belhadj', role: 'teacher', title: 'Math Teacher' }
  ];
  for (const e of employees) {
    const exists = db.prepare('SELECT id FROM employees WHERE employee_code = ?').get(e.code);
    if (!exists) {
      db.prepare(`INSERT INTO employees (id, employee_code, first_name, last_name, full_name, email, phone, role, title, hired_at, is_active, permissions_json, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '[]', ?, ?)`)
        .run(e.id, e.code, e.firstName, e.lastName, `${e.firstName} ${e.lastName}`,
          `${e.firstName.toLowerCase()}@el-imtiyaz.dz`, randomPhone(), e.role, e.title, '2024-09-01', now, now);
    }
  }
  console.log(`[seed] Employees: ${employees.length}`);
  const accountantId = db.prepare("SELECT id FROM employees WHERE role = 'accountant' LIMIT 1").get().id;

  // ── Classes ──────────────────────────────────────────────────
  const classes = [
    { id: uuidv4(), grade: 'Kindergarten', section: 'A', capacity: 25 },
    { id: uuidv4(), grade: 'Grade 1', section: 'A', capacity: 30 },
    { id: uuidv4(), grade: 'Grade 2', section: 'A', capacity: 30 },
    { id: uuidv4(), grade: 'Grade 3', section: 'A', capacity: 28 }
  ];
  for (const c of classes) {
    const exists = db.prepare('SELECT id FROM classes WHERE grade = ? AND section = ?').get(c.grade, c.section);
    if (!exists) {
      db.prepare(`INSERT INTO classes (id, grade, section, name, capacity, enrolled_count, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, 0, ?, ?)`)
        .run(c.id, c.grade, c.section, `${c.grade} ${c.section}`, c.capacity, now, now);
    }
  }
  console.log(`[seed] Classes: ${classes.length}`);

  // ── Parents ──────────────────────────────────────────────────
  const parentIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const firstName = randomChoice(['Mohamed', 'Ahmed', 'Karim', 'Riad', 'Abdelkader', 'Said', 'Hocine', 'Rachid', 'Toufik', 'Samir']);
    const lastName = randomChoice(ALGERIAN_LAST_NAMES);
    const id = uuidv4();
    const exists = db.prepare('SELECT id FROM parents WHERE first_name = ? AND last_name = ? AND phone = ?')
      .get(firstName, lastName, `+213 5${50 + i} 100 200`);
    if (!exists) {
      db.prepare(`INSERT INTO parents (id, first_name, last_name, full_name, phone, alt_phone, email, occupation, relationship, address_json, notes, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, firstName, lastName, `${firstName} ${lastName}`,
          `+213 5${50 + i} 100 200`, `+213 7${50 + i} 200 300`,
          `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
          randomChoice(['Engineer', 'Teacher', 'Doctor', 'Merchant', 'Civil Servant', 'Driver']),
          i % 3 === 0 ? 'mother' : 'father',
          JSON.stringify({ line1: `${randomInt(1, 99)} Rue des Frères`, city: randomChoice(CITIES), country: 'Algeria' }),
          null, now, now);
      parentIds.push(id);
    } else {
      parentIds.push(exists.id);
    }
  }
  console.log(`[seed] Parents: ${parentIds.length}`);

  // ── Students ─────────────────────────────────────────────────
  const studentIds: string[] = [];
  const studentNames: Array<{ id: string; fullName: string }> = [];
  for (let i = 0; i < 24; i++) {
    const isMale = Math.random() < 0.55;
    const firstName = isMale ? randomChoice(ALGERIAN_FIRST_NAMES_M) : randomChoice(ALGERIAN_FIRST_NAMES_F);
    const lastName = randomChoice(ALGERIAN_LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const id = uuidv4();
    const studentCode = `STU-2025-${String(i + 1).padStart(4, '0')}`;
    const exists = db.prepare('SELECT id FROM students WHERE student_code = ?').get(studentCode);
    if (!exists) {
      const cls = classes[i % classes.length];
      db.prepare(`INSERT INTO students (
                    id, student_code, first_name, last_name, full_name, date_of_birth, gender,
                    parent_ids_json, primary_parent_id, phone_numbers_json, address_json,
                    emergency_contacts_json, registered_at, status, class_id, academic_year_id,
                    metadata_json, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`)
        .run(
          id, studentCode, firstName, lastName, fullName,
          randomDate(2015, 2020), isMale ? 'male' : 'female',
          JSON.stringify([parentIds[i % parentIds.length]]), parentIds[i % parentIds.length],
          JSON.stringify([randomPhone()]),
          JSON.stringify({ line1: `${randomInt(1, 99)} Rue ${randomChoice(['des Martyrs', 'de la Liberté', 'de l\'Indépendance', 'Hassiba Ben Bouali'])}`, city: randomChoice(CITIES), country: 'Algeria' }),
          JSON.stringify([{ name: `${firstName}'s Aunt`, relationship: 'aunt', phone: randomPhone() }]),
          randomDate(2024, 2025),
          i % 7 === 0 ? 'suspended' : i % 11 === 0 ? 'pending' : 'active',
          cls.id, yearId, now, now
        );
      // Bump class enrollment
      db.prepare('UPDATE classes SET enrolled_count = enrolled_count + 1 WHERE id = ?').run(cls.id);
      studentIds.push(id);
      studentNames.push({ id, fullName });
    } else {
      studentIds.push(exists.id);
      studentNames.push({ id: exists.id, fullName });
    }
  }
  console.log(`[seed] Students: ${studentIds.length}`);

  // ── Fee template ─────────────────────────────────────────────
  const templateId = uuidv4();
  const templateExists = db.prepare('SELECT id FROM fee_templates WHERE name = ?').get('Standard Monthly Plan');
  if (!templateExists) {
    db.prepare(`INSERT INTO fee_templates (id, name, description, grade_level, items_json, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
      .run(templateId, 'Standard Monthly Plan', 'Default plan for primary grades',
        'Grade 1',
        JSON.stringify([
          { type: 'registration', label: 'Registration', amount: 5000, recurrence: 'one_time' },
          { type: 'monthly_tuition', label: 'Monthly Tuition', amount: 8000, recurrence: 'monthly' },
          { type: 'transportation', label: 'Transportation', amount: 3000, recurrence: 'monthly' }
        ]),
        now, now);
  }

  // ── Invoices ─────────────────────────────────────────────────
  const monthLabels = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
  let invoiceCount = 0;
  for (const s of studentIds) {
    // Registration invoice
    const regInv = uuidv4();
    db.prepare(`INSERT INTO invoices (id, invoice_number, student_id, academic_year_id, type, description, amount_due, discount_amount, amount_paid, status, due_date, issued_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'registration', 'Registration Fee 2025-2026', 5000, 0, 0, 'paid', '2025-09-15', '2025-09-01', ?, ?)`)
      .run(regInv, `INV-2025-${String(invoiceCount + 1).padStart(5, '0')}`, s, yearId, now, now);
    invoiceCount++;

    // 6 months of tuition invoices
    for (let m = 0; m < monthLabels.length; m++) {
      const month = monthLabels[m];
      // 75% chance the month is paid, 15% partial, 10% missing
      const r = Math.random();
      const amountPaid = r < 0.75 ? 8000 : r < 0.9 ? randomInt(3000, 7000) : 0;
      const status = amountPaid === 0 ? (month < '2026-01' ? 'overdue' : 'pending') : amountPaid >= 8000 ? 'paid' : 'partial';
      const inv = uuidv4();
      db.prepare(`INSERT INTO invoices (id, invoice_number, student_id, academic_year_id, type, description, amount_due, discount_amount, amount_paid, status, due_date, issued_at, created_at, updated_at)
                  VALUES (?, ?, ?, ?, 'monthly_tuition', ?, 8000, 0, ?, ?, ?, ?, ?, ?)`)
        .run(inv, `INV-2025-${String(invoiceCount + 1).padStart(5, '0')}`, s, yearId,
          `Monthly Tuition — ${month}`,
          amountPaid, status,
          `${month}-10`, `${month}-01`, now, now);
      invoiceCount++;
    }
  }
  console.log(`[seed] Invoices: ${invoiceCount}`);

  // ── Payments ─────────────────────────────────────────────────
  let paymentCount = 0;
  const methods = ['cash', 'bank_transfer', 'cheque', 'baridimob'];
  for (const s of studentIds) {
    // 4-5 payments per student, spread over the months
    const numPayments = randomInt(4, 6);
    for (let p = 0; p < numPayments; p++) {
      const amount = randomChoice([3000, 5000, 8000, 8000, 8000, 11000]);
      const month = monthLabels[Math.min(p, monthLabels.length - 1)];
      const payId = uuidv4();
      const receiptNumber = `RCP-2025-${String(paymentCount + 1).padStart(5, '0')}`;
      db.prepare(`INSERT INTO payments (id, receipt_number, student_id, parent_ids_json, invoice_ids_json, amount, payment_date, payment_method, reference, received_by_employee_id, notes, status, attachments_json, created_at, updated_at)
                  VALUES (?, ?, ?, '[]', '[]', ?, ?, ?, ?, ?, null, 'paid', '[]', ?, ?)`)
        .run(payId, receiptNumber, s, amount,
          `${month}-${String(randomInt(5, 28)).padStart(2, '0')}`,
          randomChoice(methods),
          Math.random() < 0.3 ? `REF-${randomInt(1000, 9999)}` : null,
          accountantId, now, now);
      paymentCount++;
    }
  }
  console.log(`[seed] Payments: ${paymentCount}`);

  // ── Scholarships ─────────────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    const sId = studentIds[i * 5];
    const exists = db.prepare('SELECT id FROM scholarships WHERE student_id = ?').get(sId);
    if (!exists) {
      db.prepare(`INSERT INTO scholarships (id, student_id, type, percentage, reason, granted_by_employee_id, granted_at, valid_from, is_active)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`)
        .run(uuidv4(), sId, i === 0 ? 'scholarship_full' : 'scholarship_partial',
          i === 0 ? 100 : 50,
          i === 0 ? 'Merit-based full scholarship' : 'Need-based partial scholarship',
          accountantId, now, '2025-09-01');
    }
  }
  console.log('[seed] Scholarships: 2');

  // ── Notifications ────────────────────────────────────────────
  const notifSubjects = [
    { subject: 'Overdue payment detected', body: 'A payment of 8,000.00 DZD is now overdue for student registration. Please follow up.', priority: 'high', category: 'payment' },
    { subject: 'New student enrolled', body: 'A new student has been registered in Grade 1 A. Please review their file.', priority: 'normal', category: 'student' },
    { subject: 'Monthly report ready', body: 'The financial report for the current month is ready for review.', priority: 'normal', category: 'system' },
    { subject: 'Scholarship granted', body: 'A 100% scholarship was granted to a student. Please update billing records.', priority: 'normal', category: 'student' },
    { subject: 'Backup completed', body: 'Database backup was created successfully.', priority: 'low', category: 'system' },
    { subject: 'Attendance recorded', body: 'Attendance was recorded for Grade 2 A today. 2 absences noted.', priority: 'normal', category: 'attendance' }
  ];
  for (const n of notifSubjects) {
    db.prepare(`INSERT INTO notifications (id, recipient_type, channel, category, priority, subject, body, status, created_at, updated_at)
                VALUES (?, 'employee', 'in_app', ?, ?, ?, ?, 'sent', ?, ?)`)
      .run(uuidv4(), n.category, n.priority, n.subject, n.body, now, now);
  }
  console.log(`[seed] Notifications: ${notifSubjects.length}`);

  // ── Audit log entries ────────────────────────────────────────
  const auditActions = [
    { action: 'student.created', entityType: 'Student', entityId: studentIds[0] },
    { action: 'payment.recorded', entityType: 'Payment', entityId: studentIds[0] },
    { action: 'invoice.created', entityType: 'Invoice', entityId: studentIds[0] },
    { action: 'scholarship.granted', entityType: 'Scholarship', entityId: studentIds[0] },
    { action: 'academic_year.activated', entityType: 'AcademicYear', entityId: yearId },
    { action: 'class.created', entityType: 'Class', entityId: classes[0].id }
  ];
  for (let i = 0; i < auditActions.length; i++) {
    const a = auditActions[i];
    db.prepare(`INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, action, entity_type, entity_id, before_json, after_json, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), new Date(Date.now() - i * 60000).toISOString(),
        accountantId, 'Fatima Zohra', a.action, a.entityType, a.entityId,
        null, JSON.stringify({ note: 'seed data' }), null);
  }
  console.log(`[seed] Audit logs: ${auditActions.length}`);

  console.log('\n[seed]  Done. Database is ready.');
  console.log(`[seed] DB path: ${DB_FILE}`);
}
