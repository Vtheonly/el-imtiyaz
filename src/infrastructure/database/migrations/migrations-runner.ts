/**
 * Migrations runner — applies pending migrations in order, tracking
 * applied state in the `_migrations` table.
 *
 * Each migration runs inside its own transaction. If any migration fails,
 * the runner aborts immediately and surfaces the error.
 */

import type { DatabaseClient } from '../sqlite-client';
import type { Migration } from './migrations';
import { logger } from '../../logger/logger';
import { InfrastructureError } from '../../error/app-error';

export class MigrationsRunner {
  constructor(private readonly db: DatabaseClient) {}

  async runAll(migrations: Migration[]): Promise<void> {
    this.ensureTrackingTable();

    const applied = this.getApplied();
    const pending = migrations.filter((m) => !applied.has(m.id));

    if (pending.length === 0) {
      logger.info('migrations.up-to-date', { applied: applied.size });
      return;
    }

    logger.info('migrations.pending', { count: pending.length });

    for (const migration of pending) {
      this.applyMigration(migration);
    }

    logger.info('migrations.complete', { total: migrations.length });
  }

  private ensureTrackingTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  private getApplied(): Set<string> {
    const rows = this.db.all<{ id: string }>('SELECT id FROM _migrations');
    return new Set(rows.map((r) => r.id));
  }

  private applyMigration(migration: Migration): void {
    logger.info('migrations.apply.start', { id: migration.id });

    try {
      this.db.transaction(() => {
        // Split on semicolons but preserve multi-statement integrity.
        // better-sqlite3's `exec` handles multiple statements cleanly.
        this.db.raw.exec(migration.up);
        this.db.run(
          'INSERT INTO _migrations (id, description) VALUES (?, ?)',
          [migration.id, migration.description]
        );
      });

      logger.info('migrations.apply.success', { id: migration.id });
    } catch (err) {
      logger.error('migrations.apply.failure', {
        id: migration.id,
        error: (err as Error).message
      });
      throw new InfrastructureError(
        `Migration ${migration.id} failed: ${(err as Error).message}`
      );
    }
  }
}
