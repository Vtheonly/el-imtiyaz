/**
 * Logger contract — every layer (main, services, repositories) depends on
 * this interface. The concrete implementation is Winston-based but the
 * abstraction means tests can substitute a no-op logger trivially.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silly';

export interface ILogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  silly(message: string, meta?: Record<string, unknown>): void;
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;

  /** Returns a child logger with the given default metadata. */
  child(meta: Record<string, unknown>): ILogger;
}
