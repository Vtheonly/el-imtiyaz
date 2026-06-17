/**
 * Invoice repository — exposed separately because the payment service
 * composes both. The implementation lives in payment.repository.ts.
 */
export { InvoiceRepository } from './payment.repository';
