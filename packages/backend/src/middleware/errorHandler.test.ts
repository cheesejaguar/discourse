import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { Request, Response } from 'express';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
} from './errorHandler.js';
import { ERROR_CODES } from '@hvnp/shared';
import { prisma } from '../db/client.js';
import { resetDatabase, createUser } from '../test/db.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(error.details).toBeUndefined();
    });

    it('should create an error with custom values', () => {
      const error = new AppError('Custom error', 400, 'CUSTOM_CODE', { field: 'value' });

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('should create with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('should create with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
    });
  });

  describe('ValidationError', () => {
    it('should create with message', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should create with details', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('UnauthorizedError', () => {
    it('should create with default message', () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ERROR_CODES.AUTH_REQUIRED);
    });
  });

  describe('ForbiddenError', () => {
    it('should create with default message', () => {
      const error = new ForbiddenError();

      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('RateLimitError', () => {
    it('should create with default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
    });
  });
});

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle AppError', () => {
    const error = new AppError('Test error', 400, 'TEST_ERROR', { detail: 'info' });

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error',
        details: { detail: 'info' },
      },
    });
  });

  it('should handle generic Error', () => {
    const error = new Error('Generic error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Generic error',
        }),
      })
    );
  });

  it('should include stack trace in dev mode', () => {
    const error = new Error('Dev error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    const response = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(response.error.stack).toBe(error.stack);
  });

  it('should hide message and stack trace in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    try {
      const { errorHandler: prodErrorHandler } = await import('./errorHandler.js');

      prodErrorHandler(new Error('secret internals'), mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
        },
      });
    } finally {
      process.env.NODE_ENV = originalEnv;
      vi.resetModules();
    }
  });

  describe('Prisma errors (from a real database)', () => {
    beforeEach(async () => {
      await resetDatabase();
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it('should map a unique constraint violation (P2002) to 409', async () => {
      const user = await createUser({ displayName: 'Taken' });
      const error = await prisma.user
        .create({ data: { alienId: `${user.alienId}-other`, displayName: 'Taken' } })
        .catch((e: Error) => e);

      errorHandler(error as Error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'A record with this value already exists',
          details: expect.objectContaining({ target: ['display_name'] }),
        },
      });
    });

    it('should map a missing record (P2025) to 404', async () => {
      const error = await prisma.user
        .update({ where: { id: 'does-not-exist' }, data: { bio: 'x' } })
        .catch((e: Error) => e);

      errorHandler(error as Error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Record not found',
        },
      });
    });
  });
});

describe('notFoundHandler middleware', () => {
  it('should return 404 with route info', () => {
    const mockReq = {
      method: 'GET',
      path: '/unknown',
    } as Request;
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    notFoundHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: 'Route GET /unknown not found',
      },
    });
  });
});
