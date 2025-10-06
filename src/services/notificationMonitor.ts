import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  doc,
  updateDoc,
  addDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  getFCMTokenFromUser
} from './fcmService';
import { createNotification, deleteDuplicateNotifications, clearOldNotifications } from './notificationService';
import type { NotificationData } from '../types/services';

export interface SessionData {
  id: string;
  user_id: string;
  interpreter_id: string;
  status: 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  scheduled_time: Timestamp;
  reminderSent?: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserData {
  id: string;
  full_name: string;
  fcmToken?: string;
  role: 'deaf_mute' | 'interpreter';
}

class NotificationMonitor {
  private sessionUnsubscribeInterpreter: (() => void) | null = null;
  private sessionUnsubscribeUser: (() => void) | null = null;
  private reminderInterval: NodeJS.Timeout | null = null;
  private processedSessions: Set<string> = new Set();
  private currentUserId: string | null = null;

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

  // Update current user ID
  public setCurrentUser(userId: string): void {
    this.currentUserId = userId;
    // Restart monitoring with new user
    this.cleanup();
    this.startSessionMonitoring();
    this.startReminderMonitoring();
    // Clean up duplicates and old notifications (temporarily disabled for debugging)
    // this.cleanupNotifications();
  }

  // FLOW 1: Monitor for new session requests
  private startSessionMonitoring(): void {
    if (!this.currentUserId) {
      console.warn('Cannot start session monitoring without user ID');
      return;
    }

    console.log('🔔 Starting session monitoring for user:', this.currentUserId);
    
    // Listen to sessions where current user is the interpreter
    const interpreterSessionsQuery = query(
      collection(db, 'sessions'),
      where('interpreter_id', '==', this.currentUserId),
      where('status', 'in', ['requested', 'confirmed', 'cancelled'])
      // Temporarily removed orderBy to avoid index requirement
      // orderBy('created_at', 'desc'),
      // limit(50)
    );

    this.sessionUnsubscribeInterpreter = onSnapshot(interpreterSessionsQuery, async (snapshot) => {
      console.log('📊 Interpreter sessions snapshot received:', snapshot.docs.length, 'documents');
      
      snapshot.docChanges().forEach(async (change) => {
        const sessionData = { id: change.doc.id, ...change.doc.data() } as SessionData;
        
        console.log('📊 Interpreter session change detected:', {
          type: change.type,
          sessionId: sessionData.id,
          userId: sessionData.user_id,
          interpreterId: sessionData.interpreter_id,
          currentUserId: this.currentUserId,
          status: sessionData.status
        });
        
        console.log('✅ Processing interpreter session - current user is interpreter');
        
        if (change.type === 'added') {
          // Only send notification to interpreter for new requests
          await this.handleNewSessionRequest(sessionData);
        } else if (change.type === 'modified') {
          // Only send status change notifications to the user (deaf/mute)
          // Interpreter doesn't need to be notified of their own status changes
          console.log('📝 Interpreter session modified - no notification needed for interpreter');
        }
      });
    }, (error) => {
      console.error('Error in interpreter session monitoring:', error);
    });

    // Listen to sessions where current user is the user (deaf/mute)
    const userSessionsQuery = query(
      collection(db, 'sessions'),
      where('user_id', '==', this.currentUserId),
      where('status', 'in', ['requested', 'confirmed', 'cancelled'])
      // Temporarily removed orderBy to avoid index requirement
      // orderBy('created_at', 'desc'),
      // limit(50)
    );

    this.sessionUnsubscribeUser = onSnapshot(userSessionsQuery, async (snapshot) => {
      console.log('📊 User sessions snapshot received:', snapshot.docs.length, 'documents');
      
      snapshot.docChanges().forEach(async (change) => {
        const sessionData = { id: change.doc.id, ...change.doc.data() } as SessionData;
        
        console.log('📊 User session change detected:', {
          type: change.type,
          sessionId: sessionData.id,
          userId: sessionData.user_id,
          interpreterId: sessionData.interpreter_id,
          currentUserId: this.currentUserId,
          status: sessionData.status
        });
        
        console.log('✅ Processing user session - current user is user');
        
        if (change.type === 'added') {
          // User doesn't need notification for their own session creation
          console.log('📝 User session created - no notification needed for user');
        } else if (change.type === 'modified') {
          // Only send status change notifications to the user (deaf/mute)
          await this.handleSessionStatusChange(sessionData, change.doc.metadata.fromCache);
        }
      });
    }, (error) => {
      console.error('Error in user session monitoring:', error);
    });
  }

