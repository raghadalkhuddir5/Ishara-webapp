/**
 * Rating Service
 * 
 * This service handles all rating-related operations for the application.
 * It manages ratings submitted by deaf/mute users for interpreters after
 * completed sessions.
 * 
 * Features:
 * - Submit ratings for completed sessions
 * - Validate rating eligibility
 * - Calculate and update interpreter average ratings
 * - Retrieve ratings for display
 * - Prevent duplicate ratings
 * 
 * Business Rules:
 * - Only deaf/mute users can rate sessions
 * - Sessions must be completed before rating
 * - Each session can only be rated once
 * - Ratings are 1-5 stars with optional feedback
 */

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
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * RatingData Interface
 * 
 * Represents a rating document stored in Firestore.
 * Contains all information about a rating submitted for a session.
 */
export interface RatingData {
  session_id: string; // ID of the session being rated
  user_id: string; // ID of the user (deaf/mute) who submitted the rating
  interpreter_id: string; // ID of the interpreter being rated
  stars: number; // Rating value (1-5)
  feedback: string; // Optional text feedback
  created_at: Timestamp; // When the rating was created
  rating_id?: string; // Document ID in Firestore
}

/**
 * RatingSubmission Interface
 * 
 * Represents the data required to submit a new rating.
 * Used as input for the submitRating function.
 */
export interface RatingSubmission {
  sessionId: string;
  userId: string;
  interpreterId: string;
  stars: number; // Must be between 1 and 5
  feedback: string; // Can be empty string
}

/**
 * Submit a rating for a completed session
 * 
 * This function handles the complete rating submission process:
 * 1. Validates input data
 * 2. Validates session eligibility (completed, not already rated, correct user)
 * 3. Creates rating document in Firestore
 * 4. Marks session as rated
 * 5. Updates interpreter's average rating
 * 
 * @param ratingData - Rating submission data
 * @returns Promise resolving to the rating document ID
 * @throws Error if validation fails or submission fails
 */
