/**
 * Global error handler — last-resort catch for uncaught exceptions and
 * unhandled promise rejections. Logs to the rolling file transport and
 * surfaces a structured event so the renderer can display a notification.
 */

import { app, BrowserWindow } from 'electron';
import { logger } from '../logger/logger';
import { toAppError } from './app-error';

export function installGlobalErrorHandler(): void {
  process.on('uncaughtException', (error) => {
    const appError = toAppError(error);
    logger.error('process.uncaughtException', {
      message: appError.message,
      code: appError.code,
      stack: error.stack
    });
  });

  process.on('unhandledRejection', (reason) => {
    const appError = toAppError(reason);
    logger.error('process.unhandledRejection', {
      message: appError.message,
      code: appError.code
    });
  });

  app.on('render-process-gone', (_event, _webContents, details) => {
    logger.error('app.render-process-gone', { details });
  });

  // Notify any open windows so the UI can show an error toast
  const notifyRenderer = (error: unknown) => {
    const appError = toAppError(error);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('system:error', appError.toJSON());
      }
    }
  };

  process.on('uncaughtException', notifyRenderer);
  process.on('unhandledRejection', notifyRenderer);
}
