/**
 * Bootstrap pipeline — orchestrates application startup in explicit stages.
 *
 * Stages:
 *   1. Resolve application paths & directories
 *   2. Initialise logger transports
 *   3. Open database connection & run pending migrations
 *   4. Hydrate event bus & register domain listeners
 *   5. Automatically seed demo records if database is empty
 *   6. Return a ServiceContainer to the main entry point
 */

import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../infrastructure/logger/logger";
import { DatabaseClient } from "../infrastructure/database/sqlite-client";
import { EventBus } from "../infrastructure/event-bus/event-bus";
import { MigrationsRunner } from "../infrastructure/database/migrations/migrations-runner";
import { migrations } from "../infrastructure/database/migrations";
import { AppPaths } from "./system/app-paths";

export interface ServiceContainer {
  database: DatabaseClient;
  eventBus: EventBus;
  paths: AppPaths;
}

export class BootstrapPipeline {
  async run(): Promise<ServiceContainer> {
    const paths = AppPaths.resolve();

    this.ensureDirectories(paths);
    logger.info("bootstrap.paths.resolved", {
      userData: paths.userData,
      logs: paths.logs,
    });

    // Database — single client instance shared across the app.
    const database = new DatabaseClient({ filePath: paths.databaseFile });
    await database.open();
    logger.info("bootstrap.database.opened", { file: paths.databaseFile });

    // Migrations — idempotent, ordered, versioned.
    const runner = new MigrationsRunner(database);
    await runner.runAll(migrations);
    logger.info("bootstrap.migrations.applied");

    // Auto-seed check
    try {
      const studentCount = database.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM students",
      );
      if (!studentCount || studentCount.count === 0) {
        logger.info("bootstrap.seeding.start", {
          msg: "Database empty. Initiating automatic seeding...",
        });
        await this.seedDatabase(database);
        logger.info("bootstrap.seeding.complete", {
          msg: "Rich Algerian demo dataset generated successfully.",
        });
      }
    } catch (err) {
      logger.error("bootstrap.seeding.error", {
        error: (err as Error).message,
      });
    }

    // Excel-migration defaults — seed the default fee schedule and
    // starter formula rules so the app behaves like the Excel workbook
    // from the very first run.
    try {
      await this.seedExcelMigrationDefaults(database);
      logger.info("bootstrap.excel-migration.defaults.seeded");
    } catch (err) {
      logger.error("bootstrap.excel-migration.defaults.error", {
        error: (err as Error).message,
      });
    }

    // Event bus — wires cross-domain reactions.
    const eventBus = new EventBus();
    logger.info("bootstrap.event-bus.ready");

