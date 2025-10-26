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
  uid: string;                    // Firebase Auth UID
  email: string;
  full_name: string;
  role: "deaf_mute" | "interpreter";
  created_at: Timestamp;
  updated_at: Timestamp;
  profile_picture?: string;
  phone?: string;
  language_preference?: string;
  is_active: boolean;
}
```

### 2. **interpreters** Collection
```typescript
{
  interpreter_id: string;         // Same as user UID
  availability: {
    isAlwaysAvailable: boolean;
    days: {
      [day: string]: {
        morning: boolean;
        evening: boolean;
      }
    }
  };
  languages: string[];
  hourly_rate?: number;
  average_rating: number;          // Calculated average rating (default: 0)
  total_sessions: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### 3. **sessions** Collection
```typescript
{
  session_id: string;             // Auto-generated
  user_id: string;                // Deaf/mute user UID
  interpreter_id: string;         // Interpreter UID
  scheduled_time: Timestamp;
  duration_minutes: number;
  status: "requested" | "confirmed" | "in_progress" | "completed" | "cancelled";
  session_type: "immediate" | "scheduled";
  language: string;
  description?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  started_at?: Timestamp;
  ended_at?: Timestamp;
  channel_name?: string;          // For video calls
  temp_token?: string;            // For video calls
  is_rated: boolean;              // Track if session was rated (default: false)
  rating_id?: string;             // Reference to rating document (optional)
}
```

### 4. **calls** Collection (NEW)
```typescript
{
  call_id: string;                // Auto-generated
  session_id: string;             // Reference to sessions
  user_id: string;                // Deaf/mute user
  interpreter_id: string;         // Interpreter
  started_at: Timestamp;
  ended_at?: Timestamp;
  duration_seconds?: number;
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

### 5. **ratings** Collection (NEW)
```typescript
{
  rating_id: string;              // Auto-generated document ID
  session_id: string;            // Reference to the session (foreign key)
  user_id: string;               // ID of user who gave the rating
  interpreter_id: string;        // ID of interpreter being rated
  stars: number;                 // 1-5 star rating
  feedback: string;              // Optional comment
  created_at: Timestamp;
}
```

### 6. **notifications** Collection (NEW)
```typescript
{
  notification_id: string;        // Auto-generated
  user_id: string;                // Target user
  type: "session_request" | "session_confirmed" | "session_cancelled" | 
        "session_reminder" | "rating_received" | "system_update";
  title: string;
  message: string;
  data?: {                        // Additional data for the notification
    session_id?: string;
    rating_id?: string;
    [key: string]: any;
  };
  is_read: boolean;
  priority: "low" | "medium" | "high";
  created_at: Timestamp;
  read_at?: Timestamp;
  expires_at?: Timestamp;
}
```

---

## Relationships

### Session → Call (1:1)
- Each session can have one call record
- Call record is created when session starts

### Session → Ratings (1:2)
- Each session can have 2 ratings (one from each participant)
- Ratings are created after session completion

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
- session_id (unique)
- user_id + started_at (DESC)
- interpreter_id + started_at (DESC)

### Ratings
- session_id
- interpreter_id + created_at (DESC)
- user_id + created_at (DESC)

### Notifications
- user_id + is_read + created_at (DESC)
- user_id + type + created_at (DESC)





