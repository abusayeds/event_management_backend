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

const getCorsOptions = () => {
  return {
    // Reflect request Origin so credentials work from any frontend.
    origin: true,
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
    maxAge: 86400,
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
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
      sameSite: 'strict',
    },
    ignoreMethods,
  });
};

// JWT Bearer APIs do not use cookie sessions — CSRF is not applicable for /api/v1 routes.
const shouldSkipCsrf = (path: string): boolean =>
  path.startsWith('/api/v1') || path === '/' || path === '/health' || path === '/test';

const csrfProtection = getCsrfProtection();

const applyCsrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (shouldSkipCsrf(req.path)) {
    next();
    return;
  }
  csrfProtection(req, res, next);
};

// helmet config
const getHelmetConfig = () => {
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
        connectSrc: ["'self'", '*'],
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
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
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
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    const securityError =
      typeof error === 'object' && error !== null
        ? (error as { code?: string; message?: string })
        : {};
    // Log security-related errors
    if (securityError.code === 'EBADCSRFTOKEN') {
      logger.warn('CSRF token validation failed', {
        type: 'SECURITY',
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        origin: req.get('Origin'),
      });
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }

    if (securityError.message === 'Not allowed by CORS') {
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
    globalErrorHandler(error as Error, req, res, next);
  };
};

//Basic Express Setup
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(
  '/api/v1/donations/webhook/stripe',
  express.raw({ type: 'application/json', limit: '2mb' })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser());

// CORS Configuration — allow all origins
app.use(cors(getCorsOptions()));

// Serve static assets
app.use('/public', express.static(path.join(__dirname, '../public')));

// CSRF Protection (skipped for JWT auth + webhooks; not needed for Bearer-token APIs)
app.use(applyCsrfProtection);

// Helmet security headers
app.use(getHelmetConfig());

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

// Health check at root
const healthHandler = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
};

app.get('/', healthHandler);
app.get('/health', healthHandler);

// Register Swagger routes before the catch-all notFound middleware.
setupSwagger(app);

// Error Handling
app.use(notFound);

// Enhanced global error handler with security logging
app.use(getSecurityErrorHandler());

export default app;
