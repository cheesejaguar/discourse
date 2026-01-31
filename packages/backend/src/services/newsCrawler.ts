import RSSParser from 'rss-parser';
import { prisma } from '../db/client.js';
import { config } from '../config/index.js';
import { generateSlug } from '@hvnp/shared';
import type { NewsCategory, BiasRating } from '@prisma/client';

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  isoDate?: string;
  enclosure?: {
    url?: string;
  };
}

interface NewsSourceConfig {
  name: string;
  domain: string;
  rssUrl: string;
  biasRating: BiasRating;
  logoUrl?: string;
  defaultCategory: NewsCategory;
}

// Predefined news sources with their configurations
const NEWS_SOURCES: NewsSourceConfig[] = [
  {
    name: 'BBC News',
    domain: 'bbc.com',
    rssUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    biasRating: 'CENTER',
    logoUrl: 'https://news.bbcimg.co.uk/nol/shared/img/bbc_news_120x60.gif',
    defaultCategory: 'WORLD',
  },
  {
    name: 'Reuters',
    domain: 'reuters.com',
    rssUrl: 'https://www.reutersagency.com/feed/',
    biasRating: 'CENTER',
    logoUrl: 'https://www.reuters.com/pf/resources/images/reuters/logo-vertical-default.png',
    defaultCategory: 'WORLD',
  },
  {
    name: 'The Guardian',
    domain: 'theguardian.com',
    rssUrl: 'https://www.theguardian.com/world/rss',
    biasRating: 'LEFT',
    logoUrl: 'https://assets.guim.co.uk/images/favicons/guardian.ico',
    defaultCategory: 'WORLD',
  },
  {
    name: 'NPR',
    domain: 'npr.org',
    rssUrl: 'https://feeds.npr.org/1001/rss.xml',
    biasRating: 'CENTER_LEFT',
    logoUrl: 'https://media.npr.org/images/ico/favicon.ico',
    defaultCategory: 'POLITICS',
  },
  {
    name: 'Associated Press',
    domain: 'apnews.com',
    rssUrl: 'https://rsshub.app/apnews/topics/apf-topnews',
    biasRating: 'CENTER',
    logoUrl: 'https://www.ap.org/assets/images/apple-touch-icon.png',
    defaultCategory: 'WORLD',
  },
  {
    name: 'TechCrunch',
    domain: 'techcrunch.com',
    rssUrl: 'https://techcrunch.com/feed/',
    biasRating: 'CENTER',
    logoUrl: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
    defaultCategory: 'TECHNOLOGY',
  },
  {
    name: 'Ars Technica',
    domain: 'arstechnica.com',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    biasRating: 'CENTER_LEFT',
    logoUrl: 'https://cdn.arstechnica.net/wp-content/uploads/2016/10/cropped-ars-logo-512_480-32x32.png',
    defaultCategory: 'TECHNOLOGY',
  },
];

/**
 * News Crawler Service
 * Fetches articles from RSS feeds and aggregates them into events
 */
