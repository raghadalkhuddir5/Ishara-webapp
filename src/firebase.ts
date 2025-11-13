/**
 * Firebase Configuration and Initialization
 * 
 * This module initializes Firebase services for the application.
 * It sets up Firebase Authentication and Firestore database connections.
 * 
 * Services Initialized:
 * - Firebase Authentication: For user login/signup
 * - Firestore Database: For storing application data (users, sessions, ratings, etc.)
 * 
 * Note: Firebase config contains sensitive API keys. In production, these should be
 * stored as environment variables and not committed to version control.
 */

// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase Configuration Object
 * 
 * Contains all necessary configuration for connecting to Firebase services.
 * These values are obtained from the Firebase Console project settings.
 * 
 * For Firebase JS SDK v7.20.0 and later, measurementId is optional.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCFrLqXRt1MbSLuZhbr8DIlkmnJAEMu4IE", // API key for Firebase services
  authDomain: "ishara-app-73a98.firebaseapp.com", // Domain for Firebase Authentication
  projectId: "ishara-app-73a98", // Firebase project ID
  storageBucket: "ishara-app-73a98.firebasestorage.app", // Cloud Storage bucket
  messagingSenderId: "904878479574", // Sender ID for Cloud Messaging
  appId: "1:904878479574:web:3c31f16eee5f33716cd177", // Web app ID
  measurementId: "G-4PM0GH0V9G" // Google Analytics measurement ID (optional)
};

/**
 * Initialize Firebase App
 * 
 * Creates the Firebase app instance using the configuration.
 * This must be done before using any Firebase services.
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication Instance
 * 
 * Exported for use throughout the application for user authentication.
 * Used for login, signup, and managing user sessions.
 */
export const auth = getAuth(app);

/**
 * Firestore Database Instance
 * 
 * Exported for use throughout the application for database operations.
 * Used for reading/writing user data, sessions, ratings, notifications, etc.
 */
export const db = getFirestore(app);

/**
 * Firebase App Instance
 * 
 * Exported for advanced Firebase operations if needed.
 */
export { app };

