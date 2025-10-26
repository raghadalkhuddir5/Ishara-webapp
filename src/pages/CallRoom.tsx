/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Typography, Button, Alert, CircularProgress } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import VideoCall from "../components/VideoCall";
import RatingModal from "../components/RatingModal";
import { isSessionExpired } from "../utils/sessionUtils";

export default function CallRoom() {
  const { sessionId } = useParams();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [sessionData, setSessionData] = useState<any>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [interpreterName, setInterpreterName] = useState<string>("");

  useEffect(() => {
    console.log('CallRoom useEffect triggered:', { sessionId, user: user?.uid, authLoading });
    if (!sessionId || authLoading) {
      console.log('CallRoom: Missing sessionId or auth still loading, waiting...');
      return;
    }
    
    if (!user) {
      console.log('CallRoom: No user after auth loaded, redirecting to login');
      navigate('/login');
      return;
    }
    
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
        console.log('Current user ID:', user.uid);
        console.log('Session user_id:', session.user_id);
        console.log('Session interpreter_id:', session.interpreter_id);
        console.log('Session status:', session.status);
        console.log('Session scheduled_time:', session.scheduled_time);
        
        // Check if user is authorized for this session
        if (session.user_id !== user.uid && session.interpreter_id !== user.uid) {
          console.error(' Authorization failed:');
          console.error('  - User ID:', user.uid);
          console.error('  - Session user_id:', session.user_id);
          console.error('  - Session interpreter_id:', session.interpreter_id);
          setError("You are not authorized to join this session");
          return;
        }
        
        // Check if session is confirmed
        if (session.status !== 'confirmed') {
          console.error('Session not confirmed:', session.status);
          setError("Session must be confirmed to start video call");
          return;
        }
        
        // Check if session is expired (past scheduled time)
        const isExpired = isSessionExpired(session.scheduled_time);
        console.log('Session expiry check:', {
          scheduled_time: session.scheduled_time,
          isExpired: isExpired,
          currentTime: new Date().toISOString()
        });
        
        if (isExpired) {
          console.error(' Session expired:', session.scheduled_time);
          setError("This session has expired. Sessions can only be joined within 2 hours of the scheduled time.");
          return;
        }
        
        console.log(' All checks passed, user authorized');
        
        // Get interpreter name for rating modal
        try {
          const interpreterDoc = await getDoc(doc(db, "users", session.interpreter_id));
          if (interpreterDoc.exists()) {
            const interpreterData = interpreterDoc.data();
            setInterpreterName(interpreterData.full_name || session.interpreter_id);
          } else {
            setInterpreterName(session.interpreter_id);
          }
        } catch (err) {
          console.error('Failed to get interpreter name:', err);
          setInterpreterName(session.interpreter_id);
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
  }, [sessionId, user, authLoading, navigate]);

  const handleCallEnd = () => {
    // Navigate back to dashboard or session list
    navigate("/dashboard");
  };

  const handleShowRatingModal = () => {
    setShowRatingModal(true);
  };

  const handleRatingModalClose = () => {
    setShowRatingModal(false);
  };

  const handleRatingSubmitSuccess = () => {
    setShowRatingModal(false);
    navigate("/sessions");
  };

  if (authLoading || isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {authLoading ? "Loading authentication..." : t("joining_call")}
        </Typography>
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
    <>
      <VideoCall 
        sessionId={sessionId!}
        currentUid={user!.uid}
        role={userRole}
        onCallEnd={handleCallEnd}
        onShowRatingModal={handleShowRatingModal}
      />
      
      {showRatingModal && (
        <RatingModal
          isOpen={showRatingModal}
          sessionId={sessionId!}
          interpreterId={sessionData.interpreter_id}
          interpreterName={interpreterName}
          onClose={handleRatingModalClose}
          onSubmitSuccess={handleRatingSubmitSuccess}
        />
      )}
    </>
  );
}