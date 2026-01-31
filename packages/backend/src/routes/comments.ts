import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth, optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { commentLimiter } from '../middleware/rateLimiter.js';
import { AppError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
  MAX_COMMENT_DEPTH,
  COMMENT_EDIT_WINDOW_MINUTES,
  ERROR_CODES,
  wilsonScore,
  controversyScore,
} from '@hvnp/shared';
import type { Comment, VoteType } from '@prisma/client';

const router = Router();

// Validation schemas
const createCommentSchema = z.object({
  eventId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().min(MIN_COMMENT_LENGTH).max(MAX_COMMENT_LENGTH),
});

const updateCommentSchema = z.object({
  content: z.string().min(MIN_COMMENT_LENGTH).max(MAX_COMMENT_LENGTH),
});

const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z.enum(['best', 'top', 'new', 'controversial']).default('best'),
  parentId: z.string().uuid().optional(),
});

const commentParamsSchema = z.object({
  commentId: z.string().uuid(),
});

type CommentSortOption = 'best' | 'top' | 'new' | 'controversial';

/**
 * Helper to format a comment for API response
 */
function formatComment(
  comment: Comment & { author: { id: string; displayName: string; avatarUrl: string | null; karma: number } },
  userVote?: VoteType | null
) {
  return {
    id: comment.id,
    eventId: comment.eventId,
    parentId: comment.parentId,
    content: comment.isDeleted ? '[deleted]' : comment.content,
    score: comment.score,
    upvotes: comment.upvotes,
    downvotes: comment.downvotes,
    replyCount: 0, // Will be populated separately
    isEdited: comment.isEdited,
    editedAt: comment.editedAt,
    isDeleted: comment.isDeleted,
    isHidden: comment.isHidden,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.isDeleted
      ? null
      : {
          id: comment.author.id,
          displayName: comment.author.displayName,
          avatarUrl: comment.author.avatarUrl,
          karma: comment.author.karma,
        },
    userVote: userVote || null,
  };
}

/**
 * GET /api/comments
 * List comments for a news event
 */
router.get(
  '/',
  optionalAuth,
  validateQuery(listCommentsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, sort, parentId } = req.query as {
      page: number;
      limit: number;
      sort: CommentSortOption;
      parentId?: string;
    };

    const eventId = req.query.eventId as string;
    if (!eventId) {
      throw new AppError('eventId is required', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      eventId,
      parentId: parentId || null, // Only top-level comments if no parentId
      isDeleted: false,
      isHidden: false,
    };

    // Determine order by based on sort option
    let orderBy: Record<string, string>[];
    switch (sort) {
      case 'top':
        orderBy = [{ score: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'new':
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'controversial':
        // For controversial, we'll sort in memory after fetching
        orderBy = [{ createdAt: 'desc' }];
        break;
      case 'best':
      default:
        // Wilson score sorting is done in memory
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              karma: true,
            },
          },
          _count: {
            select: { replies: { where: { isDeleted: false, isHidden: false } } },
          },
        },
        orderBy,
        skip,
        take: limit * 2, // Fetch extra for sorting
      }),
      prisma.comment.count({ where }),
    ]);

    // Sort by Wilson score or controversy in memory
    let sortedComments = comments;
    if (sort === 'best') {
      sortedComments = [...comments].sort(
        (a, b) => wilsonScore(b.upvotes, b.downvotes) - wilsonScore(a.upvotes, a.downvotes)
      );
    } else if (sort === 'controversial') {
      sortedComments = [...comments].sort(
        (a, b) => controversyScore(b.upvotes, b.downvotes) - controversyScore(a.upvotes, a.downvotes)
      );
    }

    // Apply pagination to sorted results
    sortedComments = sortedComments.slice(0, limit);

    // Get user's votes if authenticated
    let userVotes: Map<string, VoteType> = new Map();
    if (req.userId) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: req.userId,
          commentId: { in: sortedComments.map((c) => c.id) },
        },
      });
      userVotes = new Map(votes.map((v) => [v.commentId, v.type]));
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: sortedComments.map((comment) => ({
        ...formatComment(comment, userVotes.get(comment.id)),
        replyCount: comment._count.replies,
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
 * GET /api/comments/:commentId
 * Get a single comment with its replies
 */
router.get(
  '/:commentId',
  optionalAuth,
  validateParams(commentParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            karma: true,
          },
        },
        replies: {
          where: { isDeleted: false, isHidden: false },
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                karma: true,
              },
            },
            _count: {
              select: { replies: { where: { isDeleted: false, isHidden: false } } },
            },
          },
          orderBy: { score: 'desc' },
          take: 10,
        },
        _count: {
          select: { replies: { where: { isDeleted: false, isHidden: false } } },
        },
      },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Get user's vote if authenticated
    let userVote: VoteType | null = null;
    let replyVotes: Map<string, VoteType> = new Map();
    if (req.userId) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: req.userId,
          commentId: { in: [comment.id, ...comment.replies.map((r) => r.id)] },
        },
      });
      for (const vote of votes) {
        if (vote.commentId === comment.id) {
          userVote = vote.type;
        } else {
          replyVotes.set(vote.commentId, vote.type);
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...formatComment(comment, userVote),
        replyCount: comment._count.replies,
        replies: comment.replies.map((reply) => ({
          ...formatComment(reply, replyVotes.get(reply.id)),
          replyCount: reply._count.replies,
        })),
      },
    });
  }
);

