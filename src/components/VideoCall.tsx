/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { Box, Typography, Button, Stack, IconButton, Paper, Alert, CircularProgress } from "@mui/material";
import { Mic, MicOff, Videocam, VideocamOff, CallEnd, ScreenShare } from "@mui/icons-material";
import { 
  initPeer, 
  setupPeerListeners, 
  startLocalStream, 
  callPeer, 
  toggleMicrophone, 
  toggleCamera, 
  startScreenShare, 
  stopScreenShare,
  restartCamera,
  getLocalStream,
  isPeerConnected,
  cleanup,
  resetForReconnection,
  isLocalStreamReady,
  getCurrentPeerId
} from "../services/peerjsService";
import { getCallBySessionId, endCall as endCallRecord } from "../services/callService";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { Timestamp } from "firebase/firestore";

interface CallData {
  call_id?: string;
  session_id: string;
  user_id: string;
  interpreter_id: string;
  started_at: Timestamp;
  ended_at?: Timestamp;
  duration_seconds?: number;
  status: 'active' | 'ended' | 'failed';
  recording_url?: string;
  recording_duration?: number;
  call_quality: {
    video_quality: 'poor' | 'fair' | 'good' | 'excellent';
    audio_quality: 'poor' | 'fair' | 'good' | 'excellent';
    connection_stability: 'poor' | 'fair' | 'good' | 'excellent';
  };
  technical_metrics?: {
    avg_bitrate: number;
    packet_loss: number;
    jitter: number;
    latency: number;
  };
  created_at: Timestamp;
}