    return { database, eventBus, paths };
  }

  private ensureDirectories(paths: AppPaths): void {
    const dirs = [
      paths.userData,
      paths.logs,
      paths.uploads,
      paths.exports,
      paths.receipts,
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info("bootstrap.directory.created", { dir });
      }
    }
  }

  private async seedDatabase(db: DatabaseClient): Promise<void> {
    const now = new Date().toISOString();
    const yearId = uuidv4();

    db.transaction(() => {
      // 1. Academic Year
      db.run(
        `INSERT INTO academic_years (id, name, start_date, end_date, term_type, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [yearId, "2025-2026", "2025-09-01", "2026-06-30", "semester", now, now],
      );

      // 2. Terms
      const terms = [
        {
          id: uuidv4(),
          name: "Semester 1",
          start: "2025-09-01",
          end: "2026-01-31",
          order: 1,
        },
        {
          id: uuidv4(),
          name: "Semester 2",
          start: "2026-02-01",
          end: "2026-06-30",
          order: 2,
        },
      ];
      for (const t of terms) {
        db.run(
          `INSERT INTO academic_terms (id, academic_year_id, name, type, start_date, end_date, term_order)
           VALUES (?, ?, ?, 'semester', ?, ?, ?)`,
          [t.id, yearId, t.name, t.start, t.end, t.order],
        );
      }

      // 3. Employees
      const empId = uuidv4();
      db.run(
        `INSERT INTO employees (id, employee_code, first_name, last_name, full_name, email, phone, role, title, hired_at, is_active, permissions_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '[]', ?, ?)`,
        [
          empId,
          "EMP-2025-0001",
          "Fatima",
          "Zohra",
          "Fatima Zohra",
          "fatima@el-imtiyaz.dz",
          "+213 555 12 34 56",
          "accountant",
          "Senior Accountant",
          "2024-09-01",
          now,
          now,
        ],
      );

      // 4. Classes
      const clsId1 = uuidv4();
      const clsId2 = uuidv4();
      db.run(
        `INSERT INTO classes (id, grade, section, name, capacity, enrolled_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 30, 2, ?, ?)`,
        [clsId1, "Grade 1", "A", "Grade 1 A", now, now],
      );
      db.run(
        `INSERT INTO classes (id, grade, section, name, capacity, enrolled_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 25, 0, ?, ?)`,
        [clsId2, "Kindergarten", "A", "Kindergarten A", now, now],
      );

      // 5. Parents
      const pId = uuidv4();
      db.run(
        `INSERT INTO parents (id, first_name, last_name, full_name, phone, email, relationship, address_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pId,
          "Kamel",
          "Benali",
          "Kamel Benali",
          "+213 661 98 76 54",
          "kamel.benali@gmail.com",
          "father",
          JSON.stringify({
            line1: "12 Rue des Martyrs",
            city: "Algiers",
            country: "Algeria",
          }),
          now,
          now,
        ],
      );

      // 6. Students
      const sId = uuidv4();
      db.run(
        `INSERT INTO students (id, student_code, first_name, last_name, full_name, date_of_birth, gender, parent_ids_json, primary_parent_id, phone_numbers_json, address_json, emergency_contacts_json, registered_at, status, class_id, academic_year_id, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 'active', ?, ?, '{}', ?, ?)`,
        [
          sId,
          "STU-2025-0001",
          "Yacine",
          "Benali",
          "Yacine Benali",
          "2018-04-12",
          "male",
          JSON.stringify([pId]),
          pId,
          JSON.stringify(["+213 661 98 76 54"]),
          JSON.stringify({
            line1: "12 Rue des Martyrs",
            city: "Algiers",
            country: "Algeria",
          }),
          now,
          clsId1,
          yearId,
          now,
          now,
        ],
      );

      // 7. Invoices (1 Registration, 3 Months tuition)
      const invRegId = uuidv4();
      db.run(
        `INSERT INTO invoices (id, invoice_number, student_id, academic_year_id, type, description, amount_due, discount_amount, amount_paid, status, due_date, issued_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'registration', 'Registration Fee 2025-2026', 5000, 0, 5000, 'paid', '2025-09-15', '2025-09-01', ?, ?)`,
        [invRegId, "INV-2025-00001", sId, yearId, now, now],
      );

      const months = ["2025-09", "2025-10", "2025-11"];
      for (let i = 0; i < months.length; i++) {
        const invId = uuidv4();
        const paid = i === 2 ? 0 : 8000;
        const status = i === 2 ? "overdue" : "paid";
        db.run(
          `INSERT INTO invoices (id, invoice_number, student_id, academic_year_id, type, description, amount_due, discount_amount, amount_paid, status, due_date, issued_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'monthly_tuition', ?, 8000, 0, ?, ?, ?, ?, ?, ?)`,
          [
            invId,
            `INV-2025-0000${i + 2}`,
            sId,
            yearId,
            `Monthly Tuition — ${months[i]}`,
            paid,
            status,
            `${months[i]}-10`,
            `${months[i]}-01`,
            now,
            now,
          ],
        );
      }

      // 8. Payments
      db.run(
        `INSERT INTO payments (id, receipt_number, student_id, parent_ids_json, invoice_ids_json, amount, payment_date, payment_method, received_by_employee_id, status, attachments_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 21000, ?, 'cash', ?, 'paid', '[]', ?, ?)`,
        [
          uuidv4(),
          "RCP-2025-00001",
          sId,
          JSON.stringify([pId]),
          JSON.stringify([invRegId]),
          "2025-09-05",
          empId,
          now,
          now,
        ],
      );
    });
  }

  /**
   * Seed the default fee schedule + starter formula rules so the app
   * reproduces the Suivis clients.xlsx workbook's behaviour from the
   * very first run. Idempotent — if rows already exist, this is a no-op.
   */
  private async seedExcelMigrationDefaults(db: DatabaseClient): Promise<void> {
    const now = new Date().toISOString();

    db.transaction(() => {
      // ── Default fee schedule (mirrors Excel constants) ─────────
      const existingSchedule = db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM fee_schedules WHERE is_active = 1",
      );
      if (!existingSchedule || existingSchedule.count === 0) {
        const scheduleId = uuidv4();
        const lines = [
          { id: uuidv4(), type: "registration", label: "Registration Fee", amount: 25000, includedInQuote: true, isInstallment: true, excelColumn: "R" },
          { id: uuidv4(), type: "tuition", label: "Base Tuition", amount: 205000, includedInQuote: true, isInstallment: false, excelColumn: "L" },
          { id: uuidv4(), type: "transport_base", label: "Transport (standard)", amount: 35000, includedInQuote: true, isInstallment: false, excelColumn: "L" },
          { id: uuidv4(), type: "transport_premium", label: "Transport (premium)", amount: 55000, includedInQuote: true, isInstallment: false, excelColumn: "L" },
          { id: uuidv4(), type: "transport_t1", label: "Transport T1", amount: 30000, includedInQuote: false, isInstallment: true, excelColumn: "W" },
          { id: uuidv4(), type: "transport_t2", label: "Transport T2", amount: 15000, includedInQuote: false, isInstallment: true, excelColumn: "X" },
          { id: uuidv4(), type: "transport_t3", label: "Transport T3", amount: 10000, includedInQuote: false, isInstallment: true, excelColumn: "Y" },
        ];
        db.run(
          `INSERT INTO fee_schedules (id, name, description, grade_level, academic_year_id, lines_json, is_active, created_at, updated_at)
           VALUES (?, ?, ?, 'ALL', NULL, ?, 1, ?, ?)`,
          [
            scheduleId,
            "Default (Excel 2026-2027)",
            "Auto-seeded from the implicit pricing in the Suivis clients.xlsx workbook",
            JSON.stringify(lines),
            now,
            now,
          ],
        );
        logger.info("bootstrap.excel-migration.feeSchedule.seeded", { id: scheduleId });
      }

      // ── Starter formula rules (reproduce Excel cell formulas) ─
      const existingRules = db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM formula_rules",
      );
      if (!existingRules || existingRules.count === 0) {
        const rules = [
          {
            name: "DEVIS ANNUEL",
            description: "Reproduces Excel column L: registration + tuition + transport - discount",
            expression: "registration + baseTuition + transportBase - remise",
            scope: "ledger", targetField: "devisAnnuel", trigger: "on_save",
            watched: ["remise", "registration", "baseTuition", "transportBase"],
            priority: 10,
          },
          {
            name: "TOTAL VERSEMENTS",
            description: "Reproduces Excel column P: sum of all 7 payment installments",
            expression: "fi + v2 + altV2 + v3 + t1 + t2 + t3",
            scope: "ledger", targetField: "totalVersements", trigger: "on_save",
            watched: ["fi", "v2", "altV2", "v3", "t1", "t2", "t3"],
            priority: 20,
          },
          {
            name: "TOTAL CREANCE",
            description: "Reproduces Excel column Q: devis_annuel - total_versements",
            expression: "devisAnnuel - totalVersements",
            scope: "ledger", targetField: "totalCreance", trigger: "on_save",
            watched: ["devisAnnuel", "totalVersements"],
            priority: 30,
          },
          {
            name: "GRAND TOTAL",
            description: "Reproduces Excel column AL: sum of all payment + extras + quarterly",
            expression: "totalVersements + psy1 + psy2 + orth1 + orth2 + ePlant + ratrapage + september + december + march",
            scope: "ledger", targetField: "grandTotal", trigger: "on_save",
            watched: ["totalVersements", "psy1", "psy2", "orth1", "orth2", "ePlant", "ratrapage", "september", "december", "march"],
            priority: 40,
          },
          {
            name: "Quote Sub-Total",
            description: "Reproduces Excel Devis I27",
            expression: "SUM(lineItems.lineTotal)",
            scope: "quote", targetField: "subTotal", trigger: "on_save",
            watched: ["lineItems.lineTotal"], priority: 10,
          },
          {
            name: "Quote Net Payable",
            description: "Reproduces Excel Devis I31",
            expression: "subTotal - advances - discounts",
            scope: "quote", targetField: "netPayable", trigger: "on_save",
            watched: ["subTotal", "advances", "discounts"], priority: 20,
          },
          {
            name: "Quote 5% Tax on School Fees",
            description: "Reproduces Excel Devis D35",
            expression: "SUM(lineItems.fraisScolaireAmount) * 0.05",
            scope: "quote", targetField: "schoolFeeTax", trigger: "on_save",
            watched: ["lineItems.fraisScolaireAmount"], priority: 30,
          },
        ];

        for (const r of rules) {
          db.run(
            `INSERT INTO formula_rules (id, name, description, expression, scope, target_field, trigger, watched_fields_json, is_active, condition_expr, priority, last_result, last_evaluated_at, last_error, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, NULL, NULL, NULL, ?, ?)`,
            [
              uuidv4(),
              r.name,
              r.description,
              r.expression,
              r.scope,
              r.targetField,
              r.trigger,
              JSON.stringify(r.watched),
              r.priority,
              now,
              now,
            ],
          );
        }
        logger.info("bootstrap.excel-migration.formulaRules.seeded", { count: rules.length });
      }

      // ── Demo ledger entry linked to the first student (Excel row 2) ─
      // This makes the Student Profile page show the "Excel Ledger Entry"
      // card with real computed values. Idempotent — only seeds if there
      // are no ledger entries yet AND a student exists.
      const existingLedger = db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM ledger_entries",
      );
      if (!existingLedger || existingLedger.count === 0) {
        const firstStudent = db.get<{ id: string; full_name: string; academic_year_id: string | null }>(
          "SELECT id, full_name, academic_year_id FROM students LIMIT 1",
        );
        if (firstStudent) {
          const ledgerId = uuidv4();
          db.run(
            `INSERT INTO ledger_entries (
              id, student_id, academic_year_id, source_row,
              student_name, phone_numbers, tutor_name, level, class_code, option_code, destination,
              remise, justification,
              devis_annuel, total_versements, total_creance, grand_total,
              fi, v2, alt_v2, v3, t1, t2, t3,
              psy1, psy2, orth1, orth2, e_plant, ratrapage,
              september, december, march,
              created_at, updated_at
            ) VALUES (
              ?, ?, ?, 2,
              ?, '+213 661 98 76 54', 'Tutor', 'PRIM', 'Grade 1 A', 'TRNSP', 'Algiers',
              25500, 'Sibling discount (Excel row 2 reproduction)',
              239500, 254500, -15000, 254500,
              25000, 71500, 0, 71500, 30000, 15000, 10000,
              0, 0, 0, 0, 0, 0,
              0, 0, 0,
              ?, ?
            )`,
            [
              ledgerId,
              firstStudent.id,
              firstStudent.academic_year_id,
              firstStudent.full_name,
              now,
              now,
            ],
          );

          // Audit comment in Excel column-AM format
          const commentId = uuidv4();
          db.run(
            `INSERT INTO payment_audit_comments (
              id, ledger_entry_id, student_id, raw_text,
              amount, day, month, year, batch, is_closed,
              excel_cell, source_row, created_at, updated_at
            ) VALUES (
              ?, ?, ?, '254500/05/09B11',
              254500, 5, 9, 2025, 'B11', 0,
              'AM2', 2, ?, ?
            )`,
            [commentId, ledgerId, firstStudent.id, now, now],
          );
          logger.info("bootstrap.excel-migration.demoLedger.seeded", {
            id: ledgerId,
            studentId: firstStudent.id,
          });
        }
      }
    });
  }
}