/**
 * POST /api/comments
 * Create a new comment
 */
router.post(
  '/',
  requireAuth,
  commentLimiter,
  validateBody(createCommentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { eventId, parentId, content } = req.body;
    const userId = req.userId!;

    // Verify the event exists
    const event = await prisma.newsEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('News event not found');
    }

    // If replying to a comment, verify parent exists and get depth
    let depth = 0;
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment) {
        throw new NotFoundError('Parent comment not found');
      }

      if (parentComment.eventId !== eventId) {
        throw new AppError(
          'Parent comment belongs to a different event',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      depth = parentComment.depth + 1;

      if (depth > MAX_COMMENT_DEPTH) {
        throw new AppError(
          `Maximum comment depth of ${MAX_COMMENT_DEPTH} exceeded`,
          400,
          ERROR_CODES.COMMENT_DEPTH_EXCEEDED
        );
      }
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        eventId,
        authorId: userId,
        parentId,
        content,
        depth,
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            karma: true,
          },
        },
      },
    });

    // Update event comment count
    await prisma.newsEvent.update({
      where: { id: eventId },
      data: { commentCount: { increment: 1 } },
    });

    res.status(201).json({
      success: true,
      data: {
        ...formatComment(comment, null),
        replyCount: 0,
      },
    });
  }
);

/**
 * PATCH /api/comments/:commentId
 * Update a comment (within edit window)
 */
router.patch(
  '/:commentId',
  requireAuth,
  validateParams(commentParamsSchema),
  validateBody(updateCommentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.userId!;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    if (comment.isDeleted) {
      throw new AppError('Cannot edit a deleted comment', 400, ERROR_CODES.COMMENT_ALREADY_DELETED);
    }

    // Check edit window
    const editWindowEnd = new Date(
      comment.createdAt.getTime() + COMMENT_EDIT_WINDOW_MINUTES * 60 * 1000
    );

    if (new Date() > editWindowEnd) {
      throw new AppError(
        `Comments can only be edited within ${COMMENT_EDIT_WINDOW_MINUTES} minutes of posting`,
        400,
        ERROR_CODES.COMMENT_EDIT_WINDOW_EXPIRED
      );
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            karma: true,
          },
        },
        _count: {
          select: { replies: { where: { isDeleted: false, isHidden: false } } },
        },
      },
    });

    res.json({
      success: true,
      data: {
        ...formatComment(updatedComment, null),
        replyCount: updatedComment._count.replies,
      },
    });
  }
);

/**
 * DELETE /api/comments/:commentId
 * Delete a comment (soft delete)
 */
router.delete(
  '/:commentId',
  requireAuth,
  validateParams(commentParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const userId = req.userId!;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        _count: {
          select: { replies: true },
        },
      },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    if (comment.isDeleted) {
      throw new AppError('Comment is already deleted', 400, ERROR_CODES.COMMENT_ALREADY_DELETED);
    }

    // Soft delete - keep the record but mark as deleted
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        isDeleted: true,
        content: '[deleted]',
      },
    });

    // Update event comment count
    await prisma.newsEvent.update({
      where: { id: comment.eventId },
      data: { commentCount: { decrement: 1 } },
    });

    res.json({
      success: true,
      data: { message: 'Comment deleted successfully' },
    });
  }
);

/**
 * GET /api/comments/:commentId/replies
 * Get replies to a comment
 */
router.get(
  '/:commentId/replies',
  optionalAuth,
  validateParams(commentParamsSchema),
  validateQuery(listCommentsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const { page, limit, sort } = req.query as {
      page: number;
      limit: number;
      sort: CommentSortOption;
    };

    const skip = (page - 1) * limit;

    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!parentComment) {
      throw new NotFoundError('Comment not found');
    }

    const where = {
      parentId: commentId,
      isDeleted: false,
      isHidden: false,
    };

    const [replies, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              karma: true,
            },
          },
          _count: {
            select: { replies: { where: { isDeleted: false, isHidden: false } } },
          },
        },
        orderBy: sort === 'new' ? { createdAt: 'desc' } : { score: 'desc' },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    // Get user's votes if authenticated
    let userVotes: Map<string, VoteType> = new Map();
    if (req.userId) {
      const votes = await prisma.vote.findMany({
        where: {
          userId: req.userId,
          commentId: { in: replies.map((c) => c.id) },
        },
      });
      userVotes = new Map(votes.map((v) => [v.commentId, v.type]));
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: replies.map((reply) => ({
        ...formatComment(reply, userVotes.get(reply.id)),
        replyCount: reply._count.replies,
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

export default router;
