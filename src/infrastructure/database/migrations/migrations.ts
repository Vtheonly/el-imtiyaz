/**
 * Migration definitions — applied in order at app startup.
 *
 * Each migration is a pure SQL string. The runner tracks applied
 * migrations in a `_migrations` table and only runs pending ones.
 *
 * Rules for new migrations:
 *   1. Never edit an applied migration — add a new one.
 *   2. Always include `IF NOT EXISTS` on table creation.
 *   3. Wrap breaking changes in a transaction-safe pattern.
 */

export interface Migration {
  id: string;
  description: string;
  up: string;
}

export const migrations: Migration[] = [
  {
    id: '001_initial_schema',
    description: 'Core tables for students, parents, employees, classes, academic years',
    up: `
      -- ── Academic Years & Terms ─────────────────────────────
      CREATE TABLE IF NOT EXISTS academic_years (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        term_type TEXT NOT NULL DEFAULT 'semester',
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS academic_terms (
        id TEXT PRIMARY KEY,
        academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        term_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS academic_months (
        id TEXT PRIMARY KEY,
        term_id TEXT NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL
      );

      -- ── Parents ────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS parents (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        alt_phone TEXT,
        email TEXT,
        occupation TEXT,
        relationship TEXT NOT NULL DEFAULT 'guardian',
        address_json TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_parents_phone ON parents(phone);
      CREATE INDEX IF NOT EXISTS idx_parents_full_name ON parents(full_name);

      -- ── Students ───────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        student_code TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        middle_name TEXT,
        full_name TEXT NOT NULL,
        photo_path TEXT,
        date_of_birth TEXT NOT NULL,
        place_of_birth TEXT,
        gender TEXT NOT NULL DEFAULT 'unspecified',
        parent_ids_json TEXT NOT NULL DEFAULT '[]',
        primary_parent_id TEXT,
        phone_numbers_json TEXT NOT NULL DEFAULT '[]',
        address_json TEXT NOT NULL,
        emergency_contacts_json TEXT NOT NULL DEFAULT '[]',
        registered_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'pending',
        class_id TEXT,
        academic_year_id TEXT REFERENCES academic_years(id),
        notes TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
      CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);
      CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
      CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

      CREATE TABLE IF NOT EXISTS student_documents (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- ── Classes ────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        grade TEXT NOT NULL,
        section TEXT NOT NULL,
        name TEXT NOT NULL,
        classroom TEXT,
        capacity INTEGER NOT NULL DEFAULT 30,
        homeroom_teacher_id TEXT,
        academic_year_id TEXT REFERENCES academic_years(id),
        enrolled_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade);

      -- ── Employees ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        employee_code TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'viewer',
        title TEXT,
        class_ids_json TEXT NOT NULL DEFAULT '[]',
        salary REAL,
        hired_at TEXT NOT NULL DEFAULT (datetime('now')),
        left_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        permissions_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
    `
  },
  {
    id: '002_payments_invoices_receipts',
    description: 'Payment system: invoices, payments, receipts',
    up: `
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        academic_year_id TEXT REFERENCES academic_years(id),
        term_id TEXT REFERENCES academic_terms(id),
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_due REAL NOT NULL,
        discount_amount REAL NOT NULL DEFAULT 0,
        amount_paid REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        due_date TEXT,
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type);
      CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        receipt_number TEXT NOT NULL UNIQUE,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        parent_ids_json TEXT NOT NULL DEFAULT '[]',
        invoice_ids_json TEXT NOT NULL DEFAULT '[]',
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        reference TEXT,
        received_by_employee_id TEXT REFERENCES employees(id),
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'paid',
        attachments_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
      CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

      CREATE TABLE IF NOT EXISTS payment_invoice_links (
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        amount_applied REAL NOT NULL,
        PRIMARY KEY (payment_id, invoice_id)
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receipt_number TEXT NOT NULL UNIQUE,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES students(id),
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        generated_at TEXT NOT NULL DEFAULT (datetime('now')),
        generated_by_employee_id TEXT REFERENCES employees(id),
        pdf_path TEXT NOT NULL,
        qr_payload TEXT NOT NULL,
        voided_at TEXT,
        voided_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_student ON receipts(student_id);
    `
  },
  {
    id: '003_audit_attendance_templates',
    description: 'Audit log, attendance, fee templates, scholarships',
    up: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        actor_id TEXT,
        actor_name TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        ip_address TEXT,
        user_agent TEXT,
        correlation_id TEXT,
        metadata_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'present',
        arrived_at TEXT,
        left_early_at TEXT,
        notes TEXT,
        recorded_by_employee_id TEXT REFERENCES employees(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(student_id, class_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);

      CREATE TABLE IF NOT EXISTS fee_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        grade_level TEXT NOT NULL,
        items_json TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS scholarships (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        percentage REAL NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        granted_by_employee_id TEXT REFERENCES employees(id),
        granted_at TEXT NOT NULL DEFAULT (datetime('now')),
        valid_from TEXT NOT NULL,
        valid_until TEXT,
        revoked_at TEXT,
        revoked_reason TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_scholarships_student ON scholarships(student_id);

      -- ── Migration tracking ─────────────────────────────────
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `
  },
  {
    id: '004_workflows_notifications',
    description: 'Drag-and-drop workflow builder + notification center',
    up: `
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'custom',
        nodes_json TEXT NOT NULL DEFAULT '[]',
        edges_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        enabled INTEGER NOT NULL DEFAULT 0,
        last_run_at TEXT,
        last_run_status TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
      CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);

      CREATE TABLE IF NOT EXISTS workflow_executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        workflow_version INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        trigger_payload_json TEXT,
        node_results_json TEXT NOT NULL DEFAULT '[]',
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_exec_workflow ON workflow_executions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_exec_status ON workflow_executions(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_exec_started ON workflow_executions(started_at);

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipient_id TEXT,
        recipient_type TEXT NOT NULL DEFAULT 'employee',
        channel TEXT NOT NULL DEFAULT 'in_app',
        category TEXT NOT NULL DEFAULT 'system',
        priority TEXT NOT NULL DEFAULT 'normal',
        subject TEXT NOT NULL,
        body TEXT,
        payload_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        scheduled_for TEXT,
        sent_at TEXT,
        delivered_at TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_type);
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
      CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
      CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);
    `
  },
  {
    id: '005_excel_ledger_migration',
    description: 'Excel-migration tables: ledger_entries, quote_blocks, fee_schedules, formula_rules, payment_audit_comments, spreadsheet_templates',
    up: `
      -- ── Ledger Entries ───────────────────────────────────
      -- Mirrors one row of the Excel "ETAT 20262027" sheet.
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
        academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
        source_row INTEGER,

        -- Identity / descriptive (Excel cols B-I)
        infos TEXT,
        email TEXT,
        phone_numbers TEXT,
        tutor_name TEXT,
        student_name TEXT NOT NULL,
        level TEXT,
        class_code TEXT,
        option_code TEXT,

        -- Discount / quote inputs (Excel cols J-K)
        remise REAL NOT NULL DEFAULT 0,
        justification TEXT,

        -- Computed values (Excel cols L, P, Q)
        devis_annuel REAL NOT NULL DEFAULT 0,
        total_versements REAL NOT NULL DEFAULT 0,
        total_creance REAL NOT NULL DEFAULT 0,

        -- Debt carry-over (Excel cols M-O)
        reimbursement REAL NOT NULL DEFAULT 0,
        prior_debt REAL NOT NULL DEFAULT 0,
        debt_settlement REAL NOT NULL DEFAULT 0,

        -- Payment installments (Excel cols R-Y)
        fi REAL NOT NULL DEFAULT 0,
        v2 REAL NOT NULL DEFAULT 0,
        alt_v2 REAL NOT NULL DEFAULT 0,
        v3 REAL NOT NULL DEFAULT 0,
        destination TEXT,
        t1 REAL NOT NULL DEFAULT 0,
        t2 REAL NOT NULL DEFAULT 0,
        t3 REAL NOT NULL DEFAULT 0,

        -- Extras (Excel cols Z-AE)
        psy1 REAL NOT NULL DEFAULT 0,
        psy2 REAL NOT NULL DEFAULT 0,
        orth1 REAL NOT NULL DEFAULT 0,
        orth2 REAL NOT NULL DEFAULT 0,
        e_plant REAL NOT NULL DEFAULT 0,
        ratrapage REAL NOT NULL DEFAULT 0,

        -- Quarterly tracking (Excel cols AF-AK)
        september REAL NOT NULL DEFAULT 0,
        september_balance REAL,
        december REAL NOT NULL DEFAULT 0,
        december_balance REAL,
        march REAL NOT NULL DEFAULT 0,
        march_balance REAL,

        -- Grand total (Excel col AL)
        grand_total REAL NOT NULL DEFAULT 0,

        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_student ON ledger_entries(student_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_academic_year ON ledger_entries(academic_year_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_class ON ledger_entries(class_code);
      CREATE INDEX IF NOT EXISTS idx_ledger_level ON ledger_entries(level);

      -- ── Quote Blocks ─────────────────────────────────────
      -- Mirrors one block of the Excel "Devis" sheet (10 blocks per sheet).
      CREATE TABLE IF NOT EXISTS quote_blocks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
        academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
        items_json TEXT NOT NULL DEFAULT '[]',
        advances REAL NOT NULL DEFAULT 0,
        discounts REAL NOT NULL DEFAULT 0,
        sub_total REAL NOT NULL DEFAULT 0,
        net_payable REAL NOT NULL DEFAULT 0,
        school_fee_tax REAL NOT NULL DEFAULT 0,
        block_date TEXT NOT NULL,
        template_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_quote_blocks_student ON quote_blocks(student_id);
      CREATE INDEX IF NOT EXISTS idx_quote_blocks_academic_year ON quote_blocks(academic_year_id);

      -- ── Fee Schedules ────────────────────────────────────
      -- Makes the Excel implicit pricing (25k/205k/35k/55k etc.) explicit & editable.
      CREATE TABLE IF NOT EXISTS fee_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        grade_level TEXT NOT NULL,
        academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
        lines_json TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_fee_schedules_grade ON fee_schedules(grade_level);
      CREATE INDEX IF NOT EXISTS idx_fee_schedules_active ON fee_schedules(is_active);

      -- ── Formula Rules ────────────────────────────────────
      -- User-defined calculation rules. Reproduces Excel cell formulas
      -- as first-class, editable, persistable entities.
      CREATE TABLE IF NOT EXISTS formula_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        expression TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'ledger',
        target_field TEXT,
        trigger TEXT NOT NULL DEFAULT 'manual',
        watched_fields_json TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        condition_expr TEXT,
        priority INTEGER NOT NULL DEFAULT 100,
        last_result TEXT,
        last_evaluated_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_formula_rules_scope ON formula_rules(scope);
      CREATE INDEX IF NOT EXISTS idx_formula_rules_active ON formula_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_formula_rules_priority ON formula_rules(priority);

      -- ── Payment Audit Comments ───────────────────────────
      -- Mirrors Excel column AM (free-text payment audit trail).
      CREATE TABLE IF NOT EXISTS payment_audit_comments (
        id TEXT PRIMARY KEY,
        ledger_entry_id TEXT NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
        student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        raw_text TEXT NOT NULL,
        amount REAL,
        day INTEGER,
        month INTEGER,
        year INTEGER,
        batch TEXT,
        is_closed INTEGER NOT NULL DEFAULT 0,
        excel_cell TEXT,
        source_row INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_comments_ledger ON payment_audit_comments(ledger_entry_id);
      CREATE INDEX IF NOT EXISTS idx_audit_comments_student ON payment_audit_comments(student_id);
      CREATE INDEX IF NOT EXISTS idx_audit_comments_payment ON payment_audit_comments(payment_id);
      CREATE INDEX IF NOT EXISTS idx_audit_comments_batch ON payment_audit_comments(batch);

      -- ── Spreadsheet Templates ────────────────────────────
      -- Captures the *shape* of an imported Excel workbook (sheets,
      -- headers, formula patterns, named ranges, cross-sheet refs).
      CREATE TABLE IF NOT EXISTS spreadsheet_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_file_name TEXT NOT NULL,
        source_file_hash TEXT NOT NULL,
        sheets_json TEXT NOT NULL DEFAULT '[]',
        named_ranges_json TEXT NOT NULL DEFAULT '[]',
        cross_sheet_refs_json TEXT NOT NULL DEFAULT '[]',
        comment_count INTEGER NOT NULL DEFAULT 0,
        broken_reference_count INTEGER NOT NULL DEFAULT 0,
        imported_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_spreadsheet_templates_hash ON spreadsheet_templates(source_file_hash);
    `
  }
];
