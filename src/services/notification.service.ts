/**
 * Notification service — creates, dispatches, and tracks notifications.
 *
 * Subscribes to domain events on construction so workflows and other services
 * don't need to call it explicitly. Templates map an event type to a
 * notification shape (subject/body) with {{field}} interpolation.
 */

import { NotificationRepository } from '../infrastructure/repositories/notification.repository';
import type {
  Notification, CreateNotificationInput, NotificationQuery, NotificationTemplate
} from '../core/entities/notification.entity';
import type { IEventBus } from '../core/interfaces/event-bus.interface';
import { logger } from '../infrastructure/logger/logger';

export class NotificationService {
  readonly serviceName = 'NotificationService';

  private templates: NotificationTemplate[] = [
    {
      trigger: 'payment.recorded',
      channel: 'in_app',
      subjectTemplate: 'Payment received: {{amount}} DZD',
      bodyTemplate: 'A payment of {{amount}} DZD was recorded for student {{studentId}}.',
      recipientType: 'employee',
      priority: 'normal',
      enabled: true
    },
    {
      trigger: 'invoice.overdue',
      channel: 'in_app',
      subjectTemplate: 'Invoice overdue: {{invoiceId}}',
      bodyTemplate: 'Invoice {{invoiceId}} is overdue by {{daysOverdue}} days. Outstanding: {{outstanding}} DZD.',
      recipientType: 'employee',
      priority: 'high',
      enabled: true
    },
    {
      trigger: 'student.created',
      channel: 'in_app',
      subjectTemplate: 'New student enrolled: {{fullName}}',
      bodyTemplate: '{{fullName}} ({{studentCode}}) has been registered.',
      recipientType: 'employee',
      priority: 'normal',
      enabled: true
    },
    {
      trigger: 'scholarship.granted',
      channel: 'in_app',
      subjectTemplate: 'Scholarship granted ({{percentage}}%)',
      bodyTemplate: 'A {{percentage}}% scholarship was granted. Reason: {{reason}}.',
      recipientType: 'employee',
      priority: 'normal',
      enabled: true
    }
  ];

  constructor(private readonly repo: NotificationRepository) {}

  /** Subscribe to event bus for auto-notification. */
  registerListeners(eventBus: IEventBus): void {
    for (const template of this.templates) {
      if (!template.enabled) continue;
      eventBus.subscribe(template.trigger, async (event) => {
        try {
          await this.createFromTemplate(template, event.payload as Record<string, unknown>);
        } catch (err) {
          logger.error('notification.template.failed', {
            trigger: template.trigger,
            error: (err as Error).message
          });
        }
      });
    }
    logger.info('notification.listeners.registered', { count: this.templates.length });
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const n = await this.repo.create(input);
    // For in-app notifications, mark as sent immediately (no transport)
    if (n.channel === 'in_app') {
      return this.repo.update(n.id.value, {
        status: 'sent',
        sentAt: new Date().toISOString()
      });
    }
    return n;
  }

  async list(query: NotificationQuery): Promise<Notification[]> {
    return this.repo.list(query);
  }

  async getById(id: string): Promise<Notification | null> {
    return this.repo.findById(id);
  }

  async markRead(id: string): Promise<Notification> {
    return this.repo.update(id, {
      status: 'read',
      readAt: new Date().toISOString()
    });
  }

  async markAllRead(recipientId?: string): Promise<void> {
    return this.repo.markAllRead(recipientId);
  }

  async countUnread(recipientId?: string): Promise<number> {
    return this.repo.countUnread(recipientId);
  }

  async delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }

  private async createFromTemplate(
    template: NotificationTemplate,
    payload: Record<string, unknown>
  ): Promise<Notification> {
    const subject = this.interpolate(template.subjectTemplate, payload);
    const body = this.interpolate(template.bodyTemplate, payload);
    return this.repo.create({
      recipientType: template.recipientType,
      channel: template.channel,
      category: 'system',
      priority: template.priority,
      subject,
      body,
      payload
    });
  }

  private interpolate(template: string, payload: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      const value = payload?.[key];
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }
}
