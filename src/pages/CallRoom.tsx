/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Typography, Button, Alert, CircularProgress } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import VideoCall from "../components/VideoCall";

export default function CallRoom() {
  const { sessionId } = useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    if (!sessionId || !user) return;
    
    const initializeCall = async () => {
      try {
        setIsLoading(true);
        setError("");
        
        // Get session data
        const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
        if (!sessionDoc.exists()) {
          setError("Session not found");
          return;
        }
        
        const session = sessionDoc.data();
        console.log('Session data loaded:', session);
        
        // Check if user is authorized for this session
        if (session.user_id !== user.uid && session.interpreter_id !== user.uid) {
          setError("You are not authorized to join this session");
          return;
        }
        
        // Check if session is confirmed
        if (session.status !== 'confirmed') {
          setError("Session must be confirmed to start video call");
          return;
        }
        
        // Create PeerJS call document if it doesn't exist
        // For now, we'll let the VideoCall component handle peer ID generation
        // The call document will be created when the first participant joins
        
        setSessionData(session);
        
      } catch (err: any) {
        console.error("Failed to initialize call:", err);
        setError(err.message || "Failed to load session data");
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeCall();
  }, [sessionId, user]);

  const handleCallEnd = () => {
    // Navigate back to dashboard or session list
    navigate("/dashboard");
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>{t("joining_call")}</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (!sessionData) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Session data not available
        </Alert>
        <Button variant="contained" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // Determine user role
  const userRole = sessionData.user_id === user?.uid ? "deaf_mute" : "interpreter";

  return (
    <VideoCall 
      sessionId={sessionId!}
      currentUid={user!.uid}
      role={userRole}
      onCallEnd={handleCallEnd}
    />
  );
}