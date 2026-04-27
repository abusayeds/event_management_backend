import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import config from '../config';

interface FcmPayload {
  token: string;
  title: string;
  body: string;
  image?: string | null;
  data?: Record<string, string>;
}

interface FcmResult {
  success: boolean;
  invalidToken?: boolean;
  response?: unknown;
}

let firebaseApp: App | null = null;

const getFirebaseApp = (): App | null => {
  if (firebaseApp) return firebaseApp;
  if (getApps().length > 0) {
    firebaseApp = getApps()[0]!;
    return firebaseApp;
  }

  const projectId = config.firebase.projectId;
  const clientEmail = config.firebase.clientEmail;
  const privateKeyRaw = config.firebase.privateKey;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  firebaseApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  return firebaseApp;
};

export const sendFcmPush = async (payload: FcmPayload): Promise<FcmResult> => {
  const app = getFirebaseApp();
  if (!app) {
    return {
      success: false,
      response: 'Firebase admin credentials not configured',
    };
  }

  const messageId = await getMessaging(app)
    .send({
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.image ? { imageUrl: payload.image } : {}),
      },
      data: payload.data ?? {},
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    })
    .catch(error => {
      const code = String(error?.code ?? '');
      const invalidToken =
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token';
      return { error, invalidToken };
    });

  if (typeof messageId === 'string') {
    return { success: true, response: { messageId } };
  }

  return {
    success: false,
    invalidToken: Boolean(messageId.invalidToken),
    response: messageId.error,
  };
};
