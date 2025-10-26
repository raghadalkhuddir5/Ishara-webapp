import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase";

export interface RatingData {
  session_id: string;
  user_id: string;
  interpreter_id: string;
  stars: number;
  feedback: string;
  created_at: any;
}

export interface RatingSubmission {
  sessionId: string;
  userId: string;
  interpreterId: string;
  stars: number;
  feedback: string;
}

/**
 * Submit a rating for a completed session
 */
export const submitRating = async (ratingData: RatingSubmission): Promise<string> => {
  try {
    console.log('Submitting rating:', ratingData);
    
    // Validate inputs
    if (!ratingData.sessionId || !ratingData.userId || !ratingData.interpreterId) {
      throw new Error('Missing required rating data');
    }
    
    if (ratingData.stars < 1 || ratingData.stars > 5) {
      throw new Error('Stars must be between 1 and 5');
    }
    
    // Get session document to validate
    const sessionDoc = await getDoc(doc(db, "sessions", ratingData.sessionId));
    if (!sessionDoc.exists()) {
      throw new Error('Session not found');
    }
    
    const session = sessionDoc.data();
    
    // Validate session is completed
    if (session.status !== 'completed') {
      throw new Error('Session must be completed to rate');
    }
    
    // Validate user is the deaf/mute user in this session
    if (session.user_id !== ratingData.userId) {
      throw new Error('Only the deaf/mute user can rate this session');
    }
    
    // Check if session is already rated
    if (session.is_rated) {
      throw new Error('Session has already been rated');
    }
    
    // Validate interpreter ID matches
    if (session.interpreter_id !== ratingData.interpreterId) {
      throw new Error('Interpreter ID does not match session');
    }
    
    // Create rating document
    const ratingDoc = await addDoc(collection(db, "ratings"), {
      session_id: ratingData.sessionId,
      user_id: ratingData.userId,
      interpreter_id: ratingData.interpreterId,
      stars: ratingData.stars,
      feedback: ratingData.feedback.trim(),
      created_at: serverTimestamp()
    });
    
    console.log('Rating created with ID:', ratingDoc.id);
    
    // Update session document to mark as rated
    await updateDoc(doc(db, "sessions", ratingData.sessionId), {
      is_rated: true,
      rating_id: ratingDoc.id,
      updated_at: serverTimestamp()
    });
    
    console.log('Session marked as rated');
    
    // Update interpreter's average rating
    await updateInterpreterAverageRating(ratingData.interpreterId);
    
    console.log('Interpreter average rating updated');
    
    return ratingDoc.id;
  } catch (error) {
    console.error('Failed to submit rating:', error);
    throw error;
  }
};

/**
 * Update interpreter's average rating by recalculating from all ratings
 */
export const updateInterpreterAverageRating = async (interpreterId: string): Promise<void> => {
  try {
    console.log('Updating average rating for interpreter:', interpreterId);
    
    // Query all ratings for this interpreter
    const ratingsQuery = query(
      collection(db, "ratings"),
      where("interpreter_id", "==", interpreterId)
    );
    
    const ratingsSnapshot = await getDocs(ratingsQuery);
    
    if (ratingsSnapshot.empty) {
      // No ratings yet, set to 0
      await updateDoc(doc(db, "interpreters", interpreterId), {
        average_rating: 0,
        updated_at: serverTimestamp()
      });
      console.log('No ratings found, set average to 0');
      return;
    }
    
    // Calculate average
    let totalStars = 0;
    let ratingCount = 0;
    
    ratingsSnapshot.forEach((doc) => {
      const rating = doc.data();
      totalStars += rating.stars;
      ratingCount++;
    });
    
    const averageRating = Math.round((totalStars / ratingCount) * 10) / 10; // Round to 1 decimal
    
    console.log(`Calculated average: ${totalStars}/${ratingCount} = ${averageRating}`);
    
    // Update interpreter document
    await updateDoc(doc(db, "interpreters", interpreterId), {
      average_rating: averageRating,
      updated_at: serverTimestamp()
    });
    
    console.log('Average rating updated successfully');
  } catch (error) {
    console.error('Failed to update interpreter average rating:', error);
    throw error;
  }
};

/**
 * Check if a user can rate a session
 */
export const canRateSession = async (sessionId: string, userId: string): Promise<boolean> => {
  try {
    console.log('Checking if user can rate session:', { sessionId, userId });
    
    const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
    if (!sessionDoc.exists()) {
      console.log('Session not found');
      return false;
    }
    
    const session = sessionDoc.data();
    
    // Check if session is completed
    if (session.status !== 'completed') {
      console.log('Session not completed:', session.status);
      return false;
    }
    
    // Check if session is already rated
    if (session.is_rated) {
      console.log('Session already rated');
      return false;
    }
    
    // Check if user is the deaf/mute user in this session
    if (session.user_id !== userId) {
      console.log('User is not the deaf/mute user in this session');
      return false;
    }
    
    console.log('User can rate this session');
    return true;
  } catch (error) {
    console.error('Failed to check if user can rate session:', error);
    return false;
  }
};

/**
 * Get ratings for a specific interpreter
 */
export const getRatingsForInterpreter = async (interpreterId: string, limitCount?: number): Promise<RatingData[]> => {
  try {
    console.log('Getting ratings for interpreter:', interpreterId);
    
    let ratingsQuery = query(
      collection(db, "ratings"),
      where("interpreter_id", "==", interpreterId),
      orderBy("created_at", "desc")
    );
    
    if (limitCount) {
      ratingsQuery = query(ratingsQuery, limit(limitCount));
    }
    
    const ratingsSnapshot = await getDocs(ratingsQuery);
    
    const ratings: RatingData[] = [];
    ratingsSnapshot.forEach((doc) => {
      ratings.push({
        ...doc.data(),
        rating_id: doc.id
      } as RatingData);
    });
    
    console.log(`Found ${ratings.length} ratings for interpreter`);
    return ratings;
  } catch (error) {
    console.error('Failed to get ratings for interpreter:', error);
    throw error;
  }
};

/**
 * Get rating for a specific session
 */
export const getRatingForSession = async (sessionId: string): Promise<RatingData | null> => {
  try {
    console.log('Getting rating for session:', sessionId);
    
    const ratingsQuery = query(
      collection(db, "ratings"),
      where("session_id", "==", sessionId)
    );
    
    const ratingsSnapshot = await getDocs(ratingsQuery);
    
    if (ratingsSnapshot.empty) {
      console.log('No rating found for session');
      return null;
    }
    
    const ratingDoc = ratingsSnapshot.docs[0];
    const rating = {
      ...ratingDoc.data(),
      rating_id: ratingDoc.id
    } as RatingData;
    
    console.log('Found rating for session');
    return rating;
  } catch (error) {
    console.error('Failed to get rating for session:', error);
    throw error;
  }
};
