/**
 * Electron main process entry point.
 *
 * Responsibilities:
 *  - Bootstrap the application lifecycle
 *  - Register IPC handlers (single source of truth for channel routing)
 *  - Manage window lifecycle through WindowManager
 *  - Wire up the menu, logger, and database connections
 *
 * Architecture note: this file should remain thin. All side-effects are
 * delegated to dedicated modules so the bootstrap pipeline is testable.
 */

import { app, BrowserWindow } from 'electron';
import { loadEnv } from './system/env-loader';

// Load environmental variables from .env
loadEnv();

import { registerIpcHandlers } from './ipc';
import { WindowManager } from './window-manager';
import { BootstrapPipeline } from './bootstrap';
import { buildApplicationMenu } from './system/menu';
import { logger } from '../infrastructure/logger/logger';
import { DatabaseClient } from '../infrastructure/database/sqlite-client';
import { EventBus } from '../infrastructure/event-bus/event-bus';

// Singletons — created in bootstrap, shared via app-level references.
let windowManager: WindowManager | null = null;
let database: DatabaseClient | null = null;
let eventBus: EventBus | null = null;

/**
 * Main bootstrap routine. Runs once Electron is ready.
 * Order matters: infrastructure → services → UI.
 */
async function bootstrapApplication(): Promise<void> {
  try {
    logger.info('app.boot.start', { version: app.getVersion(), platform: process.platform });

    const pipeline = new BootstrapPipeline();
    const container = await pipeline.run();

    database = container.database;
    eventBus = container.eventBus;

    // Register the entire IPC surface in one place.
    registerIpcHandlers({ database: container.database, eventBus: container.eventBus });

    // Build the native menu (commands route to focused window).
    buildApplicationMenu();

    // Open the main window.
    windowManager = new WindowManager();
    await windowManager.createMainWindow();

    logger.info('app.boot.complete');
  } catch (error) {
    logger.error('app.boot.failure', { error: (error as Error).message, stack: (error as Error).stack });
    // Non-fatal: keep the app alive so the user can inspect logs.
  }
}

// Prevent multiple instances — focus existing window if a second instance is launched.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const primary = windows[0];
      if (primary.isMinimized()) primary.restore();
      primary.focus();
    }
  });

  app.whenReady().then(bootstrapApplication);

  app.on('activate', () => {
    // macOS: re-create a window when dock icon is clicked and no windows exist.
    if (BrowserWindow.getAllWindows().length === 0 && windowManager) {
      windowManager.createMainWindow();
    }
  });
}

// Graceful shutdown — close database & flush logs.
app.on('before-quit', async (event) => {
  event.preventDefault();
  logger.info('app.shutdown.start');

  try {
    await database?.close?.();
    await eventBus?.dispose?.();
    logger.info('app.shutdown.complete');
  } catch (error) {
    logger.error('app.shutdown.error', { error: (error as Error).message });
  } finally {
    app.exit(0);
  }
});

// Security: prevent new-window creation by renderer, force electron to handle links.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    logger.warn('security.window-open.blocked', { url });
    return { action: 'deny' };
  });
});
