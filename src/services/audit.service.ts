/**
 * Audit service — emits structured audit entries for every domain mutation.
 *
 * Subscribes to the event bus on construction so other services don't have
 * to call it explicitly — they just `eventBus.publish('student.created', …)`
 * and the audit trail is built automatically.
 */

import { AuditLogRepository } from '../infrastructure/repositories/audit-log.repository';
import type { AuditLog, AuditQuery } from '../core/entities/audit-log.entity';
import type { IEventBus } from '../core/interfaces/event-bus.interface';
import { logger } from '../infrastructure/logger/logger';

interface AuditContext {
  actorId?: string;
  actorName?: string;
  correlationId?: string;
  ipAddress?: string;
}

export class AuditService {
  readonly serviceName = 'AuditService';

  constructor(private readonly repo: AuditLogRepository) {}

  /** Subscribes to the event bus for automatic audit logging. */
  registerListeners(eventBus: IEventBus): void {
    const auditEvents = [
      'student.created', 'student.updated', 'student.deleted',
      'parent.created', 'parent.updated', 'parent.deleted',
      'payment.recorded', 'payment.updated', 'payment.refunded',
      'invoice.created', 'invoice.updated',
      'employee.created', 'employee.updated', 'employee.deleted',
      'class.created', 'class.updated',
      'attendance.recorded',
      'academic_year.created', 'academic_year.activated',
      'scholarship.granted', 'scholarship.revoked'
    ];

    for (const type of auditEvents) {
      eventBus.subscribe(type, async (event) => {
        const payload = (event.payload ?? {}) as {
          entityType?: string;
          entityId?: string;
          before?: unknown;
          after?: unknown;
          actor?: AuditContext;
        };
        await this.record({
          action: type,
          entityType: payload.entityType ?? 'Unknown',
          entityId: payload.entityId ?? 'unknown',
          before: payload.before,
          after: payload.after,
          correlationId: event.correlationId
        }, payload.actor);
      });
    }

    logger.info('audit.listeners.registered', { count: auditEvents.length });
  }

  async record(
    entry: {
      action: string;
      entityType: string;
      entityId: string;
      before?: unknown;
      after?: unknown;
      correlationId?: string;
    },
    context?: AuditContext
  ): Promise<AuditLog> {
    return this.repo.create({
      timestamp: new Date().toISOString(),
      actorId: context?.actorId ?? 'system',
      actorName: context?.actorName ?? 'System',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      correlationId: entry.correlationId,
      ipAddress: context?.ipAddress
    });
  }

  async list(query: AuditQuery): Promise<AuditLog[]> {
    return this.repo.list(query);
  }

  async getById(id: string): Promise<AuditLog | null> {
    return this.repo.findById(id);
  }
}
