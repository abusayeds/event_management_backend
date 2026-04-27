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

const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

export const sendFcmPush = async (payload: FcmPayload): Promise<FcmResult> => {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    return { success: false, response: 'FCM_SERVER_KEY not configured' };
  }

  const body = {
    to: payload.token,
    priority: 'high',
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.image ? { image: payload.image } : {}),
    },
    data: payload.data ?? {},
  };

  const res = await fetch(FCM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    failure?: number;
    results?: Array<{ error?: string }>;
  };

  const firstError = json.results?.[0]?.error;
  const invalidToken = firstError === 'NotRegistered' || firstError === 'InvalidRegistration';
  const success = res.ok && !firstError && (json.failure ?? 0) === 0;

  return { success, invalidToken, response: json };
};
