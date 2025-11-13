/**
 * PeerJS Service
 * 
 * This service manages WebRTC video call connections using PeerJS.
 * It handles peer-to-peer video/audio communication between users and interpreters.
 * 
 * Features:
 * - Initialize PeerJS peer connections
 * - Manage local and remote media streams (camera, microphone)
 * - Handle incoming/outgoing calls
 * - Toggle camera and microphone
 * - Screen sharing support
 * - Data channel for signaling
 * - Connection state management
 * 
 * Architecture:
 * - Uses PeerJS library for WebRTC signaling
 * - STUN servers for NAT traversal
 * - Global state management for peer connections
 * - Media stream management for video/audio tracks
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import Peer from 'peerjs';

// Global variables for peer and connections
// These are module-level to maintain state across function calls
let peer: Peer | null = null; // PeerJS peer instance
let currentPeerId: string | null = null; // Current peer's ID
let dataConnection: any = null; // Data channel for signaling (text messages)
let mediaConnection: any = null; // Media channel for video/audio
let localStream: MediaStream | null = null; // User's own camera/microphone stream
let remoteStream: MediaStream | null = null; // Remote peer's video/audio stream
let isConnected = false; // Connection state flag
let isCameraEnabled = true; // Track camera state (for toggle functionality)

/**
 * Helper function to create a black video track
 * 
 * Creates a canvas-based black video track to replace camera feed when camera is disabled.
 * This ensures the video connection remains active even when camera is off.
 * 
 * @returns MediaStreamTrack - A black video track
 */
const createBlackVideoTrack = (): MediaStreamTrack => {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  const stream = canvas.captureStream(30);
  const track = stream.getVideoTracks()[0];
  
  // Keep drawing black frames
  const drawFrame = () => {
    if (ctx && track.readyState === 'live') {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawFrame);
    }
  };
  drawFrame();
  
  return track;
};

/**
 * Initialize PeerJS peer with explicit peerId
 * 
 * Creates a new PeerJS peer instance with a deterministic peer ID.
 * If a peer already exists with the same ID, it reuses it.
 * Otherwise, it destroys the existing peer and creates a new one.
 * 
 * @param peerId - Unique peer ID (typically based on user ID or session ID)
 * @returns Promise resolving to the peer ID when initialization is complete
 * @throws Error if initialization fails
 */
export const initPeer = async (peerId: string): Promise<string> => {
  try {
    console.log('Initializing PeerJS peer with ID:', peerId);
    
    // If peer already exists with same id, reuse it
    if (peer && peer.id === peerId) {
      console.log('Peer already initialized with ID:', peerId);
      return peer.id;
    }
    
    // Destroy existing peer if it exists
    if (peer) {
      console.log('Destroying existing peer for new initialization');
      peer.destroy();
      peer = null;
      currentPeerId = null;
    }
    
    // Create new peer instance using provided peerId
    // Add configuration for better connection reliability
    peer = new Peer(peerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });
    
    return new Promise((resolve, reject) => {
      peer!.on('open', (id: string) => {
        console.log('PeerJS peer initialized with ID:', id);
        currentPeerId = id;
        resolve(id);
      });
      
      peer!.on('error', (error: Error) => {
        console.error('PeerJS initialization error:', error);
        // Try to provide a more helpful error message
        if (error.message.includes('CORS') || error.message.includes('fetch')) {
          reject(new Error('Unable to connect to PeerJS server. Please check your internet connection and try again.'));
        } else {
          reject(error);
        }
      });
    });
    
  } catch (error) {
    console.error('Failed to initialize PeerJS peer:', error);
    throw error;
  }
};

/**
 * Set up event listeners for incoming connections
 * 
 * Configures event handlers for incoming data connections and media calls.
 * Handles both incoming calls (when remote peer calls us) and data messages.
 * 
 * @param onRemoteStream - Callback when remote video/audio stream is received
 * @param onDataReceived - Callback when data message is received via data channel
 * @param onConnectionClosed - Callback when connection is closed
 * @param onRemotePeerId - Optional callback when remote peer ID is detected
 * @throws Error if peer is not initialized
 */
