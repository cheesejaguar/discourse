import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/client.js';
import { config } from '../config/index.js';
import { alienAuthService, AlienAuthService } from '../services/alienAuth.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES, SESSION_DURATION_HOURS } from '@hvnp/shared';

const router = Router();

// Validation schemas
const alienAuthSchema = z.object({
  alienId: z.string().min(1),
  signature: z.string().min(1),
  timestamp: z.number(),
  nonce: z.string().min(1),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

/**
 * POST /api/auth/challenge
 * Generate a QR code challenge for Alien.org authentication
 */
router.post('/challenge', authLimiter, async (req: Request, res: Response) => {
  try {
    const challenge = await alienAuthService.generateChallenge();

    res.json({
      success: true,
      data: challenge,
    });
  } catch (error) {
    throw new AppError('Failed to generate authentication challenge', 500);
  }
});

/**
 * POST /api/auth/verify
 * Verify Alien.org authentication and create/login user
 */
router.post(
  '/verify',
  authLimiter,
  validateBody(alienAuthSchema),
  async (req: Request, res: Response) => {
    const payload = req.body;

    // Verify with Alien.org
    const verificationResult = await alienAuthService.verifyPayload(payload);

    if (!verificationResult.isValid || !verificationResult.alienId) {
      throw new AppError(
        verificationResult.error || 'Verification failed',
        401,
        ERROR_CODES.AUTH_ALIEN_VERIFICATION_FAILED
      );
    }

    const alienId = verificationResult.alienId;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { alienId },
    });

    const isNewUser = !user;

    if (!user) {
      // Generate a unique display name for new users
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const displayName = `user_${randomSuffix}`;

      user = await prisma.user.create({
        data: {
          alienId,
          displayName,
          isVerified: true,
        },
      });
    }

    // Check if banned
    if (user.isBanned) {
      throw new AppError('Your account has been banned', 403, ERROR_CODES.USER_BANNED, {
        reason: user.banReason,
      });
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const token = jwt.sign(
      {
        userId: user.id,
        sessionId,
        alienId: user.alienId,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token,
        expiresAt,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          karma: user.karma,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
        token,
        expiresAt,
        isNewUser,
      },
    });
  }
);

/**
 * POST /api/auth/dev-login (Development only)
 * Quick login for development/testing without Alien.org
 */
router.post('/dev-login', authLimiter, async (req: Request, res: Response) => {
  if (!config.isDev) {
    throw new AppError('This endpoint is only available in development', 403);
  }

  const { displayName } = req.body;

  // Generate mock Alien payload
  const mockPayload = AlienAuthService.generateMockPayload();
  const alienId = mockPayload.alienId;

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { alienId },
  });

  if (!user) {
    const name = displayName || `dev_${Math.random().toString(36).substring(2, 8)}`;

    // Check if display name is taken
    const existingName = await prisma.user.findUnique({
      where: { displayName: name },
    });

    const finalName = existingName
      ? `${name}_${Math.random().toString(36).substring(2, 4)}`
      : name;

    user = await prisma.user.create({
      data: {
        alienId,
        displayName: finalName,
        isVerified: true,
      },
    });
  }

  // Create session
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  const token = jwt.sign(
    {
      userId: user.id,
      sessionId,
      alienId: user.alienId,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      token,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        karma: user.karma,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      token,
      expiresAt,
    },
  });
});

/**
 * POST /api/auth/logout
 * End the current session
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await prisma.session.delete({
    where: { id: req.sessionId },
  });

  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  // Get additional stats
  const [commentCount, totalUpvotes] = await Promise.all([
    prisma.comment.count({
      where: { authorId: user.id, isDeleted: false },
    }),
    prisma.vote.count({
      where: {
        type: 'UP',
        comment: { authorId: user.id },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      karma: user.karma,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      commentCount,
      totalUpvotes,
    },
  });
});

/**
 * PATCH /api/auth/me
 * Update current user's profile
 */
router.patch(
  '/me',
  requireAuth,
  validateBody(updateProfileSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { displayName, bio, avatarUrl } = req.body;
    const userId = req.userId!;

    // Check if display name is taken (if changing)
    if (displayName && displayName !== req.user!.displayName) {
      const existingUser = await prisma.user.findUnique({
        where: { displayName },
      });

      if (existingUser) {
        throw new AppError(
          'Display name is already taken',
          409,
          ERROR_CODES.USER_DISPLAY_NAME_TAKEN
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        karma: updatedUser.karma,
        isVerified: updatedUser.isVerified,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  }
);

/**
 * GET /api/auth/sessions
 * List active sessions for current user
 */
router.get('/sessions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const sessions = await prisma.session.findMany({
    where: {
      userId: req.userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      createdAt: true,
      lastActivityAt: true,
      userAgent: true,
      expiresAt: true,
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  res.json({
    success: true,
    data: sessions.map((s) => ({
      ...s,
      isCurrent: s.id === req.sessionId,
    })),
  });
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * End a specific session
 */
router.delete('/sessions/:sessionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId: req.userId,
    },
  });

  if (!session) {
    throw new AppError('Session not found', 404, ERROR_CODES.NOT_FOUND);
  }

  await prisma.session.delete({
    where: { id: sessionId },
  });

  res.json({
    success: true,
    data: { message: 'Session ended successfully' },
  });
});

export default router;