  // FLOW 1: Handle new session request
  private async handleNewSessionRequest(sessionData: SessionData): Promise<void> {
    if (sessionData.status !== 'requested') return;
    
    console.log('📝 New session request detected:', sessionData.id);
    console.log('📝 Session data:', sessionData);
    
    try {
      // Get interpreter data
      console.log('🔍 Getting interpreter data for:', sessionData.interpreter_id);
      const interpreterData = await this.getUserData(sessionData.interpreter_id);
      console.log('🔍 Interpreter data:', interpreterData);
      
      if (!interpreterData?.fcmToken) {
        console.log('⚠️ No FCM token for interpreter:', sessionData.interpreter_id);
        console.log('⚠️ Interpreter data available:', !!interpreterData);
        console.log('⚠️ FCM token available:', !!interpreterData?.fcmToken);
        return;
      }

      // Create in-app notification (browser notification handled by service worker)
      console.log('📝 Creating notification for interpreter:', sessionData.interpreter_id);
      
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

      console.log('✅ New request notification created with ID:', notificationId);
    } catch (error) {
      console.error('❌ Error handling new session request:', error);
    }
  }

  // FLOW 2 & 3: Handle session status changes
  private async handleSessionStatusChange(sessionData: SessionData, fromCache: boolean): Promise<void> {
    // Skip if this is from cache (initial load)
    if (fromCache) return;
    
    // Skip if we've already processed this session
    if (this.processedSessions.has(sessionData.id)) return;
    
    console.log('📝 Session status change detected:', sessionData.id, sessionData.status);
    
    try {
      if (sessionData.status === 'confirmed') {
        await this.handleSessionConfirmed(sessionData);
      } else if (sessionData.status === 'rejected') {
        await this.handleSessionRejected(sessionData);
      } else if (sessionData.status === 'cancelled') {
        await this.handleSessionCancelled(sessionData);
      }
      
      // Mark as processed
      this.processedSessions.add(sessionData.id);
    } catch (error) {
      console.error('❌ Error handling session status change:', error);
    }
  }

