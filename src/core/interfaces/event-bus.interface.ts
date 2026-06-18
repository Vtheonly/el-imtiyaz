/**
 * Event bus contract — in-process pub/sub for cross-domain reactions.
 *
 * Examples:
 *   - `payment.recorded` → audit service logs the action
 *   - `student.enrolled` → fee template service auto-creates invoices
 *   - `invoice.overdue` → notification service queues an email reminder
 *
 * The bus is synchronous within the main process; all handlers run to
 * completion before the publisher continues. This keeps audit logging
 * deterministic without distributed transactions.
 */

export type DomainEvent<TPayload = unknown> = {
  type: string;
  payload: TPayload;
  timestamp: string;
  correlationId?: string;
};

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => void | Promise<void>;

export interface IEventBus {
  publish<T>(type: string, payload: T, meta?: { correlationId?: string }): Promise<void>;
  subscribe<T>(type: string, handler: EventHandler<T>): () => void;
  dispose(): Promise<void>;
}
