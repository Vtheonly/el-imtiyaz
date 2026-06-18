/**
 * SQLite client — thin wrapper around better-sqlite3 that adds:
 *   - Lazy connection
 *   - Foreign-key enforcement
 *   - WAL mode for concurrent reads
 *   - Transaction helper with auto-rollback
 *   - Backup helper
 *   - Prepared-statement cache to avoid repeated parsing
 *
 * The wrapper is intentionally framework-light. ORMs add abstraction that
 * obscures what hits the disk; for an offline-first desktop app, raw SQL
 * with typed helpers is the right tradeoff.
 */

import Database, { Database as SqliteDB, Statement } from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../logger/logger";
import { InfrastructureError } from "../error/app-error";

export interface SqliteClientOptions {
  filePath: string;
  readonly?: boolean;
}

export type SqlParameters = Record<string, unknown> | unknown[];

export class DatabaseClient {
  private db: SqliteDB | null = null;
  private readonly statementCache = new Map<string, Statement<unknown[]>>();

  constructor(private readonly options: SqliteClientOptions) {}

  async open(): Promise<void> {
    if (this.db) return;

    const dir = path.dirname(this.options.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      this.db = new Database(this.options.filePath, {
        readonly: this.options.readonly ?? false,
        fileMustExist: false,
      });

      // Performance & safety pragmas
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
      this.db.pragma("synchronous = NORMAL");
      this.db.pragma("temp_store = MEMORY");
      this.db.pragma("cache_size = -64000"); // 64MB

      logger.info("database.opened", { file: this.options.filePath });
    } catch (err) {
      throw new InfrastructureError(
        `Failed to open database: ${(err as Error).message}`,
      );
    }
  }

  async close(): Promise<void> {
    if (!this.db) return;
    try {
      this.db.pragma("wal_checkpoint(TRUNCATE)");
      this.db.close();
      this.db = null;
      this.statementCache.clear();
      logger.info("database.closed");
    } catch (err) {
      throw new InfrastructureError(
        `Failed to close database: ${(err as Error).message}`,
      );
    }
  }

  private requireDb(): SqliteDB {
    if (!this.db) {
      throw new InfrastructureError("Database is not open. Call open() first.");
    }
    return this.db;
  }

  prepare<T = unknown>(sql: string): Statement<any> {
    let stmt = this.statementCache.get(sql) as Statement<any> | undefined;
    if (!stmt) {
      stmt = this.requireDb().prepare(sql) as Statement<any>;
      this.statementCache.set(sql, stmt as Statement<unknown[]>);
    }
    return stmt;
  }

  /** Runs a parameterised query that returns rows. */
  all<T = Record<string, unknown>>(
    sql: string,
    params: SqlParameters = {},
  ): T[] {
    const stmt = this.prepare(sql);
    if (typeof params === "object" && !Array.isArray(params)) {
      return Object.keys(params).length === 0
        ? ((stmt.all as any)() as T[])
        : ((stmt.all as any)(params) as T[]);
    }
    const arr = params as unknown[];
    return (
      arr.length === 0 ? (stmt.all as any)() : (stmt.all as any)(...arr)
    ) as T[];
  }

  /** Runs a parameterised query that returns a single row (or undefined). */
  get<T = Record<string, unknown>>(
    sql: string,
    params: SqlParameters = {},
  ): T | undefined {
    const stmt = this.prepare(sql);
    if (typeof params === "object" && !Array.isArray(params)) {
      return Object.keys(params).length === 0
        ? ((stmt.get as any)() as T | undefined)
        : ((stmt.get as any)(params) as T | undefined);
    }
    const arr = params as unknown[];
    return (
      arr.length === 0 ? (stmt.get as any)() : (stmt.get as any)(...arr)
    ) as T | undefined;
  }

  /** Runs an INSERT/UPDATE/DELETE. Returns the number of affected rows. */
  run(
    sql: string,
    params: SqlParameters = {},
  ): { changes: number; lastInsertRowid: number | bigint } {
    const stmt = this.prepare(sql);
    if (typeof params === "object" && !Array.isArray(params)) {
      return Object.keys(params).length === 0
        ? (stmt.run as any)()
        : (stmt.run as any)(params);
    }
    const arr = params as unknown[];
    return arr.length === 0 ? (stmt.run as any)() : (stmt.run as any)(...arr);
  }

  /**
   * Transaction helper. The callback receives the client so it can run
   * multiple statements atomically. Throws on any error and rolls back.
   */
  transaction<T>(fn: (client: DatabaseClient) => T): T {
    const db = this.requireDb();
    const tx = db.transaction(() => fn(this));
    return tx();
  }

  /** Backup the database to a timestamped file in the same directory. */
  async backup(): Promise<string> {
    const db = this.requireDb();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      path.dirname(this.options.filePath),
      `backup-${ts}.db`,
    );
    await db.backup(backupPath);
    logger.info("database.backed-up", { path: backupPath });
    return backupPath;
  }

  /** Returns raw underlying better-sqlite3 instance (escape hatch). */
  get raw(): SqliteDB {
    return this.requireDb();
  }
}
