const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Agora configuration - SECURE MODE
const AGORA_APP_ID = '73a6fdb660614eb4bd38e452f2f0255a';
const AGORA_APP_CERTIFICATE = 'c934915a872d4eaebbe7cddb0f6ad915';

// Generate Agora RTC Token for any channel
exports.generateAgoraToken = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { channelName, uid, role = 'publisher' } = data;

    // Validate required parameters
    if (!channelName || !uid) {
      throw new functions.https.HttpsError('invalid-argument', 'channelName and uid are required');
    }

    // Import Agora token builder
    const { RtcTokenBuilder, RtcRole } = require('agora-token');

    // Set token expiration time (1 hour from now)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 3600;

    // Determine role
    const userRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    // Generate token
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      userRole,
      expirationTimeInSeconds
    );

    console.log(`Generated token for user ${uid} in channel ${channelName}`);

    return {
      token,
      appId: AGORA_APP_ID,
      channelName,
      uid,
      expirationTime: expirationTimeInSeconds
    };

  } catch (error) {
    console.error('Error generating Agora token:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to generate token');
  }
});

// Generate token for session and store in CALLS collection
exports.generateSessionToken = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { sessionId } = data;
    const userId = context.auth.uid;

    if (!sessionId) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId is required');
    }

    // Verify user has access to this session
    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    
    if (!sessionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Session not found');
    }

    const sessionData = sessionDoc.data();
    
    // Check if user is part of this session
    if (sessionData.user_id !== userId && sessionData.interpreter_id !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'User not authorized for this session');
    }

    // Check if session is confirmed
    if (sessionData.status !== 'confirmed') {
      throw new functions.https.HttpsError('failed-precondition', 'Session must be confirmed to generate token');
    }

    // Import Agora token builder
    const { RtcTokenBuilder, RtcRole } = require('agora-token');

    // Set token expiration time (1 hour from now)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 3600;

    // Generate token for the session
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      sessionId, // Use sessionId as channel name
      userId,
      RtcRole.PUBLISHER,
      expirationTimeInSeconds
    );

    // Store token info in CALLS collection
    const callData = {
      sessionId,
      channelName: sessionId,
      token,
      appId: AGORA_APP_ID,
      userId,
      expirationTime: expirationTimeInSeconds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    };

    // Store in CALLS collection
    await admin.firestore().collection('calls').doc(sessionId).set(callData);

    console.log(`Generated session token for user ${userId} in session ${sessionId}`);

    return {
      token,
      appId: AGORA_APP_ID,
      channelName: sessionId,
      uid: userId,
      expirationTime: expirationTimeInSeconds
    };

  } catch (error) {
    console.error('Error generating session token:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to generate session token');
  }
});

// Get call token for joining a session
exports.getCallToken = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { sessionId } = data;
    const userId = context.auth.uid;

    if (!sessionId) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId is required');
    }

    // Get call data from CALLS collection
    const callDoc = await admin.firestore().collection('calls').doc(sessionId).get();
    
    if (!callDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Call not found. Session may not be confirmed yet.');
    }

    const callData = callDoc.data();
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (callData.expirationTime < now) {
      throw new functions.https.HttpsError('failed-precondition', 'Call token has expired');
    }

    // Verify user has access to this session
    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    const sessionData = sessionDoc.data();
    
    if (sessionData.user_id !== userId && sessionData.interpreter_id !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'User not authorized for this session');
    }

    console.log(`Retrieved call token for user ${userId} in session ${sessionId}`);

    return {
      token: callData.token,
      appId: callData.appId,
      channelName: callData.channelName,
      uid: userId,
      expirationTime: callData.expirationTime
    };

  } catch (error) {
    console.error('Error getting call token:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to get call token');
  }
});

// End call and update CALLS collection
exports.endCall = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { sessionId } = data;
    const userId = context.auth.uid;

    if (!sessionId) {
      throw new functions.https.HttpsError('invalid-argument', 'sessionId is required');
    }

    // Verify user has access to this session
    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    const sessionData = sessionDoc.data();
    
    if (sessionData.user_id !== userId && sessionData.interpreter_id !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'User not authorized for this session');
    }

    // Update call status to ended
    await admin.firestore().collection('calls').doc(sessionId).update({
      status: 'ended',
      endTime: admin.firestore.FieldValue.serverTimestamp(),
      endedBy: userId
    });

    console.log(`Call ended for session ${sessionId} by user ${userId}`);

    return { success: true };

  } catch (error) {
    console.error('Error ending call:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to end call');
  }
});

// Send FCM notification using Admin SDK
exports.sendFCMNotification = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { token, title, body, data: notificationData } = data;

    if (!token || !title || !body) {
      throw new functions.https.HttpsError('invalid-argument', 'token, title, and body are required');
    }

    // Send notification using Firebase Admin SDK
    const message = {
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: notificationData || {},
      webpush: {
        fcmOptions: {
          link: '/'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);

    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending FCM notification:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});