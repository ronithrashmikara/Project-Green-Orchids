const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Global rate limiter: 300 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 5000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});

/**
 * Auth routes: 10 requests per minute per IP
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDevelopment ? 5000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, please try again later' },
  },
});

/**
 * Forgot password: 3 requests per hour per IP
 */
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDevelopment ? 50 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many password reset attempts, please try again later' },
  },
});

/**
 * Report endpoints: 30 requests per minute per IP
 */
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDevelopment ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many report requests, please try again later' },
  },
});

module.exports = { globalLimiter, authLimiter, forgotPasswordLimiter, reportLimiter };