export class NewsCrawlerService {
  private parser: RSSParser;
  private isRunning: boolean = false;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      headers: {
        'User-Agent': 'HumanVerifiedNewsPlatform/1.0 (News Aggregator)',
      },
    });
  }

  /**
   * Initialize news sources in the database
   */
  async initializeSources(): Promise<void> {
    console.log('Initializing news sources...');

    for (const source of NEWS_SOURCES) {
      await prisma.newsSource.upsert({
        where: { domain: source.domain },
        update: {
          name: source.name,
          rssUrl: source.rssUrl,
          biasRating: source.biasRating,
          logoUrl: source.logoUrl,
          isActive: true,
        },
        create: {
          name: source.name,
          domain: source.domain,
          rssUrl: source.rssUrl,
          biasRating: source.biasRating,
          logoUrl: source.logoUrl,
          isActive: true,
        },
      });
    }

    console.log(`Initialized ${NEWS_SOURCES.length} news sources`);
  }

  /**
   * Start the crawler with periodic fetching
   */
  start(): void {
    if (this.isRunning) {
      console.log('Crawler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting news crawler...');

    // Initial fetch
    this.fetchAllSources();

    // Periodic fetch
    this.intervalId = setInterval(() => {
      this.fetchAllSources();
    }, config.newsCrawler.intervalMs);
  }

  /**
   * Stop the crawler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('News crawler stopped');
  }

  /**
   * Fetch articles from all active sources
   */
  async fetchAllSources(): Promise<void> {
    console.log('Fetching from all news sources...');

    const sources = await prisma.newsSource.findMany({
      where: { isActive: true, rssUrl: { not: null } },
    });

    const results = await Promise.allSettled(
      sources.map((source) => this.fetchSource(source))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`Fetch complete: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * Fetch articles from a single source
   */
  async fetchSource(source: { id: string; name: string; rssUrl: string | null; domain: string }): Promise<number> {
    if (!source.rssUrl) {
      return 0;
    }

    try {
      const feed = await this.parser.parseURL(source.rssUrl);
      let newArticles = 0;

      for (const item of feed.items.slice(0, 20)) {
        const created = await this.processArticle(item, source);
        if (created) newArticles++;
      }

      console.log(`${source.name}: fetched ${newArticles} new articles`);
      return newArticles;
    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error);
      return 0;
    }
  }

  /**
   * Process a single RSS item into an article
   */
  private async processArticle(
    item: RSSItem,
    source: { id: string; name: string; domain: string }
  ): Promise<boolean> {
    if (!item.title || !item.link) {
      return false;
    }

    // Check if article already exists
    const existingArticle = await prisma.newsArticle.findUnique({
      where: { url: item.link },
    });

    if (existingArticle) {
      return false;
    }

    // Determine category from title/content
    const category = this.categorizeArticle(item.title, item.contentSnippet || '');

    // Find or create an event for this article
    const event = await this.findOrCreateEvent(item.title, item.contentSnippet || '', category);

    // Create the article
    await prisma.newsArticle.create({
      data: {
        sourceId: source.id,
        eventId: event.id,
        title: item.title,
        url: item.link,
        summary: item.contentSnippet?.substring(0, 500) || null,
        imageUrl: item.enclosure?.url || null,
        author: item.creator || null,
        publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
      },
    });

    return true;
  }

  /**
   * Find an existing event that matches or create a new one
   */
  private async findOrCreateEvent(
    title: string,
    summary: string,
    category: NewsCategory
  ): Promise<{ id: string }> {
    // Simple keyword-based matching for now
    // In production, use NLP/ML for better clustering
    const keywords = this.extractKeywords(title);

    if (keywords.length > 0) {
      // Try to find an existing event with similar keywords
      const recentEvents = await prisma.newsEvent.findMany({
        where: {
          category,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      for (const event of recentEvents) {
        const eventKeywords = this.extractKeywords(event.title);
        const overlap = keywords.filter((k) => eventKeywords.includes(k));

        // If more than 30% keyword overlap, consider it the same event
        if (overlap.length >= Math.min(2, keywords.length * 0.3)) {
          return event;
        }
      }
    }

    // Create a new event
    const slug = generateSlug(title) + '-' + Date.now().toString(36);

    const event = await prisma.newsEvent.create({
      data: {
        slug,
        title,
        summary: summary.substring(0, 500),
        category,
        isTrending: false,
      },
    });

    return event;
  }

  /**
   * Extract keywords from text for matching
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
      'we', 'you', 'i', 'my', 'your', 'his', 'her', 'their', 'our',
      'says', 'said', 'new', 'after', 'before', 'over', 'into',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  /**
   * Categorize an article based on its content
   */
  private categorizeArticle(title: string, content: string): NewsCategory {
    const text = (title + ' ' + content).toLowerCase();

    const categoryKeywords: Record<NewsCategory, string[]> = {
      POLITICS: ['president', 'congress', 'senate', 'election', 'vote', 'government', 'policy', 'democrat', 'republican', 'political'],
      TECHNOLOGY: ['tech', 'software', 'app', 'startup', 'ai', 'artificial intelligence', 'google', 'apple', 'microsoft', 'amazon', 'meta', 'cyber'],
      BUSINESS: ['market', 'stock', 'economy', 'trade', 'company', 'ceo', 'investment', 'finance', 'bank', 'revenue'],
      SCIENCE: ['research', 'study', 'scientist', 'discovery', 'space', 'nasa', 'physics', 'biology', 'chemistry'],
      HEALTH: ['health', 'medical', 'doctor', 'hospital', 'disease', 'vaccine', 'covid', 'treatment', 'fda', 'drug'],
      SPORTS: ['game', 'team', 'player', 'championship', 'nfl', 'nba', 'mlb', 'soccer', 'football', 'basketball'],
      ENTERTAINMENT: ['movie', 'film', 'music', 'celebrity', 'hollywood', 'netflix', 'streaming', 'concert', 'award'],
      WORLD: ['international', 'country', 'foreign', 'global', 'united nations', 'diplomat'],
      ENVIRONMENT: ['climate', 'environment', 'carbon', 'pollution', 'renewable', 'energy', 'green', 'sustainable'],
      OTHER: [],
    };

    let maxScore = 0;
    let bestCategory: NewsCategory = 'OTHER';

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter((kw) => text.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as NewsCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Update trending status based on comment activity
   */
  async updateTrendingEvents(): Promise<void> {
    // Get events with high recent comment activity
    const recentComments = await prisma.comment.groupBy({
      by: ['eventId'],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000), // Last 6 hours
        },
        isDeleted: false,
      },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const trendingEventIds = recentComments
      .filter((c) => c._count._all >= 5)
      .map((c) => c.eventId);

    // Reset all trending flags
    await prisma.newsEvent.updateMany({
      where: { isTrending: true },
      data: { isTrending: false },
    });

    // Set trending for active events
    if (trendingEventIds.length > 0) {
      await prisma.newsEvent.updateMany({
        where: { id: { in: trendingEventIds } },
        data: { isTrending: true },
      });
    }

    console.log(`Updated trending: ${trendingEventIds.length} events marked as trending`);
  }
}

export const newsCrawlerService = new NewsCrawlerService();
