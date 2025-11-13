/**
 * Notification Service
 * 
 * This service manages in-app notifications stored in Firestore.
 * It handles creation, reading, updating, and deletion of notifications
 * for users throughout the application.
 * 
 * Features:
 * - Create notifications for various events (session requests, confirmations, etc.)
 * - Mark notifications as read/unread
 * - Query notifications by user, type, or read status
 * - Prevent duplicate notifications
 * - Clean up expired notifications
 * - Delete duplicate notifications
 * 
 * Notification Types:
 * - session_request: New session request for interpreter
 * - session_confirmed: Session confirmed for user
 * - session_cancelled: Session cancelled
 * - session_reminder: Reminder 30 minutes before session
 * - rating_received: New rating received by interpreter
 * - system_update: System-wide updates
 */

/* eslint-disable prefer-const */
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * NotificationData Interface
 * 
 * Represents a notification document stored in Firestore.
 * Contains all information about a notification sent to a user.
 */
export interface NotificationData {
  notification_id?: string; // Document ID in Firestore
  user_id: string; // ID of the user receiving the notification
  type: 'session_request' | 'session_confirmed' | 'session_cancelled' | 
        'session_reminder' | 'rating_received' | 'system_update'; // Type of notification
  title: string; // Notification title
  message: string; // Notification message body
  data?: { // Additional data for the notification (e.g., session_id, rating_id)
    session_id?: string;
    rating_id?: string;
    [key: string]: unknown;
  };
  is_read: boolean; // Whether the notification has been read
  priority: 'low' | 'medium' | 'high'; // Notification priority level
  created_at: Timestamp; // When the notification was created
  read_at?: Timestamp; // When the notification was marked as read
  expires_at?: Timestamp; // Optional expiration time for the notification
}

/**
 * Check if a notification already exists
 * 
 * Prevents duplicate notifications by checking if a notification with the same
 * type, user, and optionally session_id already exists.
 * 
 * @param userId - ID of the user
 * @param type - Type of notification to check
 * @param sessionId - Optional session ID to check for exact match
 * @returns Promise resolving to true if notification exists, false otherwise
 */
export const notificationExists = async (
  userId: string,
  type: NotificationData['type'],
  sessionId?: string
): Promise<boolean> => {
  try {
    // Query notifications for this user and type
    let q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('type', '==', type)
    );

    const querySnapshot = await getDocs(q);
    
    // Check if any notification matches
    if (sessionId) {
      // If sessionId is provided, check for exact match
      // This prevents duplicate notifications for the same session
      return querySnapshot.docs.some(doc => {
        const data = doc.data();
        return data.data?.session_id === sessionId;
      });
    } else {
      // If no sessionId provided, check if any notification of this type exists for this user
      return querySnapshot.docs.length > 0;
    }
  } catch (error) {
    console.error('Error checking notification existence:', error);
    return false; // If check fails, allow creation (fail-safe approach)
  }
};

/**
 * Create a new notification
 * 
 * Creates a notification document in Firestore. First checks if a duplicate
 * notification already exists to prevent spam. Returns empty string if duplicate found.
 * 
 * @param notificationData - Notification data (without notification_id, created_at, is_read, read_at)
 * @returns Promise resolving to notification document ID, or empty string if duplicate
 * @throws Error if creation fails
 */
export const createNotification = async (notificationData: Omit<NotificationData, 'notification_id' | 'created_at' | 'is_read' | 'read_at'>): Promise<string> => {
  try {
    // Step 1: Check if notification already exists (prevent duplicates)
    const sessionId = notificationData.data?.session_id as string | undefined;
    const exists = await notificationExists(
      notificationData.user_id,
      notificationData.type,
      sessionId
    );
    
    // If duplicate exists, skip creation and return empty string
    if (exists) {
      console.log('Notification already exists, skipping creation:', {
        userId: notificationData.user_id,
        type: notificationData.type,
        sessionId
      });
      // Return empty string to indicate no new notification was created
      return '';
    }

    // Step 2: Create notification document with default values
    const newNotification: Omit<NotificationData, 'notification_id'> = {
      ...notificationData,
      is_read: false, // New notifications are unread by default
      created_at: serverTimestamp() as Timestamp // Use server timestamp for consistency
    };

    // Step 3: Add notification to Firestore
    const docRef = await addDoc(collection(db, 'notifications'), newNotification);
    console.log('Notification created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * 
 * Updates a notification to mark it as read and records the read timestamp.
 * 
 * @param notificationId - ID of the notification document
 * @returns Promise that resolves when update is complete
 * @throws Error if update fails
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      is_read: true, // Mark as read
      read_at: serverTimestamp() // Record when it was read
    });
    console.log('Notification marked as read');
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * 
 * Marks all unread notifications for a user as read in a single operation.
 * Used when user clicks "Mark all as read" in the notification center.
 * 
 * @param userId - ID of the user
 * @returns Promise that resolves when all updates are complete
 * @throws Error if update fails
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    // Query all unread notifications for this user
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('is_read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Update all notifications in parallel
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        is_read: true,
        read_at: serverTimestamp()
      })
    );
    
    await Promise.all(updatePromises);
    console.log('All notifications marked as read');
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * 
 * Retrieves notifications for a user, optionally filtered to unread only.
 * Results are ordered by most recent first and limited to the specified count.
 * 
 * @param userId - ID of the user
 * @param limit - Maximum number of notifications to return (default: 20)
 * @param unreadOnly - If true, only return unread notifications
 * @returns Promise resolving to array of NotificationData objects
 * @throws Error if query fails
 */
