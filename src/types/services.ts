/**
 * Service Types
 * 
 * This module defines TypeScript interfaces and types used across
 * various service modules in the application.
 * 
 * Types defined here:
 * - FCMNotification: Structure for Firebase Cloud Messaging notifications
 * - NotificationPayload: Payload structure for sending notifications
 * - Re-exports: NotificationData and CallData from their respective services
 */

/**
 * FCMNotification Interface
 * 
 * Defines the structure for Firebase Cloud Messaging (FCM) notifications.
 * Used for push notifications sent to users' devices.
 */
export interface FCMNotification {
  title: string; // Notification title
  body: string; // Notification message body
  icon?: string; // Optional icon URL
  badge?: string; // Optional badge icon URL
  data?: Record<string, unknown>; // Optional custom data payload
}

/**
 * NotificationPayload Interface
 * 
 * Defines the complete payload structure for sending notifications via FCM.
 * Includes the notification content and the target device token.
 */
export interface NotificationPayload {
  notification: FCMNotification; // Notification content
  token: string; // FCM device token for the target device
}

// Re-export other types from services for convenience
// These types are defined in their respective service modules
export type { NotificationData } from '../services/notificationService';
export type { CallData } from '../services/callService';
