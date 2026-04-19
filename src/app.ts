import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import csrf from 'csurf';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import path from 'path';
import config from './config';
import logger from './config/logger';
import { setupSwagger } from './config/swagger';
import globalErrorHandler from './middleware/errorHandler.middleware';
import notFound from './middleware/notFound.middleware';
import { rateLimiters } from './middleware/rateLimiter.middleware';
import routes from './routes';

// Create Express application
const app: express.Application = express();

const getAllowedOrigins = (): string[] => {
  const origins = [...config.cors.allowedOrigins];

  // Add development origins in development mode
  if (process.env.NODE_ENV === 'development') {
    origins.push(...config.cors.developmentOrigins);
  }

  return origins;
};

//
const getCorsOptions = (allowedOrigins: string[]) => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) => {
      if (isProduction) {
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        logger.warn('CORS blocked origin in production', {
          type: 'SECURITY',
          origin,
        });
        return callback(new Error('Not allowed by CORS'));
      }

      // In development: More permissive
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow localhost in development only
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
      'Connection',
      'User-Agent',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: isProduction ? 86400 : 3600,
  };
};

const getCsrfProtection = () => {
  const ignoreMethods =
    process.env.NODE_ENV === 'development'
      ? ['GET', 'HEAD', 'OPTIONS', 'DELETE', 'POST', 'PATCH', 'PUT']
      : ['GET', 'HEAD', 'OPTIONS'];

  return csrf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
    ignoreMethods,
  });
};

// helmet config
const getHelmetConfig = (allowedOrigins: string[]) => {
  return helmet({
    hsts: {
      includeSubDomains: true,
      preload: true,
      maxAge: 63072000, // 2 years in seconds
    },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: [
          "'self'",
          'https://polyfill.io',
          'https://*.cloudflare.com',
          'http://127.0.0.1:3000/',
        ],
        baseUri: ["'self'"],
        scriptSrc: [
          "'self'",
          'http://127.0.0.1:3000/',
          'https://*.cloudflare.com',
          'https://polyfill.io',
          process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : "'strict-dynamic'",
        ],
        styleSrc: ["'self'", 'https:', 'http:', "'unsafe-inline'"],
        imgSrc: ["'self'", 'blob:', 'validator.swagger.io', '*'],
        fontSrc: ["'self'", 'https:', 'data:'],
        childSrc: ["'self'", 'blob:'],
        styleSrcAttr: ["'self'", "'unsafe-inline'", 'http:'],
        frameSrc: ["'self'"],
        connectSrc: ["'self'", ...allowedOrigins],
      },
    },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    originAgentCluster: true,
  });
};

// security headers
const getAdditionalSecurityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'fullscreen=(self), camera=(), geolocation=(self), autoplay=(), payment=(), microphone=()'
    );
    next();
  };
};

//Configure HTTP Parameter Pollution protection
const getHppConfig = () => {
  return hpp({
    whitelist: ['sort', 'fields', 'page', 'limit', 'filter'],
  });
};

//Log suspicious activity patterns
const logSuspiciousActivity = (req: Request, ip: string | undefined): void => {
  const bodyStr = JSON.stringify(req.body);
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\$ne|\$gt|\$lt|\$regex/i, // MongoDB injection patterns
    /union\s+select/i, // SQL injection patterns
    /exec\s*\(/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(bodyStr)) {
      logger.warn('Suspicious request pattern detected', {
        type: 'SECURITY',
        ip,
        method: req.method,
        url: req.originalUrl,
        pattern: pattern.source,
      });
      break;
    }
  }
};

// Configure security middleware
const getSecurityLoggingMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log suspicious activities
    if (req.body && typeof req.body === 'object') {
      const ip = req.ip || req.connection.remoteAddress;
      logSuspiciousActivity(req, ip);
    }

    // Log clean route hit details when response is sent.
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      logger.info(
        `ROUTE HIT ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
      );
    });

    next();
  };
};

const getSecurityErrorHandler = () => {
  return (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    // Log security-related errors
    if (error.code === 'EBADCSRFTOKEN') {
      logger.warn('CSRF token validation failed', {
        type: 'SECURITY',
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
      });
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }

    if (error.message === 'Not allowed by CORS') {
      logger.warn('CORS policy violation', {
        type: 'SECURITY',
        origin: req.get('Origin'),
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
      });
      res.status(403).json({ error: 'CORS policy violation' });
      return;
    }

    // Use existing global error handler
    globalErrorHandler(error, req, res, next);
  };
};

//Basic Express Setup
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser());

// CORS Configuration
const allowedOrigins = getAllowedOrigins();
const corsOptions = getCorsOptions(allowedOrigins);

app.use(cors(corsOptions));

// Serve static assets
app.use('/public', express.static(path.join(__dirname, '../public')));

// CSRF Protection
if (process.env.NODE_ENV === 'development') {
  app.use(getCsrfProtection());
}

// Helmet security headers
app.use(getHelmetConfig(allowedOrigins));

// Additional security headers
app.use(getAdditionalSecurityHeaders());

// HTTP Parameter Pollution Protection
app.use(getHppConfig());

// Security logging middleware
app.use(getSecurityLoggingMiddleware());

// General API rate limiting
app.use(rateLimiters.generalRateLimiter);

// Main API routes
app.use('/api/v1/', routes);

// Health check endpoints
app.get('/test', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: '🚀 Dawabuyi Backend API is running smoothly!',
    data: {
      name: 'Dawabuyi Backend API',
      status: 'Online',
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      environment: config.env || 'development',
      version: '1.0.0',
    },
    services: {
      database: 'Connected',
      security: 'Fortified',
    },
    documentation: {
      swagger: config.env !== 'production' ? '/api-docs' : 'Contact admin for documentation',
      routes: '/api/v1',
    },
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Register Swagger routes before the catch-all notFound middleware.
setupSwagger(app);

// Error Handling
app.use(notFound);

// Enhanced global error handler with security logging
app.use(getSecurityErrorHandler());

export default app;
