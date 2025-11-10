/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { Box, Typography, Button, Stack, IconButton, Paper, Alert, CircularProgress, Tooltip, Chip, Avatar } from "@mui/material";
import { Mic, MicOff, Videocam, VideocamOff, CallEnd, ScreenShare, SignalWifi4Bar, FiberManualRecord } from "@mui/icons-material";
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
import { useI18n } from "../context/I18nContext";

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
  interpreterName?: string;
  userName?: string;
  onCallEnd?: () => void;
  onShowRatingModal?: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ sessionId, currentUid, role, interpreterName, userName, onCallEnd, onShowRatingModal }) => {
  const { t } = useI18n();
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
  const [callDuration, setCallDuration] = useState(0);

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
        setError(t("call_failed_after_attempts"));
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
          setError(err.message || t("failed_to_join_call"));
        } else {
          setError(t("failed_to_join_call"));
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
  }, [sessionId, currentUid, role, t]);

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
  }, [role, isJoined, remotePeerId, t]); // Run when these values change

  // Call timer effect
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    
    if (isJoined) {
      timerInterval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isJoined]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMic = async () => {
    try {
      const enabled = await toggleMicrophone();
      setIsMuted(!enabled);
    } catch (error: unknown) {
      console.error('Failed to toggle microphone:', error);
      if (error instanceof Error) {
        setError(t("failed_to_toggle_microphone"));
      } else {
        setError(t("failed_to_toggle_microphone"));
      }
    }
  };

  const handleToggleVideo = async () => {
    try {
      const enabled = await toggleCamera();
      setIsVideoOn(enabled);
      
      // Update local video element with current stream
      const localStream = getLocalStream();
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        console.log('Local video element updated');
      }
    } catch (error: unknown) {
      console.error('Failed to toggle camera:', error);
      if (error instanceof Error) {
        setError(t("failed_to_toggle_camera"));
      } else {
        setError(t("failed_to_toggle_camera"));
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
        setError(t("failed_to_toggle_screen_sharing"));
      } else {
        setError(t("failed_to_toggle_screen_sharing"));
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
        setError(t("failed_to_end_call"));
      } else {
        setError(t("failed_to_end_call"));
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', bgcolor: 'white' }}>
        <CircularProgress size={60} sx={{ color: '#008080' }} />
        <Typography variant="h6" sx={{ mt: 2, color: '#333' }}>{t("joining_call")}</Typography>
        <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
          {t("role")}: {role} | {t("session")}: {sessionId}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
          {role === "deaf_mute" ? t("calling_interpreter") : t("waiting_for_call")}
        </Typography>
        {peerId && (
          <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
            {t("my_peer_id")}: {peerId}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mt: 2, color: '#008080' }}>
          📹 {t("allow_camera_microphone")}
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
          {t("retry")}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      bgcolor: 'white',
      overflow: 'hidden'
    }}>
      {/* Enhanced Header */}
      <Box sx={{ 
        p: 2, 
        bgcolor: 'white',
        color: '#333',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, color: '#333' }}>
            {t("call_room_title")}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip 
              label={isPeerConnected() ? t("connected") : t("connecting")} 
              size="small"
              icon={isPeerConnected() ? <FiberManualRecord sx={{ fontSize: 12, color: '#4caf50' }} /> : <CircularProgress size={12} />}
              sx={{ 
                bgcolor: isPeerConnected() ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                color: isPeerConnected() ? '#2e7d32' : '#f57c00',
                fontWeight: 500,
                border: `1px solid ${isPeerConnected() ? '#4caf50' : '#ff9800'}`
              }}
            />
            <Chip 
              label={role === 'deaf_mute' ? t("deaf_mute") : t("interpreter")} 
              size="small"
              sx={{ bgcolor: 'rgba(0, 128, 128, 0.1)', color: '#008080', border: '1px solid #008080' }}
            />
            {isJoined && (
              <Chip 
                label={formatDuration(callDuration)} 
                size="small"
                icon={<SignalWifi4Bar sx={{ fontSize: 12, color: '#008080' }} />}
                sx={{ bgcolor: 'rgba(0, 128, 128, 0.1)', color: '#008080', fontWeight: 600, border: '1px solid #008080' }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Enhanced Video Container */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        p: 2, 
        gap: 2,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#f5f5f5'
      }}>
        {/* Remote Video Container - Main */}
        <Paper 
          elevation={3}
          sx={{ 
            flex: 1, 
            minHeight: 400, 
            bgcolor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            border: '2px solid rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'rgba(0, 128, 128, 0.3)',
              boxShadow: '0 4px 12px rgba(0, 128, 128, 0.2)'
            }
          }}
        >
          <video 
            ref={remoteVideoRef}
            autoPlay 
            playsInline 
            style={{ 
              width: '100%', 
              height: '100%', 
              minHeight: 400,
              objectFit: 'cover'
            }}
          />
          {!isJoined && (
            <Box sx={{ 
              textAlign: 'center', 
              position: 'absolute',
              zIndex: 2,
              background: 'rgba(0, 0, 0, 0.7)',
              borderRadius: 2,
              p: 4
            }}>
              <CircularProgress size={50} sx={{ mb: 2, color: '#008080' }} />
              <Typography variant="h6" sx={{ mb: 1, color: 'white' }}>{t("waiting_participant")}</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {t("connection_attempts")}: {connectionAttempts}
              </Typography>
            </Box>
          )}
          {/* Video overlay info */}
          {isJoined && (
            <Box sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              display: 'flex',
              gap: 1,
              zIndex: 1
            }}>
              <Chip 
                label={role === 'deaf_mute' ? (interpreterName || t("interpreter")) : (userName || t("deaf_mute"))}
                size="small"
                sx={{ bgcolor: 'rgba(0, 0, 0, 0.7)', color: 'white', backdropFilter: 'blur(10px)' }}
              />
            </Box>
          )}
        </Paper>

        {/* Local Video - Picture in Picture */}
        <Paper 
          elevation={3}
          sx={{ 
            width: { xs: 200, sm: 280, md: 320 }, 
            height: { xs: 150, sm: 200, md: 240 }, 
            bgcolor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            borderRadius: 2,
            overflow: 'hidden',
            border: '2px solid rgba(0, 0, 0, 0.1)',
            position: 'relative',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'scale(1.02)',
              borderColor: 'rgba(0, 128, 128, 0.3)',
              boxShadow: '0 4px 12px rgba(0, 128, 128, 0.2)',
              zIndex: 10
            }
          }}
        >
          <video 
            ref={localVideoRef}
            autoPlay 
            playsInline 
            muted 
            style={{ 
              width: '100%', 
              height: '100%',
              objectFit: 'cover'
            }}
          />
          {!isVideoOn && (
            <Box sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1
            }}>
              <Avatar sx={{ bgcolor: '#424242', width: 60, height: 60 }}>
                <VideocamOff />
              </Avatar>
            </Box>
          )}
          {/* Local video label */}
          <Box sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            zIndex: 2
          }}>
            <Chip 
              label={role === 'deaf_mute' ? (userName || t("you")) : (interpreterName || t("interpreter"))}
              size="small"
              sx={{ bgcolor: 'rgba(0, 0, 0, 0.7)', color: 'white', backdropFilter: 'blur(10px)' }}
            />
          </Box>
        </Paper>
      </Box>

      {/* Enhanced Controls */}
      <Box sx={{ 
        p: 3, 
        bgcolor: 'white',
        display: 'flex', 
        justifyContent: 'center',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Tooltip title={isMuted ? t("unmute") : t("mute")} arrow>
            <IconButton
              onClick={handleToggleMic}
              sx={{ 
                bgcolor: isMuted ? '#f44336' : '#4caf50',
                color: 'white',
                width: 56,
                height: 56,
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: isMuted ? '#d32f2f' : '#388e3c',
                  transform: 'scale(1.05)'
                }
              }}
            >
              {isMuted ? <MicOff sx={{ fontSize: 28 }} /> : <Mic sx={{ fontSize: 28 }} />}
            </IconButton>
          </Tooltip>

          <Tooltip title={isVideoOn ? t("turn_off_camera") : t("turn_on_camera")} arrow>
            <IconButton
              onClick={handleToggleVideo}
              sx={{ 
                bgcolor: isVideoOn ? '#4caf50' : '#f44336',
                color: 'white',
                width: 56,
                height: 56,
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: isVideoOn ? '#388e3c' : '#d32f2f',
                  transform: 'scale(1.05)'
                }
              }}
            >
              {isVideoOn ? <Videocam sx={{ fontSize: 28 }} /> : <VideocamOff sx={{ fontSize: 28 }} />}
            </IconButton>
          </Tooltip>

          <Tooltip title={t("end_call")} arrow>
            <IconButton
              onClick={handleEndCall}
              sx={{ 
                bgcolor: '#f44336',
                color: 'white',
                width: 64,
                height: 64,
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: '#d32f2f',
                  transform: 'scale(1.08)'
                }
              }}
            >
              <CallEnd sx={{ fontSize: 32 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Enhanced Status Bar */}
      <Box sx={{ 
        p: 1.5, 
        bgcolor: '#f5f5f5',
        color: '#333', 
        textAlign: 'center',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#333' }}>
            <FiberManualRecord sx={{ fontSize: 8, color: isJoined ? '#4caf50' : '#ff9800' }} />
            {isJoined ? t("connected") : t("connecting")}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(0, 0, 0, 0.5)' }}>•</Typography>
          <Typography variant="caption" sx={{ color: '#333' }}>
            {t("mic")}: <strong style={{ color: isMuted ? '#f44336' : '#4caf50' }}>{isMuted ? t("off") : t("on")}</strong>
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(0, 0, 0, 0.5)' }}>•</Typography>
          <Typography variant="caption" sx={{ color: '#333' }}>
            {t("camera")}: <strong style={{ color: isVideoOn ? '#4caf50' : '#f44336' }}>{isVideoOn ? t("on") : t("off")}</strong>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default VideoCall;