export const submitRating = async (ratingData: RatingSubmission): Promise<string> => {
  try {
    console.log('Submitting rating:', ratingData);
    
    // Step 1: Validate required inputs
    if (!ratingData.sessionId || !ratingData.userId || !ratingData.interpreterId) {
      throw new Error('Missing required rating data');
    }
    
    // Step 2: Validate stars rating is in valid range
    if (ratingData.stars < 1 || ratingData.stars > 5) {
      throw new Error('Stars must be between 1 and 5');
    }
    
    // Step 3: Get session document to validate eligibility
    const sessionDoc = await getDoc(doc(db, "sessions", ratingData.sessionId));
    if (!sessionDoc.exists()) {
      throw new Error('Session not found');
    }
    
    const session = sessionDoc.data();
    
    // Step 4: Validate session is completed (can't rate pending/confirmed sessions)
    if (session.status !== 'completed') {
      throw new Error('Session must be completed to rate');
    }
    
    // Step 5: Validate user is the deaf/mute user (only they can rate)
    if (session.user_id !== ratingData.userId) {
      throw new Error('Only the deaf/mute user can rate this session');
    }
    
    // Step 6: Check if session is already rated (prevent duplicates)
    if (session.is_rated) {
      throw new Error('Session has already been rated');
    }
    
    // Step 7: Validate interpreter ID matches session
    if (session.interpreter_id !== ratingData.interpreterId) {
      throw new Error('Interpreter ID does not match session');
    }
    
    // Step 8: Create rating document in Firestore
    const ratingDoc = await addDoc(collection(db, "ratings"), {
      session_id: ratingData.sessionId,
      user_id: ratingData.userId,
      interpreter_id: ratingData.interpreterId,
      stars: ratingData.stars,
      feedback: ratingData.feedback.trim(), // Trim whitespace from feedback
      created_at: serverTimestamp() // Use server timestamp for consistency
    });
    
    console.log('Rating created with ID:', ratingDoc.id);
    
    // Step 9: Update session document to mark as rated
    // This prevents duplicate ratings and links the rating to the session
    await updateDoc(doc(db, "sessions", ratingData.sessionId), {
      is_rated: true,
      rating_id: ratingDoc.id, // Store rating ID for quick lookup
      updated_at: serverTimestamp()
    });
    
    console.log('Session marked as rated');
    
    // Step 10: Update interpreter's average rating
    // Recalculates average from all ratings for this interpreter
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
 * 
 * This function recalculates the average rating for an interpreter by:
 * 1. Querying all ratings for the interpreter
 * 2. Calculating the average (sum of stars / count)
 * 3. Rounding to 1 decimal place
 * 4. Updating the interpreter document
 * 
 * This is called whenever a new rating is submitted to keep the average current.
 * 
 * @param interpreterId - ID of the interpreter whose rating to update
 * @returns Promise that resolves when update is complete
 * @throws Error if update fails
 */
export const updateInterpreterAverageRating = async (interpreterId: string): Promise<void> => {
  try {
    console.log('Updating average rating for interpreter:', interpreterId);
    
    // Query all ratings for this interpreter from Firestore
    const ratingsQuery = query(
      collection(db, "ratings"),
      where("interpreter_id", "==", interpreterId)
    );
    
    const ratingsSnapshot = await getDocs(ratingsQuery);
    
    // Handle case where interpreter has no ratings yet
    if (ratingsSnapshot.empty) {
      // No ratings yet, set to 0
      await updateDoc(doc(db, "interpreters", interpreterId), {
        average_rating: 0,
        updated_at: serverTimestamp()
      });
      console.log('No ratings found, set average to 0');
      return;
    }
    
    // Calculate average rating from all ratings
    let totalStars = 0;
    let ratingCount = 0;
    
    // Sum all star ratings
    ratingsSnapshot.forEach((doc) => {
      const rating = doc.data();
      totalStars += rating.stars;
      ratingCount++;
    });
    
    // Calculate average and round to 1 decimal place for display
    const averageRating = Math.round((totalStars / ratingCount) * 10) / 10;
    
    console.log(`Calculated average: ${totalStars}/${ratingCount} = ${averageRating}`);
    
    // Update interpreter document with new average rating
    // This value is used for display in interpreter profiles and search results
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
 * 
 * Validates all conditions required for rating a session:
 * 1. Session exists
 * 2. Session is completed
 * 3. Session is not already rated
 * 4. User is the deaf/mute user (not the interpreter)
 * 
 * This function is used to determine if the rating button should be shown/enabled.
 * 
 * @param sessionId - ID of the session to check
 * @param userId - ID of the user attempting to rate
 * @returns Promise resolving to true if user can rate, false otherwise
 */
export const canRateSession = async (sessionId: string, userId: string): Promise<boolean> => {
  try {
    console.log('Checking if user can rate session:', { sessionId, userId });
    
    // Get session document
    const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
    if (!sessionDoc.exists()) {
      console.log('Session not found');
      return false;
    }
    
    const session = sessionDoc.data();
    
    // Check 1: Session must be completed (can't rate pending/confirmed sessions)
    if (session.status !== 'completed') {
      console.log('Session not completed:', session.status);
      return false;
    }
    
    // Check 2: Session must not already be rated (prevent duplicates)
    if (session.is_rated) {
      console.log('Session already rated');
      return false;
    }
    
    // Check 3: User must be the deaf/mute user (interpreters cannot rate themselves)
    if (session.user_id !== userId) {
      console.log('User is not the deaf/mute user in this session');
      return false;
    }
    
    console.log('User can rate this session');
    return true;
  } catch (error) {
    console.error('Failed to check if user can rate session:', error);
    return false; // Fail-safe: return false on error
  }
};

/**
 * Get ratings for a specific interpreter
 * 
 * Retrieves ratings submitted for an interpreter, ordered by most recent first.
 * Used to display ratings in the interpreter's profile.
 * 
 * @param interpreterId - ID of the interpreter
 * @param limitCount - Optional limit on number of ratings to return
 * @returns Promise resolving to array of RatingData objects
 * @throws Error if query fails
 */
export const getRatingsForInterpreter = async (interpreterId: string, limitCount?: number): Promise<RatingData[]> => {
  try {
    console.log('Getting ratings for interpreter:', interpreterId);
    
    // Build query: get all ratings for this interpreter, ordered by newest first
    let ratingsQuery = query(
      collection(db, "ratings"),
      where("interpreter_id", "==", interpreterId),
      orderBy("created_at", "desc") // Most recent first
    );
    
    // Apply limit if specified (useful for showing only recent ratings)
    if (limitCount) {
      ratingsQuery = query(ratingsQuery, limit(limitCount));
    }
    
    // Execute query
    const ratingsSnapshot = await getDocs(ratingsQuery);
    
    // Convert Firestore documents to RatingData objects
    const ratings: RatingData[] = [];
    ratingsSnapshot.forEach((doc) => {
      ratings.push({
        ...doc.data(),
        rating_id: doc.id // Include document ID
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
 * 
 * Retrieves the rating submitted for a particular session.
 * Used to display existing ratings or check if a session has been rated.
 * 
 * @param sessionId - ID of the session
 * @returns Promise resolving to RatingData if found, null otherwise
 * @throws Error if query fails
 */
export const getRatingForSession = async (sessionId: string): Promise<RatingData | null> => {
  try {
    console.log('Getting rating for session:', sessionId);
    
    // Query ratings collection for this specific session
    const ratingsQuery = query(
      collection(db, "ratings"),
      where("session_id", "==", sessionId)
    );
    
    const ratingsSnapshot = await getDocs(ratingsQuery);
    
    // Return null if no rating found (session not rated yet)
    if (ratingsSnapshot.empty) {
      console.log('No rating found for session');
      return null;
    }
    
    // Get first (and should be only) rating document
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