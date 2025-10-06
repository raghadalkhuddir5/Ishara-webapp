import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  limit as limitQuery
} from 'firebase/firestore';
import { db } from '../firebase';

export interface NotificationData {
  notification_id?: string;
  user_id: string;
  type: 'session_request' | 'session_confirmed' | 'session_cancelled' | 
        'session_reminder' | 'rating_received' | 'system_update';
  title: string;
  message: string;
  data?: { // Additional data for the notification
    session_id?: string;
    rating_id?: string;
    [key: string]: any;
  };
  is_read: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: Timestamp;
  read_at?: Timestamp;
  expires_at?: Timestamp;
}

// Create a new notification
export const createNotification = async (notificationData: Omit<NotificationData, 'notification_id' | 'created_at' | 'is_read' | 'read_at'>): Promise<string> => {
  try {
    const newNotification: Omit<NotificationData, 'notification_id'> = {
      ...notificationData,
      is_read: false,
      created_at: serverTimestamp() as Timestamp
    };

    const docRef = await addDoc(collection(db, 'notifications'), newNotification);
    console.log('Notification created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      is_read: true,
      read_at: serverTimestamp()
    });
    console.log('Notification marked as read');
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Mark all notifications as read for a user
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('is_read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
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

// Get notifications for a user
export const getUserNotifications = async (userId: string, limit: number = 20, unreadOnly: boolean = false): Promise<NotificationData[]> => {
  try {
    let q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );

    if (unreadOnly) {
      q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        where('is_read', '==', false),
        orderBy('created_at', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.slice(0, limit).map(doc => ({
      notification_id: doc.id,
      ...doc.data()
    })) as NotificationData[];
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

// Get unread notification count for a user
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('is_read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    console.log('🔍 Unread count query for user:', userId, 'result:', querySnapshot.size);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    throw error;
  }
};

// Delete a notification
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    // Note: Firestore doesn't have a delete function in the client SDK
    // You would need to use a Cloud Function for this, or mark as deleted
    await updateDoc(doc(db, 'notifications', notificationId), {
      is_read: true,
      read_at: serverTimestamp(),
      // Add a deleted flag if you want to soft delete
      deleted: true
    });
    console.log('Notification deleted');
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// Create session request notification
export const createSessionRequestNotification = async (userId: string, sessionId: string, interpreterName: string): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_request',
    title: 'New Session Request',
    message: `You have a new session request from ${interpreterName}`,
    data: { session_id: sessionId },
    priority: 'high'
  });
};

// Create session confirmed notification
export const createSessionConfirmedNotification = async (userId: string, sessionId: string, sessionTime: Date): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_confirmed',
    title: 'Session Confirmed',
    message: `Your session has been confirmed for ${sessionTime.toLocaleString()}`,
    data: { session_id: sessionId },
    priority: 'medium'
  });
};

// Create session cancelled notification
export const createSessionCancelledNotification = async (userId: string, sessionId: string, reason?: string): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_cancelled',
    title: 'Session Cancelled',
    message: reason ? `Your session has been cancelled: ${reason}` : 'Your session has been cancelled',
    data: { session_id: sessionId },
    priority: 'medium'
  });
};

// Create session reminder notification
export const createSessionReminderNotification = async (userId: string, sessionId: string, sessionTime: Date): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'session_reminder',
    title: 'Session Reminder',
    message: `Your session is starting in 15 minutes at ${sessionTime.toLocaleString()}`,
    data: { session_id: sessionId },
    priority: 'high',
    expires_at: serverTimestamp() as Timestamp // Expire after session time
  });
};

// Create rating received notification
export const createRatingReceivedNotification = async (userId: string, ratingId: string, raterName: string, rating: number): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'rating_received',
    title: 'New Rating Received',
    message: `You received a ${rating}-star rating from ${raterName}`,
    data: { rating_id: ratingId },
    priority: 'low'
  });
};

// Create system update notification
export const createSystemUpdateNotification = async (userId: string, title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<string> => {
  return createNotification({
    user_id: userId,
    type: 'system_update',
    title,
    message,
    priority
  });
};

// Get notifications by type
export const getNotificationsByType = async (userId: string, type: NotificationData['type'], limit: number = 10): Promise<NotificationData[]> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('type', '==', type),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.slice(0, limit).map(doc => ({
      notification_id: doc.id,
      ...doc.data()
    })) as NotificationData[];
  } catch (error) {
    console.error('Error getting notifications by type:', error);
    throw error;
  }
};

// Clean up expired notifications (this would typically be done by a Cloud Function)
export const cleanupExpiredNotifications = async (): Promise<void> => {
  try {
    const now = new Date();
    const q = query(
      collection(db, 'notifications'),
      where('expires_at', '<=', now)
    );
    
    const querySnapshot = await getDocs(q);
    const updatePromises = querySnapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        is_read: true,
        read_at: serverTimestamp(),
        expired: true
      })
    );
    
    await Promise.all(updatePromises);
    console.log('Expired notifications cleaned up');
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error);
    throw error;
  }
};

// Clear all notifications for a user (mark as read and deleted)
export const clearAllNotifications = async (userId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      where('is_read', '==', false)
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
    console.log('All notifications cleared for user:', userId);
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    throw error;
  }
};

// Clear old notifications (older than specified days)
export const clearOldNotifications = async (userId: string, daysOld: number = 7): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // First try with the composite index query
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
    } catch (indexError) {
      // If index is not ready, fall back to client-side filtering
      console.log('Index not ready, using fallback method for clearing old notifications');
      
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const oldNotifications = querySnapshot.docs.filter(doc => {
        const data = doc.data();
        const createdAt = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
        return createdAt <= cutoffDate;
      });
      
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
    console.log('Continuing without clearing old notifications');
    // Return silently to prevent the error from propagating
    return;
  }
};

// Delete duplicate notifications (same type, same session, same user)
export const deleteDuplicateNotifications = async (userId: string): Promise<void> => {
  try {
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
    
    // Group by type and session_id to find duplicates
    const grouped = notifications.reduce((acc, notification) => {
      const key = `${notification.type}-${notification.data?.session_id || 'no-session'}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(notification);
      return acc;
    }, {} as Record<string, (NotificationData & { id: string })[]>);
    
    // Keep only the first (most recent) notification of each type/session
    const duplicatesToDelete: string[] = [];
    Object.values(grouped).forEach(group => {
      if (group.length > 1) {
        // Keep the first one, mark others as duplicates
        duplicatesToDelete.push(...group.slice(1).map(n => n.id));
      }
    });
    
    // Mark duplicates as deleted
    const updatePromises = duplicatesToDelete.map(id => 
      updateDoc(doc(db, 'notifications', id), {
        is_read: true,
        read_at: serverTimestamp(),
        duplicate: true
      })
    );
    
    await Promise.all(updatePromises);
    console.log(`Deleted ${duplicatesToDelete.length} duplicate notifications for user:`, userId);
  } catch (error) {
    console.error('Error deleting duplicate notifications:', error);
    throw error;
  }
};