interface VideoCallProps {
  sessionId: string;
  currentUid: string;
  role: "deaf_mute" | "interpreter";
  onCallEnd?: () => void;
  onShowRatingModal?: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ sessionId, currentUid, role, onCallEnd, onShowRatingModal }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [callData, setCallData] = useState<CallData | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Function to attempt calling the remote peer (for callers)
  const attemptCall = async (remoteId: string, attemptNumber: number = 1): Promise<void> => {
    try {
      console.log(`📞 Attempting call #${attemptNumber} to:`, remoteId);
      
      // Check if we're already connected
      if (isPeerConnected()) {
        console.log('✅ Already connected, skipping call attempt');
        return;
      }
      
      await callPeer(remoteId, (stream: MediaStream) => {
        console.log('📞 Received remote stream as caller');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        setIsJoined(true);
        setConnectionAttempts(0); // Reset attempts on success
      });
      console.log('✅ Call initiated successfully');
    } catch (error: unknown) {
      console.log(`⚠️ Call attempt #${attemptNumber} failed:`, error);
      if (attemptNumber < 5) { // Try up to 5 times
        setTimeout(() => attemptCall(remoteId, attemptNumber + 1), 3000);
      } else {
        console.log('❌ Max call attempts reached');
        setError("Failed to connect after multiple attempts. Please refresh the page and try again.");
      }
    }
  };

  useEffect(() => {
    const initializeCall = async () => {
      try {
        setIsLoading(true);
        setError("");
        
        console.log('Starting PeerJS call for session:', sessionId);
        
        // Derive deterministic peer IDs per role
        const myId = role === 'deaf_mute' ? `${sessionId}-caller` : `${sessionId}-callee`;
        const remoteId = role === 'deaf_mute' ? `${sessionId}-callee` : `${sessionId}-caller`;

        // Initialize PeerJS with explicit ID
        const myPeerId = await initPeer(myId);
        setPeerId(myPeerId);
        console.log('My Peer ID:', myPeerId);

        // Set remote peer ID (the counterpart role)
        setRemotePeerId(remoteId);

        // Start local media stream (or restart if needed for reconnection)
        let localStream = getLocalStream();
        if (!localStream || !isLocalStreamReady()) {
          console.log('🔄 Starting new local stream for reconnection...');
          localStream = await startLocalStream(true, true);
          console.log('✅ Local stream obtained:', localStream);
        } else {
          console.log('♻️ Reusing existing local stream:', localStream);
        }
        
        // Attach local stream to video element immediately
        if (localStream && localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          console.log('Local video element updated immediately');
        }

        // Set up peer event listeners
        setupPeerListeners(
          // onRemoteStream
          (stream: MediaStream) => {
            console.log('Received remote stream');
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
            setIsJoined(true);
            setConnectionAttempts(0); // Reset attempts on success
          },
          // onDataReceived
          (data: unknown) => {
            console.log('Received data:', data);
          },
          // onConnectionClosed
          () => {
            console.log('Connection closed');
            setIsJoined(false);
          },
          // onRemotePeerId
          (id: string) => {
            console.log('Remote peer identified:', id);
            setRemotePeerId(id);
          }
        );

        // Get call data for history/metrics (separate collection)
        const callDataResult = await getCallBySessionId(sessionId);
        setCallData(callDataResult);

        // Only caller initiates the call; callee waits to be called
        if (role === 'deaf_mute') {
          console.log('📞 Caller initiating call to:', remoteId);
          // Add a small delay to ensure callee is ready, then start attempting calls
          setTimeout(() => {
            attemptCall(remoteId);
          }, 2000);
        } else {
          console.log('📞 Callee ready and waiting for incoming call from:', remoteId);
          // For callee, we need to ensure we're ready to receive calls
          // The setupPeerListeners already handles incoming calls
        }

        console.log('PeerJS call initialized successfully');
        
      } catch (err: unknown) {
        console.error('Failed to initialize PeerJS call:', err);
        if (err instanceof Error) {
          setError(err.message || 'Failed to join call. Please check your camera/microphone permissions.');
        } else {
          setError('Failed to join call. Please check your camera/microphone permissions.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeCall();

    return () => {
      console.log('Cleaning up PeerJS call...');
      cleanup();
    };
  }, [sessionId, currentUid, role]);

  // Additional effect to ensure local video is properly connected
  useEffect(() => {
    const updateLocalVideo = () => {
      const localStream = getLocalStream();
      if (localStream && localVideoRef.current && !localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = localStream;
        console.log('Local video element updated via useEffect');
      }
    };

    // Try immediately and also after a short delay
    updateLocalVideo();
    const timeoutId = setTimeout(updateLocalVideo, 1000);

    return () => clearTimeout(timeoutId);
  }, [isLoading]); // Run when loading state changes

  // Periodic reconnection check for callers (deaf/mute users)
  useEffect(() => {
    let reconnectionInterval: NodeJS.Timeout | null = null;
    
    if (role === 'deaf_mute' && !isJoined && remotePeerId && connectionAttempts < 3) {
      console.log('🔄 Setting up periodic reconnection check for caller');
      
      reconnectionInterval = setInterval(() => {
        if (!isJoined && remotePeerId) {
          console.log('🔄 Periodic check: attempting to reconnect to callee');
          setConnectionAttempts(prev => prev + 1);
          attemptCall(remotePeerId);
        }
      }, 8000); // Check every 8 seconds instead of 5 for better reliability
    }

    return () => {
      if (reconnectionInterval) {
        console.log('🔄 Clearing periodic reconnection check');
        clearInterval(reconnectionInterval);
      }
    };
  }, [role, isJoined, remotePeerId]); // Run when these values change

  const handleToggleMic = async () => {
    try {
      const enabled = await toggleMicrophone();
      setIsMuted(!enabled);
    } catch (error: unknown) {
      console.error('Failed to toggle microphone:', error);
      if (error instanceof Error) {
        setError("Failed to toggle microphone. Please try again.");
      } else {
        setError("Failed to toggle microphone. Please try again.");
      }
    }
  };

  const handleToggleVideo = async () => {
    try {
      const enabled = await toggleCamera();
      setIsVideoOn(enabled);
      
      // If camera was disabled and now enabled, restart it
      if (enabled && !isVideoOn) {
        console.log('Restarting camera...');
        await restartCamera();
        
        // Update local video element with new stream
        const localStream = getLocalStream();
        if (localStream && localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          console.log('Local video element updated with new stream');
        }
      }
    } catch (error: unknown) {
      console.error('Failed to toggle camera:', error);
      if (error instanceof Error) {
        setError("Failed to toggle camera. Please try again.");
      } else {
        setError("Failed to toggle camera. Please try again.");
      }
    }
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await startScreenShare();
        setIsScreenSharing(true);
      }
    } catch (error: unknown) {
      console.error('Failed to toggle screen sharing:', error);
      if (error instanceof Error) {
        setError("Failed to toggle screen sharing. Please try again.");
      } else {
        setError("Failed to toggle screen sharing. Please try again.");
      }
    }
  };

  const handleEndCall = async () => {
    console.log('🔴 End call button clicked');
    try {
      console.log('📊 Call data:', callData);
      
      // End the call record in database
      if (callData?.call_id) {
        console.log('💾 Ending call record:', callData.call_id);
        await endCallRecord(callData.call_id);
        console.log('✅ Call record ended successfully');
      } else {
        console.log('⚠️ No call_id found in callData');
      }
      
      // Update session status to completed
      console.log('📝 Updating session status to completed');
      await updateDoc(doc(db, "sessions", sessionId), {
        status: "completed",
        ended_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      console.log('✅ Session marked as completed');
      
      // Reset for reconnection (keeps peer alive with same session ID)
      console.log('🧹 Resetting PeerJS for reconnection...');
      resetForReconnection();
      setIsJoined(false);
      console.log('✅ PeerJS reset completed - ready for reconnection');
      
      // Show rating modal for deaf/mute users
      if (role === 'deaf_mute' && onShowRatingModal) {
        console.log('⭐ Showing rating modal for deaf/mute user');
        onShowRatingModal();
      } else {
        // Call the onCallEnd callback for interpreters
        if (onCallEnd) {
          console.log('📞 Calling onCallEnd callback');
          onCallEnd();
        }
      }
      
      console.log('🎉 Call ended successfully');
    } catch (error: unknown) {
      console.error('❌ Failed to end call:', error);
      if (error instanceof Error) {
        setError("Failed to end call properly. Please refresh the page.");
      } else {
        setError("Failed to end call properly. Please refresh the page.");
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>Joining call...</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Role: {role} | Session: {sessionId}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {role === "deaf_mute" ? "Calling interpreter..." : "Waiting for call..."}
        </Typography>
        {peerId && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            My Peer ID: {peerId}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mt: 2, color: 'primary.main' }}>
          📹 Please allow camera and microphone access when prompted
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
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#1a1a1a' }}>
      {/* Header */}
      <Box sx={{ p: 2, bgcolor: '#2d2d2d', color: 'white' }}>
        <Typography variant="h6">
          Video Call - Session: {sessionId}
        </Typography>
        <Typography variant="body2" color="grey.400">
          Status: {isPeerConnected() ? 'Connected' : 'Connecting...'} | Role: {role}
        </Typography>
        <Typography variant="body2" color="grey.400">
          My Peer ID: {getCurrentPeerId()} | Remote Peer ID: {remotePeerId || 'Unknown'}
        </Typography>
      </Box>

      {/* Video Container */}
      <Box sx={{ flex: 1, display: 'flex', p: 2, gap: 2 }}>
        {/* Remote Video Container */}
        <Paper 
          sx={{ 
            flex: 1, 
            minHeight: 400, 
            bgcolor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            position: 'relative'
          }}
        >
          <video 
            ref={remoteVideoRef}
            autoPlay 
            playsInline 
            style={{ width: '100%', height: '100%', minHeight: 400 }}
          />
          {!isJoined && (
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography>Waiting for other participant...</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Connection attempts: {connectionAttempts}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Local Video */}
        <Paper 
          sx={{ 
            width: 300, 
            height: 200, 
            bgcolor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}
        >
          <video 
            ref={localVideoRef}
            autoPlay 
            playsInline 
            muted 
            style={{ width: '100%', height: '100%' }}
          />
        </Paper>
      </Box>

      {/* Controls */}
      <Box sx={{ p: 2, bgcolor: '#2d2d2d', display: 'flex', justifyContent: 'center' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton
            onClick={handleToggleMic}
            sx={{ 
              bgcolor: isMuted ? '#f44336' : '#4caf50',
              color: 'white',
              '&:hover': { bgcolor: isMuted ? '#d32f2f' : '#388e3c' }
            }}
          >
            {isMuted ? <MicOff /> : <Mic />}
          </IconButton>

          <IconButton
            onClick={handleToggleVideo}
            sx={{ 
              bgcolor: isVideoOn ? '#4caf50' : '#f44336',
              color: 'white',
              '&:hover': { bgcolor: isVideoOn ? '#388e3c' : '#d32f2f' }
            }}
          >
            {isVideoOn ? <Videocam /> : <VideocamOff />}
          </IconButton>

          <IconButton
            onClick={handleScreenShare}
            sx={{ 
              bgcolor: isScreenSharing ? '#ff9800' : '#2196f3',
              color: 'white',
              '&:hover': { bgcolor: isScreenSharing ? '#f57c00' : '#1976d2' }
            }}
          >
            <ScreenShare />
          </IconButton>

          <IconButton
            onClick={handleEndCall}
            sx={{ 
              bgcolor: '#f44336',
              color: 'white',
              '&:hover': { bgcolor: '#d32f2f' }
            }}
          >
            <CallEnd />
          </IconButton>
        </Stack>
      </Box>

      {/* Status */}
      <Box sx={{ p: 1, bgcolor: '#1a1a1a', color: 'white', textAlign: 'center' }}>
        <Typography variant="body2">
          {isJoined ? "Connected" : "Connecting..."} | 
          Mic: {isMuted ? "Off" : "On"} | 
          Camera: {isVideoOn ? "On" : "Off"} |
          Screen: {isScreenSharing ? "Sharing" : "Off"} |
          Attempts: {connectionAttempts}
        </Typography>
      </Box>
    </Box>
  );
};

export default VideoCall;