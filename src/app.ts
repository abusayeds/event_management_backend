import cookieParser from 'cookie-parser';
import express, { Application } from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './config/cors';
import { setupSwagger } from './config/swagger';
import globalErrorHandler from './middleware/errorHandler.middleware';
import notFoundHandler from './middleware/notFound.middleware';
import requestLogger from './middleware/requestLogger.middleware';
import router from './routes';
import { uploadRoot } from './utils/localStorage';

const app: Application = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(corsMiddleware);
app.use(
  '/uploads',
  express.static(uploadRoot, {
    dotfiles: 'deny',
    setHeaders: res => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── API Documentation ─────────────────────────────────────────────────────────
setupSwagger(app);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', router);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
