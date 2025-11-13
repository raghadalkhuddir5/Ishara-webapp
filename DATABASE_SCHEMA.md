# Ishara Database Schema

## Collections Overview

### 1. **users** - User profiles and authentication
### 2. **interpreters** - Interpreter availability and settings
### 3. **sessions** - Session bookings and management
### 4. **calls** - Session recordings and call metadata
### 5. **ratings** - User ratings and feedback
### 6. **notifications** - System notifications

---

## Collection Details

### 1. **users** Collection
```typescript
{
  user_id: string;                 // Firebase Auth UID (document ID)
  email: string;
  password_hash: string;           // Empty string (Firebase handles auth)
  role: "deaf_mute" | "interpreter";
  full_name: string;
  birthdate?: string | null;       // Date string (YYYY-MM-DD format)
  age?: number;                   // Calculated from birthdate
  phone_number?: string;
  language?: string;               // Language preference ("en" | "ar")
  created_at: Date | Timestamp;
  updated_at: Date | Timestamp;
  fcmToken?: string;               // Firebase Cloud Messaging token
  fcmTokenUpdatedAt?: Date;        // When FCM token was last updated
  profile_picture?: string;        // URL to profile picture (optional)
}
```

### 2. **interpreters** Collection
```typescript
{
  interpreter_id: string;         // Same as user UID (document ID)
  availability: {
    isAlwaysAvailable: boolean;
    days: {
      [day: string]: {            // Day keys: "monday", "tuesday", etc.
        morning: boolean;
        evening: boolean;
      }
    }
  };
  average_rating: number;          // Calculated average rating (default: 0)
  total_sessions: number;          // Total number of sessions (default: 0)
  bio?: string;                    // Interpreter biography (default: "")
  languages?: string[];             // Supported languages (optional)
  hourly_rate?: number;            // Hourly rate (optional)
}
```

### 3. **sessions** Collection
```typescript
{
  // Document ID is used as session_id
  user_id: string;                // Deaf/mute user UID
  interpreter_id: string;         // Interpreter UID
  scheduled_time: string | Timestamp;  // ISO string or Timestamp
  duration: number;                // Duration in minutes (default: 0)
  status: "requested" | "confirmed" | "rejected" | "cancelled" | "completed" | "in_progress";
  created_at: Timestamp;
  updated_at?: Timestamp;         // Updated when session status changes
  reminderSent?: boolean;          // Whether reminder notification was sent (default: false)
  is_rated: boolean;               // Track if session was rated (default: false)
  rating_id?: string;             // Reference to rating document (optional)
  hidden?: boolean;                // Soft delete flag (default: false)
  // Optional fields (not currently used but may be added):
  // session_type?: "immediate" | "scheduled";
  // language?: string;
  // description?: string;
  // started_at?: Timestamp;
  // ended_at?: Timestamp;
  // channel_name?: string;        // For video calls
  // temp_token?: string;          // For video calls
}
```

### 4. **calls** Collection
```typescript
{
  // Document ID is used as call_id
  session_id: string;             // Reference to sessions
  user_id: string;                // Deaf/mute user
  interpreter_id: string;         // Interpreter
  started_at: Timestamp;
  ended_at?: Timestamp;
  duration_seconds?: number;       // Calculated when call ends
  status: "active" | "ended" | "failed";
  recording_url?: string;         // If recording is enabled
  recording_duration?: number;    // Recording length in seconds
  call_quality: {
    video_quality: "poor" | "fair" | "good" | "excellent";
    audio_quality: "poor" | "fair" | "good" | "excellent";
    connection_stability: "poor" | "fair" | "good" | "excellent";
  };
  technical_metrics?: {
    avg_bitrate: number;
    packet_loss: number;
    jitter: number;
    latency: number;
  };
  created_at: Timestamp;
}
```

### 5. **ratings** Collection
```typescript
{
  // Document ID is used as rating_id
  session_id: string;             // Reference to the session (foreign key)
  user_id: string;                // ID of user who gave the rating (deaf/mute user)
  interpreter_id: string;         // ID of interpreter being rated
  stars: number;                  // 1-5 star rating
  feedback: string;               // Comment/feedback (can be empty string)
  created_at: Timestamp;
}
```

### 6. **notifications** Collection
```typescript
{
  // Document ID is used as notification_id
  user_id: string;                // Target user
  type: "session_request" | "session_confirmed" | "session_cancelled" | 
        "session_reminder" | "rating_received" | "system_update";
  title: string;
  message: string;
  data?: {                        // Additional data for the notification
    session_id?: string;
    rating_id?: string;
    [key: string]: unknown;       // Additional custom fields
  };
  is_read: boolean;               // Default: false
  priority: "low" | "medium" | "high";
  created_at: Timestamp;
  read_at?: Timestamp;            // When notification was marked as read
  expires_at?: Timestamp;         // Optional expiration time
  // Internal cleanup fields (set by cleanup functions):
  // deleted?: boolean;            // Soft delete flag
  // cleared?: boolean;            // Marked as cleared
  // expired?: boolean;            // Marked as expired
  // duplicate?: boolean;         // Marked as duplicate
}
```

---

## Relationships

### Session → Call (1:1)
- Each session can have one call record
- Call record is created when session starts

### Session → Ratings (1:1)
- Each session can have one rating (from the deaf/mute user)
- Only the deaf/mute user can rate the interpreter
- Rating is created after session completion

### User → Notifications (1:many)
- Each user can have multiple notifications
- Notifications are user-specific

### User → Sessions (1:many)
- Each user can have multiple sessions
- Sessions are filtered by user_id or interpreter_id

---

## Indexes Required

### Sessions
- user_id + scheduled_time (DESC)
- interpreter_id + scheduled_time (DESC)
- status + scheduled_time (DESC)

### Calls
- session_id (for unique lookup)
- user_id + started_at (DESC)
- interpreter_id + started_at (DESC)

### Ratings
- session_id (for unique lookup per session)
- interpreter_id + created_at (DESC)

### Notifications
- user_id + is_read + created_at (DESC)
- user_id + type + created_at (DESC)