export const getUserNotifications = async (userId: string, limit: number = 20, unreadOnly: boolean = false): Promise<NotificationData[]> => {
  try {
    // Build query based on whether we want all notifications or only unread
    let q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc') // Most recent first
    );

    // If unreadOnly is true, add filter for unread notifications
    if (unreadOnly) {
      q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        where('is_read', '==', false),
        orderBy('created_at', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    
    // Filter out soft-deleted notifications (if any exist from previous implementation)
    // Convert Firestore documents to NotificationData objects
    return querySnapshot.docs
      .filter(doc => {
        const data = doc.data();
        return !data.deleted; // Exclude soft-deleted notifications
      })
      .slice(0, limit) // Apply limit
      .map(doc => ({
        notification_id: doc.id,
        ...doc.data()
      })) as NotificationData[];
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * 
 * Counts the number of unread notifications for a user.
 * Used to display a badge count in the UI.
 * 
 * @param userId - ID of the user
 * @returns Promise resolving to the count of unread notifications
 * @throws Error if query fails
 */
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    // Query all unread notifications for this user
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('is_read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Filter out soft-deleted notifications and count
    const count = querySnapshot.docs.filter(doc => !doc.data().deleted).length;
    console.log('🔍 Unread count query for user:', userId, 'result:', count);
    return count;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * 
 * Permanently deletes a notification document from Firestore.
 * Used when user explicitly deletes a notification.
 * 
 * @param notificationId - ID of the notification document to delete
 * @returns Promise that resolves when deletion is complete
 * @throws Error if deletion fails
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    // Actually delete the notification document from Firestore
    // This is a hard delete (not soft delete)
    await deleteDoc(doc(db, 'notifications', notificationId));
    console.log('Notification deleted');
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Create session request notification
 * 
 * Helper function to create a notification when a new session request is made.
 * Sent to the interpreter who received the request.
 * 
 * @param userId - ID of the interpreter receiving the notification
 * @param sessionId - ID of the session being requested
 * @param interpreterName - Name of the user making the request (for display)
 * @returns Promise resolving to notification ID (or empty string if duplicate)
 */
export const createSessionRequestNotification = async (userId: string, sessionId: string, interpreterName: string): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_request',
    title: 'New Session Request',
    message: `You have a new session request from ${interpreterName}`,
    data: { session_id: sessionId }, // Include session ID for navigation
    priority: 'high' // High priority for new requests
  });
};

/**
 * Create session confirmed notification
 * 
 * Helper function to create a notification when a session is confirmed.
 * Sent to the deaf/mute user whose session was confirmed.
 * 
 * @param userId - ID of the user receiving the notification
 * @param sessionId - ID of the confirmed session
 * @param sessionTime - Scheduled time of the session
 * @returns Promise resolving to notification ID (or empty string if duplicate)
 */
export const createSessionConfirmedNotification = async (userId: string, sessionId: string, sessionTime: Date): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_confirmed',
    title: 'Session Confirmed',
    message: `Your session has been confirmed for ${sessionTime.toLocaleString()}`,
    data: { session_id: sessionId },
    priority: 'medium' // Medium priority for confirmations
  });
};

/**
 * Create session cancelled notification
 * 
 * Helper function to create a notification when a session is cancelled.
 * Can be sent to either the user or interpreter depending on who cancelled.
 * 
 * @param userId - ID of the user receiving the notification
 * @param sessionId - ID of the cancelled session
 * @param reason - Optional reason for cancellation
 * @returns Promise resolving to notification ID (or empty string if duplicate)
 */
