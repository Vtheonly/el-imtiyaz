import { Identifier } from '../value-objects/identifier';

/**
 * Audit log entry. Append-only — records are never edited or deleted.
 * Each entry stores the full before/after state so it can be replayed.
 */
export interface AuditLog {
  id: Identifier<'AuditLog'>;
  timestamp: string;
  actorId: string;                    // employee who performed the action
  actorName: string;
  action: string;                     // 'student.create', 'payment.update', etc.
  entityType: string;                 // 'Student', 'Payment', etc.
  entityId: string;
  before?: unknown;                   // JSON snapshot before mutation
  after?: unknown;                    // JSON snapshot after mutation
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;             // ties to IPC request correlationId
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
