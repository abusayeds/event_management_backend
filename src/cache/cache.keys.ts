// Cache key constants
export const CACHE_KEYS = {
  // Authentication keys
  AUTH: {
    ATTEMPTS: (email: string) => `auth:attempts:${email.toLowerCase()}`,
    LOCK: (email: string) => `auth:lock:${email.toLowerCase()}`,
    REGISTRATION: (email: string) => `auth:registration:${email.toLowerCase()}`,
    REGISTRATION_SESSION: (sessionId: string) => `auth:registration:session:${sessionId}`,
    REGISTRATION_ATTEMPTS: (email: string) => `auth:registration:attempts:${email.toLowerCase()}`,
    PASSWORD_RESET: (email: string) => `auth:password-reset:${email.toLowerCase()}`,
    PASSWORD_RESET_ATTEMPTS: (email: string) => `auth:password-reset:attempts:${email.toLowerCase()}`,
    TOKEN_BLACKLIST: (token: string) => `blacklist:${token}`,
    REFRESH_TOKEN: (userId: string) => `refresh-token:${userId}`,
    PERMISSIONS: (userId: string) => `auth:permissions:${userId}`,
  },

  // User keys
  USER: {
    PROFILE: (userId: string) => `user:profile:${userId}`,
    PERMISSIONS: (userId: string) => `user:permissions:${userId}`,
    SESSIONS: (userId: string) => `user:sessions:${userId}`,
    ONLINE_STATUS: (userId: string) => `user:online:${userId}`,
  },

  // Notification keys
  NOTIFICATION: {
    LIST: (userId: string) => `notification:list:${userId}`,
    UNREAD_COUNT: (userId: string) => `notification:unread:${userId}`,
    SETTINGS: (userId: string) => `notification:settings:${userId}`,
  },

  // System keys
  SYSTEM: {
    HEALTH_CHECK: 'system:health',
    CONFIG: 'system:config',
    RATE_LIMIT: (identifier: string) => `rate-limit:${identifier}`,
    FEATURE_FLAGS: 'system:feature-flags',
  },

  // Security keys
  SECURITY: {
    RATE_LIMIT: (identifier: string) => `rate_limit:${identifier}`,
    SESSION: (userId: string, sessionId: string) => `session:${userId}:${sessionId}`,
    SESSIONS_REVOKED: (userId: string) => `sessions_revoked:${userId}`,
    SUSPICIOUS_FLAG: (email: string) => `suspicious_flag:${email}`,
    SUSPICIOUS_ACTIVITY: (email: string) => `suspicious:${email}`,
    SECURITY_LOG: (timestamp: number) => `security_log:${timestamp}`,
    DEVICE_FINGERPRINT: (userId: string) => `device_fp:${userId}`,
  },

  // Analytics keys
  ANALYTICS: {
    DAILY_STATS: (date: string) => `analytics:daily:${date}`,
    USER_ACTIVITY: (userId: string) => `analytics:activity:${userId}`,
    PAGE_VIEWS: (page: string) => `analytics:views:${page}`,
  },

  // Session keys
  SESSION: {
    ACTIVE_USERS: 'session:active-users',
    USER_SESSIONS: (userId: string) => `session:user:${userId}`,
    DEVICE_SESSIONS: (userId: string, deviceId: string) => `session:device:${userId}:${deviceId}`,
  },

  // Cache TTL constants (in seconds)
  TTL: {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
    WEEK: 604800, // 7 days
    MONTH: 2592000, // 30 days
  },
} as const;
