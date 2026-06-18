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
}
