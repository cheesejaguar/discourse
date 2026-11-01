import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@hvnp/shared';
import { config } from '../config/index.js';
import { prisma } from '../db/client.js';
import { resetDatabase, createUser } from '../test/db.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from './auth.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createSession(
  options: { isBanned?: boolean; banReason?: string | null; expiresAt?: Date } = {}
) {
  const user = await createUser({ isBanned: options.isBanned, banReason: options.banReason });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: `token-${user.id}`,
      expiresAt: options.expiresAt ?? new Date(Date.now() + DAY_MS),
      lastActivityAt: new Date(Date.now() - DAY_MS),
    },
  });
  const token = jwt.sign(
    { userId: user.id, sessionId: session.id, alienId: user.alienId },
    config.jwt.secret
  );
  return { user, session, token };
}

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await resetDatabase();
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('requireAuth', () => {
    it('should reject request without authorization header', async () => {
      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_REQUIRED,
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockReq.headers = { authorization: 'InvalidFormat token' };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_REQUIRED,
          message: 'Authentication required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_INVALID_TOKEN,
          message: 'Invalid token',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token signed with a different secret', async () => {
      const { user, session } = await createSession();
      const forged = jwt.sign(
        { userId: user.id, sessionId: session.id, alienId: user.alienId },
        'not-the-real-secret'
      );
      mockReq.headers = { authorization: `Bearer ${forged}` };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_INVALID_TOKEN,
          message: 'Invalid token',
        },
      });
      expect(mockReq.user).toBeUndefined();
    });

    it('should reject expired token', async () => {
      const { user, session } = await createSession();
      const expiredToken = jwt.sign(
        { userId: user.id, sessionId: session.id, alienId: user.alienId },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Token has expired',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when session not found', async () => {
      const { token } = await createSession();
      await prisma.session.deleteMany();
      mockReq.headers = { authorization: `Bearer ${token}` };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Session has expired',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when session expired', async () => {
      const { token } = await createSession({ expiresAt: new Date(Date.now() - 1000) });
      mockReq.headers = { authorization: `Bearer ${token}` };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Session has expired',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject banned user', async () => {
      const { token } = await createSession({ isBanned: true, banReason: 'Violation' });
      mockReq.headers = { authorization: `Bearer ${token}` };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.USER_BANNED,
          message: 'Your account has been banned',
          details: { reason: 'Violation' },
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should authenticate valid request', async () => {
      const { user, session, token } = await createSession();
      mockReq.headers = { authorization: `Bearer ${token}` };

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(user);
      expect(mockReq.userId).toBe(user.id);
      expect(mockReq.sessionId).toBe(session.id);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should update last activity on successful auth', async () => {
      const { session, token } = await createSession();
      mockReq.headers = { authorization: `Bearer ${token}` };
      const before = Date.now();

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      const updated = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
      expect(updated.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated.lastActivityAt.getTime()).toBeGreaterThan(session.lastActivityAt.getTime());
    });
  });

  describe('optionalAuth', () => {
    it('should continue without auth header', async () => {
      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should continue with invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should populate user with valid token and update last activity', async () => {
      const { user, session, token } = await createSession();
      mockReq.headers = { authorization: `Bearer ${token}` };

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(user);
      expect(mockReq.userId).toBe(user.id);
      expect(mockReq.sessionId).toBe(session.id);
      expect(mockNext).toHaveBeenCalledWith();
      const updated = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
      expect(updated.lastActivityAt.getTime()).toBeGreaterThan(session.lastActivityAt.getTime());
    });

    it('should not populate user if session expired', async () => {
      const { token } = await createSession({ expiresAt: new Date(Date.now() - 1000) });
      mockReq.headers = { authorization: `Bearer ${token}` };

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not populate user if user is banned', async () => {
      const { token } = await createSession({ isBanned: true });
      mockReq.headers = { authorization: `Bearer ${token}` };

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
