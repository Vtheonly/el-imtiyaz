/**
 * Audit log repository — append-only.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type { AuditLog, AuditQuery } from '../../core/entities/audit-log.entity';
import { Identifier } from '../../core/value-objects/identifier';
import { BaseRepository } from './base.repository';

interface AuditRow {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  metadata_json: string | null;
}

export class AuditLogRepository extends BaseRepository<AuditLog, AuditQuery> {
  constructor(db: DatabaseClient) {
    super(db, 'audit_logs');
  }

  async findById(id: string): Promise<AuditLog | null> {
    const row = this.db.get<AuditRow>('SELECT * FROM audit_logs WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async list(query: AuditQuery = {}): Promise<AuditLog[]> {
    const conditions: string[] = ['1=1'];
    const params: Record<string, unknown> = {};

    if (query.actorId) { conditions.push('actor_id = @actorId'); params.actorId = query.actorId; }
    if (query.action) { conditions.push('action = @action'); params.action = query.action; }
    if (query.entityType) { conditions.push('entity_type = @entityType'); params.entityType = query.entityType; }
    if (query.entityId) { conditions.push('entity_id = @entityId'); params.entityId = query.entityId; }
    if (query.from) { conditions.push('timestamp >= @from'); params.from = query.from; }
    if (query.to) { conditions.push('timestamp <= @to'); params.to = query.to; }

    const limit = query.limit ?? 200;
    const offset = query.offset ?? 0;

    const rows = this.db.all<AuditRow>(
      `SELECT * FROM audit_logs WHERE ${conditions.join(' AND ')}
       ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    const id = Identifier.generate<'AuditLog'>().value;

    this.db.run(
      `INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, action, entity_type,
        entity_id, before_json, after_json, ip_address, user_agent, correlation_id, metadata_json)
       VALUES (@id, @timestamp, @actorId, @actorName, @action, @entityType, @entityId,
        @before, @after, @ipAddress, @userAgent, @correlationId, @metadata)`,
      {
        id,
        timestamp: input.timestamp,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before !== undefined ? JSON.stringify(input.before) : null,
        after: input.after !== undefined ? JSON.stringify(input.after) : null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null
      }
    );

    return (await this.findById(id))!;
  }

  async update(_id: string, _patch: Partial<AuditLog>): Promise<AuditLog> {
    throw new Error('Audit logs are append-only and cannot be updated.');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('Audit logs are append-only and cannot be deleted.');
  }

  private mapRow(row: AuditRow): AuditLog {
    return {
      id: Identifier.from<'AuditLog'>(row.id),
      timestamp: row.timestamp,
      actorId: row.actor_id ?? '',
      actorName: row.actor_name ?? '',
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      before: row.before_json ? JSON.parse(row.before_json) : undefined,
      after: row.after_json ? JSON.parse(row.after_json) : undefined,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      correlationId: row.correlation_id ?? undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined
    };
  }
}