  // FLOW 2: Handle session confirmed
  private async handleSessionConfirmed(sessionData: SessionData): Promise<void> {
    console.log('✅ Session confirmed:', sessionData.id);
    
    try {
      // Get user data
      const userData = await this.getUserData(sessionData.user_id);
      if (!userData?.fcmToken) {
        console.log('⚠️ No FCM token for user:', sessionData.user_id);
        return;
      }

      // Create in-app notification (browser notification handled by service worker)
      await createNotification({
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

      console.log('✅ Session confirmed notification sent to user');
    } catch (error) {
      console.error('❌ Error handling session confirmed:', error);
    }
  }

  // FLOW 2: Handle session rejected
  private async handleSessionRejected(sessionData: SessionData): Promise<void> {
    console.log('❌ Session rejected:', sessionData.id);
    
    try {
      // Get user data
      const userData = await this.getUserData(sessionData.user_id);
      if (!userData?.fcmToken) {
        console.log('⚠️ No FCM token for user:', sessionData.user_id);
        return;
      }

      // Create in-app notification (browser notification handled by service worker)
      await createNotification({
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

      console.log('✅ Session rejected notification sent to user');
    } catch (error) {
      console.error('❌ Error handling session rejected:', error);
    }
  }

  // FLOW 3: Handle session cancelled
  private async handleSessionCancelled(sessionData: SessionData): Promise<void> {
    console.log('🚫 Session cancelled:', sessionData.id);
    
    try {
      // Get interpreter data
      const interpreterData = await this.getUserData(sessionData.interpreter_id);
      if (!interpreterData?.fcmToken) {
        console.log('⚠️ No FCM token for interpreter:', sessionData.interpreter_id);
        return;
      }

      // Create in-app notification (browser notification handled by service worker)
      await createNotification({
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

      console.log('✅ Session cancelled notification sent to interpreter');
    } catch (error) {
      console.error('❌ Error handling session cancelled:', error);
    }
  }

  // FLOW 4: Monitor for 30-minute reminders
  private startReminderMonitoring(): void {
    if (!this.currentUserId) {
      console.warn('Cannot start reminder monitoring without user ID');
      return;
    }

    console.log('⏰ Starting reminder monitoring for user:', this.currentUserId);
    
    // Check every 5 minutes
    this.reminderInterval = setInterval(async () => {
      await this.checkReminders();
    }, 5 * 60 * 1000); // 5 minutes
  }

  // FLOW 4: Check for sessions that need reminders
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
      
      snapshot.docs.forEach(async (doc) => {
        const sessionData = { id: doc.id, ...doc.data() } as SessionData;
        
        // Only process sessions where the current user is involved
        if (sessionData.user_id === this.currentUserId || sessionData.interpreter_id === this.currentUserId) {
          await this.sendReminderNotification(sessionData);
        }
      });
    } catch (error) {
      console.error('❌ Error checking reminders:', error);
    }
  }

  // FLOW 4: Send reminder notification
  private async sendReminderNotification(sessionData: SessionData): Promise<void> {
    console.log('⏰ Sending reminder for session:', sessionData.id);
    
    try {
      // Get both user and interpreter data
      const [userData, interpreterData] = await Promise.all([
        this.getUserData(sessionData.user_id),
        this.getUserData(sessionData.interpreter_id)
      ]);

      // Send to user
      if (userData?.fcmToken) {
        await createNotification({
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
      }

      // Send to interpreter
      if (interpreterData?.fcmToken) {
        await createNotification({
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
      }

      // Update session to mark reminder as sent
      const sessionRef = doc(db, 'sessions', sessionData.id);
      await updateDoc(sessionRef, {
        reminderSent: true
      });

      console.log('✅ Reminder notifications sent for session:', sessionData.id);
    } catch (error) {
      console.error('❌ Error sending reminder notification:', error);
    }
  }

  // Helper method to get user data
  private async getUserData(userId: string): Promise<UserData | null> {
    try {
      console.log('🔍 Fetching user data for ID:', userId);
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = { id: userDoc.id, ...userDoc.data() } as UserData;
        console.log('🔍 User data retrieved:', userData);
        console.log('🔍 FCM token in user data:', userData.fcmToken);
        return userData;
      } else {
        console.log('⚠️ User document does not exist for ID:', userId);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting user data:', error);
      return null;
    }
  }

  // Cleanup method
  public cleanup(): void {
    if (this.sessionUnsubscribeInterpreter) {
      this.sessionUnsubscribeInterpreter();
    }
    if (this.sessionUnsubscribeUser) {
      this.sessionUnsubscribeUser();
    }
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
    }
    console.log('🔔 Notification monitoring stopped');
  }

  // Clean up notifications (duplicates and old notifications)
  private async cleanupNotifications(): Promise<void> {
    if (!this.currentUserId) {
      console.warn('Cannot cleanup notifications without user ID');
      return;
    }

    try {
      console.log('🧹 Starting notification cleanup for user:', this.currentUserId);
      
      // Clean up duplicates (this should work without indexes)
      try {
        await deleteDuplicateNotifications(this.currentUserId);
        console.log('✅ Duplicate cleanup completed');
      } catch (duplicateError) {
        console.log('⚠️ Duplicate cleanup failed, continuing:', duplicateError);
      }
      
      // Clean up old notifications (older than 7 days) - this might need indexes
      try {
        await clearOldNotifications(this.currentUserId, 7);
        console.log('✅ Old notification cleanup completed');
      } catch (oldError) {
        console.log('⚠️ Old notification cleanup failed (indexes may still be building):', oldError);
        console.log('🔄 This is normal - cleanup will work once indexes are built');
      }
      
      console.log('✅ Notification cleanup process completed');
    } catch (error) {
      console.error('❌ Error during notification cleanup:', error);
      // Continue without cleanup - don't let this break the notification system
      console.log('🔄 Continuing notification monitoring despite cleanup error');
    }
  }
}

// Export singleton instance (will be initialized with user ID)
let notificationMonitor: NotificationMonitor | null = null;

// Export for manual initialization
export const startNotificationMonitoring = (userId: string): void => {
  console.log('🔔 Starting notification monitoring for user:', userId);
  if (notificationMonitor) {
    notificationMonitor.setCurrentUser(userId);
  } else {
    notificationMonitor = new NotificationMonitor(userId);
  }
};

// Export for cleanup
export const stopNotificationMonitoring = (): void => {
  if (notificationMonitor) {
    notificationMonitor.cleanup();
  }
};

// Export manual cleanup functions for UI
export const clearAllUserNotifications = async (userId: string): Promise<void> => {
  const { clearAllNotifications } = await import('./notificationService');
  await clearAllNotifications(userId);
};

export const clearOldUserNotifications = async (userId: string, daysOld: number = 7): Promise<void> => {
  const { clearOldNotifications } = await import('./notificationService');
  await clearOldNotifications(userId, daysOld);
};

export const removeDuplicateUserNotifications = async (userId: string): Promise<void> => {
  const { deleteDuplicateNotifications } = await import('./notificationService');
  await deleteDuplicateNotifications(userId);
};
