/**
 * Notification Monitor Service
 * 
 * This service monitors Firestore for session changes and automatically creates
 * in-app notifications for users. It uses real-time listeners to detect changes
 * and prevents duplicate notifications.
 * 
 * Features:
 * - Real-time monitoring of session status changes
 * - Automatic notification creation for session events
 * - 30-minute reminder notifications before sessions
 * - Duplicate prevention (in-memory and database checks)
 * - Processing locks to prevent race conditions
 * - Skips initial cache loads to avoid false notifications
 * 
 * Notification Flows:
 * 1. New session request → Notify interpreter
 * 2. Session confirmed → Notify user (deaf/mute)
 * 3. Session cancelled/rejected → Notify appropriate party
 * 4. Session reminder (30 min before) → Notify both parties
 */

import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc,
  getDoc,
  updateDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { createNotification } from './notificationService';

/**
 * SessionData Interface
 * 
 * Represents a session document from Firestore.
 */
export interface SessionData {
  id: string;
  user_id: string;
  interpreter_id: string;
  status: 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  scheduled_time: Timestamp;
  reminderSent?: boolean; // Whether reminder notification has been sent
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * UserData Interface
 * 
 * Represents user data needed for notifications.
 */
export interface UserData {
  id: string;
  full_name: string;
  fcmToken?: string; // FCM token for push notifications
  role: 'deaf_mute' | 'interpreter';
}

/**
 * NotificationMonitor Class
 * 
 * Monitors Firestore sessions for changes and creates notifications.
 * Uses singleton pattern - only one instance per user.
 */
class NotificationMonitor {
  // Firestore snapshot unsubscribe functions
  private sessionUnsubscribeInterpreter: (() => void) | null = null; // Unsubscribe function for interpreter sessions listener
  private sessionUnsubscribeUser: (() => void) | null = null; // Unsubscribe function for user sessions listener
  private reminderInterval: NodeJS.Timeout | null = null; // Interval timer for reminder checks
  
  // Duplicate prevention: Track processed notifications by sessionId + notification type
  private processedNotifications: Map<string, Set<string>> = new Map();
  
  // Current user ID being monitored
  private currentUserId: string | null = null;
  
  // Track initial loads to skip cache snapshots (prevent false notifications)
  private isInitialLoadInterpreter: boolean = true; // For interpreter sessions listener
  private isInitialLoadUser: boolean = true; // For user sessions listener
  
  // Processing locks to prevent concurrent processing of same session
  private processingLocks: Map<string, Promise<void>> = new Map();

  /**
   * Constructor
   * 
   * Initializes the notification monitor for a user and starts monitoring.
   * 
   * @param userId - Optional user ID to monitor (can be set later)
   */
  constructor(userId?: string) {
    this.currentUserId = userId || null;
    try {
      if (this.currentUserId) {
        this.startSessionMonitoring();
        this.startReminderMonitoring();
      } else {
        console.warn('Notification monitor initialized without user ID');
      }
    } catch (error) {
      console.error('Error initializing notification monitor:', error);
    }
  }

  /**
   * Update current user ID
   * 
   * Changes the user being monitored. Cleans up existing listeners
   * and starts new ones for the new user.
   * 
   * @param userId - New user ID to monitor
   */
  public setCurrentUser(userId: string): void {
    this.currentUserId = userId;
    // Restart monitoring with new user
    this.cleanup();
    this.startSessionMonitoring();
    this.startReminderMonitoring();
    
  }