export const createSessionCancelledNotification = async (userId: string, sessionId: string, reason?: string): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_cancelled',
    title: 'Session Cancelled',
    message: reason ? `Your session has been cancelled: ${reason}` : 'Your session has been cancelled',
    data: { session_id: sessionId },
    priority: 'medium' // Medium priority for cancellations
  });
};

/**
 * Create session reminder notification
 * 
 * Helper function to create a reminder notification 30 minutes before a session.
 * Sent to both the user and interpreter.
 * 
 * @param userId - ID of the user receiving the reminder
 * @param sessionId - ID of the session
 * @param sessionTime - Scheduled time of the session
 * @returns Promise resolving to notification ID (or empty string if duplicate)
 */
export const createSessionReminderNotification = async (userId: string, sessionId: string, sessionTime: Date): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_reminder',
    title: 'Session Reminder',
    message: `Your session is starting in 15 minutes at ${sessionTime.toLocaleString()}`,
    data: { session_id: sessionId },
    priority: 'high', // High priority for reminders
    expires_at: serverTimestamp() as Timestamp // Expire after session time
  });
};

/**
 * Create rating received notification
 * 
 * Helper function to create a notification when an interpreter receives a new rating.
 * Sent to the interpreter who was rated.
 * 
 * @param userId - ID of the interpreter receiving the notification
 * @param ratingId - ID of the rating document
 * @param raterName - Name of the user who submitted the rating
 * @param rating - Star rating value (1-5)
 * @returns Promise resolving to notification ID (or empty string if duplicate)
 */
export const createRatingReceivedNotification = async (userId: string, ratingId: string, raterName: string, rating: number): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'rating_received',
    title: 'New Rating Received',
    message: `You received a ${rating}-star rating from ${raterName}`,
    data: { rating_id: ratingId },
    priority: 'low' // Low priority for ratings (not urgent)
  });
};

/**
 * Create system update notification
 * 
 * Helper function to create system-wide update notifications.
 * Can be used for announcements, maintenance notices, etc.
 * 
 * @param userId - ID of the user receiving the notification
 * @param title - Notification title
 * @param message - Notification message
 * @param priority - Priority level (default: 'medium')
 * @returns Promise resolving to notification ID (or empty string if duplicate)
 */
export const createSystemUpdateNotification = async (userId: string, title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'system_update',
    title,
    message,
    priority
  });
};

/**
 * Get notifications by type
 * 
 * Retrieves notifications for a user filtered by a specific type.
 * Used to show filtered views in the notification center.
 * 
 * @param userId - ID of the user
 * @param type - Type of notifications to retrieve
 * @param limit - Maximum number of notifications to return (default: 10)
 * @returns Promise resolving to array of NotificationData objects
 * @throws Error if query fails
 */
export const getNotificationsByType = async (userId: string, type: NotificationData['type'], limit: number = 10): Promise<NotificationData[]> => {
  try {
    // Query notifications filtered by user and type, ordered by newest first
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('type', '==', type),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    // Convert Firestore documents to NotificationData objects and apply limit
    return querySnapshot.docs.slice(0, limit).map(doc => ({
      notification_id: doc.id,
      ...doc.data()
    })) as NotificationData[];
  } catch (error) {
    console.error('Error getting notifications by type:', error);
    throw error;
  }
};

/**
 * Clean up expired notifications
 * 
 * Marks expired notifications as read. This function would typically be run
 * by a Cloud Function on a schedule, but can also be called manually.
 * 
 * Note: This marks notifications as read rather than deleting them, preserving
 * notification history for auditing purposes.
 * 
 * @returns Promise that resolves when cleanup is complete
 * @throws Error if cleanup fails
 */
export const cleanupExpiredNotifications = async (): Promise<void> => {
  try {
    const now = new Date();
    
    // Query all notifications that have expired
    const q = query(
      collection(db, 'notifications'),
      where('expires_at', '<=', now)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Mark all expired notifications as read
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        is_read: true,
        read_at: serverTimestamp(),
        expired: true // Mark as expired for filtering
      })
    );
    
    await Promise.all(updatePromises);
    console.log('Expired notifications cleaned up');
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error);
    throw error;
  }
};

