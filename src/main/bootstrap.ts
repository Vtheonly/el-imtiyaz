/**
 * Bootstrap pipeline — orchestrates application startup in explicit stages.
 *
 * Stages:
 *   1. Resolve application paths & directories
 *   2. Initialise logger transports
 *   3. Open database connection & run pending migrations
 *   4. Hydrate event bus & register domain listeners
 *   5. Return a ServiceContainer to the main entry point
 *
 * Each stage is independently testable and produces structured log events
 * so failures can be traced without running the full app.
 */

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../infrastructure/logger/logger';
import { DatabaseClient } from '../infrastructure/database/sqlite-client';
import { EventBus } from '../infrastructure/event-bus/event-bus';
import { MigrationsRunner } from '../infrastructure/database/migrations/migrations-runner';
import { migrations } from '../infrastructure/database/migrations';
import { AppPaths } from './system/app-paths';

export interface ServiceContainer {
  database: DatabaseClient;
  eventBus: EventBus;
  paths: AppPaths;
}

export class BootstrapPipeline {
  async run(): Promise<ServiceContainer> {
    const paths = AppPaths.resolve();

    this.ensureDirectories(paths);
    logger.info('bootstrap.paths.resolved', { userData: paths.userData, logs: paths.logs });

    // Database — single client instance shared across the app.
    const database = new DatabaseClient({ filePath: paths.databaseFile });
    await database.open();
    logger.info('bootstrap.database.opened', { file: paths.databaseFile });

    // Migrations — idempotent, ordered, versioned.
    const runner = new MigrationsRunner(database);
    await runner.runAll(migrations);
    logger.info('bootstrap.migrations.applied');

    // Event bus — wires cross-domain reactions (e.g. payment → audit log).
    const eventBus = new EventBus();
    logger.info('bootstrap.event-bus.ready');

    return { database, eventBus, paths };
  }

  private ensureDirectories(paths: AppPaths): void {
    const dirs = [paths.userData, paths.logs, paths.uploads, paths.exports, paths.receipts];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('bootstrap.directory.created', { dir });
      }
    }
    void app; // app imported for side-effect reference; keep for future hooks
    void path;
  }
}
