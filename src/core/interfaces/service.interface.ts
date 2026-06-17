/**
 * Service contract — application services orchestrate repositories and
 * emit domain events. They are the only layer allowed to start transactions
 * and to compose cross-cutting concerns (audit, logging, events).
 */

export interface IService {
  /** Optional service name for logging & diagnostics. */
  readonly serviceName: string;
}

export interface IServiceContext {
  correlationId: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
}
