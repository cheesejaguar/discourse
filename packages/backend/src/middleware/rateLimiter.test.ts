import { describe, it, expect, vi } from 'vitest';
import {
  generalLimiter,
  commentLimiter,
  voteLimiter,
  reportLimiter,
  authLimiter,
} from './rateLimiter.js';

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    rateLimit: {
      windowMs: 60000,
      maxRequests: 100,
    },
  },
}));

describe('Rate Limiters', () => {
  describe('generalLimiter', () => {
    it('should be a function (middleware)', () => {
      expect(typeof generalLimiter).toBe('function');
    });

    it('should have length of 3 (req, res, next)', () => {
      expect(generalLimiter.length).toBe(3);
    });
  });

  describe('commentLimiter', () => {
    it('should be a function (middleware)', () => {
      expect(typeof commentLimiter).toBe('function');
    });
  });

  describe('voteLimiter', () => {
    it('should be a function (middleware)', () => {
      expect(typeof voteLimiter).toBe('function');
    });
  });

  describe('reportLimiter', () => {
    it('should be a function (middleware)', () => {
      expect(typeof reportLimiter).toBe('function');
    });
  });

  describe('authLimiter', () => {
    it('should be a function (middleware)', () => {
      expect(typeof authLimiter).toBe('function');
    });
  });
});
