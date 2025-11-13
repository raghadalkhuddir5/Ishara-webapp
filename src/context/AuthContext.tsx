/**
 * Authentication Context
 * 
 * This context provides authentication state throughout the application.
 * It manages Firebase Auth state and automatically starts/stops notification
 * monitoring when users log in/out.
 * 
 * Features:
 * - Tracks current authenticated user
 * - Provides loading state during auth initialization
 * - Automatically manages notification monitoring lifecycle
 * - Exposes useAuth hook for easy access to auth state
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { startNotificationMonitoring, stopNotificationMonitoring } from "../services/notificationMonitor";

/**
 * AuthContextType Interface
 * Defines the shape of the authentication context value
 */
interface AuthContextType {
  user: User | null; // Current authenticated user (null if not logged in)
  loading: boolean; // True while checking authentication state
}

/**
 * Create Auth Context with default values
 * Default user is null and loading is true (initial state)
 */
const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

/**
 * AuthProvider Component
 * 
 * Wraps the application and provides authentication state to all child components.
 * Listens to Firebase Auth state changes and manages notification monitoring.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // State for current authenticated user
  const [user, setUser] = useState<User | null>(null);
  // State for loading (true while checking auth state)
  const [loading, setLoading] = useState(true);

  /**
   * useEffect: Listen to Firebase Auth state changes
   * 
   * This effect runs once on mount and sets up a listener for authentication
   * state changes. When a user logs in or out, it updates the context state
   * and manages notification monitoring accordingly.
   */
  useEffect(() => {
    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
      
      // Update context state with current user
      setUser(firebaseUser);
      setLoading(false); // Auth check complete
      
      // Manage notification monitoring based on auth state
      // Initialize notification monitoring when user logs in (in-app notifications only)
      if (firebaseUser) {
        console.log('Starting notification monitoring for user:', firebaseUser.uid);
        startNotificationMonitoring(firebaseUser.uid);
      } else {
        console.log('Stopping notification monitoring - user logged out');
        stopNotificationMonitoring();
      }
    });
    
    // Cleanup: unsubscribe from auth state changes when component unmounts
    return () => unsubscribe();
  }, []);

  // Provide auth context value to all child components
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 * 
 * Custom hook to access authentication context.
 * Returns the current user and loading state.
 * 
 * @returns {AuthContextType} Object containing user and loading state
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
