import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
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
    const endedAt = serverTimestamp() as Timestamp;
    
    // Calculate duration
    const durationSeconds = startedAt ? Math.floor((endedAt.seconds - startedAt.seconds)) : 0;

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
      where('user_id', '==', userId),
      orderBy('started_at', 'desc'),
      // Note: You might need to add a composite index for this query
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.slice(0, limit).map(doc => ({
      call_id: doc.id,
      ...doc.data()
    })) as CallData[];
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
      where('interpreter_id', '==', interpreterId),
      orderBy('started_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.slice(0, limit).map(doc => ({
      call_id: doc.id,
      ...doc.data()
    })) as CallData[];
  } catch (error) {
    console.error('Error getting interpreter calls:', error);
    throw error;
  }
};

// Update call quality during the call
export const updateCallQuality = async (callId: string, quality: CallData['call_quality']): Promise<void> => {
  try {
    await updateDoc(doc(db, 'calls', callId), {
      call_quality: quality
    });
    console.log('Call quality updated');
  } catch (error) {
    console.error('Error updating call quality:', error);
    throw error;
  }
};

// Update technical metrics during the call
export const updateTechnicalMetrics = async (callId: string, metrics: CallData['technical_metrics']): Promise<void> => {
  try {
    await updateDoc(doc(db, 'calls', callId), {
      technical_metrics: metrics
    });
    console.log('Technical metrics updated');
  } catch (error) {
    console.error('Error updating technical metrics:', error);
    throw error;
  }
};

// Mark call as failed
export const markCallAsFailed = async (callId: string, reason?: string): Promise<void> => {
  try {
    const updateData: Partial<CallData> = {
      status: 'failed',
      ended_at: serverTimestamp() as Timestamp
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