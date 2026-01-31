import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { voteLimiter } from '../middleware/rateLimiter.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '@hvnp/shared';

const router = Router();

// Validation schemas
const voteSchema = z.object({
  type: z.enum(['UP', 'DOWN']),
});

const commentParamsSchema = z.object({
  commentId: z.string().uuid(),
});

/**
 * POST /api/votes/:commentId
 * Vote on a comment (upvote or downvote)
 */
router.post(
  '/:commentId',
  requireAuth,
  voteLimiter,
  validateParams(commentParamsSchema),
  validateBody(voteSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { commentId } = req.params;
    const { type } = req.body;
    const userId = req.userId!;

    // Get the comment
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Can't vote on deleted or hidden comments
    if (comment.isDeleted) {
      throw new AppError('Cannot vote on a deleted comment', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    if (comment.isHidden) {
      throw new AppError('Cannot vote on a hidden comment', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Can't vote on your own comment
    if (comment.authorId === userId) {
      throw new AppError('You cannot vote on your own comment', 400, ERROR_CODES.VOTE_OWN_COMMENT);
    }

    // Check for existing vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    let updatedComment;
    let action: 'created' | 'changed' | 'removed';

    if (existingVote) {
      if (existingVote.type === type) {
        // Same vote type - remove the vote (toggle off)
        await prisma.vote.delete({
          where: { id: existingVote.id },
        });

        // Update comment vote counts
        const updates =
          type === 'UP'
            ? { upvotes: { decrement: 1 }, score: { decrement: 1 } }
            : { downvotes: { decrement: 1 }, score: { increment: 1 } };

        updatedComment = await prisma.comment.update({
          where: { id: commentId },
          data: updates,
        });

        // Update author karma
        await prisma.user.update({
          where: { id: comment.authorId },
          data: { karma: { increment: type === 'UP' ? -1 : 1 } },
        });

        action = 'removed';
      } else {
        // Different vote type - change the vote
        await prisma.vote.update({
          where: { id: existingVote.id },
          data: { type },
        });

        // Update comment vote counts (reverse old vote and apply new)
        const updates =
          type === 'UP'
            ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 }, score: { increment: 2 } }
            : { upvotes: { decrement: 1 }, downvotes: { increment: 1 }, score: { decrement: 2 } };

        updatedComment = await prisma.comment.update({
          where: { id: commentId },
          data: updates,
        });

        // Update author karma (double change since reversing)
        await prisma.user.update({
          where: { id: comment.authorId },
          data: { karma: { increment: type === 'UP' ? 2 : -2 } },
        });

        action = 'changed';
      }
    } else {
      // New vote
      await prisma.vote.create({
        data: {
          userId,
          commentId,
          type,
        },
      });

      // Update comment vote counts
      const updates =
        type === 'UP'
          ? { upvotes: { increment: 1 }, score: { increment: 1 } }
          : { downvotes: { increment: 1 }, score: { decrement: 1 } };

      updatedComment = await prisma.comment.update({
        where: { id: commentId },
        data: updates,
      });

      // Update author karma
      await prisma.user.update({
        where: { id: comment.authorId },
        data: { karma: { increment: type === 'UP' ? 1 : -1 } },
      });

      action = 'created';
    }

    res.json({
      success: true,
      data: {
        commentId,
        score: updatedComment.score,
        upvotes: updatedComment.upvotes,
        downvotes: updatedComment.downvotes,
        userVote: action === 'removed' ? null : type,
        action,
      },
    });
  }
);

/**
 * DELETE /api/votes/:commentId
 * Remove vote from a comment
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
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    if (!existingVote) {
      throw new NotFoundError('Vote not found');
    }

    await prisma.vote.delete({
      where: { id: existingVote.id },
    });

    // Update comment vote counts
    const updates =
      existingVote.type === 'UP'
        ? { upvotes: { decrement: 1 }, score: { decrement: 1 } }
        : { downvotes: { decrement: 1 }, score: { increment: 1 } };

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: updates,
    });

    // Update author karma
    await prisma.user.update({
      where: { id: comment.authorId },
      data: { karma: { increment: existingVote.type === 'UP' ? -1 : 1 } },
    });

    res.json({
      success: true,
      data: {
        commentId,
        score: updatedComment.score,
        upvotes: updatedComment.upvotes,
        downvotes: updatedComment.downvotes,
        userVote: null,
      },
    });
  }
);

/**
 * GET /api/votes/user
 * Get current user's votes (for a list of comments)
 */
router.get('/user', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const commentIds = (req.query.commentIds as string)?.split(',').filter(Boolean) || [];

  if (commentIds.length === 0) {
    res.json({
      success: true,
      data: {},
    });
    return;
  }

  if (commentIds.length > 100) {
    throw new AppError('Too many comment IDs (max 100)', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const votes = await prisma.vote.findMany({
    where: {
      userId,
      commentId: { in: commentIds },
    },
  });

  const voteMap: Record<string, string> = {};
  for (const vote of votes) {
    voteMap[vote.commentId] = vote.type;
  }

  res.json({
    success: true,
    data: voteMap,
  });
});

export default router;