  /**
   * FLOW 1: Monitor for new session requests and status changes
   * 
   * Sets up real-time Firestore listeners for sessions where the current user
   * is either the interpreter or the user (deaf/mute). Processes changes and
   * creates notifications accordingly.
   */
  private startSessionMonitoring(): void {
    if (!this.currentUserId) {
      console.warn('Cannot start session monitoring without user ID');
      return;
    }

    console.log(' Starting session monitoring for user:', this.currentUserId);
    
    // Listen to sessions where current user is the interpreter
    const interpreterSessionsQuery = query(
      collection(db, 'sessions'),
      where('interpreter_id', '==', this.currentUserId),
      where('status', 'in', ['requested', 'confirmed', 'cancelled'])
      
    );

    this.sessionUnsubscribeInterpreter = onSnapshot(interpreterSessionsQuery, async (snapshot) => {
      console.log('Interpreter sessions snapshot received:', snapshot.docs.length, 'documents', 'fromCache:', snapshot.metadata.fromCache);
      
      // Skip initial load (from cache) - only process actual changes
      if (snapshot.metadata.fromCache && this.isInitialLoadInterpreter) {
        console.log('Skipping initial cache load for interpreter sessions');
        this.isInitialLoadInterpreter = false;
        return;
      }
      this.isInitialLoadInterpreter = false;
      
      // Only process if there are actual changes
      if (snapshot.docChanges().length === 0) {
        console.log('No changes in interpreter sessions snapshot');
        return;
      }
      
      // Process changes sequentially to avoid race conditions
      for (const change of snapshot.docChanges()) {
        const sessionData = { id: change.doc.id, ...change.doc.data() } as SessionData;
        
        // Skip if already processing this session
        const lockKey = `interpreter_${sessionData.id}_${change.type}`;
        if (this.processingLocks.has(lockKey)) {
          console.log('Already processing interpreter session change:', lockKey);
          continue;
        }
        
        console.log('📊 Interpreter session change detected:', {
          type: change.type,
          sessionId: sessionData.id,
          userId: sessionData.user_id,
          interpreterId: sessionData.interpreter_id,
          currentUserId: this.currentUserId,
          status: sessionData.status
        });
        
        // Create processing lock
        const processPromise = (async () => {
          try {
            if (change.type === 'added') {
              // Only send notification to interpreter for new requests
              await this.handleNewSessionRequest(sessionData);
            } else if (change.type === 'modified') {
              // Only send status change notifications to the user (deaf/mute)
              // Interpreter doesn't need to be notified of their own status changes
              console.log(' Interpreter session modified - no notification needed for interpreter');
            }
          } finally {
            this.processingLocks.delete(lockKey);
          }
        })();
        
        this.processingLocks.set(lockKey, processPromise);
        await processPromise;
      }
    }, (error) => {
      console.error('Error in interpreter session monitoring:', error);
    });

    // Listen to sessions where current user is the user (deaf/mute)
    const userSessionsQuery = query(
      collection(db, 'sessions'),
      where('user_id', '==', this.currentUserId),
      where('status', 'in', ['requested', 'confirmed', 'cancelled'])
    
    );

    this.sessionUnsubscribeUser = onSnapshot(userSessionsQuery, async (snapshot) => {
      console.log(' User sessions snapshot received:', snapshot.docs.length, 'documents', 'fromCache:', snapshot.metadata.fromCache);
      
      // Skip initial load (from cache) - only process actual changes
      if (snapshot.metadata.fromCache && this.isInitialLoadUser) {
        console.log('Skipping initial cache load for user sessions');
        this.isInitialLoadUser = false;
        return;
      }
      this.isInitialLoadUser = false;
      
      // Only process if there are actual changes
      if (snapshot.docChanges().length === 0) {
        console.log('No changes in user sessions snapshot');
        return;
      }
      
      // Process changes sequentially to avoid race conditions
      for (const change of snapshot.docChanges()) {
        const sessionData = { id: change.doc.id, ...change.doc.data() } as SessionData;
        
        // Skip if already processing this session
        const lockKey = `user_${sessionData.id}_${change.type}`;
        if (this.processingLocks.has(lockKey)) {
          console.log('Already processing user session change:', lockKey);
          continue;
        }
        
        console.log(' User session change detected:', {
          type: change.type,
          sessionId: sessionData.id,
          userId: sessionData.user_id,
          interpreterId: sessionData.interpreter_id,
          currentUserId: this.currentUserId,
          status: sessionData.status
        });
        
        // Create processing lock
        const processPromise = (async () => {
          try {
            if (change.type === 'added') {
              // User doesn't need notification for their own session creation
              console.log(' User session created - no notification needed for user');
            } else if (change.type === 'modified') {
              // Only send status change notifications to the user (deaf/mute)
              await this.handleSessionStatusChange(sessionData);
            }
          } finally {
            this.processingLocks.delete(lockKey);
          }
        })();
        
        this.processingLocks.set(lockKey, processPromise);
        await processPromise;
      }
    }, (error) => {
      console.error('Error in user session monitoring:', error);
    });
  }

