/**
 * Custom error classes for the export pipeline.
 */

import { AppError } from '../error/app-error';

export class ExportError extends AppError {
  constructor(message: string) {
    super(message, { category: 'infrastructure', code: 'EXPORT_FAILED' });
  }
}

export { AppError } from '../error/app-error';
