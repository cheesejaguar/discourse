import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { reportLimiter } from '../middleware/rateLimiter.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '@hvnp/shared';

const router = Router();

// Validation schemas
const createReportSchema = z.object({
  commentId: z.string().uuid(),
  reason: z.enum(['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'MISINFORMATION', 'OFF_TOPIC', 'OTHER']),
  description: z.string().max(500).optional(),
});

const reportParamsSchema = z.object({
  reportId: z.string().uuid(),
});

/**
 * POST /api/reports
 * Report a comment for moderation
 */
router.post(
  '/',
  requireAuth,
  reportLimiter,
  validateBody(createReportSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { commentId, reason, description } = req.body;
    const userId = req.userId!;

    // Get the comment
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.isDeleted) {
      throw new AppError('Cannot report a deleted comment', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Can't report your own comment
    if (comment.authorId === userId) {
      throw new AppError('You cannot report your own comment', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Check if user already reported this comment
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: userId,
        commentId,
        status: { in: ['PENDING', 'REVIEWED'] },
      },
    });

    if (existingReport) {
      throw new AppError(
        'You have already reported this comment',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        commentId,
        reason,
        description,
      },
    });

    // Auto-hide comments with many reports
    const reportCount = await prisma.report.count({
      where: {
        commentId,
        status: 'PENDING',
      },
    });

    if (reportCount >= 5) {
      await prisma.comment.update({
        where: { id: commentId },
        data: { isHidden: true },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: report.id,
        commentId: report.commentId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  }
);

/**
 * GET /api/reports/my-reports
 * Get current user's submitted reports
 */
router.get('/my-reports', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  const reports = await prisma.report.findMany({
    where: { reporterId: userId },
    include: {
      comment: {
        select: {
          id: true,
          content: true,
          isDeleted: true,
          isHidden: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({
    success: true,
    data: reports.map((report) => ({
      id: report.id,
      commentId: report.commentId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
      comment: {
        id: report.comment.id,
        content: report.comment.isDeleted ? '[deleted]' : report.comment.content,
        isDeleted: report.comment.isDeleted,
        isHidden: report.comment.isHidden,
      },
    })),
  });
});

export default router;
