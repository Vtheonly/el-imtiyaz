/**
 * Notification entity — in-app and email messages.
 *
 * Notifications are queued with a status (pending → sent → delivered → read).
 * The NotificationService subscribes to domain events (payment.overdue,
 * student.enrolled, etc.) and creates notifications automatically based on
 * user-configured templates.
 */

import { Identifier } from '../value-objects/identifier';

export type NotificationChannel = 'in_app' | 'email';
export type NotificationCategory = 'payment' | 'student' | 'attendance' | 'system' | 'workflow' | 'announcement';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type RecipientType = 'employee' | 'parent' | 'student' | 'all';

export interface Notification {
  id: Identifier<'Notification'>;
  recipientId?: string;             // undefined = broadcast to recipientType
  recipientType: RecipientType;
  channel: NotificationChannel;
  category: NotificationCategory;
  priority: NotificationPriority;
  subject: string;
  body?: string;
  payload?: Record<string, unknown>;
  status: NotificationStatus;
  scheduledFor?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {
  recipientId?: string;
  recipientType?: RecipientType;
  channel?: NotificationChannel;
  category: NotificationCategory;
  priority?: NotificationPriority;
  subject: string;
  body?: string;
  payload?: Record<string, unknown>;
  scheduledFor?: string;
}

export interface NotificationTemplate {
  trigger: string;                  // domain event type
  channel: NotificationChannel;
  subjectTemplate: string;          // {{studentName}} interpolation
  bodyTemplate: string;
  recipientType: RecipientType;
  priority: NotificationPriority;
  enabled: boolean;
}

export interface NotificationQuery {
  recipientId?: string;
  recipientType?: RecipientType;
  channel?: NotificationChannel;
  category?: NotificationCategory;
  status?: NotificationStatus;
  priority?: NotificationPriority;
  from?: string;
  to?: string;
  unreadOnly?: boolean;
  limit?: number;
}