  /**
   * FLOW 1: Handle new session request
   * 
   * Creates a notification for the interpreter when a new session request is received.
   * Checks for duplicates before creating notification.
   * 
   * @param sessionData - Session data from Firestore
   */
  private async handleNewSessionRequest(sessionData: SessionData): Promise<void> {
    if (sessionData.status !== 'requested') return;
    
    // Check if we've already processed this notification (in-memory check)
    if (!this.processedNotifications.has(sessionData.id)) {
      this.processedNotifications.set(sessionData.id, new Set());
    }
    if (this.processedNotifications.get(sessionData.id)?.has('session_request')) {
      console.log('Session request notification already processed (in-memory):', sessionData.id);
      return;
    }
    
    console.log(' New session request detected:', sessionData.id);
    
    try {
      // Create in-app notification for interpreter
      // The createNotification function will check for duplicates in the database
      const notificationId = await createNotification({
        user_id: sessionData.interpreter_id,
        type: 'session_request',
        title: 'New Session Request',
        message: 'You have a new interpretation request.',
        data: {
          session_id: sessionData.id,
          user_id: sessionData.user_id
        },
        priority: 'high'
      });

      // Only mark as processed if notification was actually created
      if (notificationId) {
        this.processedNotifications.get(sessionData.id)?.add('session_request');
        console.log(' New request notification created with ID:', notificationId);
      } else {
        console.log(' Notification already exists in database, skipped:', sessionData.id);
        // Still mark as processed to prevent retries
        this.processedNotifications.get(sessionData.id)?.add('session_request');
      }
    } catch (error) {
      console.error(' Error handling new session request:', error);
    }
  }

  /**
   * FLOW 2 & 3: Handle session status changes
   * 
   * Processes session status changes (confirmed, rejected, cancelled) and
   * creates appropriate notifications. Only notifies the user (deaf/mute),
   * not the interpreter (they initiated the change).
   * 
   * @param sessionData - Session data from Firestore
   */
  private async handleSessionStatusChange(sessionData: SessionData): Promise<void> {
    // Determine notification type based on status
    let notificationType: string | null = null;
    if (sessionData.status === 'confirmed') {
      notificationType = 'session_confirmed';
    } else if (sessionData.status === 'rejected') {
      notificationType = 'session_cancelled'; // Using cancelled type for rejected
    } else if (sessionData.status === 'cancelled') {
      notificationType = 'session_cancelled';
    }
    
    if (!notificationType) {
      console.log('No notification type for status:', sessionData.status);
      return;
    }
    
    // Check if we've already processed this notification type for this session (in-memory check)
    if (!this.processedNotifications.has(sessionData.id)) {
      this.processedNotifications.set(sessionData.id, new Set());
    }
    if (this.processedNotifications.get(sessionData.id)?.has(notificationType)) {
      console.log('Notification already processed (in-memory):', sessionData.id, notificationType);
      return;
    }
    
    console.log(' Session status change detected:', sessionData.id, sessionData.status);
    
    try {
      let notificationId: string = '';
      if (sessionData.status === 'confirmed') {
        notificationId = await this.handleSessionConfirmed(sessionData);
        if (notificationId) {
          this.processedNotifications.get(sessionData.id)?.add('session_confirmed');
        }
      } else if (sessionData.status === 'rejected') {
        notificationId = await this.handleSessionRejected(sessionData);
        if (notificationId) {
          this.processedNotifications.get(sessionData.id)?.add('session_cancelled');
        }
      } else if (sessionData.status === 'cancelled') {
        notificationId = await this.handleSessionCancelled(sessionData);
        if (notificationId) {
          this.processedNotifications.get(sessionData.id)?.add('session_cancelled');
        }
      }
      
      // Mark as processed even if notification already existed (to prevent retries)
      if (!notificationId) {
        this.processedNotifications.get(sessionData.id)?.add(notificationType);
      }
    } catch (error) {
      console.error(' Error handling session status change:', error);
    }
  }

  /**
   * FLOW 2: Handle session confirmed
   * 
   * Creates a notification for the user (deaf/mute) when their session is confirmed.
   * 
   * @param sessionData - Session data from Firestore
   * @returns Notification ID if created, empty string if duplicate
   */
  private async handleSessionConfirmed(sessionData: SessionData): Promise<string> {
    console.log(' Session confirmed:', sessionData.id);
    
    try {
      // Create in-app notification for user
      // The createNotification function will check for duplicates in the database
      const notificationId = await createNotification({
        user_id: sessionData.user_id,
        type: 'session_confirmed',
        title: 'Session Confirmed',
        message: 'Your interpretation session has been confirmed.',
        data: {
          session_id: sessionData.id,
          interpreter_id: sessionData.interpreter_id
        },
        priority: 'medium'
      });

      if (notificationId) {
        console.log(' Session confirmed notification sent to user:', notificationId);
      } else {
        console.log(' Session confirmed notification already exists, skipped');
      }
      return notificationId;
    } catch (error) {
      console.error(' Error handling session confirmed:', error);
      return '';
    }
  }

