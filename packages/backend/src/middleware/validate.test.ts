import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { z } from 'zod';
import { validate, validateBody, validateQuery, validateParams } from './validate.js';
import { ERROR_CODES } from '@hvnp/shared';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('validate', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    });

    it('should pass valid data', () => {
      mockReq.body = { name: 'John', age: 25 };
      const middleware = validate(schema, 'body');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject invalid data with validation errors', () => {
      mockReq.body = { name: '', age: -5 };
      const middleware = validate(schema, 'body');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: {
            errors: expect.arrayContaining([
              expect.objectContaining({ field: 'name' }),
              expect.objectContaining({ field: 'age' }),
            ]),
          },
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should transform data according to schema', () => {
      const transformSchema = z.object({
        count: z.coerce.number(),
      });
      mockReq.body = { count: '42' };
      const middleware = validate(transformSchema, 'body');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body).toEqual({ count: 42 });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should validate query parameters', () => {
      const querySchema = z.object({
        page: z.coerce.number().default(1),
      });
      mockReq.query = { page: '5' };
      const middleware = validate(querySchema, 'query');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query).toEqual({ page: 5 });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should validate path parameters', () => {
      const paramsSchema = z.object({
        id: z.string().uuid(),
      });
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const middleware = validate(paramsSchema, 'params');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next with error for non-Zod errors', () => {
      const badSchema = {
        parse: () => {
          throw new Error('Non-Zod error');
        },
      };
      const middleware = validate(badSchema as unknown as z.ZodSchema, 'body');

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ message: 'Non-Zod error' }));
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('validateBody', () => {
    const schema = z.object({ test: z.coerce.number() });

    it('should validate and replace req.body only', () => {
      const middleware = validateBody(schema);
      mockReq.body = { test: '7' };
      mockReq.query = { test: 'not-a-number' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ test: 7 });
      expect(mockReq.query).toEqual({ test: 'not-a-number' });
    });

    it('should reject an invalid body', () => {
      const middleware = validateBody(schema);
      mockReq.body = { test: 'abc' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({ search: z.string().min(2) });

    it('should validate and replace req.query only', () => {
      const middleware = validateQuery(schema);
      mockReq.query = { search: 'test', extra: 'dropped' };
      mockReq.body = {};

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ search: 'test' });
      expect(mockReq.body).toEqual({});
    });

    it('should reject an invalid query', () => {
      const middleware = validateQuery(schema);
      mockReq.query = { search: 'x' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    const schema = z.object({ id: z.string().uuid() });

    it('should validate req.params', () => {
      const middleware = validateParams(schema);
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    it('should reject invalid params with the failing field', () => {
      const middleware = validateParams(schema);
      mockReq.params = { id: 'abc123' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: { errors: [{ field: 'id', message: 'Invalid uuid' }] },
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
