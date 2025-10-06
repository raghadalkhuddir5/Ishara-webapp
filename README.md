# Ishara - Sign Language Interpretation Platform

A real-time video calling platform that connects deaf/mute users with sign language interpreters.

## Features

### 🔐 Authentication & User Management
- Firebase Authentication with email/password
- Role-based access (Deaf/Mute users and Interpreters)
- User profiles and availability management

### 📞 Real-time Video Calling
- PeerJS-powered video calls with audio/video
- Screen sharing capabilities
- Call quality indicators
- Mute/unmute and camera controls
- Call recording and session management

### 🔔 Notification System
- Firebase Cloud Messaging (FCM) integration
- Real-time notifications for session requests
- In-app notification center
- Role-specific notification filtering

### 📅 Session Management
- Book immediate or scheduled sessions
- Session status tracking (requested, confirmed, cancelled)
- Session history and ratings
- Interpreter availability management

### 🌐 Internationalization
- Multi-language support
- Context-aware translations
- Dynamic language switching

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Material-UI (MUI)
- **Backend**: Firebase (Firestore, Authentication, Cloud Messaging)
- **Video Calling**: PeerJS
- **State Management**: React Context API
- **Styling**: Material-UI + CSS

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AppLayout.tsx   # Main app layout
│   ├── VideoCall.tsx   # Video calling interface
│   ├── NotificationCenter.tsx # Notification management
│   └── ...
├── pages/              # Page components
│   ├── DashboardDeafMute.tsx
│   ├── DashboardInterpreter.tsx
│   ├── BookSession.tsx
│   └── ...
├── services/           # Business logic and API calls
│   ├── peerjsService.ts # Video calling logic
│   ├── fcmService.ts   # Push notifications
│   ├── notificationService.ts # Notification management
│   └── ...
├── context/            # React Context providers
│   ├── AuthContext.tsx # Authentication state
│   └── I18nContext.tsx # Internationalization
└── types/              # TypeScript type definitions
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- Firebase project with Firestore, Authentication, and Cloud Messaging enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ishara-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Update `src/firebase.ts` with your Firebase config
   - Deploy Firestore security rules: `firebase deploy --only firestore:rules`
   - Deploy Firestore indexes: `firebase deploy --only firestore:indexes`

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## Firebase Configuration

### Required Services
- **Authentication**: Email/password authentication
- **Firestore**: Real-time database for sessions, notifications, and user data
- **Cloud Messaging**: Push notifications
- **Storage**: (Optional) For call recordings

### Security Rules
The project includes Firestore security rules that ensure:
- Users can only access their own data
- Role-based access control
- Secure session and notification management

### Indexes
Required Firestore composite indexes are defined in `firestore.indexes.json`:
- Session queries by user/interpreter ID and status
- Notification queries by user ID and timestamp
- Call history queries

## Usage

### For Deaf/Mute Users
1. Sign up and create a profile
2. Browse available interpreters
3. Book immediate or scheduled sessions
4. Join video calls for interpretation
5. Rate sessions after completion

### For Interpreters
1. Sign up and set availability
2. Receive session requests via notifications
3. Accept/decline session requests
4. Join video calls to provide interpretation
5. Manage session history and ratings

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style
- TypeScript strict mode enabled
- ESLint with React and TypeScript rules
- Material-UI for consistent UI components
- Functional components with hooks

## Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
firebase deploy
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.