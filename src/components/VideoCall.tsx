/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  cleanup
} from "../services/peerjsService";
import { getCallBySessionId, endCall as endCallRecord } from "../services/callService";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

interface VideoCallProps {
  sessionId: string;
  currentUid: string;
  role: "deaf_mute" | "interpreter";
  onCallEnd?: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ sessionId, currentUid, role, onCallEnd }) => {
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
  const [callData, setCallData] = useState<any>(null);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        setIsLoading(true);
        setError("");
        
        console.log('Starting PeerJS call for session:', sessionId);
        
        // Initialize PeerJS peer
        const myPeerId = await initPeer();
        setPeerId(myPeerId);
        console.log('My Peer ID:', myPeerId);

        // Start local media stream
        const localStream = await startLocalStream(true, true);
        console.log('Local stream obtained:', localStream);
        
        // Do not attach to local video here, because while loading, the
        // video element isn't mounted yet. The effect below will attach the
        // stream once the element exists (after loading UI is gone).

        // Set up peer event listeners
        setupPeerListeners(
          // onRemoteStream
          (stream: MediaStream) => {
            console.log('Received remote stream');
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
            setIsJoined(true);
          },
          // onDataReceived
          (data: any) => {
            console.log('Received data:', data);
          },
          // onConnectionClosed
          () => {
            console.log('Connection closed');
            setIsJoined(false);
          }
        );

        // Get call data for history/metrics (separate collection)
        const callDataResult = await getCallBySessionId(sessionId);
        setCallData(callDataResult);

        // Use a lightweight signaling doc keyed by sessionId to exchange peer IDs
        const signalingRef = doc(db, 'CALLS', sessionId);

        // Determine caller vs callee based on role
        const isCaller = role === "deaf_mute";

        if (isCaller) {
          console.log('Calling as caller...');

          // Publish caller peer ID
          await setDoc(signalingRef, { callerPeerId: myPeerId, updated_at: Date.now() }, { merge: true });

          console.log('Waiting for interpreter to join...');
          // Listen for callee peer ID then initiate call
          const unsubscribe = onSnapshot(signalingRef, async (snap) => {
            if (snap.exists()) {
              const data: any = snap.data();
              if (data.calleePeerId && !isJoined) {
                console.log('Interpreter joined, initiating call...');
                setRemotePeerId(data.calleePeerId);
                await callPeer(data.calleePeerId, (stream: MediaStream) => {
                  console.log('Received remote stream as caller');
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = stream;
                  }
                  setIsJoined(true);
                });
                unsubscribe();
              }
            }
          });

          // Clean up listener on component unmount
          return () => unsubscribe();
        } else {
          console.log('Waiting as callee...');

          // Publish callee peer ID and wait for incoming call
          await setDoc(signalingRef, { calleePeerId: myPeerId, updated_at: Date.now() }, { merge: true });

          console.log('Callee peer ID published; waiting for incoming call');
          // No further action: setupPeerListeners will handle incoming call
        }

        console.log('PeerJS call initialized successfully');
        
      } catch (err: any) {
        console.error('Failed to initialize PeerJS call:', err);
        setError(err.message || 'Failed to join call');
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
    const timeoutId = setTimeout(updateLocalVideo, 500);

    return () => clearTimeout(timeoutId);
  }, [isLoading]); // Run when loading state changes

  const handleToggleMic = async () => {
    try {
      const enabled = await toggleMicrophone();
      setIsMuted(!enabled);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
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
    } catch (error) {
      console.error('Failed to toggle camera:', error);
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
    } catch (error) {
      console.error('Failed to toggle screen sharing:', error);
    }
  };

  const handleEndCall = async () => {
    console.log('🔴 End call button clicked');
    try {
      console.log('📞 Call data:', callData);
      
      // End the call record in database
      if (callData?.call_id) {
        console.log('💾 Ending call record:', callData.call_id);
        await endCallRecord(callData.call_id);
        console.log('✅ Call record ended successfully');
      } else {
        console.log('⚠️ No call_id found in callData');
      }
      
      // Clean up PeerJS connection
      console.log('🧹 Cleaning up PeerJS connection');
      cleanup();
      setIsJoined(false);
      console.log('✅ PeerJS cleanup completed');
      
      // Call the onCallEnd callback if provided
      if (onCallEnd) {
        console.log('📞 Calling onCallEnd callback');
        onCallEnd();
      }
      
      console.log('🎉 Call ended successfully');
    } catch (error) {
      console.error('💥 Failed to end call:', error);
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
          Status: {isPeerConnected() ? 'Connected' : 'Disconnected'} | Role: {role}
        </Typography>
        <Typography variant="body2" color="grey.400">
          My Peer ID: {peerId} | Remote Peer ID: {remotePeerId || 'Unknown'}
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
            <Typography>Waiting for other participant...</Typography>
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
          Screen: {isScreenSharing ? "Sharing" : "Off"}
        </Typography>
      </Box>
    </Box>
  );
};

export default VideoCall;