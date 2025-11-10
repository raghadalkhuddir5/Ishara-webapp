import Peer from 'peerjs';

// Global variables for peer and connections
let peer: Peer | null = null;
let currentPeerId: string | null = null;
let dataConnection: any = null;
let mediaConnection: any = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let isConnected = false;
let isCameraEnabled = true; // Track camera state

// Helper function to create a black video track
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

// Initialize PeerJS peer with explicit peerId (deterministic per role)
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

// Set up event listeners for incoming connections
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

// Start local media stream
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

// Call another peer
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

// End call
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

// Restart camera (create new video track)
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

// Toggle microphone
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

// Toggle camera
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

// Start screen sharing
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

// Stop screen sharing
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

// Send data to remote peer
export const sendData = (data: unknown): void => {
  if (dataConnection && dataConnection.open) {
    dataConnection.send(data);
    console.log('Sent data:', data);
  } else {
    console.warn('Data connection not available');
  }
};

// Get current peer ID
export const getCurrentPeerId = (): string | null => {
  return currentPeerId;
};

// Get local stream
export const getLocalStream = (): MediaStream | null => {
  return localStream;
};

// Get remote stream
export const getRemoteStream = (): MediaStream | null => {
  return remoteStream;
};

// Check if connected
export const isPeerConnected = (): boolean => {
  return isConnected;
};

// Check if peer is initialized
export const isPeerInitialized = (): boolean => {
  return peer !== null && currentPeerId !== null;
};

// Reset for reconnection (keep peer alive, just close connections)
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

// Check if local stream is available and ready for calls
export const isLocalStreamReady = (): boolean => {
  return localStream !== null && localStream.active;
};

// Clean up resources completely
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