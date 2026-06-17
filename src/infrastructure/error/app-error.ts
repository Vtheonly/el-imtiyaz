/**
 * Error handling — the single source of truth for error types in the app.
 *
 * Every layer throws `AppError` (or its subclasses). The IPC boundary
 * normalises unknown errors via `toAppError()` so the renderer always
 * receives a typed error payload.
 */

import { logger } from '../logger/logger';

export type ErrorCategory =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'permission'
  | 'business_rule'
  | 'infrastructure'
  | 'unknown';

export class AppError extends Error {
  readonly category: ErrorCategory;
  readonly code: string;
  readonly details?: unknown;
  readonly timestamp: string;
  readonly isOperational: boolean;

  constructor(
    message: string,
    options: {
      category?: ErrorCategory;
      code?: string;
      details?: unknown;
      isOperational?: boolean;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = options.category ?? 'unknown';
    this.code = options.code ?? this.deriveCode();
    this.details = options.details;
    this.timestamp = new Date().toISOString();
    this.isOperational = options.isOperational ?? true;
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
  }

  private deriveCode(): string {
    return `${this.category.toUpperCase()}_${this.name.toUpperCase()}`;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { category: 'validation', code: 'VALIDATION_ERROR', details });
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, {
      category: 'not_found',
      code: 'NOT_FOUND'
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { category: 'conflict', code: 'CONFLICT', details });
  }
}

export class PermissionError extends AppError {
  constructor(action: string) {
    super(`Permission denied for action: ${action}`, {
      category: 'permission',
      code: 'PERMISSION_DENIED'
    });
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { category: 'business_rule', code: 'BUSINESS_RULE_VIOLATION', details });
  }
}

export class InfrastructureError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, {
      category: 'infrastructure',
      code: 'INFRASTRUCTURE_ERROR',
      details,
      isOperational: false
    });
  }
}

/**
 * Normalises any thrown value into an AppError. Unknown values are wrapped
 * in `AppError` with category 'unknown' and logged.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof Error) {
    logger.warn('error.normalised', { name: err.name, message: err.message });
    return new AppError(err.message, {
      category: 'unknown',
      code: 'UNKNOWN_ERROR',
      isOperational: false,
      cause: err
    });
  }

  const message = typeof err === 'string' ? err : 'An unknown error occurred';
  return new AppError(message, { category: 'unknown', code: 'UNKNOWN_ERROR' });
}
