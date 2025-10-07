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

export interface CallData {
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

// Start a new call session
export const startCall = async (sessionId: string, userId: string, interpreterId: string): Promise<string> => {
  try {
    const callData: Omit<CallData, 'call_id'> = {
      session_id: sessionId,
      user_id: userId,
      interpreter_id: interpreterId,
      started_at: serverTimestamp() as Timestamp,
      status: 'active',
      call_quality: {
        video_quality: 'good',
        audio_quality: 'good',
        connection_stability: 'good'
      },
      created_at: serverTimestamp() as Timestamp
    };

    const docRef = await addDoc(collection(db, 'calls'), callData);
    console.log('Call started with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error starting call:', error);
    throw error;
  }
};

// End a call session
export const endCall = async (callId: string, callQuality?: CallData['call_quality'], technicalMetrics?: CallData['technical_metrics']): Promise<void> => {
  try {
    const callDoc = await getDoc(doc(db, 'calls', callId));
    if (!callDoc.exists()) {
      throw new Error('Call not found');
    }

    const callData = callDoc.data() as CallData;
    const startedAt = callData.started_at;
    const endedAt = Timestamp.now();
    
    // Calculate duration
    const durationSeconds = startedAt ? Math.floor((endedAt.toMillis() - startedAt.toMillis()) / 1000) : 0;

    const updateData: Partial<CallData> = {
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      status: 'ended'
    };

    if (callQuality) {
      updateData.call_quality = callQuality;
    }

    if (technicalMetrics) {
      updateData.technical_metrics = technicalMetrics;
    }

    await updateDoc(doc(db, 'calls', callId), updateData);
    console.log('Call ended successfully');
  } catch (error) {
    console.error('Error ending call:', error);
    throw error;
  }
};

// Get call by session ID
export const getCallBySessionId = async (sessionId: string): Promise<CallData | null> => {
  try {
    const q = query(
      collection(db, 'calls'),
      where('session_id', '==', sessionId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }

    const callDoc = querySnapshot.docs[0];
    return { call_id: callDoc.id, ...callDoc.data() } as CallData;
  } catch (error) {
    console.error('Error getting call by session ID:', error);
    throw error;
  }
};

// Get calls for a user
export const getUserCalls = async (userId: string, limit: number = 10): Promise<CallData[]> => {
  try {
    const q = query(
      collection(db, 'calls'),
      where('user_id', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    // Sort by started_at in memory since orderBy might need composite index
    const calls = querySnapshot.docs.map(doc => ({
      call_id: doc.id,
      ...doc.data()
    })) as CallData[];
    
    // Sort by started_at descending and limit
    return calls
      .sort((a, b) => b.started_at.toMillis() - a.started_at.toMillis())
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting user calls:', error);
    throw error;
  }
};

// Get calls for an interpreter
export const getInterpreterCalls = async (interpreterId: string, limit: number = 10): Promise<CallData[]> => {
  try {
    const q = query(
      collection(db, 'calls'),
      where('interpreter_id', '==', interpreterId)
    );
    
    const querySnapshot = await getDocs(q);
    // Sort by started_at in memory since orderBy might need composite index
    const calls = querySnapshot.docs.map(doc => ({
      call_id: doc.id,
      ...doc.data()
    })) as CallData[];
    
    // Sort by started_at descending and limit
    return calls
      .sort((a, b) => b.started_at.toMillis() - a.started_at.toMillis())
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting interpreter calls:', error);
    throw error;
  }
};


// Mark call as failed
export const markCallAsFailed = async (callId: string, reason?: string): Promise<void> => {
  try {
    const updateData: Partial<CallData> = {
      status: 'failed',
      ended_at: Timestamp.now()
    };

    if (reason) {
      console.log('Call failed reason:', reason);
    }

    await updateDoc(doc(db, 'calls', callId), updateData);
    console.log('Call marked as failed');
  } catch (error) {
    console.error('Error marking call as failed:', error);
    throw error;
  }
};