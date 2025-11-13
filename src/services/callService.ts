/**
 * Call Service
 * 
 * This service manages call records in Firestore. It tracks video call sessions
 * between users and interpreters, including call duration, quality metrics,
 * and technical performance data.
 * 
 * Features:
 * - Create call records when sessions start
 * - Update call records when sessions end
 * - Track call duration and quality metrics
 * - Query calls by session, user, or interpreter
 * - Mark calls as failed if connection issues occur
 * 
 * Note: This service manages call metadata. The actual WebRTC connection
 * is handled by the PeerJS service (peerjsService.ts).
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * CallData Interface
 * 
 * Represents a call record document stored in Firestore.
 * Tracks metadata about video call sessions including timing,
 * quality metrics, and technical performance data.
 */
export interface CallData {
  call_id?: string; // Document ID in Firestore
  session_id: string; // ID of the associated session
  user_id: string; // ID of the deaf/mute user
  interpreter_id: string; // ID of the interpreter
  started_at: Timestamp; // When the call started
  ended_at?: Timestamp; // When the call ended (if ended)
  duration_seconds?: number; // Calculated call duration
  status: 'active' | 'ended' | 'failed'; // Current call status
  recording_url?: string; // Optional URL to call recording
  recording_duration?: number; // Duration of recording if available
  call_quality: {
    video_quality: 'poor' | 'fair' | 'good' | 'excellent'; // Subjective video quality
    audio_quality: 'poor' | 'fair' | 'good' | 'excellent'; // Subjective audio quality
    connection_stability: 'poor' | 'fair' | 'good' | 'excellent'; // Connection stability rating
  };
  technical_metrics?: {
    avg_bitrate: number; // Average bitrate in kbps
    packet_loss: number; // Packet loss percentage
    jitter: number; // Network jitter in ms
    latency: number; // Round-trip latency in ms
  };
  created_at: Timestamp; // When the call record was created
}

/**
 * Start a new call session
 * 
 * Creates a call record in Firestore when a video call begins.
 * This record tracks the call lifecycle and can be updated when the call ends.
 * 
 * @param sessionId - ID of the session associated with this call
 * @param userId - ID of the deaf/mute user
 * @param interpreterId - ID of the interpreter
 * @returns Promise resolving to the call document ID
 * @throws Error if call record creation fails
 */
export const startCall = async (sessionId: string, userId: string, interpreterId: string): Promise<string> => {
  try {
    // Create call data object with initial values
    const callData: Omit<CallData, 'call_id'> = {
      session_id: sessionId,
      user_id: userId,
      interpreter_id: interpreterId,
      started_at: serverTimestamp() as Timestamp, // Use server timestamp for accuracy
      status: 'active', // Call is starting, so status is active
      call_quality: {
        // Initialize with default "good" values
        // These can be updated during/after the call based on actual metrics
        video_quality: 'good',
        audio_quality: 'good',
        connection_stability: 'good'
      },
      created_at: serverTimestamp() as Timestamp
    };

    // Create call document in Firestore
    const docRef = await addDoc(collection(db, 'calls'), callData);
    console.log('Call started with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error starting call:', error);
    throw error;
  }
};

/**
 * End a call session
 * 
 * Updates a call record when a video call ends. Calculates call duration
 * and optionally updates quality metrics and technical performance data.
 * 
 * @param callId - ID of the call document to update
 * @param callQuality - Optional subjective quality ratings (video, audio, stability)
 * @param technicalMetrics - Optional technical performance metrics (bitrate, packet loss, etc.)
 * @returns Promise that resolves when update is complete
 * @throws Error if call not found or update fails
 */
export const endCall = async (callId: string, callQuality?: CallData['call_quality'], technicalMetrics?: CallData['technical_metrics']): Promise<void> => {
  try {
    // Get existing call document
    const callDoc = await getDoc(doc(db, 'calls', callId));
    if (!callDoc.exists()) {
      throw new Error('Call not found');
    }

    const callData = callDoc.data() as CallData;
    const startedAt = callData.started_at;
    const endedAt = Timestamp.now(); // Current timestamp
    
    // Calculate call duration in seconds
    const durationSeconds = startedAt ? Math.floor((endedAt.toMillis() - startedAt.toMillis()) / 1000) : 0;

    // Prepare update data
    const updateData: Partial<CallData> = {
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      status: 'ended' // Mark call as ended
    };

    // Include quality metrics if provided
    if (callQuality) {
      updateData.call_quality = callQuality;
    }

    // Include technical metrics if provided
    if (technicalMetrics) {
      updateData.technical_metrics = technicalMetrics;
    }

    // Update call document in Firestore
    await updateDoc(doc(db, 'calls', callId), updateData);
    console.log('Call ended successfully');
  } catch (error) {
    console.error('Error ending call:', error);
    throw error;
  }
};