  /**
   * FLOW 2: Handle session rejected
   * 
   * Creates a notification for the user (deaf/mute) when their session is rejected.
   * 
   * @param sessionData - Session data from Firestore
   * @returns Notification ID if created, empty string if duplicate
   */
  private async handleSessionRejected(sessionData: SessionData): Promise<string> {
    console.log(' Session rejected:', sessionData.id);
    
    try {
      // Create in-app notification for user
      // The createNotification function will check for duplicates in the database
      const notificationId = await createNotification({
        user_id: sessionData.user_id,
        type: 'session_cancelled',
        title: 'Session Rejected',
        message: 'Your interpretation session request was rejected.',
        data: {
          session_id: sessionData.id,
          interpreter_id: sessionData.interpreter_id
        },
        priority: 'medium'
      });

      if (notificationId) {
        console.log('Session rejected notification sent to user:', notificationId);
      } else {
        console.log('Session rejected notification already exists, skipped');
      }
      return notificationId;
    } catch (error) {
      console.error(' Error handling session rejected:', error);
      return '';
    }
  }

  /**
   * FLOW 3: Handle session cancelled
   * 
   * Creates a notification for the interpreter when a session is cancelled by the user.
   * 
   * @param sessionData - Session data from Firestore
   * @returns Notification ID if created, empty string if duplicate
   */
  private async handleSessionCancelled(sessionData: SessionData): Promise<string> {
    console.log(' Session cancelled:', sessionData.id);
    
    try {
      // Create in-app notification for interpreter
      // The createNotification function will check for duplicates in the database
      const notificationId = await createNotification({
        user_id: sessionData.interpreter_id,
        type: 'session_cancelled',
        title: 'Session Cancelled',
        message: 'The user has cancelled the session.',
        data: {
          session_id: sessionData.id,
          user_id: sessionData.user_id
        },
        priority: 'medium'
      });

      if (notificationId) {
        console.log(' Session cancelled notification sent to interpreter:', notificationId);
      } else {
        console.log(' Session cancelled notification already exists, skipped');
      }
      return notificationId;
    } catch (error) {
      console.error(' Error handling session cancelled:', error);
      return '';
    }
  }

