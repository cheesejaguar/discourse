import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ERROR_CODES } from '@hvnp/shared';

const router = Router();

// Validation schemas
const userParamsSchema = z.object({
  userId: z.string().uuid(),
});

const userCommentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z.enum(['new', 'top']).default('new'),
});

/**
 * GET /api/users/:userId
 * Get a user's public profile
 */
router.get(
  '/:userId',
  validateParams(userParamsSchema),
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get user stats
    const [commentCount, totalUpvotes, totalDownvotes] = await Promise.all([
      prisma.comment.count({
        where: { authorId: userId, isDeleted: false },
      }),
      prisma.vote.count({
        where: {
          type: 'UP',
          comment: { authorId: userId },
        },
      }),
      prisma.vote.count({
        where: {
          type: 'DOWN',
          comment: { authorId: userId },
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
        commentCount,
        totalUpvotes,
        totalDownvotes,
      },
    });
  }
);

/**
 * GET /api/users/:userId/comments
 * Get a user's comment history
 */
router.get(
  '/:userId/comments',
  optionalAuth,
  validateParams(userParamsSchema),
  validateQuery(userCommentsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { page, limit, sort } = req.query as {
      page: number;
      limit: number;
      sort: 'new' | 'top';
    };

    const skip = (page - 1) * limit;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const where = {
      authorId: userId,
      isDeleted: false,
      isHidden: false,
    };

    const orderBy = sort === 'top' ? { score: 'desc' as const } : { createdAt: 'desc' as const };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
          _count: {
            select: { replies: { where: { isDeleted: false, isHidden: false } } },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    // Get user's votes if authenticated
    let userVotes = new Map<string, string>();
    if (req.userId) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: req.userId,
          commentId: { in: comments.map((c) => c.id) },
        },
      });
      userVotes = new Map(votes.map((v) => [v.commentId, v.type]));
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: comments.map((comment) => ({
        id: comment.id,
        eventId: comment.eventId,
        parentId: comment.parentId,
        content: comment.content,
        score: comment.score,
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
        replyCount: comment._count.replies,
        isEdited: comment.isEdited,
        createdAt: comment.createdAt,
        event: comment.event,
        userVote: userVotes.get(comment.id) || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  }
);

/**
 * GET /api/users/search
 * Search for users by display name
 */
router.get('/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

  if (query.length < 2) {
    res.json({
      success: true,
      data: [],
    });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      displayName: { contains: query, mode: 'insensitive' },
      isBanned: false,
    },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      karma: true,
    },
    take: limit,
    orderBy: { karma: 'desc' },
  });

  res.json({
    success: true,
    data: users,
  });
});

export default router;