/**
 * Get call by session ID
 * 
 * Retrieves the call record associated with a specific session.
 * Used to check if a call exists for a session or get call details.
 * 
 * @param sessionId - ID of the session
 * @returns Promise resolving to CallData if found, null otherwise
 * @throws Error if query fails
 */
export const getCallBySessionId = async (sessionId: string): Promise<CallData | null> => {
  try {
    // Query calls collection for this session
    const q = query(
      collection(db, 'calls'),
      where('session_id', '==', sessionId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Return null if no call found
    if (querySnapshot.empty) {
      return null;
    }

    // Return first (and should be only) call document
    const callDoc = querySnapshot.docs[0];
    return { call_id: callDoc.id, ...callDoc.data() } as CallData;
  } catch (error) {
    console.error('Error getting call by session ID:', error);
    throw error;
  }
};

/**
 * Get calls for a user (deaf/mute)
 * 
 * Retrieves all call records for a specific user, sorted by most recent first.
 * Used to display call history in user profiles.
 * 
 * @param userId - ID of the user
 * @param limit - Maximum number of calls to return (default: 10)
 * @returns Promise resolving to array of CallData objects
 * @throws Error if query fails
 */
export const getUserCalls = async (userId: string, limit: number = 10): Promise<CallData[]> => {
  try {
    // Query calls collection for this user
    const q = query(
      collection(db, 'calls'),
      where('user_id', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Convert Firestore documents to CallData objects
    // Sort by started_at in memory since orderBy might need composite index
    const calls = querySnapshot.docs.map(doc => ({
      call_id: doc.id,
      ...doc.data()
    })) as CallData[];
    
    // Sort by started_at descending (most recent first) and apply limit
    return calls
      .sort((a, b) => b.started_at.toMillis() - a.started_at.toMillis())
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting user calls:', error);
    throw error;
  }
};

/**
 * Get calls for an interpreter
 * 
 * Retrieves all call records for a specific interpreter, sorted by most recent first.
 * Used to display call history in interpreter profiles.
 * 
 * @param interpreterId - ID of the interpreter
 * @param limit - Maximum number of calls to return (default: 10)
 * @returns Promise resolving to array of CallData objects
 * @throws Error if query fails
 */
export const getInterpreterCalls = async (interpreterId: string, limit: number = 10): Promise<CallData[]> => {
  try {
    // Query calls collection for this interpreter
    const q = query(
      collection(db, 'calls'),
      where('interpreter_id', '==', interpreterId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Convert Firestore documents to CallData objects
    // Sort by started_at in memory since orderBy might need composite index
    const calls = querySnapshot.docs.map(doc => ({
      call_id: doc.id,
      ...doc.data()
    })) as CallData[];
    
    // Sort by started_at descending (most recent first) and apply limit
    return calls
      .sort((a, b) => b.started_at.toMillis() - a.started_at.toMillis())
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting interpreter calls:', error);
    throw error;
  }
};


/**
 * Mark call as failed
 * 
 * Updates a call record to indicate the call failed (e.g., connection issues,
 * technical problems). Used when a call cannot be completed successfully.
 * 
 * @param callId - ID of the call document to update
 * @param reason - Optional reason for failure (for logging/debugging)
 * @returns Promise that resolves when update is complete
 * @throws Error if update fails
 */
export const markCallAsFailed = async (callId: string, reason?: string): Promise<void> => {
  try {
    // Prepare update data to mark call as failed
    const updateData: Partial<CallData> = {
      status: 'failed', // Set status to failed
      ended_at: Timestamp.now() // Record when failure occurred
    };

    // Log failure reason if provided (for debugging)
    if (reason) {
      console.log('Call failed reason:', reason);
    }

    // Update call document in Firestore
    await updateDoc(doc(db, 'calls', callId), updateData);
    console.log('Call marked as failed');
  } catch (error) {
    console.error('Error marking call as failed:', error);
    throw error;
  }
};