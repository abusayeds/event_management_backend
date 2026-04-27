import { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import config from '../config';
import logger, { performanceLogger } from '../config/logger';

// Custom morgan format for API logging
const morganFormat = ':method :url :status :res[content-length] - :response-time ms';

// Create morgan middleware with winston integration
const requestLogger = morgan(morganFormat, {
  stream: {
    write: (message: string) => {
      // Parse morgan output for structured logging
      const parts = message.trim().split(' ');
      if (parts.length >= 4) {
        const [method, url, status, responseTime] = parts;
        const duration = parseInt(responseTime) || 0;
        
        // Log performance metrics
        performanceLogger.apiCall(
          method,
          url,
          duration,
          parseInt(status) || 200
        );
      }
      
      // Also log to winston for file output
      logger.info('HTTP Request', {
        type: 'HTTP',
        message: message.trim(),
        timestamp: new Date().toISOString()
      });
    },
  },
});

// Enhanced request logging middleware
export const enhancedRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request start
  logger.info('Request started', {
    type: 'REQUEST',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, callback?: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      type: 'RESPONSE',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    return originalEnd(chunk, encoding, callback);
  };
  
  next();
};

export default requestLogger;
