/**
 * Call Room Page Component
 * 
 * This component handles the video call room for sessions. It:
 * - Validates user authorization to join the session
 * - Checks session status and expiration
 * - Loads session data and participant names
 * - Renders the VideoCall component
 * - Shows rating modal after call ends (for deaf/mute users)
 * 
 * Security:
 * - Only authorized users (session participants) can join
 * - Session must be confirmed status
 * - Session must not be expired (within 2 hours of scheduled time)
 */

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

/**
 * Call Room Component
 * Main component for video call sessions
 */
export default function CallRoom() {
  // Get session ID from URL parameters
  const { sessionId } = useParams();
  // Get translation function
  const { t } = useI18n();
  // Get authenticated user and loading state
  const { user, loading: authLoading } = useAuth();
  // Navigation hook for redirects
  const navigate = useNavigate();
  
  // Component state
  const [isLoading, setIsLoading] = useState(true); // Loading session data
  const [error, setError] = useState<string>(""); // Error message if validation fails
  const [sessionData, setSessionData] = useState<any>(null); // Session document data
  const [showRatingModal, setShowRatingModal] = useState(false); // Control rating modal visibility
  const [interpreterName, setInterpreterName] = useState<string>(""); // Interpreter's display name
  const [userName, setUserName] = useState<string>(""); // User's display name

  /**
   * useEffect: Initialize call room and validate session
   * 
   * This effect runs when the component mounts or when sessionId/user changes.
   * It performs several security checks before allowing access to the call room:
   * 1. Validates session exists
   * 2. Checks user authorization (must be participant)
   * 3. Verifies session is confirmed
   * 4. Checks session hasn't expired
   * 5. Loads participant names for display
   */
  useEffect(() => {
    console.log('CallRoom useEffect triggered:', { sessionId, user: user?.uid, authLoading });
    
    // Wait for authentication to complete
    if (!sessionId || authLoading) {
      console.log('CallRoom: Missing sessionId or auth still loading, waiting...');
      return;
    }
    
    // Redirect to login if not authenticated
    if (!user) {
      console.log('CallRoom: No user after auth loaded, redirecting to login');
      navigate('/login');
      return;
    }
    
    /**
     * Initialize call room with validation
     */
    const initializeCall = async () => {
      try {
        setIsLoading(true);
        setError("");
        
        // Step 1: Get session data from Firestore
        const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
        if (!sessionDoc.exists()) {
          setError(t("session_not_found"));
          return;
        }
        
        const session = sessionDoc.data();
        console.log('Session data loaded:', session);
        console.log('Current user ID:', user.uid);
        console.log('Session user_id:', session.user_id);
        console.log('Session interpreter_id:', session.interpreter_id);
        console.log('Session status:', session.status);
        console.log('Session scheduled_time:', session.scheduled_time);
        
        // Step 2: Authorization check - user must be either the deaf/mute user or interpreter
        if (session.user_id !== user.uid && session.interpreter_id !== user.uid) {
          console.error(' Authorization failed:');
          console.error('  - User ID:', user.uid);
          console.error('  - Session user_id:', session.user_id);
          console.error('  - Session interpreter_id:', session.interpreter_id);
          setError(t("not_authorized_for_session"));
          return;
        }
        
        // Step 3: Status check - session must be confirmed to start call
        if (session.status !== 'confirmed') {
          console.error('Session not confirmed:', session.status);
          setError(t("session_must_be_confirmed"));
          return;
        }
        
        // Step 4: Expiration check - session must be within 2 hours of scheduled time
        const isExpired = isSessionExpired(session.scheduled_time);
        console.log('Session expiry check:', {
          scheduled_time: session.scheduled_time,
          isExpired: isExpired,
          currentTime: new Date().toISOString()
        });
        
        if (isExpired) {
          console.error(' Session expired:', session.scheduled_time);
          setError(t("session_expired"));
          return;
        }
        
        console.log(' All checks passed, user authorized');
        
        // Step 5: Load participant names for display in video call
        // Get interpreter name
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

        // Get user (deaf/mute) name
        try {
          const userDoc = await getDoc(doc(db, "users", session.user_id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserName(userData.full_name || session.user_id);
          } else {
            setUserName(session.user_id);
          }
        } catch (err) {
          console.error('Failed to get user name:', err);
          setUserName(session.user_id);
        }
        
        // All validation passed - set session data to render VideoCall component
        // The VideoCall component will handle PeerJS connection setup
        setSessionData(session);
        
      } catch (err: any) {
        console.error("Failed to initialize call:", err);
        setError(err.message || t("failed_to_load_session"));
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeCall();
  }, [sessionId, user, authLoading, navigate, t]);

  /**
   * Handle call end - navigate back to dashboard
   */
  const handleCallEnd = () => {
    // Navigate back to dashboard or session list
    navigate("/dashboard");
  };

  /**
   * Show rating modal after call ends
   * Called by VideoCall component when call ends for deaf/mute users
   */
  const handleShowRatingModal = () => {
    setShowRatingModal(true);
  };

  /**
   * Handle rating modal close - navigate to sessions page
   */
  const handleRatingModalClose = () => {
    setShowRatingModal(false);
    // After closing rating modal, go to sessions page
    navigate("/sessions");
  };

  /**
   * Handle successful rating submission - close modal and navigate
   */
  const handleRatingSubmitSuccess = () => {
    setShowRatingModal(false);
    navigate("/sessions");
  };

  if (authLoading || isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {authLoading ? t("loading_authentication") : t("joining_call")}
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
          {t("back_to_dashboard")}
        </Button>
      </Box>
    );
  }

  if (!sessionData) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("session_data_not_available")}
        </Alert>
        <Button variant="contained" onClick={() => navigate("/dashboard")}>
          {t("back_to_dashboard")}
        </Button>
      </Box>
    );
  }

  // Determine user role based on session data
  // If current user is the user_id, they are deaf_mute; otherwise interpreter
  const userRole = sessionData.user_id === user?.uid ? "deaf_mute" : "interpreter";

  return (
    <>
      {/* VideoCall component handles the actual WebRTC connection via PeerJS */}
      <VideoCall 
        sessionId={sessionId!}
        currentUid={user!.uid}
        role={userRole}
        interpreterName={interpreterName}
        userName={userName}
        onCallEnd={handleCallEnd}
        onShowRatingModal={handleShowRatingModal}
      />
      
      {/* Rating modal shown after call ends (only for deaf/mute users) */}
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