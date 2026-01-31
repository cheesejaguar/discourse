import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../db/client.js';
import { ERROR_CODES } from '@hvnp/shared';
import type { User } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
  sessionId?: string;
}

interface JWTPayload {
  userId: string;
  sessionId: string;
  alienId: string;
}

/**
 * Authentication middleware - requires valid JWT token
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_REQUIRED,
          message: 'Authentication required',
        },
      });
      return;
    }

    const token = authHeader.substring(7);

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
            message: 'Token has expired',
          },
        });
        return;
      }
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_INVALID_TOKEN,
          message: 'Invalid token',
        },
      });
      return;
    }

    // Verify session exists and is valid
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          message: 'Session has expired',
        },
      });
      return;
    }

    // Check if user is banned
    if (session.user.isBanned) {
      res.status(403).json({
        success: false,
        error: {
          code: ERROR_CODES.USER_BANNED,
          message: 'Your account has been banned',
          details: { reason: session.user.banReason },
        },
      });
      return;
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    req.user = session.user;
    req.userId = session.userId;
    req.sessionId = session.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Authentication error',
      },
    });
  }
}

/**
 * Optional authentication - populates user if token present but doesn't require it
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
        include: { user: true },
      });

      if (session && session.expiresAt > new Date() && !session.user.isBanned) {
        req.user = session.user;
        req.userId = session.userId;
        req.sessionId = session.id;

        // Update last activity
        await prisma.session.update({
          where: { id: session.id },
          data: { lastActivityAt: new Date() },
        });
      }
    } catch {
      // Token invalid, continue without user
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
}
