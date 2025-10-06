// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in service worker
const firebaseConfig = {
  apiKey: "AIzaSyCFrLqXRt1MbSLuZhbr8DIlkmnJAEMu4IE",
  authDomain: "ishara-app-73a98.firebaseapp.com",
  projectId: "ishara-app-73a98",
  storageBucket: "ishara-app-73a98.firebasestorage.app",
  messagingSenderId: "904878479574",
  appId: "1:904878479574:web:3c31f16eee5f33716cd177",
  measurementId: "G-4PM0GH0V9G"
};

firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/vite.svg',
    badge: payload.notification?.badge || '/vite.svg',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  // Handle different notification types
  const data = event.notification.data;
  if (data && data.sessionId) {
    // Open the app and navigate to the session
    event.waitUntil(
      clients.openWindow(`/call/${data.sessionId}`)
    );
  } else {
    // Open the app to the main page
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});