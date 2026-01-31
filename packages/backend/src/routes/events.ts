import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ERROR_CODES } from '@hvnp/shared';
import type { NewsCategory as PrismaNewsCategory, BiasRating as PrismaBiasRating } from '@prisma/client';

const router = Router();

// Validation schemas
const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  category: z.enum([
    'POLITICS', 'TECHNOLOGY', 'BUSINESS', 'SCIENCE',
    'HEALTH', 'SPORTS', 'ENTERTAINMENT', 'WORLD', 'ENVIRONMENT', 'OTHER'
  ]).optional(),
  trending: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  search: z.string().max(200).optional(),
});

const eventParamsSchema = z.object({
  eventId: z.string().uuid().or(z.string().min(1)), // Can be UUID or slug
});

/**
 * Helper to convert bias rating to frontend format
 */
function formatBiasRating(rating: PrismaBiasRating | null): string | null {
  if (!rating) return null;
  const map: Record<PrismaBiasRating, string> = {
    FAR_LEFT: 'far-left',
    LEFT: 'left',
    CENTER_LEFT: 'center-left',
    CENTER: 'center',
    CENTER_RIGHT: 'center-right',
    RIGHT: 'right',
    FAR_RIGHT: 'far-right',
  };
  return map[rating];
}

/**
 * Helper to convert category to frontend format
 */
function formatCategory(category: PrismaNewsCategory): string {
  return category.toLowerCase();
}

/**
 * GET /api/events
 * List news events with pagination and filtering
 */
router.get(
  '/',
  validateQuery(listEventsQuerySchema),
  async (req: Request, res: Response) => {
    const { page, limit, category, trending, search } = req.query as {
      page: number;
      limit: number;
      category?: PrismaNewsCategory;
      trending?: boolean;
      search?: string;
    };

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (trending !== undefined) {
      where.isTrending = trending;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.newsEvent.findMany({
        where,
        include: {
          articles: {
            include: {
              source: true,
            },
            orderBy: { publishedAt: 'desc' },
          },
          _count: {
            select: { comments: { where: { isDeleted: false } } },
          },
        },
        orderBy: [
          { isTrending: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.newsEvent.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: events.map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        summary: event.summary,
        category: formatCategory(event.category),
        imageUrl: event.imageUrl,
        isTrending: event.isTrending,
        commentCount: event._count.comments,
        sourceCount: event.articles.length,
        sources: event.articles.map((article) => ({
          id: article.id,
          name: article.source.name,
          biasRating: formatBiasRating(article.source.biasRating),
          logoUrl: article.source.logoUrl,
        })),
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
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
 * GET /api/events/trending
 * Get trending news events
 */
router.get('/trending', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

  const events = await prisma.newsEvent.findMany({
    where: { isTrending: true },
    include: {
      articles: {
        include: {
          source: true,
        },
        take: 5,
        orderBy: { publishedAt: 'desc' },
      },
      _count: {
        select: { comments: { where: { isDeleted: false } } },
      },
    },
    orderBy: [
      { commentCount: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  res.json({
    success: true,
    data: events.map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      category: formatCategory(event.category),
      imageUrl: event.imageUrl,
      isTrending: event.isTrending,
      commentCount: event._count.comments,
      sourceCount: event.articles.length,
      createdAt: event.createdAt,
    })),
  });
});

/**
 * GET /api/events/categories
 * Get events grouped by category
 */
router.get('/categories', async (req: Request, res: Response) => {
  const categories = await prisma.newsEvent.groupBy({
    by: ['category'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  res.json({
    success: true,
    data: categories.map((c) => ({
      category: formatCategory(c.category),
      count: c._count._all,
    })),
  });
});

/**
 * GET /api/events/:eventId
 * Get a single news event with full details
 */
router.get(
  '/:eventId',
  optionalAuth,
  validateParams(eventParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const { eventId } = req.params;

    // Try to find by ID or slug
    const event = await prisma.newsEvent.findFirst({
      where: {
        OR: [
          { id: eventId },
          { slug: eventId },
        ],
      },
      include: {
        articles: {
          include: {
            source: true,
          },
          orderBy: { publishedAt: 'desc' },
        },
        _count: {
          select: { comments: { where: { isDeleted: false } } },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('News event not found');
    }

    res.json({
      success: true,
      data: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        summary: event.summary,
        category: formatCategory(event.category),
        imageUrl: event.imageUrl,
        isTrending: event.isTrending,
        commentCount: event._count.comments,
        articles: event.articles.map((article) => ({
          id: article.id,
          title: article.title,
          url: article.url,
          summary: article.summary,
          imageUrl: article.imageUrl,
          author: article.author,
          publishedAt: article.publishedAt,
          source: {
            id: article.source.id,
            name: article.source.name,
            domain: article.source.domain,
            logoUrl: article.source.logoUrl,
            biasRating: formatBiasRating(article.source.biasRating),
          },
        })),
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      },
    });
  }
);

/**
 * GET /api/events/:eventId/related
 * Get related news events
 */
router.get(
  '/:eventId/related',
  validateParams(eventParamsSchema),
  async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);

    // Get the event to find its category
    const event = await prisma.newsEvent.findFirst({
      where: {
        OR: [
          { id: eventId },
          { slug: eventId },
        ],
      },
    });

    if (!event) {
      throw new NotFoundError('News event not found');
    }

    // Find related events in the same category
    const relatedEvents = await prisma.newsEvent.findMany({
      where: {
        category: event.category,
        id: { not: event.id },
      },
      include: {
        _count: {
          select: { comments: { where: { isDeleted: false } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      success: true,
      data: relatedEvents.map((e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        summary: e.summary,
        category: formatCategory(e.category),
        imageUrl: e.imageUrl,
        commentCount: e._count.comments,
        createdAt: e.createdAt,
      })),
    });
  }
);

export default router;
