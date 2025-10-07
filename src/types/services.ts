// FCM Types - Standalone definitions
export interface FCMNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export interface NotificationPayload {
  notification: FCMNotification;
  token: string;
}

// Re-export other types from services
export type { NotificationData } from '../services/notificationService';

export type { CallData } from '../services/callService';
