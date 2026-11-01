import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { prisma } from '../db/client.js';
import { config } from '../config/index.js';
import { resetDatabase, createUser } from '../test/db.js';
import { NewsCrawlerService, newsCrawlerService } from './newsCrawler.js';

// RSS feeds are served by a local HTTP server, so the real rss-parser does the
// fetching and parsing and nothing in the crawler is mocked.
const feeds = new Map<string, string>();
let server: http.Server;
let baseUrl: string;

function rss(items: Array<{ title?: string; link?: string; description?: string; creator?: string; pubDate?: string; enclosure?: string }>): string {
  const body = items
    .map(
      (item) => `<item>
        ${item.title !== undefined ? `<title>${item.title}</title>` : ''}
        ${item.link !== undefined ? `<link>${item.link}</link>` : ''}
        ${item.description !== undefined ? `<description>${item.description}</description>` : ''}
        ${item.creator ? `<dc:creator>${item.creator}</dc:creator>` : ''}
        ${item.pubDate ? `<pubDate>${item.pubDate}</pubDate>` : ''}
        ${item.enclosure ? `<enclosure url="${item.enclosure}" type="image/jpeg" length="0"/>` : ''}
      </item>`
    )
    .join('\n');
  return `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Feed</title>${body}</channel></rss>`;
}

