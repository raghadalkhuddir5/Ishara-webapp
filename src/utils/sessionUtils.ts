/**
 * Session Utility Functions
 * 
 * This module provides utility functions for managing session lifecycle,
 * including expiration checks and time calculations.
 * 
 * Purpose:
 * - Validate session expiration based on scheduled time
 * - Calculate time remaining until session expires
 * - Format time remaining in human-readable format
 */

/**
 * Check if a session is expired based on its scheduled time
 * 
 * A session is considered expired if more than the grace period has passed
 * since the scheduled time. This prevents users from joining sessions that
 * are too far in the past.
 * 
 * @param scheduledTime - The scheduled time of the session (ISO string or Date)
 * @param gracePeriodHours - Number of hours after scheduled time to allow joining (default: 2)
 * @returns true if session is expired, false otherwise
 * 
 * @example
 * const isExpired = isSessionExpired("2024-01-01T10:00:00Z", 2);
 * // Returns true if current time is more than 2 hours after scheduled time
 */
export const isSessionExpired = (
  scheduledTime: string | Date, 
  gracePeriodHours: number = 2
): boolean => {
  // Convert scheduled time to Date object
  const scheduled = new Date(scheduledTime);
  const now = new Date();
  
  // Calculate time difference in milliseconds
  const timeDifference = now.getTime() - scheduled.getTime();
  // Convert to hours
  const hoursDifference = timeDifference / (1000 * 60 * 60);
  
  // Session is expired if more than grace period has passed
  return hoursDifference > gracePeriodHours;
};

/**
 * Get the time remaining until a session expires
 * 
 * Calculates how many hours remain before the session expires.
 * Returns negative value if session is already expired.
 * 
 * @param scheduledTime - The scheduled time of the session (ISO string or Date)
 * @param gracePeriodHours - Number of hours after scheduled time to allow joining (default: 2)
 * @returns Time remaining in hours (negative if expired)
 * 
 * @example
 * const timeRemaining = getTimeUntilExpiry("2024-01-01T10:00:00Z", 2);
 * // Returns 1.5 if 30 minutes remain, -0.5 if expired 30 minutes ago
 */
export const getTimeUntilExpiry = (
  scheduledTime: string | Date, 
  gracePeriodHours: number = 2
): number => {
  const scheduled = new Date(scheduledTime);
  const now = new Date();
  
  // Calculate time difference in hours
  const timeDifference = now.getTime() - scheduled.getTime();
  const hoursDifference = timeDifference / (1000 * 60 * 60);
  
  // Return remaining hours (negative if expired)
  return gracePeriodHours - hoursDifference;
};

/**
 * Format time remaining in a human-readable format
 * 
 * Converts hours to a user-friendly string format.
 * Handles both positive (remaining) and negative (expired) values.
 * 
 * @param hours - Number of hours remaining (can be negative if expired)
 * @returns Formatted string like "2h 30m remaining" or "Expired 1h ago"
 * 
 * @example
 * formatTimeRemaining(2.5) // "2h 30m remaining"
 * formatTimeRemaining(0.5) // "30m remaining"
 * formatTimeRemaining(-1.5) // "Expired 1h ago"
 */
export const formatTimeRemaining = (hours: number): string => {
  // Handle expired sessions (negative hours)
  if (hours <= 0) {
    const expiredHours = Math.abs(hours);
    // If expired less than an hour ago, show minutes
    if (expiredHours < 1) {
      const expiredMinutes = Math.round(expiredHours * 60);
      return `Expired ${expiredMinutes}m ago`;
    }
    // Otherwise show hours
    return `Expired ${Math.round(expiredHours)}h ago`;
  }
  
  // Handle sessions with less than 1 hour remaining
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m remaining`;
  }
  
  // Handle sessions with 1+ hours remaining
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  // If no minutes, show only hours
  if (minutes === 0) {
    return `${wholeHours}h remaining`;
  }
  
  // Show both hours and minutes
  return `${wholeHours}h ${minutes}m remaining`;
};
