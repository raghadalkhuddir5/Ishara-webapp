/**
 * Utility functions for session management
 */

/**
 * Check if a session is expired based on its scheduled time
 * @param scheduledTime - The scheduled time of the session (ISO string or Date)
 * @param gracePeriodHours - Number of hours after scheduled time to allow joining (default: 2)
 * @returns true if session is expired, false otherwise
 */
export const isSessionExpired = (
  scheduledTime: string | Date, 
  gracePeriodHours: number = 2
): boolean => {
  const scheduled = new Date(scheduledTime);
  const now = new Date();
  const timeDifference = now.getTime() - scheduled.getTime();
  const hoursDifference = timeDifference / (1000 * 60 * 60);
  
  return hoursDifference > gracePeriodHours;
};

/**
 * Get the time remaining until a session expires
 * @param scheduledTime - The scheduled time of the session (ISO string or Date)
 * @param gracePeriodHours - Number of hours after scheduled time to allow joining (default: 2)
 * @returns Time remaining in hours (negative if expired)
 */
export const getTimeUntilExpiry = (
  scheduledTime: string | Date, 
  gracePeriodHours: number = 2
): number => {
  const scheduled = new Date(scheduledTime);
  const now = new Date();
  const timeDifference = now.getTime() - scheduled.getTime();
  const hoursDifference = timeDifference / (1000 * 60 * 60);
  
  return gracePeriodHours - hoursDifference;
};

/**
 * Format time remaining in a human-readable format
 * @param hours - Number of hours remaining
 * @returns Formatted string like "2h 30m remaining" or "Expired 1h ago"
 */
export const formatTimeRemaining = (hours: number): string => {
  if (hours <= 0) {
    const expiredHours = Math.abs(hours);
    if (expiredHours < 1) {
      const expiredMinutes = Math.round(expiredHours * 60);
      return `Expired ${expiredMinutes}m ago`;
    }
    return `Expired ${Math.round(expiredHours)}h ago`;
  }
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m remaining`;
  }
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h remaining`;
  }
  
  return `${wholeHours}h ${minutes}m remaining`;
};