  /**
   * FLOW 4: Monitor for 30-minute reminders
   * 
   * Sets up an interval to check for sessions that need reminder notifications.
   * Checks every 5 minutes for sessions starting in 30 minutes.
   */
  private startReminderMonitoring(): void {
    if (!this.currentUserId) {
      console.warn('Cannot start reminder monitoring without user ID');
      return;
    }

    console.log(' Starting reminder monitoring for user:', this.currentUserId);
    
    // Check every 5 minutes
    this.reminderInterval = setInterval(async () => {
      await this.checkReminders();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * FLOW 4: Check for sessions that need reminders
   * 
   * Queries Firestore for confirmed sessions starting in 30 minutes that haven't
   * received reminder notifications yet. Processes sessions where current user is involved.
   */
  private async checkReminders(): Promise<void> {
    if (!this.currentUserId) {
      console.warn('Cannot check reminders without user ID');
      return;
    }

    try {
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('status', '==', 'confirmed'),
        where('reminderSent', '==', false),
        where('scheduled_time', '<=', Timestamp.fromDate(thirtyMinutesFromNow)),
        where('scheduled_time', '>', Timestamp.fromDate(now))
      );

      const snapshot = await getDocs(sessionsQuery);
      
      // Process sequentially to avoid race conditions
      for (const doc of snapshot.docs) {
        const sessionData = { id: doc.id, ...doc.data() } as SessionData;
        
        // Only process sessions where the current user is involved
        if (sessionData.user_id === this.currentUserId || sessionData.interpreter_id === this.currentUserId) {
          await this.sendReminderNotification(sessionData);
        }
      }
    } catch (error) {
      console.error(' Error checking reminders:', error);
    }
  }

  /**
   * FLOW 4: Send reminder notification
   * 
   * Sends reminder notifications to both the user and interpreter 30 minutes
   * before a session starts. Marks session as reminderSent to prevent duplicates.
   * 
   * @param sessionData - Session data from Firestore
   */
  private async sendReminderNotification(sessionData: SessionData): Promise<void> {
    console.log(' Sending reminder for session:', sessionData.id);
    
    // Check if reminder was already sent (double-check before sending)
    const sessionRef = doc(db, 'sessions', sessionData.id);
    const sessionDoc = await getDoc(sessionRef);
    if (sessionDoc.exists() && sessionDoc.data().reminderSent) {
      console.log('Reminder already sent for session:', sessionData.id);
      return;
    }
    
    // Check if we've already processed this reminder (in-memory check)
    if (!this.processedNotifications.has(sessionData.id)) {
      this.processedNotifications.set(sessionData.id, new Set());
    }
    if (this.processedNotifications.get(sessionData.id)?.has('session_reminder')) {
      console.log('Reminder already processed (in-memory):', sessionData.id);
      return;
    }
    
    try {
      // Send to user (createNotification will check for duplicates in database)
      const userNotificationId = await createNotification({
        user_id: sessionData.user_id,
        type: 'session_reminder',
        title: 'Session Reminder',
        message: 'Your session starts in 30 minutes.',
        data: {
          session_id: sessionData.id,
          interpreter_id: sessionData.interpreter_id
        },
        priority: 'high'
      });

      // Send to interpreter (createNotification will check for duplicates in database)
      const interpreterNotificationId = await createNotification({
        user_id: sessionData.interpreter_id,
        type: 'session_reminder',
        title: 'Session Reminder',
        message: 'Your session starts in 30 minutes.',
        data: {
          session_id: sessionData.id,
          user_id: sessionData.user_id
        },
        priority: 'high'
      });

      // Only update session if at least one notification was created
      if (userNotificationId || interpreterNotificationId) {
        // Update session to mark reminder as sent
        await updateDoc(sessionRef, {
          reminderSent: true
        });
        // Mark as processed
        this.processedNotifications.get(sessionData.id)?.add('session_reminder');
        console.log(' Reminder notifications sent for session:', sessionData.id);
      } else {
        console.log(' Reminder notifications already exist, skipped');
        // Still mark as processed to prevent retries
        this.processedNotifications.get(sessionData.id)?.add('session_reminder');
      }
    } catch (error) {
      console.error(' Error sending reminder notification:', error);
    }
  }


  /**
   * Cleanup method
   * 
   * Stops all listeners, clears intervals, and resets state.
   * Call this when user logs out or monitoring is no longer needed.
   */
  public cleanup(): void {
    if (this.sessionUnsubscribeInterpreter) {
      this.sessionUnsubscribeInterpreter();
      this.sessionUnsubscribeInterpreter = null;
    }
    if (this.sessionUnsubscribeUser) {
      this.sessionUnsubscribeUser();
      this.sessionUnsubscribeUser = null;
    }
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
    // Clear processed notifications when cleaning up
    this.processedNotifications.clear();
    this.processingLocks.clear();
    this.isInitialLoadInterpreter = true;
    this.isInitialLoadUser = true;
    console.log(' Notification monitoring stopped');
  }

}

// Export singleton instance (will be initialized with user ID)
// Only one monitor instance exists at a time
let notificationMonitor: NotificationMonitor | null = null;

/**
 * Start notification monitoring for a user
 * 
 * Initializes or updates the notification monitor singleton for a user.
 * If monitor already exists, updates it with new user ID.
 * 
 * @param userId - User ID to monitor
 */
export const startNotificationMonitoring = (userId: string): void => {
  console.log(' Starting notification monitoring for user:', userId);
  if (notificationMonitor) {
    notificationMonitor.setCurrentUser(userId);
  } else {
    notificationMonitor = new NotificationMonitor(userId);
  }
};

/**
 * Stop notification monitoring
 * 
 * Stops the notification monitor and cleans up all listeners.
 */
export const stopNotificationMonitoring = (): void => {
  if (notificationMonitor) {
    notificationMonitor.cleanup();
  }
};

/**
 * Clear all notifications for a user
 * 
 * Wrapper function to clear all notifications for a user.
 * Used by UI components.
 * 
 * @param userId - User ID whose notifications to clear
 */
export const clearAllUserNotifications = async (userId: string): Promise<void> => {
  const { clearAllNotifications } = await import('./notificationService');
  await clearAllNotifications(userId);
};

/**
 * Clear old notifications for a user
 * 
 * Wrapper function to clear notifications older than specified days.
 * 
 * @param userId - User ID whose notifications to clear
 * @param daysOld - Number of days old to consider (default: 7)
 */
export const clearOldUserNotifications = async (userId: string, daysOld: number = 7): Promise<void> => {
  const { clearOldNotifications } = await import('./notificationService');
  await clearOldNotifications(userId, daysOld);
};

/**
 * Remove duplicate notifications for a user
 * 
 * Wrapper function to remove duplicate notifications for a user.
 * 
 * @param userId - User ID whose duplicate notifications to remove
 */
export const removeDuplicateUserNotifications = async (userId: string): Promise<void> => {
  const { deleteDuplicateNotifications } = await import('./notificationService');
  await deleteDuplicateNotifications(userId);
};
