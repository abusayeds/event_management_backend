import cors from 'cors';
import { RequestHandler } from 'express';
// test
const corsOptions: cors.CorsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key',
    'X-CSRF-Token',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'Content-Length', 'X-Request-Id'],
  maxAge: 86400,
};

export const corsMiddleware: RequestHandler = cors(corsOptions);
