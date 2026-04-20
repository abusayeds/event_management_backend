import colors from 'colors';
import dotenv from 'dotenv';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/apiError';
import awsConfig from './aws';
dotenv.config({ quiet: true });

const requiredEnvVars = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

const optionalEnvVars = ['JWT_RESET_PASSWORD_SECRET', 'SMTP_USERNAME', 'SMTP_PASSWORD'] as const;

// Validate required environment variables
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      colors.red(`Missing required environment variables: ${missingEnvVars.join(', ')}`)
    );
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
  } else {
    console.warn(
      colors.yellow(`Warning: Missing required environment variables: ${missingEnvVars.join(', ')}`)
    );
  }
}

// Warn about missing optional variables
if (process.env.NODE_ENV === 'development') {
  const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar]);
  if (missingOptional.length > 0) {
    console.warn(
      colors.yellow(`Missing optional environment variables: ${missingOptional.join(', ')}`)
    );
  }
}

// Export config
const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8082', 10),
  // Database
  database: {
    url: process.env.DATABASE_URL!,
  },

  // JWT Authentication (For Access & Refresh Tokens)
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    resetPasswordSecret: process.env.JWT_RESET_PASSWORD_SECRET || process.env.JWT_ACCESS_SECRET!,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION_TIME || '1d',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION_TIME || '7d',
    resetPasswordExpiration: process.env.JWT_RESET_PASSWORD_EXPIRATION_TIME || '30m',
  },

  // Auth Settings
  auth: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '30', 10),
    lockTime: parseInt(process.env.LOCK_TIME || '1', 10), //1 minute lock after max attempts
  },
  // Bcrypt
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    emailFrom: process.env.EMAIL_FROM || process.env.SMTP_USERNAME || '',
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  },
  // Backend
  backend: {
    ip: process.env.BACKEND_IP || '0.0.0.0',
    baseUrl: `http://${process.env.BACKEND_IP || 'localhost'}:${process.env.PORT || '8082'}`,
  },
  // CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:3001'],
    developmentOrigins: process.env.DEV_ALLOWED_ORIGINS
      ? process.env.DEV_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
  },

  // Redis
  redis: {
    username: process.env.REDIS_USERNAME || '',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // Security & Rate Limiting
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
    encryptionKey: process.env.ENCRYPTION_KEY || '',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
  },
  // AWS Configuration
  aws: awsConfig,

  // Queue Configuration (BullMQ)
  queue: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },

  // Socket Configuration
  socket: {
    enabled: process.env.SOCKET_ENABLED !== 'false',
    cors: {
      origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8, // 100 MB
    allowEIO3: true,
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
};

// Validate critical configurations
if (config.env === 'production') {
  if (!config.jwt.accessSecret || config.jwt.accessSecret.length < 32) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'JWT_ACCESS_SECRET must be at least 32 characters in production'
    );
  }

  if (!config.jwt.refreshSecret || config.jwt.refreshSecret.length < 32) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'JWT_REFRESH_SECRET must be at least 32 characters in production'
    );
  }
  if (!config.email.username || !config.email.password) {
    console.warn(colors.yellow('WARNING: SMTP credentials not configured!'));
  }
}

export default config;
