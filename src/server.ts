import colors from 'colors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import config from './config';
import { closeDB, connectDB } from './config/database';
import { verifyEmailConnection } from './config/email';
import logger from './config/logger';
import { closeRedis, connectRedis } from './config/redis';
import { initializeWorkers, shutdownWorkers } from './jobs';
import { initializeSocket } from './socket';

type TrackedSocket = {
  setKeepAlive: (enable?: boolean, initialDelay?: number) => void;
  destroy: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

// Track if shutdown is in progress
let isShuttingDown = false;

// Declare server variables globally
let server: http.Server | null = null;
let io: SocketIOServer | null = null;
let activeConnections = new Set<TrackedSocket>();
let workers: ReturnType<typeof initializeWorkers> = [];

// ==========================================
// UNCAUGHT EXCEPTION HANDLER
// ==========================================
process.on('uncaughtException', (error: Error) => {
  logger.error(colors.red('💥 UNCAUGHT EXCEPTION! Shutting down...'));
  logger.error(colors.red(`Error: ${error.message}`));
  logger.error(error.stack);

  // Exit immediately on uncaught exception
  process.exit(1);
});

// Start server
const startServer = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const port = config.port;

    // Create HTTP server
    server = app.listen(port, config.backend.ip, () => {
      logger.info(colors.green('═══════════════════════════════════════════════════════════'));
      logger.info(colors.green('                 🚀 SERVER STARTED SUCCESSFULLY!            '));
      logger.info(colors.green('═══════════════════════════════════════════════════════════'));

      // ✅ Configure timeout settings to prevent request timeouts
      server!.requestTimeout = 300000; // 5 minutes
      server!.keepAliveTimeout = 65000; // 65 seconds
      server!.headersTimeout = 60000; // 60 seconds
      logger.info(colors.cyan(`📌 Environment      : ${colors.bold(config.env.toUpperCase())}`));
      logger.info(colors.cyan(`🌐 Server URL       : ${colors.bold(config.backend.baseUrl)}`));
      logger.info(colors.cyan(`📍 IP Address       : ${colors.bold(config.backend.ip)}`));
      logger.info(colors.cyan(`🔌 Port             : ${colors.bold(port.toString())}`));
      logger.info(colors.cyan(`⚡ Process ID       : ${colors.bold(process.pid.toString())}`));
      logger.info(
        colors.cyan(
          `💾 Memory Usage     : ${colors.bold(Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB')}`
        )
      );
      logger.info(colors.cyan(`📅 Started At       : ${colors.bold(new Date().toLocaleString())}`));
      logger.info(colors.green('───────────────────────────────────────────────────────────'));

      resolve();
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(colors.red(`❌ Port ${port} is already in use`));
        if (process.platform === 'win32') {
          logger.error(colors.yellow(`💡 Try: netstat -ano | findstr :${port}`));
          logger.error(colors.yellow(`💡 Then: taskkill /F /PID <PID>`));
        } else {
          logger.error(colors.yellow(`💡 Try: lsof -ti:${port} | xargs kill -9`));
        }
      } else if (error.code === 'EACCES') {
        logger.error(colors.red(`❌ Port ${port} requires elevated privileges`));
        logger.error(colors.yellow(`💡 Try: sudo node server.js`));
      } else {
        logger.error(colors.red('❌ Server error:'), error);
      }
      reject(error);
    });

    activeConnections = new Set<TrackedSocket>();

    server.on('connection', socket => {
      // Set keep-alive
      socket.setKeepAlive(true);

      // Track connection
      activeConnections.add(socket);

      // Remove on close
      socket.on('close', () => {
        activeConnections.delete(socket);
      });

      // ✅ Handle socket errors - ignore common client errors
      socket.on('error', (err: unknown) => {
        // Ignored error patterns
        const ignoredPatterns = [
          'ECONNRESET',
          'EPIPE',
          'Parse Error',
          'Invalid method encountered',
          'Invalid HTTP',
          'HPE_INVALID_METHOD',
        ];

        const errorMessage =
          err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        const errorCode =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: unknown }).code)
            : '';

        // Check if error should be logged
        const shouldIgnore = ignoredPatterns.some(
          pattern => errorMessage.includes(pattern) || errorCode === pattern
        );

        // Only log unexpected errors
        if (!shouldIgnore) {
          logger.error(colors.red('❌ Socket error:'), err);
        }

        // Destroy problematic socket
        socket.destroy();
      });
    });
  });
};
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn(colors.yellow('⚠️  Shutdown already in progress...'));
    return;
  }

  isShuttingDown = true;

  // Quick shutdown for dev restarts
  const isDevelopmentRestart = signal === 'SIGUSR2' || signal === 'SIGTERM';
  const timeoutDuration = isDevelopmentRestart ? 2000 : 15000;

  if (!isDevelopmentRestart) {
    logger.info(colors.yellow(''));
    logger.info(colors.yellow('═══════════════════════════════════════════════════════════'));
    logger.info(colors.yellow(`         ⚠️  ${signal} RECEIVED - GRACEFUL SHUTDOWN          `));
    logger.info(colors.yellow('═══════════════════════════════════════════════════════════'));
  }

  const shutdownTimeout = setTimeout(() => {
    if (!isDevelopmentRestart) {
      logger.error(colors.red('❌ Forced shutdown due to timeout'));
    }
    process.exit(0);
  }, timeoutDuration);

  try {
    if (io) {
      if (!isDevelopmentRestart) {
        logger.info(colors.cyan('🔌 [2.1/5] Closing Socket.IO server...'));
      }
      io.close();
      io = null;
    }

    // Close BullMQ workers
    if (workers.length > 0) {
      if (!isDevelopmentRestart) {
        logger.info(colors.cyan('👷 [2.2/5] Closing Job Workers...'));
      }
      await shutdownWorkers();
      workers = [];
    }

    if (server) {
      if (!isDevelopmentRestart) {
        logger.info(colors.cyan('🌐 [2.3/5] Closing HTTP server...'));
      }

      // Force destroy all connections FIRST to unblock server.close()
      if (activeConnections.size > 0) {
        if (!isDevelopmentRestart) {
          logger.info(
            colors.yellow(`   🧹 Destroying ${activeConnections.size} active connections...`)
          );
        }
        activeConnections.forEach(conn => conn.destroy());
        activeConnections.clear();
      }

      await new Promise<void>(resolve => {
        server!.close(() => {
          if (!isDevelopmentRestart) {
            logger.info(colors.green('   ✅ HTTP server closed'));
          }
          resolve();
        });
      });

      server = null;
    }

    // Step 3: Close Database
    if (!isDevelopmentRestart) {
      logger.info(colors.cyan('🗄️  [3/5] Closing Database..'));
    }
    await closeDB();
    if (!isDevelopmentRestart) {
      logger.info(colors.green('   ✅ Database closed'));
    }

    // Step 4: Close Redis
    if (!isDevelopmentRestart) {
      logger.info(colors.cyan('🔴 [4/5] Closing Redis...'));
    }
    await closeRedis();
    if (!isDevelopmentRestart) {
      logger.info(colors.green('   ✅ Redis closed'));
    }

    clearTimeout(shutdownTimeout);

    if (!isDevelopmentRestart) {
      logger.info(colors.green(''));
      logger.info(colors.green('═══════════════════════════════════════════════════════════'));
      logger.info(colors.green('         ✅ SHUTDOWN COMPLETED                              '));
      logger.info(colors.green('═══════════════════════════════════════════════════════════\n'));
    }

    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    if (!isDevelopmentRestart) {
      logger.error(colors.red('❌ Shutdown error:'), error);
    }
    process.exit(1);
  }
};

