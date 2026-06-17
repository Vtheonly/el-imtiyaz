/**
 * EventBus — synchronous in-process pub/sub.
 *
 * Uses a Map of handlers per event type. Handlers may be async; the bus
 * awaits each one in registration order. Errors in one handler do NOT
 * prevent subsequent handlers from running — they are logged and re-thrown
 * only after all handlers have completed.
 */

import type {
  IEventBus,
  DomainEvent,
  EventHandler
} from '../../core/interfaces/event-bus.interface';
import { logger } from '../logger/logger';

type AnyHandler = EventHandler<any>;

export class EventBus implements IEventBus {
  private readonly handlers = new Map<string, Set<AnyHandler>>();

  async publish<T>(
    type: string,
    payload: T,
    meta?: { correlationId?: string }
  ): Promise<void> {
    const event: DomainEvent<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: meta?.correlationId
    };

    const handlers = this.handlers.get(type);
    if (!handlers || handlers.size === 0) {
      logger.debug('eventbus.no-handlers', { type });
      return;
    }

    const errors: unknown[] = [];

    for (const handler of handlers) {
      try {
        await handler(event as DomainEvent<unknown>);
      } catch (err) {
        logger.error('eventbus.handler.error', {
          type,
          error: (err as Error).message
        });
        errors.push(err);
      }
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new Error(
        `EventBus: ${errors.length} handlers failed for event "${type}". First error: ${(errors[0] as Error).message}`
      );
    }
  }

  subscribe<T>(type: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as AnyHandler);
    logger.debug('eventbus.subscribed', { type, count: this.handlers.get(type)!.size });

    return () => {
      this.handlers.get(type)?.delete(handler as AnyHandler);
      logger.debug('eventbus.unsubscribed', { type });
    };
  }

  async dispose(): Promise<void> {
    this.handlers.clear();
    logger.info('eventbus.disposed');
  }
}
