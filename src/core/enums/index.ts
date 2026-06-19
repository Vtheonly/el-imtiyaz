/**
 * Centralised enum & constant barrel for the domain layer.
 * Importing from one place keeps type drift out of the codebase.
 */

export * from './payment-status';
export * from './payment-type';
export * from './student-status';
export * from './attendance-status';
export * from './user-role';
export * from './academic-term-type';
export * from './gender';
export * from './discount-type';
export * from './payment-method';

// ── Excel-migration enums ────────────────────────────────────
export * from './ledger-category';
