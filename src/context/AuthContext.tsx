import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { initializeFCM } from "../services/fcmService";
import { startNotificationMonitoring, stopNotificationMonitoring } from "../services/notificationMonitor";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      // Initialize FCM and notification monitoring when user logs in
      if (firebaseUser) {
        console.log('🔔 Initializing FCM and notification monitoring for user:', firebaseUser.uid);
        await initializeFCM(firebaseUser.uid);
        startNotificationMonitoring(firebaseUser.uid);
      } else {
        console.log('🔔 Stopping notification monitoring - user logged out');
        stopNotificationMonitoring();
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
