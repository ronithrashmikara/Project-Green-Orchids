const env = require('../config/env');

/**
 * Custom application error with status code
 */
class AppError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, _next) {
  // Log the error
  if (!err.isOperational) {
    console.error('❌ Unhandled error:', err.stack || err.message);
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = env.isDev || err.isOperational
    ? err.message
    : 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details && { details: err.details }),
      ...(env.isDev && !err.isOperational && { stack: err.stack }),
    },
  });
}

/**
 * 404 handler for unknown routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

/**
 * Catch unhandled rejections and exceptions
 */
function setupGlobalHandlers() {
  process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    // Don't exit in production - let the process continue
  });

  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
    if (env.isProd) {
      // In production, give time for logs to flush then exit
      setTimeout(() => process.exit(1), 1000);
    }
  });
}

module.exports = { AppError, errorHandler, notFoundHandler, setupGlobalHandlers };
