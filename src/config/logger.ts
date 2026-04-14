import fs from 'fs';
import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, label, printf, errors, colorize } = winston.format;

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const successLogsDir = path.join(logsDir, 'success');
const errorLogsDir = path.join(logsDir, 'errors');

if (!fs.existsSync(successLogsDir)) {
  fs.mkdirSync(successLogsDir, { recursive: true });
}

if (!fs.existsSync(errorLogsDir)) {
  fs.mkdirSync(errorLogsDir, { recursive: true });
}

const myFormat = printf(info => {
  const { level, message, label: loggerLabel, timestamp: logTime, stack, ...meta } = info;
  const date = new Date(logTime as string);
  const hour = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  const formattedMessage = `${date.toDateString()} ${hour}:${minutes}:${seconds} [${loggerLabel}] ${level}: ${message}`;
  const shouldPrintMeta = level !== 'info';
  const metaOutput =
    shouldPrintMeta && Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';

  return stack ? `${formattedMessage}\n${stack}${metaOutput}` : `${formattedMessage}${metaOutput}`;
});

// Daily Rotate File Transport for Success/Info logs
const successTransport = new DailyRotateFile({
  filename: path.join(successLogsDir, 'success-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
  level: 'info',
  format: combine(label({ label: 'Dawabuyi-Backend' }), timestamp(), myFormat),
});

// Daily Rotate File Transport for Error logs
const errorTransport = new DailyRotateFile({
  filename: path.join(errorLogsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
  level: 'error',
  format: combine(
    label({ label: 'Dawabuyi-Backend' }),
    timestamp(),
    errors({ stack: true }),
    myFormat
  ),
});

// Console transport
const consoleTransport = new winston.transports.Console({
  format: combine(label({ label: 'Dawabuyi-Backend' }), timestamp(), colorize(), myFormat),
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    label({ label: 'Dawabuyi-Backend' }),
    timestamp(),
    errors({ stack: true }),
    myFormat
  ),
  transports: [successTransport, consoleTransport, errorTransport],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Security logging helper
export const securityLogger = {
  loginAttempt: (email: string, ip: string, success: boolean) => {
    logger.warn('Login attempt', {
      type: 'AUTHENTICATION',
      email,
      ip,
      success,
      timestamp: new Date().toISOString(),
    });
  },

  suspiciousActivity: (email: string, activity: string, details: unknown) => {
    logger.warn('Suspicious activity detected', {
      type: 'SECURITY',
      email,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  },

  dataAccess: (userId: string, resource: string, action: string) => {
    logger.info('Data access', {
      type: 'AUDIT',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString(),
    });
  },
};

// Performance logging helper
export const performanceLogger = {
  apiCall: (method: string, url: string, duration: number, statusCode: number) => {
    logger.info('API call', {
      type: 'PERFORMANCE',
      method,
      url,
      duration: `${duration}ms`,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  },

  databaseQuery: (query: string, duration: number, success: boolean) => {
    logger.info('Database query', {
      type: 'DATABASE',
      query: query.substring(0, 100), // Truncate long queries
      duration: `${duration}ms`,
      success,
      timestamp: new Date().toISOString(),
    });
  },
};

export default logger;
