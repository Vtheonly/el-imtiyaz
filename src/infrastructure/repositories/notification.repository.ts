/**
 * Notification repository — SQLite-backed.
 */

import type { DatabaseClient } from '../database/sqlite-client';
import type {
  Notification, CreateNotificationInput, NotificationQuery
} from '../../core/entities/notification.entity';
import type {
  NotificationChannel, NotificationCategory, NotificationPriority,
  NotificationStatus, RecipientType
} from '../../core/entities/notification.entity';
import { Identifier } from '../../core/value-objects/identifier';
import { BaseRepository } from './base.repository';

interface NotificationRow {
  id: string;
  recipient_id: string | null;
  recipient_type: string;
  channel: string;
  category: string;
  priority: string;
  subject: string;
  body: string | null;
  payload_json: string | null;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export class NotificationRepository extends BaseRepository<Notification> {
  constructor(db: DatabaseClient) {
    super(db, 'notifications');
  }

  async findById(id: string): Promise<Notification | null> {
    const row = this.db.get<NotificationRow>('SELECT * FROM notifications WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async list(query: NotificationQuery = {}): Promise<Notification[]> {
    const conditions: string[] = ['1=1'];
    const params: Record<string, unknown> = {};

    if (query.recipientId) { conditions.push('recipient_id = @recipientId'); params.recipientId = query.recipientId; }
    if (query.recipientType) { conditions.push('recipient_type = @recipientType'); params.recipientType = query.recipientType; }
    if (query.channel) { conditions.push('channel = @channel'); params.channel = query.channel; }
    if (query.category) { conditions.push('category = @category'); params.category = query.category; }
    if (query.status) { conditions.push('status = @status'); params.status = query.status; }
    if (query.priority) { conditions.push('priority = @priority'); params.priority = query.priority; }
    if (query.from) { conditions.push('created_at >= @from'); params.from = query.from; }
    if (query.to) { conditions.push('created_at <= @to'); params.to = query.to; }
    if (query.unreadOnly) { conditions.push('read_at IS NULL'); }

    const limit = query.limit ?? 100;
    const rows = this.db.all<NotificationRow>(
      `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`,
      params
    );
    return rows.map((r) => this.mapRow(r));
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const id = Identifier.generate<'Notification'>().value;
    const now = this.now();
    this.db.run(
      `INSERT INTO notifications (id, recipient_id, recipient_type, channel, category, priority,
        subject, body, payload_json, status, scheduled_for, created_at, updated_at)
       VALUES (@id, @recipientId, @recipientType, @channel, @category, @priority,
        @subject, @body, @payload, @status, @scheduledFor, @createdAt, @updatedAt)`,
      {
        id,
        recipientId: input.recipientId ?? null,
        recipientType: input.recipientType ?? 'employee',
        channel: input.channel ?? 'in_app',
        category: input.category,
        priority: input.priority ?? 'normal',
        subject: input.subject,
        body: input.body ?? null,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        status: 'pending',
        scheduledFor: input.scheduledFor ?? null,
        createdAt: now,
        updatedAt: now
      }
    );
    return (await this.findById(id))!;
  }

  async update(id: string, patch: Partial<Notification>): Promise<Notification> {
    const sets: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: this.now() };
    if (patch.status !== undefined) { sets.push('status = @status'); params.status = patch.status; }
    if (patch.sentAt !== undefined) { sets.push('sent_at = @sentAt'); params.sentAt = patch.sentAt; }
    if (patch.deliveredAt !== undefined) { sets.push('delivered_at = @deliveredAt'); params.deliveredAt = patch.deliveredAt; }
    if (patch.readAt !== undefined) { sets.push('read_at = @readAt'); params.readAt = patch.readAt; }
    this.db.run(`UPDATE notifications SET ${sets.join(', ')} WHERE id = @id`, params);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    this.db.run('DELETE FROM notifications WHERE id = ?', [id]);
  }

  async countUnread(recipientId?: string, recipientType?: RecipientType): Promise<number> {
    const conditions: string[] = ['read_at IS NULL', "status IN ('sent', 'delivered')"];
    const params: Record<string, unknown> = {};
    if (recipientId) { conditions.push('recipient_id = @recipientId'); params.recipientId = recipientId; }
    if (recipientType) { conditions.push('recipient_type = @recipientType'); params.recipientType = recipientType; }
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE ${conditions.join(' AND ')}`,
      params
    );
    return row?.count ?? 0;
  }

  async markAllRead(recipientId?: string): Promise<void> {
    const now = this.now();
    if (recipientId) {
      this.db.run(
        `UPDATE notifications SET read_at = @now, status = 'read', updated_at = @now
         WHERE recipient_id = @recipientId AND read_at IS NULL`,
        { now, recipientId }
      );
    } else {
      this.db.run(
        `UPDATE notifications SET read_at = @now, status = 'read', updated_at = @now WHERE read_at IS NULL`,
        { now }
      );
    }
  }

  private mapRow(row: NotificationRow): Notification {
    return {
      id: Identifier.from<'Notification'>(row.id),
      recipientId: row.recipient_id ?? undefined,
      recipientType: row.recipient_type as RecipientType,
      channel: row.channel as NotificationChannel,
      category: row.category as NotificationCategory,
      priority: row.priority as NotificationPriority,
      subject: row.subject,
      body: row.body ?? undefined,
      payload: row.payload_json ? JSON.parse(row.payload_json) : undefined,
      status: row.status as NotificationStatus,
      scheduledFor: row.scheduled_for ?? undefined,
      sentAt: row.sent_at ?? undefined,
      deliveredAt: row.delivered_at ?? undefined,
      readAt: row.read_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
