import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express, { RequestHandler } from 'express';
import request from 'supertest';
import {
  ERROR_CODES,
  RATE_LIMIT_COMMENTS_PER_MINUTE,
  RATE_LIMIT_VOTES_PER_MINUTE,
  RATE_LIMIT_REPORTS_PER_HOUR,
} from '@hvnp/shared';

// The limiters keep in-memory counters at module scope, so load a fresh copy
// for each test to start from zero.
async function loadLimiters() {
  vi.resetModules();
  return import('./rateLimiter.js');
}

/**
 * Builds a tiny app that puts the limiter in front of a route. A `x-user-id`
 * header simulates what requireAuth sets on the request.
 */
function appWith(limiter: RequestHandler) {
  const app = express();
  app.use((req, _res, next) => {
    const userId = req.header('x-user-id');
    if (userId) (req as { userId?: string }).userId = userId;
    next();
  });
  app.post('/', limiter, (_req, res) => {
    res.json({ success: true });
  });
  return app;
}

async function hit(app: express.Express, times: number, userId?: string) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i++) {
    const req = request(app).post('/');
    const res = await (userId ? req.set('x-user-id', userId) : req);
    statuses.push(res.status);
  }
  return statuses;
}

describe('Rate Limiters', () => {
  let limiters: Awaited<ReturnType<typeof loadLimiters>>;

  beforeEach(async () => {
    process.env.RATE_LIMIT_MAX_REQUESTS = '3';
    limiters = await loadLimiters();
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
  });

  describe('generalLimiter', () => {
    it('should allow RATE_LIMIT_MAX_REQUESTS requests and then return 429', async () => {
      const app = appWith(limiters.generalLimiter);

      expect(await hit(app, 4)).toEqual([200, 200, 200, 429]);
    });

    it('should respond with the API error envelope and standard headers', async () => {
      const app = appWith(limiters.generalLimiter);
      await hit(app, 3);

      const res = await request(app).post('/');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests, please try again later',
        },
      });
      expect(res.headers['ratelimit-limit']).toBe('3');
      expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    });
  });

  describe('commentLimiter', () => {
    it(`should allow ${RATE_LIMIT_COMMENTS_PER_MINUTE} comments per minute`, async () => {
      const app = appWith(limiters.commentLimiter);

      const statuses = await hit(app, RATE_LIMIT_COMMENTS_PER_MINUTE + 1, 'user-a');

      expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
      expect(statuses.at(-1)).toBe(429);
    });

    it('should count each authenticated user separately', async () => {
      const app = appWith(limiters.commentLimiter);
      await hit(app, RATE_LIMIT_COMMENTS_PER_MINUTE, 'user-a');

      const blocked = await request(app).post('/').set('x-user-id', 'user-a');
      const other = await request(app).post('/').set('x-user-id', 'user-b');

      expect(blocked.status).toBe(429);
      expect(blocked.body.error.message).toBe(
        'Comment rate limit exceeded. Please wait before posting again.'
      );
      expect(other.status).toBe(200);
    });
  });

  describe('voteLimiter', () => {
    it(`should allow ${RATE_LIMIT_VOTES_PER_MINUTE} votes per minute per user`, async () => {
      const app = appWith(limiters.voteLimiter);

      const statuses = await hit(app, RATE_LIMIT_VOTES_PER_MINUTE + 1, 'user-a');
      const other = await request(app).post('/').set('x-user-id', 'user-b');

      expect(statuses.filter((s) => s === 200)).toHaveLength(RATE_LIMIT_VOTES_PER_MINUTE);
      expect(statuses.at(-1)).toBe(429);
      expect(other.status).toBe(200);
    });
  });

  describe('reportLimiter', () => {
    it(`should allow ${RATE_LIMIT_REPORTS_PER_HOUR} reports per hour per user`, async () => {
      const app = appWith(limiters.reportLimiter);

      const statuses = await hit(app, RATE_LIMIT_REPORTS_PER_HOUR + 1, 'user-a');

      expect(statuses.filter((s) => s === 200)).toHaveLength(RATE_LIMIT_REPORTS_PER_HOUR);
      expect(statuses.at(-1)).toBe(429);
    });
  });

  describe('authLimiter', () => {
    it('should allow 10 attempts and then block by IP', async () => {
      const app = appWith(limiters.authLimiter);

      const statuses = await hit(app, 11);
      const res = await request(app).post('/');

      expect(statuses.filter((s) => s === 200)).toHaveLength(10);
      expect(statuses.at(-1)).toBe(429);
      expect(res.body.error).toEqual({
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Too many authentication attempts. Please try again later.',
      });
    });
  });
});
