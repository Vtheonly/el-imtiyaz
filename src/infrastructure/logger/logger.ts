/**
 * Winston-backed structured logger.
 *
 * Transports:
 *   - Console (colorised, dev only)
 *   - Daily-rotating file (always on)
 *   - Error-only file (always on)
 *
 * Every log entry uses a stable structured shape so log files can be
 * ingested by external tools without parsing ambiguity.
 */

import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'node:path';
import type { ILogger, LogLevel } from '../../core/interfaces/logger.interface';

// Try to use Electron's userData path if available; fall back to ./logs for plain Node scripts.
function isElectronDev(): boolean {
  try {
    const electron = require('electron');
    const app = electron?.app ?? electron?.remote?.app;
    return app ? !app.isPackaged : process.env.NODE_ENV !== 'production';
  } catch {
    return process.env.NODE_ENV !== 'production';
  }
}

function resolveLogDir(): string {
  try {
    const electron = require('electron');
    const app = electron?.app ?? electron?.remote?.app;
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'logs');
    }
  } catch {
    // Electron not available
  }
  return path.join(process.cwd(), 'logs');
}

const isDev = isElectronDev();

const logDir = resolveLogDir();

const baseFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.printf((info) => {
    const ts = info.timestamp as string;
    const level = info.level as string;
    const message = info.message as string;
    const meta = (() => {
      const { timestamp, level: _l, message: _m, ...rest } = info as Record<string, unknown>;
      return Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    })();
    return `${ts} [${level}] ${message}${meta}`;
  })
);

const winston: WinstonLogger = createLogger({
  level: isDev ? 'debug' : 'info',
  defaultMeta: { service: 'el-imtiyaz' },
  format: baseFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    new DailyRotateFile({
      level: 'error',
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '90d',
      zippedArchive: true
    })
  ]
});

if (isDev) {
  winston.add(new transports.Console({ format: consoleFormat, level: 'debug' }));
}

class WinstonLoggerAdapter implements ILogger {
  constructor(private readonly meta: Record<string, unknown> = {}) {}

  error(message: string, meta: Record<string, unknown> = {}): void {
    winston.error(message, { ...this.meta, ...meta });
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    winston.warn(message, { ...this.meta, ...meta });
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    winston.info(message, { ...this.meta, ...meta });
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    winston.debug(message, { ...this.meta, ...meta });
  }

  silly(message: string, meta: Record<string, unknown> = {}): void {
    winston.silly(message, { ...this.meta, ...meta });
  }

  log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    (winston as any)[level](message, { ...this.meta, ...meta });
  }

  child(meta: Record<string, unknown>): ILogger {
    return new WinstonLoggerAdapter({ ...this.meta, ...meta });
  }
}

export const logger: ILogger = new WinstonLoggerAdapter();

export function setLogLevel(level: LogLevel): void {
  winston.level = level;
}