export const setupPeerListeners = (
  onRemoteStream: (stream: MediaStream) => void,
  onDataReceived: (data: unknown) => void,
  onConnectionClosed: () => void,
  onRemotePeerId?: (peerId: string) => void
): void => {
  if (!peer) {
    throw new Error('Peer not initialized');
  }
  
  // Handle incoming data connections
  peer.on('connection', (conn: any) => {
    console.log('Incoming data connection from:', conn.peer);
    dataConnection = conn;
    if (onRemotePeerId) onRemotePeerId(conn.peer);
    
    conn.on('data', (data: unknown) => {
      console.log('Received data:', data);
      onDataReceived(data);
    });
    
    conn.on('close', () => {
      console.log('Data connection closed');
      onConnectionClosed();
    });
    
    conn.on('error', (error: Error) => {
      console.error('Data connection error:', error);
    });
  });
  
  // Handle incoming media connections (calls)
  peer.on('call', async (call: any) => {
    console.log('📞 Incoming call from:', call.peer);
    console.log('📞 Local stream available:', !!localStream);
    if (onRemotePeerId) onRemotePeerId(call.peer);
    
    try {
      // Answer the call with local stream
      if (localStream) {
        console.log('📞 Answering call with local stream');
        call.answer(localStream);
        mediaConnection = call;
        
        // Handle remote stream
        call.on('stream', (stream: MediaStream) => {
          console.log('📞 Received remote stream from incoming call');
          remoteStream = stream;
          onRemoteStream(stream);
        });
        
        call.on('close', () => {
          console.log('📞 Incoming call ended');
          onConnectionClosed();
        });
        
        call.on('error', (error: Error) => {
          console.error('📞 Incoming call error:', error);
        });
        
        isConnected = true;
        console.log('📞 Call answered successfully');
      } else {
        console.error('📞 No local stream available to answer call');
        // Try to start local stream and answer again
        try {
          console.log('📞 Attempting to start local stream for incoming call...');
          localStream = await startLocalStream(true, true);
          console.log('📞 Local stream started, answering call...');
          call.answer(localStream);
          mediaConnection = call;
          
          // Handle remote stream
          call.on('stream', (stream: MediaStream) => {
            console.log('📞 Received remote stream from incoming call (retry)');
            remoteStream = stream;
            onRemoteStream(stream);
          });
          
          call.on('close', () => {
            console.log('📞 Incoming call ended (retry)');
            onConnectionClosed();
          });
          
          call.on('error', (error: Error) => {
            console.error('📞 Incoming call error (retry):', error);
          });
          
          isConnected = true;
          console.log('📞 Call answered successfully (retry)');
        } catch (streamError) {
          console.error('📞 Failed to start local stream for incoming call:', streamError);
          throw new Error('No local stream available to answer call');
        }
      }
    } catch (error) {
      console.error('📞 Failed to answer call:', error);
    }
  });
};

/**
 * Start local media stream
 * 
 * Requests access to user's camera and microphone and creates a MediaStream.
 * Handles various permission errors with user-friendly messages.
 * Falls back to simpler constraints if initial request fails.
 * 
 * @param audio - Whether to request audio (microphone) access (default: true)
 * @param video - Whether to request video (camera) access (default: true)
 * @returns Promise resolving to MediaStream with camera/microphone tracks
 * @throws Error if media access is denied or devices are unavailable
 */
export const startLocalStream = async (audio: boolean = true, video: boolean = true): Promise<MediaStream> => {
  try {
    console.log('Requesting camera and microphone access...');
    
    const constraints: MediaStreamConstraints = {
      audio: audio,
      video: video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } as MediaTrackConstraints : false
    };
    
    console.log('Media constraints:', constraints);
    
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    isCameraEnabled = video; // Initialize camera state
    console.log('✅ Camera and microphone access granted');
    console.log('Local stream tracks:', localStream.getTracks().map(track => ({
      kind: track.kind,
      enabled: track.enabled,
      readyState: track.readyState
    })));
    
    return localStream;
  } catch (error: unknown) {
    console.error(' Failed to access camera/microphone:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera and microphone access denied. Please allow access and refresh the page.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera or microphone found. Please connect a camera and microphone.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera or microphone is already in use by another application.');
      } else if (error.name === 'OverconstrainedError') {
        // Try with simpler constraints
        console.log('Trying with simpler constraints...');
        try {
          const fallbackConstraints: MediaStreamConstraints = {
            audio: audio,
            video: video
          };
          localStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          console.log('✅ Camera and microphone access granted with fallback constraints');
          return localStream;
        } catch (fallbackError) {
          console.error('Fallback constraints also failed:', fallbackError);
        }
      }
    }
    
    throw new Error('Failed to access camera and microphone. Please check your device permissions.');
  }
};

