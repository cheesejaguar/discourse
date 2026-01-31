import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@hvnp/shared';

// Use vi.hoisted to define mocks that need to be available when vi.mock runs
const { mockPrisma, mockSession } = vi.hoisted(() => ({
  mockPrisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockSession: {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    user: {
      id: 'user-123',
      displayName: 'TestUser',
      alienId: 'alien-123',
      isBanned: false,
      karma: 100,
    },
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
    },
  },
}));

// Mock prisma
vi.mock('../db/client.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocks are set up
import { requireAuth, optionalAuth, AuthenticatedRequest } from './auth.js';

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();

    // Reset mockSession expiresAt to future date
    mockSession.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockSession.user.isBanned = false;
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
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret',
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
    });

    it('should reject when session not found', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Session has expired',
        },
      });
    });

    it('should reject when session is expired', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject banned user', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, isBanned: true, banReason: 'Violation' },
      });

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
    });

    it('should authenticate valid request', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.session.update.mockResolvedValue(mockSession);

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockSession.user);
      expect(mockReq.userId).toBe('user-123');
      expect(mockReq.sessionId).toBe('session-123');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should update last activity on successful auth', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.session.update.mockResolvedValue(mockSession);

      await requireAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: { lastActivityAt: expect.any(Date) },
      });
    });
  });

  describe('optionalAuth', () => {
    it('should continue without auth header', async () => {
      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue with invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should populate user with valid token', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.session.update.mockResolvedValue(mockSession);

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockSession.user);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not populate user if session expired', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not populate user if user is banned', async () => {
      const token = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', alienId: 'alien-123' },
        'test-secret'
      );
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, isBanned: true },
      });

      await optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
