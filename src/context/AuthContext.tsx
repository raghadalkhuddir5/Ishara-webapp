import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
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
      console.log('Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
      setUser(firebaseUser);
      setLoading(false);
      
      // Initialize notification monitoring when user logs in (in-app notifications only)
      if (firebaseUser) {
        console.log('Starting notification monitoring for user:', firebaseUser.uid);
        startNotificationMonitoring(firebaseUser.uid);
      } else {
        console.log('Stopping notification monitoring - user logged out');
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