/**
 * Call another peer
 * 
 * Initiates a video call to a remote peer. Creates both media connection
 * (for video/audio) and data connection (for signaling/text messages).
 * 
 * @param remotePeerId - ID of the remote peer to call
 * @param onRemoteStream - Optional callback when remote stream is received
 * @throws Error if peer is not initialized or local stream is unavailable
 */
export const callPeer = async (remotePeerId: string, onRemoteStream?: (stream: MediaStream) => void): Promise<void> => {
  try {
    if (!peer) {
      throw new Error('Peer not initialized');
    }
    
    if (!localStream) {
      throw new Error('Local stream not available');
    }
    
    console.log('📞 Calling peer:', remotePeerId);
    console.log('📞 My peer ID:', peer.id);
    console.log('📞 Local stream available:', !!localStream);
    
    // Create media connection
    const call = peer.call(remotePeerId, localStream);
    mediaConnection = call;
    console.log('📞 Media call created');
    
    // Handle remote stream
    call.on('stream', (stream: MediaStream) => {
      console.log('📞 Received remote stream from outgoing call');
      remoteStream = stream;
      if (onRemoteStream) {
        onRemoteStream(stream);
      }
    });
    
    call.on('close', () => {
      console.log('📞 Outgoing call ended');
      isConnected = false;
    });
    
    call.on('error', (error: Error) => {
      console.error('📞 Outgoing call error:', error);
    });
    
    // Create data connection for signaling
    const conn = peer.connect(remotePeerId);
    dataConnection = conn;
    console.log('📞 Data connection created');
    
    conn.on('open', () => {
      console.log('📞 Data connection established');
      isConnected = true;
    });
    
    conn.on('data', (data: unknown) => {
      console.log('📞 Received data:', data);
    });
    
    conn.on('close', () => {
      console.log('📞 Data connection closed');
    });
    
    conn.on('error', (error: Error) => {
      console.error('📞 Data connection error:', error);
    });
    
  } catch (error) {
    console.error('📞 Failed to call peer:', error);
    throw error;
  }
};

/**
 * End call
 * 
 * Closes all active connections (media and data) and stops local media tracks.
 * Resets connection state but keeps peer instance alive for potential reconnection.
 * 
 * @throws Error if cleanup fails
 */
export const endCall = async (): Promise<void> => {
  try {
    console.log('Ending call...');
    
    // Close media connection
    if (mediaConnection) {
      mediaConnection.close();
      mediaConnection = null;
    }
    
    // Close data connection
    if (dataConnection) {
      dataConnection.close();
      dataConnection = null;
    }
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      localStream = null;
    }
    
    // Reset connection state but keep peer alive for reconnection
    remoteStream = null;
    isConnected = false;
    
    console.log('Call ended successfully');
    
  } catch (error) {
    console.error('Failed to end call:', error);
    throw error;
  }
};

/**
 * Restart camera (create new video track)
 * 
 * Creates a new camera video track and replaces the existing one in the local stream.
 * Also updates the media connection to use the new track.
 * Useful for fixing camera issues or switching cameras.
 * 
 * @throws Error if local stream is unavailable or camera access fails
 */
export const restartCamera = async (): Promise<void> => {
  try {
    if (!localStream) {
      throw new Error('Local stream not available');
    }
    
    console.log('Restarting camera...');
    
    // Create new video track
    const newVideoTrack = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } as MediaTrackConstraints
    });
    
    // Replace the video track in local stream
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      localStream.removeTrack(videoTrack);
    }
    
    const newVideoTrackStream = newVideoTrack.getVideoTracks()[0];
    localStream.addTrack(newVideoTrackStream);
    
    // Replace track in media connection if active
    if (mediaConnection) {
      const senders = mediaConnection.peerConnection.getSenders();
      const sender = senders.find((s: RTCRtpSender) => 
        s.track && s.track.kind === 'video'
      );
      if (sender) {
        await sender.replaceTrack(newVideoTrackStream);
      }
    }
    
    console.log('Camera restarted successfully');
    
  } catch (error) {
    console.error('Failed to restart camera:', error);
    throw error;
  }
};