async function createSource(name: string, feedPath: string | null, isActive = true) {
  return prisma.newsSource.create({
    data: {
      name,
      domain: `${name.toLowerCase().replace(/\s+/g, '')}.test`,
      rssUrl: feedPath === null ? null : `${baseUrl}${feedPath}`,
      isActive,
    },
  });
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const feed = feeds.get(req.url ?? '');
    if (feed === undefined) {
      res.writeHead(500);
      res.end('boom');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    res.end(feed);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

describe('NewsCrawlerService', () => {
  let service: NewsCrawlerService;

  beforeEach(async () => {
    await resetDatabase();
    feeds.clear();
    service = new NewsCrawlerService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('initializeSources', () => {
    it('should create the predefined news sources', async () => {
      await service.initializeSources();

      const sources = await prisma.newsSource.findMany({ orderBy: { domain: 'asc' } });
      expect(sources.map((s) => s.domain)).toEqual([
        'apnews.com',
        'arstechnica.com',
        'bbc.com',
        'npr.org',
        'reuters.com',
        'techcrunch.com',
        'theguardian.com',
      ]);
      const bbc = sources.find((s) => s.domain === 'bbc.com')!;
      expect(bbc).toMatchObject({
        name: 'BBC News',
        rssUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
        biasRating: 'CENTER',
        isActive: true,
      });
    });

    it('should be idempotent and reactivate existing sources', async () => {
      await service.initializeSources();
      await prisma.newsSource.update({ where: { domain: 'npr.org' }, data: { isActive: false, name: 'Old' } });

      await service.initializeSources();

      expect(await prisma.newsSource.count()).toBe(7);
      const npr = await prisma.newsSource.findUniqueOrThrow({ where: { domain: 'npr.org' } });
      expect(npr).toMatchObject({ name: 'NPR', isActive: true, biasRating: 'CENTER_LEFT' });
    });
  });

  describe('start', () => {
    it('should fetch immediately and then on every configured interval', async () => {
      vi.useFakeTimers();
      const fetchSpy = vi.spyOn(service, 'fetchAllSources').mockResolvedValue();

      service.start();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(config.newsCrawler.intervalMs);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should not start if already running', () => {
      vi.useFakeTimers();
      const fetchSpy = vi.spyOn(service, 'fetchAllSources').mockResolvedValue();

      service.start();
      service.start();
      vi.advanceTimersByTime(config.newsCrawler.intervalMs);

      // One initial fetch plus one interval tick: a second timer was not created.
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop periodic fetching', () => {
      vi.useFakeTimers();
      const fetchSpy = vi.spyOn(service, 'fetchAllSources').mockResolvedValue();

      service.start();
      service.stop();
      vi.advanceTimersByTime(config.newsCrawler.intervalMs * 3);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(service['isRunning']).toBe(false);
    });
  });

  describe('fetchAllSources', () => {
    it('should fetch only active sources with an RSS URL', async () => {
      feeds.set('/active', rss([{ title: 'Active story about markets', link: 'https://news.test/a' }]));
      feeds.set('/inactive', rss([{ title: 'Inactive story', link: 'https://news.test/b' }]));
      await createSource('Active', '/active');
      await createSource('Inactive', '/inactive', false);
      await createSource('NoFeed', null);

      await service.fetchAllSources();

      const articles = await prisma.newsArticle.findMany();
      expect(articles.map((a) => a.url)).toEqual(['https://news.test/a']);
    });

    it('should keep going when one source fails', async () => {
      feeds.set('/good', rss([{ title: 'Good story about science research', link: 'https://news.test/good' }]));
      await createSource('Broken', '/missing');
      await createSource('Good', '/good');

      await service.fetchAllSources();

      expect(await prisma.newsArticle.count()).toBe(1);
      expect(console.log).toHaveBeenCalledWith('Fetch complete: 2 succeeded, 0 failed');
    });
  });

  describe('fetchSource', () => {
    it('should return 0 if no RSS URL', async () => {
      const source = { id: '1', name: 'Test', rssUrl: null, domain: 'test.com' };

      const result = await service.fetchSource(source);

      expect(result).toBe(0);
    });

    it('should return 0 and log when the feed cannot be fetched', async () => {
      const source = await createSource('Broken', '/missing');

      const result = await service.fetchSource(source);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith('Error fetching Broken:', expect.any(Error));
    });

    it('should store new articles with their parsed fields and create an event', async () => {
      feeds.set(
        '/feed',
        rss([
          {
            title: 'Senate passes election reform bill',
            link: 'https://news.test/senate',
            description: 'Congress votes on the government policy package',
            creator: 'Jane Reporter',
            pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
            enclosure: 'https://img.test/senate.jpg',
          },
        ])
      );
      const source = await createSource('Feed', '/feed');

      const result = await service.fetchSource(source);

      expect(result).toBe(1);
      const article = await prisma.newsArticle.findUniqueOrThrow({
        where: { url: 'https://news.test/senate' },
        include: { event: true },
      });
      expect(article).toMatchObject({
        sourceId: source.id,
        title: 'Senate passes election reform bill',
        summary: 'Congress votes on the government policy package',
        author: 'Jane Reporter',
        imageUrl: 'https://img.test/senate.jpg',
        publishedAt: new Date('2024-01-01T12:00:00Z'),
      });
      expect(article.event).toMatchObject({
        title: 'Senate passes election reform bill',
        summary: 'Congress votes on the government policy package',
        category: 'POLITICS',
        isTrending: false,
      });
      expect(article.event!.slug).toMatch(/^senate-passes-election-reform-bill-[a-z0-9]+$/);
    });

    it('should skip items without a title or link and articles already stored', async () => {
      feeds.set(
        '/feed',
        rss([
          { title: 'No link here' },
          { link: 'https://news.test/no-title' },
          { title: 'Fresh technology startup story', link: 'https://news.test/fresh' },
        ])
      );
      const source = await createSource('Feed', '/feed');

      expect(await service.fetchSource(source)).toBe(1);
      expect(await service.fetchSource(source)).toBe(0);
      expect(await prisma.newsArticle.count()).toBe(1);
    });

    it('should group articles with overlapping keywords into one event', async () => {
      feeds.set(
        '/feed',
        rss([
          { title: 'Climate summit reaches historic agreement on carbon', link: 'https://news.test/1' },
          { title: 'Historic climate summit agreement welcomed by leaders', link: 'https://news.test/2' },
          { title: 'Basketball championship game goes to overtime', link: 'https://news.test/3' },
        ])
      );
      const source = await createSource('Feed', '/feed');

      await service.fetchSource(source);

      const events = await prisma.newsEvent.findMany({ include: { articles: true }, orderBy: { createdAt: 'asc' } });
      expect(events.map((e) => [e.category, e.articles.length])).toEqual([
        ['ENVIRONMENT', 2],
        ['SPORTS', 1],
      ]);
    });
  });

  describe('updateTrendingEvents', () => {
    async function createEvent(slug: string, isTrending = false) {
      return prisma.newsEvent.create({
        data: { slug, title: slug, summary: '', category: 'OTHER', isTrending },
      });
    }

    async function addComments(eventId: string, authorId: string, count: number, options: { isDeleted?: boolean; createdAt?: Date } = {}) {
      for (let i = 0; i < count; i++) {
        await prisma.comment.create({
          data: { eventId, authorId, content: `c${i}`, isDeleted: options.isDeleted ?? false, createdAt: options.createdAt },
        });
      }
    }

    it('should mark events with at least 5 recent comments as trending and clear the rest', async () => {
      const author = await createUser();
      const hot = await createEvent('hot');
      const lukewarm = await createEvent('lukewarm');
      const stale = await createEvent('stale', true);
      const deleted = await createEvent('deleted');
      const old = await createEvent('old');
      await addComments(hot.id, author.id, 5);
      await addComments(lukewarm.id, author.id, 4);
      await addComments(deleted.id, author.id, 5, { isDeleted: true });
      await addComments(old.id, author.id, 5, { createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000) });

      await service.updateTrendingEvents();

      const trending = await prisma.newsEvent.findMany({ where: { isTrending: true } });
      expect(trending.map((e) => e.slug)).toEqual(['hot']);
      expect((await prisma.newsEvent.findUniqueOrThrow({ where: { id: stale.id } })).isTrending).toBe(false);
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

    // categorizeArticle matches keywords as raw substrings, so the TECHNOLOGY
    // keyword 'ai' fires on ordinary words like "said", "praised" or "again".
    it.fails('should not treat "ai" inside other words as a technology keyword (known bug: substring keyword matching)', () => {
      const category = service['categorizeArticle'](
        'Climate report praised',
        'Officials said'
      );

      expect(category).toBe('ENVIRONMENT');
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
