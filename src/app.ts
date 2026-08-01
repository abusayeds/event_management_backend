import cookieParser from 'cookie-parser';
import express, { Application } from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './config/cors';
import { setupSwagger } from './config/swagger';
import globalErrorHandler from './middleware/errorHandler.middleware';
import notFoundHandler from './middleware/notFound.middleware';
import requestLogger from './middleware/requestLogger.middleware';
import router from './routes';

const app: Application = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(corsMiddleware);

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
