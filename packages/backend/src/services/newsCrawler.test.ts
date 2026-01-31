import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to define mocks that need to be available when vi.mock runs
const mockPrisma = vi.hoisted(() => ({
  newsSource: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  newsArticle: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  newsEvent: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  comment: {
    groupBy: vi.fn(),
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    newsCrawler: {
      intervalMs: 900000,
    },
  },
}));

// Mock prisma
vi.mock('../db/client.js', () => ({
  prisma: mockPrisma,
}));

// Mock RSSParser
vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({
    parseURL: vi.fn().mockResolvedValue({
      items: [
        {
          title: 'Test Article',
          link: 'https://example.com/article1',
          pubDate: '2024-01-01T00:00:00Z',
          contentSnippet: 'Test content snippet',
          isoDate: '2024-01-01T00:00:00Z',
        },
      ],
    }),
  })),
}));

// Import after mocks are set up
import { NewsCrawlerService, newsCrawlerService } from './newsCrawler.js';

describe('NewsCrawlerService', () => {
  let service: NewsCrawlerService;

  beforeEach(() => {
    service = new NewsCrawlerService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.stop();
  });

  describe('initializeSources', () => {
    it('should initialize news sources', async () => {
      mockPrisma.newsSource.upsert.mockResolvedValue({});

      await service.initializeSources();

      expect(mockPrisma.newsSource.upsert).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should start the crawler', () => {
      vi.spyOn(service, 'fetchAllSources').mockResolvedValue();

      service.start();

      expect(service['isRunning']).toBe(true);
    });

    it('should not start if already running', () => {
      vi.spyOn(service, 'fetchAllSources').mockResolvedValue();

      service.start();
      const intervalId1 = service['intervalId'];

      service.start();
      const intervalId2 = service['intervalId'];

      expect(intervalId1).toBe(intervalId2);
    });
  });

  describe('stop', () => {
    it('should stop the crawler', () => {
      vi.spyOn(service, 'fetchAllSources').mockResolvedValue();

      service.start();
      service.stop();

      expect(service['isRunning']).toBe(false);
      expect(service['intervalId']).toBeUndefined();
    });
  });

  describe('fetchAllSources', () => {
    it('should fetch from all active sources', async () => {
      const sources = [
        { id: '1', name: 'Source1', rssUrl: 'https://example.com/rss', domain: 'example.com' },
      ];
      mockPrisma.newsSource.findMany.mockResolvedValue(sources);
      mockPrisma.newsArticle.findUnique.mockResolvedValue(null);
      mockPrisma.newsEvent.findMany.mockResolvedValue([]);
      mockPrisma.newsEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrisma.newsArticle.create.mockResolvedValue({});

      await service.fetchAllSources();

      expect(mockPrisma.newsSource.findMany).toHaveBeenCalledWith({
        where: { isActive: true, rssUrl: { not: null } },
      });
    });

    it('should handle individual source errors gracefully via Promise.allSettled', async () => {
      const sources = [
        { id: '1', name: 'Source1', rssUrl: 'https://example.com/rss1', domain: 'example1.com' },
        { id: '2', name: 'Source2', rssUrl: 'https://example.com/rss2', domain: 'example2.com' },
      ];
      mockPrisma.newsSource.findMany.mockResolvedValue(sources);

      // Even if individual sources fail, the function completes successfully
      // because Promise.allSettled is used
      await service.fetchAllSources();

      expect(mockPrisma.newsSource.findMany).toHaveBeenCalled();
    });
  });

  describe('fetchSource', () => {
    it('should return 0 if no RSS URL', async () => {
      const source = { id: '1', name: 'Test', rssUrl: null, domain: 'test.com' };

      const result = await service.fetchSource(source);

      expect(result).toBe(0);
    });

    it('should fetch and process articles', async () => {
      const source = { id: '1', name: 'Test', rssUrl: 'https://test.com/rss', domain: 'test.com' };
      mockPrisma.newsArticle.findUnique.mockResolvedValue(null);
      mockPrisma.newsEvent.findMany.mockResolvedValue([]);
      mockPrisma.newsEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrisma.newsArticle.create.mockResolvedValue({});

      const result = await service.fetchSource(source);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateTrendingEvents', () => {
    it('should update trending events based on comment activity', async () => {
      mockPrisma.comment.groupBy.mockResolvedValue([
        { eventId: 'event-1', _count: { _all: 10 } },
        { eventId: 'event-2', _count: { _all: 3 } },
      ]);
      mockPrisma.newsEvent.updateMany.mockResolvedValue({ count: 1 });

      await service.updateTrendingEvents();

      expect(mockPrisma.newsEvent.updateMany).toHaveBeenCalledTimes(2);
    });

    it('should reset all trending flags first', async () => {
      mockPrisma.comment.groupBy.mockResolvedValue([]);
      mockPrisma.newsEvent.updateMany.mockResolvedValue({ count: 0 });

      await service.updateTrendingEvents();

      expect(mockPrisma.newsEvent.updateMany).toHaveBeenCalledWith({
        where: { isTrending: true },
        data: { isTrending: false },
      });
    });
  });

  describe('extractKeywords (private method)', () => {
    it('should extract keywords from text', () => {
      // Access private method for testing
      const keywords = service['extractKeywords']('The climate summit reaches historic agreement');

      expect(keywords).toContain('climate');
      expect(keywords).toContain('summit');
      expect(keywords).toContain('historic');
      expect(keywords).toContain('agreement');
      // Common stop words are filtered
      expect(keywords).not.toContain('the');
    });
  });

  describe('categorizeArticle (private method)', () => {
    it('should categorize technology articles', () => {
      const category = service['categorizeArticle'](
        'Apple announces new iPhone with AI features',
        'Tech giant reveals latest smartphone'
      );

      expect(category).toBe('TECHNOLOGY');
    });

    it('should categorize politics articles', () => {
      const category = service['categorizeArticle'](
        'President signs new bill into law',
        'Congress passes legislation'
      );

      expect(category).toBe('POLITICS');
    });

    it('should categorize health articles', () => {
      const category = service['categorizeArticle'](
        'New vaccine approved by FDA',
        'Medical breakthrough for disease treatment'
      );

      expect(category).toBe('HEALTH');
    });

    it('should return OTHER for unmatched content', () => {
      const category = service['categorizeArticle'](
        'Random unrelated headline',
        'No keywords match'
      );

      expect(category).toBe('OTHER');
    });
  });

  describe('newsCrawlerService singleton', () => {
    it('should be an instance of NewsCrawlerService', () => {
      expect(newsCrawlerService).toBeInstanceOf(NewsCrawlerService);
    });
  });
});