async function main() {
  try {
    logger.info(colors.cyan(''));
    logger.info(colors.cyan('═══════════════════════════════════════════════════════════'));
    logger.info(colors.cyan('                🚀 APPLICATION INITIALIZATION               '));
    logger.info(colors.cyan('═══════════════════════════════════════════════════════════'));

    // Step 1: Connect to Database
    logger.info(colors.cyan('📦 [1/5] Connecting to Database...'));
    await connectDB();

    // Step 2: Connect to Redis
    logger.info(colors.cyan('📦 [2/5] Connecting to Redis...'));
    await connectRedis();
    logger.info(colors.green('✅ Local Redis connected'));

    // Step 2.5: Initialize BullMQ Workers
    logger.info(colors.cyan('👷 [2.5/5] Initializing Job Workers...'));
    workers = initializeWorkers();
    logger.info(colors.green(' ✅ BullMQ Workers initialized'));

    // Step 3: Verify Email Service (optional)
    if (config.email.username && config.email.password) {
      logger.info(colors.cyan('📧 [3/5] Verifying email service...'));
      await verifyEmailConnection();
      logger.info(colors.green('   ✅ Email service verified'));
    }

    // Step 4: Start HTTP server (NOW ASYNC)
    logger.info(colors.cyan('🌐 [4/5] Starting HTTP server...\n'));
    await startServer();

    // Attach Socket.IO (optional)
    if (server && config.socket.enabled) {
      io = initializeSocket(server);
      logger.info(colors.green('✅ Socket.IO initialized'));
    }
  } catch (error) {
    logger.error(colors.red(''));
    logger.error(colors.red('═══════════════════════════════════════════════════════════'));
    logger.error(colors.red('              ❌ APPLICATION FAILED TO START               '));
    logger.error(colors.red('═══════════════════════════════════════════════════════════'));
    logger.error(colors.red('Error Details:'), error);
    logger.error(colors.red('───────────────────────────────────────────────────────────\n'));

    // Attempt cleanup
    try {
      logger.info(colors.yellow('🧹 Attempting cleanup...'));
      await closeDB();
      await closeRedis();
      logger.info(colors.green('✅ Cleanup completed'));
    } catch (cleanupError) {
      logger.error(colors.red('❌ Cleanup error:'), cleanupError);
    }

    process.exit(1);
  }
}

// Start the application
main();

// Process event handlers
process.on('unhandledRejection', (reason: unknown) => {
  logger.error(colors.red('💥 UNHANDLED REJECTION:'), reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// SIGTERM (Production/ts-node-dev restart)
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

// SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

// SIGUSR2 (Nodemon/ts-node-dev restart)
process.on('SIGUSR2', () => {
  gracefulShutdown('SIGUSR2');
});

// SIGHUP (Terminal closed)
process.on('SIGHUP', () => {
  gracefulShutdown('SIGHUP');
});
