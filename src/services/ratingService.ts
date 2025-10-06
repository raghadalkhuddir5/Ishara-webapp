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

export interface RatingData {
  rating_id?: string;
  session_id: string;
  rater_id: string;
  rated_id: string;
  rater_role: 'deaf_mute' | 'interpreter';
  rated_role: 'deaf_mute' | 'interpreter';
  rating: number; // 1-5 stars
  comment?: string;
  categories: {
    communication: number; // 1-5
    professionalism: number; // 1-5
    punctuality: number; // 1-5
    technical_quality: number; // 1-5
  };
  is_anonymous: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Create a new rating
export const createRating = async (ratingData: Omit<RatingData, 'rating_id' | 'created_at' | 'updated_at'>): Promise<string> => {
  try {
    // Validate rating values
    if (ratingData.rating < 1 || ratingData.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Validate category ratings
    const categories = ratingData.categories;
    Object.values(categories).forEach(categoryRating => {
      if (categoryRating < 1 || categoryRating > 5) {
        throw new Error('Category ratings must be between 1 and 5');
      }
    });

    const newRating: Omit<RatingData, 'rating_id'> = {
      ...ratingData,
      created_at: serverTimestamp() as Timestamp,
      updated_at: serverTimestamp() as Timestamp
    };

    const docRef = await addDoc(collection(db, 'ratings'), newRating);
    console.log('Rating created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating rating:', error);
    throw error;
  }
};

// Update an existing rating
export const updateRating = async (ratingId: string, updates: Partial<Omit<RatingData, 'rating_id' | 'created_at' | 'rater_id' | 'rated_id' | 'session_id'>>): Promise<void> => {
  try {
    // Validate rating values if provided
    if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Validate category ratings if provided
    if (updates.categories) {
      Object.values(updates.categories).forEach(categoryRating => {
        if (categoryRating < 1 || categoryRating > 5) {
          throw new Error('Category ratings must be between 1 and 5');
        }
      });
    }

    await updateDoc(doc(db, 'ratings', ratingId), {
      ...updates,
      updated_at: serverTimestamp()
    });
    console.log('Rating updated successfully');
  } catch (error) {
    console.error('Error updating rating:', error);
    throw error;
  }
};

// Get rating by ID
export const getRating = async (ratingId: string): Promise<RatingData | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'ratings', ratingId));
    if (!docSnap.exists()) {
      return null;
    }
    return { rating_id: docSnap.id, ...docSnap.data() } as RatingData;
  } catch (error) {
    console.error('Error getting rating:', error);
    throw error;
  }
};

// Get ratings for a session
export const getSessionRatings = async (sessionId: string): Promise<RatingData[]> => {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('session_id', '==', sessionId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      rating_id: doc.id,
      ...doc.data()
    })) as RatingData[];
  } catch (error) {
    console.error('Error getting session ratings:', error);
    throw error;
  }
};

// Get ratings received by a user
export const getRatingsReceived = async (userId: string, limit: number = 10): Promise<RatingData[]> => {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('rated_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.slice(0, limit).map(doc => ({
      rating_id: doc.id,
      ...doc.data()
    })) as RatingData[];
  } catch (error) {
    console.error('Error getting ratings received:', error);
    throw error;
  }
};

// Get ratings given by a user
export const getRatingsGiven = async (userId: string, limit: number = 10): Promise<RatingData[]> => {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('rater_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.slice(0, limit).map(doc => ({
      rating_id: doc.id,
      ...doc.data()
    })) as RatingData[];
  } catch (error) {
    console.error('Error getting ratings given:', error);
    throw error;
  }
};

// Calculate average rating for a user
export const calculateAverageRating = async (userId: string): Promise<{
  overall: number;
  communication: number;
  professionalism: number;
  punctuality: number;
  technical_quality: number;
  total_ratings: number;
}> => {
  try {
    const ratings = await getRatingsReceived(userId, 100); // Get more ratings for accurate average
    
    if (ratings.length === 0) {
      return {
        overall: 0,
        communication: 0,
        professionalism: 0,
        punctuality: 0,
        technical_quality: 0,
        total_ratings: 0
      };
    }

    const totals = ratings.reduce((acc, rating) => {
      acc.overall += rating.rating;
      acc.communication += rating.categories.communication;
      acc.professionalism += rating.categories.professionalism;
      acc.punctuality += rating.categories.punctuality;
      acc.technical_quality += rating.categories.technical_quality;
      return acc;
    }, {
      overall: 0,
      communication: 0,
      professionalism: 0,
      punctuality: 0,
      technical_quality: 0
    });

    const count = ratings.length;
    return {
      overall: Math.round((totals.overall / count) * 10) / 10,
      communication: Math.round((totals.communication / count) * 10) / 10,
      professionalism: Math.round((totals.professionalism / count) * 10) / 10,
      punctuality: Math.round((totals.punctuality / count) * 10) / 10,
      technical_quality: Math.round((totals.technical_quality / count) * 10) / 10,
      total_ratings: count
    };
  } catch (error) {
    console.error('Error calculating average rating:', error);
    throw error;
  }
};

// Check if user has already rated a session
export const hasUserRatedSession = async (sessionId: string, userId: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('session_id', '==', sessionId),
      where('rater_id', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking if user has rated session:', error);
    throw error;
  }
};

// Get rating statistics for a user
export const getRatingStatistics = async (userId: string): Promise<{
  average_rating: number;
  total_ratings: number;
  rating_distribution: { [key: number]: number };
  recent_ratings: RatingData[];
}> => {
  try {
    const ratings = await getRatingsReceived(userId, 50);
    
    if (ratings.length === 0) {
      return {
        average_rating: 0,
        total_ratings: 0,
        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recent_ratings: []
      };
    }

    const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    const averageRating = Math.round((totalRating / ratings.length) * 10) / 10;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(rating => {
      distribution[rating.rating as keyof typeof distribution]++;
    });

    return {
      average_rating: averageRating,
      total_ratings: ratings.length,
      rating_distribution: distribution,
      recent_ratings: ratings.slice(0, 5)
    };
  } catch (error) {
    console.error('Error getting rating statistics:', error);
    throw error;
  }
};