/**
 * Clear all notifications for a user
 * 
 * Marks all unread notifications for a user as read and cleared.
 * Used when user clicks "Clear all" in the notification center.
 * This is a soft delete (marks as cleared, doesn't actually delete).
 * 
 * @param userId - ID of the user
 * @returns Promise that resolves when all notifications are cleared
 * @throws Error if clearing fails
 */
export const clearAllNotifications = async (userId: string): Promise<void> => {
  try {
    // Query all unread notifications for this user
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('is_read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Mark all as read and cleared
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        is_read: true,
        read_at: serverTimestamp(),
        cleared: true // Mark as cleared for filtering
      })
    );
    
    await Promise.all(updatePromises);
    console.log('All notifications cleared for user:', userId);
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    throw error;
  }
};

/**
 * Clear old notifications (older than specified days)
 * 
 * Marks notifications older than the specified number of days as read and cleared.
 * Helps keep notification lists manageable by automatically cleaning up old items.
 * 
 * Uses a fallback method if Firestore composite index is not available.
 * 
 * @param userId - ID of the user
 * @param daysOld - Number of days old to consider for clearing (default: 7)
 * @returns Promise that resolves when old notifications are cleared
 */
export const clearOldNotifications = async (userId: string, daysOld: number = 7): Promise<void> => {
  try {
    // Calculate cutoff date (notifications older than this will be cleared)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // First try with the composite index query (more efficient)
    try {
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        where('created_at', '<=', cutoffDate)
      );
      
      const querySnapshot = await getDocs(q);
      const updatePromises = querySnapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          is_read: true,
          read_at: serverTimestamp(),
          cleared: true
        })
      );
      
      await Promise.all(updatePromises);
      console.log(`Cleared notifications older than ${daysOld} days for user:`, userId);
    } catch {
      // If index is not ready, fall back to client-side filtering
      // This is less efficient but works without requiring composite index setup
      console.log('Index not ready, using fallback method for clearing old notifications');
      
      // Get all notifications for user
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Filter old notifications in memory
      const oldNotifications = querySnapshot.docs.filter(doc => {
        const data = doc.data();
        const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
        return createdAt <= cutoffDate;
      });
      
      // Mark old notifications as cleared
      const updatePromises = oldNotifications.map(doc => 
        updateDoc(doc.ref, {
          is_read: true,
          read_at: serverTimestamp(),
          cleared: true
        })
      );
      
      await Promise.all(updatePromises);
      console.log(`Cleared ${oldNotifications.length} old notifications for user:`, userId);
    }
  } catch (error) {
    console.error('Error clearing old notifications:', error);
    // Don't throw error to prevent breaking the notification system
    // This is a cleanup operation, so failures shouldn't break the app
    console.log('Continuing without clearing old notifications');
    // Return silently to prevent the error from propagating
    return;
  }
};

/**
 * Delete duplicate notifications
 * 
 * Finds and marks duplicate notifications (same type, same session, same user).
 * Keeps only the most recent notification of each type/session combination.
 * 
 * This helps clean up duplicate notifications that may have been created due to
 * race conditions or multiple triggers.
 * 
 * @param userId - ID of the user
 * @returns Promise that resolves when duplicates are processed
 * @throws Error if processing fails
 */
export const deleteDuplicateNotifications = async (userId: string): Promise<void> => {
  try {
    // Get all notifications for user, ordered by most recent first
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (NotificationData & { id: string })[];
    
    // Group notifications by type and session_id to find duplicates
    // Key format: "type-session_id" or "type-no-session"
    const grouped = notifications.reduce((acc, notification) => {
      const key = `${notification.type}-${notification.data?.session_id || 'no-session'}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(notification);
      return acc;
    }, {} as Record<string, (NotificationData & { id: string })[]>);
    
    // Identify duplicates: keep first (most recent), mark others as duplicates
    const duplicatesToDelete: string[] = [];
    Object.values(grouped).forEach(group => {
      if (group.length > 1) {
        // Keep the first one (most recent), mark others as duplicates
        duplicatesToDelete.push(...group.slice(1).map(n => n.id));
      }
    });
    
    // Mark duplicates as read and duplicate (soft delete)
    const updatePromises = duplicatesToDelete.map(id => 
      updateDoc(doc(db, 'notifications', id), {
        is_read: true,
        read_at: serverTimestamp(),
        duplicate: true // Mark as duplicate for filtering
      })
    );
    
    await Promise.all(updatePromises);
    console.log(`Deleted ${duplicatesToDelete.length} duplicate notifications for user:`, userId);
  } catch (error) {
    console.error('Error deleting duplicate notifications:', error);
    throw error;
  }
};