/**
 * Toggle microphone on/off
 * 
 * Enables or disables the microphone track in the local stream.
 * When disabled, remote peer will not receive audio.
 * 
 * @returns Promise resolving to true if microphone is now enabled, false if disabled
 * @throws Error if local stream is unavailable
 */
export const toggleMicrophone = async (): Promise<boolean> => {
  try {
    if (!localStream) {
      throw new Error('Local stream not available');
    }
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const enabled = !audioTrack.enabled;
      audioTrack.enabled = enabled;
      console.log('Microphone toggled:', enabled ? 'ON' : 'OFF');
      return enabled;
    }
    return false;
  } catch (error) {
    console.error('Failed to toggle microphone:', error);
    return false;
  }
};

/**
 * Toggle camera on/off
 * 
 * Enables or disables the camera track in the local stream.
 * When disabled, replaces camera feed with a black video track to maintain connection.
 * When enabled, requests new camera access and replaces black track.
 * 
 * @returns Promise resolving to true if camera is now enabled, false if disabled
 * @throws Error if local stream is unavailable or camera access fails
 */
export const toggleCamera = async (): Promise<boolean> => {
  try {
    if (!localStream) {
      throw new Error('Local stream not available');
    }
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) {
      return false;
    }
    
    // Toggle the camera state
    isCameraEnabled = !isCameraEnabled;
    
    if (!isCameraEnabled) {
      // Disabling camera - replace with black track
      console.log('Disabling camera - replacing with black track');
      
      // Create black video track
      const blackTrack = createBlackVideoTrack();
      
      // Remove old track from stream
      localStream.removeTrack(videoTrack);
      
      // Stop the camera track to turn off camera light
      videoTrack.stop();
      
      // Add black track to stream
      localStream.addTrack(blackTrack);
      
      // Replace track in media connection if active
      if (mediaConnection) {
        const senders = mediaConnection.peerConnection.getSenders();
        const sender = senders.find((s: RTCRtpSender) => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(blackTrack);
        }
      }
      
      console.log('Camera disabled - black track active');
    } else {
      // Enabling camera - get new camera stream
      console.log('Enabling camera - getting new camera stream');
      
      // Get new camera stream
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } as MediaTrackConstraints
      });
      
      // Remove current video track (black track)
      const currentVideoTrack = localStream.getVideoTracks()[0];
      if (currentVideoTrack) {
        localStream.removeTrack(currentVideoTrack);
        currentVideoTrack.stop();
      }
      
      // Add new camera track
      const cameraVideoTrack = cameraStream.getVideoTracks()[0];
      localStream.addTrack(cameraVideoTrack);
      
      // Replace track in media connection
      if (mediaConnection) {
        const senders = mediaConnection.peerConnection.getSenders();
        const sender = senders.find((s: RTCRtpSender) => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(cameraVideoTrack);
        }
      }
      
      console.log('Camera enabled');
    }
    
    console.log('Camera toggled:', isCameraEnabled ? 'ON' : 'OFF');
    return isCameraEnabled;
  } catch (error) {
    console.error('Failed to toggle camera:', error);
    // Revert state on error
    isCameraEnabled = !isCameraEnabled;
    return false;
  }
};

/**
 * Start screen sharing
 * 
 * Requests screen sharing permission and replaces camera video track with screen share.
 * User can share their entire screen or a specific application window.
 * 
 * @throws Error if local stream is unavailable or screen sharing is denied
 */
export const startScreenShare = async (): Promise<void> => {
  try {
    if (!localStream) {
      throw new Error('Local stream not available');
    }
    
    console.log('Starting screen sharing...');
    
    // Get screen stream
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } as MediaTrackConstraints,
      audio: true
    });
    
    // Replace video track in local stream
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      localStream.removeTrack(videoTrack);
      videoTrack.stop();
    }
    
    const screenVideoTrack = screenStream.getVideoTracks()[0];
    localStream.addTrack(screenVideoTrack);
    
    // Replace track in media connection if active
    if (mediaConnection) {
      const senders = mediaConnection.peerConnection.getSenders();
      const sender = senders.find((s: RTCRtpSender) => 
        s.track && s.track.kind === 'video'
      );
      if (sender) {
        await sender.replaceTrack(screenVideoTrack);
      }
    }
    
    console.log('Screen sharing started');
    
  } catch (error) {
    console.error('Failed to start screen sharing:', error);
    throw error;
  }
};

