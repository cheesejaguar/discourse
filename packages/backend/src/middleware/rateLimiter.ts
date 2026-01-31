import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { ERROR_CODES, RATE_LIMIT_COMMENTS_PER_MINUTE, RATE_LIMIT_VOTES_PER_MINUTE, RATE_LIMIT_REPORTS_PER_HOUR } from '@hvnp/shared';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Comment posting rate limiter (stricter)
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: RATE_LIMIT_COMMENTS_PER_MINUTE,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Comment rate limit exceeded. Please wait before posting again.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return (req as { userId?: string }).userId || req.ip || 'unknown';
  },
});

// Vote rate limiter
export const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: RATE_LIMIT_VOTES_PER_MINUTE,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Vote rate limit exceeded. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as { userId?: string }).userId || req.ip || 'unknown';
  },
});

// Report rate limiter
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: RATE_LIMIT_REPORTS_PER_HOUR,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Report rate limit exceeded. Please wait before submitting more reports.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as { userId?: string }).userId || req.ip || 'unknown';
  },
});

// Authentication rate limiter (protect against brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
