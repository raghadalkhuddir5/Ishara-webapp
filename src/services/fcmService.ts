/**
 * Firebase Cloud Messaging (FCM) Service
 * 
 * This service handles Firebase Cloud Messaging for push notifications.
 * It manages FCM token registration, service worker setup, and foreground
 * message handling.
 * 
 * Features:
 * - Register service worker for background notifications
 * - Request notification permissions
 * - Generate and save FCM tokens
 * - Handle foreground messages
 * - Display browser notifications
 * 
 * Note: This service works alongside the notification monitor for in-app
 * notifications. FCM tokens are stored in user documents for server-side
 * push notification sending.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '../firebase';
import type { NotificationPayload } from '../types/services';

// VAPID key for FCM token generation (from Firebase Console)
// This key is used to authenticate the app with Firebase Cloud Messaging
const VAPID_KEY = 'BI0Jb9kj3HOS-Dxn3Kdh3AbxXbwqn46NFrN3aZljk0MV6F8PMNBPnaOTjDuSJuAMPVdiK43Rr_QBchEhyyp3c2A';

// Initialize Firebase Messaging
let messaging: ReturnType<typeof getMessaging> | null = null; // Firebase messaging instance
let swRegistration: ServiceWorkerRegistration | null = null; // Service worker registration

/**
 * Register service worker
 * 
 * Registers the Firebase messaging service worker for background notifications.
 * The service worker handles notifications when the app is in the background.
 * 
 * @returns Promise resolving to service worker registration or null if not supported
 */
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered successfully:', registration);
      return registration;
    } else {
      console.warn('Service Worker not supported');
      return null;
    }
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

try {
  messaging = getMessaging();
} catch (error) {
  console.warn('Firebase messaging not available:', error);
}

/**
 * Save FCM token to user document
 * 
 * Saves the FCM token to the user's Firestore document. This token is used
 * by server-side code to send push notifications to the user's device.
 * 
 * @param userId - User ID whose token to save
 * @param token - FCM token string
 */
export const saveFCMTokenToUser = async (userId: string, token: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      fcmToken: token,
      fcmTokenUpdatedAt: new Date()
    }, { merge: true });
    console.log('FCM token saved to user document:', userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
};

/**
 * Send push notification using client-side approach
 * 
 * Displays a browser notification if permission is granted.
 * Note: This is a client-side implementation. For true push notifications
 * when app is closed, use server-side FCM sending with the stored token.
 * 
 * @param payload - Notification payload with title, body, icon, etc.
 * @returns Promise resolving to true if notification was shown, false otherwise
 */
export const sendPushNotification = async (payload: NotificationPayload): Promise<boolean> => {
  try {
    console.log('Creating in-app notification:', payload);
    
    // For now, we'll create in-app notifications and use browser notifications
    // This works without requiring server-side FCM sending
    
    // Show browser notification if permission is granted
    if (Notification.permission === 'granted') {
      const notification = new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: payload.notification.icon || '/vite.svg',
        data: payload.notification.data || {}
      });
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      console.log('Browser notification shown successfully');
    }
    
    
    console.log('In-app notification will be created by notification monitor');
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

/**
 * Handle foreground messages
 * 
 * Sets up a listener for FCM messages received when the app is in the foreground.
 * Displays browser notifications for foreground messages.
 */
export const setupForegroundMessageHandler = (): void => {
  if (!messaging) {
    console.warn('Firebase messaging not available');
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    
    // Show notification in foreground
    if (payload.notification) {
      new Notification(payload.notification.title || 'Notification', {
        body: payload.notification.body || 'You have a new notification',
        icon: payload.notification.icon || '/vite.svg',
        data: payload.data || {}
      });
    }
  });
};

/**
 * Get FCM token from user document
 * 
 * Retrieves the stored FCM token from the user's Firestore document.
 * 
 * @param userId - User ID whose token to retrieve
 * @returns Promise resolving to FCM token or null if not found
 */
export const getFCMTokenFromUser = async (userId: string): Promise<string | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.fcmToken || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting FCM token from user:', error);
    return null;
  }
};

/**
 * Request permission and get FCM token
 * 
 * Requests browser notification permission and generates an FCM token.
 * Registers service worker if needed. Handles permission denial gracefully.
 * 
 * @returns Promise resolving to FCM token or null if permission denied/unavailable
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    if (!messaging) {
      console.warn('Firebase messaging not available');
      return null;
    }

    // Register service worker first
    if (!swRegistration) {
      console.log('Registering service worker...');
      swRegistration = await registerServiceWorker();
      if (!swRegistration) {
        console.error('Failed to register service worker');
        return null;
      }
    }

    // Check current permission status
    const currentPermission = Notification.permission;
    console.log('Current notification permission:', currentPermission);

    if (currentPermission === 'denied') {
      console.warn('Notification permission is denied. User needs to reset it in browser settings.');
      alert('Notifications are blocked. Please click the lock icon in your address bar and allow notifications, then refresh the page.');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    console.log('Notification permission result:', permission);
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    console.log('Notification permission granted');

    // Get FCM token with service worker
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration
    });

    if (token) {
      console.log('FCM token generated:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.log('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Initialize FCM for the current user
 * 
 * Complete FCM initialization flow:
 * 1. Request notification permission
 * 2. Generate FCM token
 * 3. Save token to user document
 * 4. Set up foreground message handler
 * 
 * Call this when user logs in to enable push notifications.
 * 
 * @param userId - User ID to initialize FCM for
 */
export const initializeFCM = async (userId: string): Promise<void> => {
  try {
    // Request permission and get token
    const token = await requestNotificationPermission();
    
    if (token) {
      // Save token to user document
      await saveFCMTokenToUser(userId, token);
      console.log('FCM initialized successfully');
      
      // Set up foreground message handler
      setupForegroundMessageHandler();
    } else {
      console.log('FCM initialization failed - no token generated');
    }
  } catch (error) {
    console.error('Error initializing FCM:', error);
  }
};