/**
 * Stop screen sharing
 * 
 * Stops screen sharing and switches back to camera feed.
 * Replaces screen share track with camera video track.
 * 
 * @throws Error if local stream is unavailable or camera access fails
 */
export const stopScreenShare = async (): Promise<void> => {
  try {
    if (!localStream) {
      throw new Error('Local stream not available');
    }
    
    console.log('Stopping screen sharing...');
    
    // Get camera stream
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } as MediaTrackConstraints
    });
    
    // Replace video track in local stream
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      localStream.removeTrack(videoTrack);
      videoTrack.stop();
    }
    
    const cameraVideoTrack = cameraStream.getVideoTracks()[0];
    localStream.addTrack(cameraVideoTrack);
    
    // Replace track in media connection if active
    if (mediaConnection) {
      const senders = mediaConnection.peerConnection.getSenders();
      const sender = senders.find((s: RTCRtpSender) => 
        s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(cameraVideoTrack);
      }
    }
    
    console.log('Screen sharing stopped');
    
  } catch (error) {
    console.error('Failed to stop screen sharing:', error);
    throw error;
  }
};

/**
 * Send data to remote peer
 * 
 * Sends arbitrary data (text, JSON, etc.) to the remote peer via data channel.
 * Used for signaling, chat messages, or other non-media communication.
 * 
 * @param data - Data to send (can be string, object, etc.)
 */
export const sendData = (data: unknown): void => {
  if (dataConnection && dataConnection.open) {
    dataConnection.send(data);
    console.log('Sent data:', data);
  } else {
    console.warn('Data connection not available');
  }
};

/**
 * Get current peer ID
 * 
 * @returns Current peer ID or null if not initialized
 */
export const getCurrentPeerId = (): string | null => {
  return currentPeerId;
};

/**
 * Get local stream
 * 
 * @returns Local media stream (camera/microphone) or null if not started
 */
export const getLocalStream = (): MediaStream | null => {
  return localStream;
};

/**
 * Get remote stream
 * 
 * @returns Remote peer's media stream or null if not received
 */
export const getRemoteStream = (): MediaStream | null => {
  return remoteStream;
};

/**
 * Check if connected
 * 
 * @returns True if peer is connected to remote peer, false otherwise
 */
export const isPeerConnected = (): boolean => {
  return isConnected;
};

/**
 * Check if peer is initialized
 * 
 * @returns True if peer instance exists and has an ID, false otherwise
 */
export const isPeerInitialized = (): boolean => {
  return peer !== null && currentPeerId !== null;
};

/**
 * Reset for reconnection (keep peer alive, just close connections)
 * 
 * Closes active connections and stops media streams but keeps the peer instance
 * alive. This allows reconnection without reinitializing the peer.
 * Useful when connection drops temporarily.
 */
export const resetForReconnection = (): void => {
  // Close connections
  if (mediaConnection) {
    mediaConnection.close();
    mediaConnection = null;
  }
  
  if (dataConnection) {
    dataConnection.close();
    dataConnection = null;
  }
  
  // Stop local stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  // Reset state but keep peer alive (same session ID)
  remoteStream = null;
  isConnected = false;
  
  console.log('PeerJS reset for reconnection (peer kept alive)');
};

/**
 * Check if local stream is available and ready for calls
 * 
 * @returns True if local stream exists and is active, false otherwise
 */
export const isLocalStreamReady = (): boolean => {
  return localStream !== null && localStream.active;
};

/**
 * Clean up resources completely
 * 
 * Destroys peer instance, stops all media tracks, and resets all state.
 * Call this when leaving the call room or when peer is no longer needed.
 */
export const cleanup = (): void => {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  dataConnection = null;
  mediaConnection = null;
  currentPeerId = null;
  remoteStream = null;
  isConnected = false;
  
  console.log('PeerJS resources cleaned up');
};