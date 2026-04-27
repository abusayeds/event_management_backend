// Socket event constants
export const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Authentication events
  AUTHENTICATE: 'authenticate',
  AUTH_SUCCESS: 'auth_success',
  AUTH_ERROR: 'auth_error',

  // Room events
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',

  // Notification events
  NOTIFICATION: 'notification',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_UNREAD_COUNT: 'notification_unread_count',

  // User status events
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  USER_STATUS_UPDATE: 'user_status_update',

  // System events
  SYSTEM_MESSAGE: 'system_message',
  SERVER_SHUTDOWN: 'server_shutdown',
} as const;

// Room constants
export const ROOMS = {
  GENERAL: 'general',
  NOTIFICATIONS: 'notifications',
  USER_PREFIX: 'user_',
} as const;

// Socket error types
export const SOCKET_ERRORS = {
  AUTHENTICATION_FAILED: 'authentication_failed',
  ROOM_NOT_FOUND: 'room_not_found',
  PERMISSION_DENIED: 'permission_denied',
  INVALID_DATA: 'invalid_data',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
} as const;
