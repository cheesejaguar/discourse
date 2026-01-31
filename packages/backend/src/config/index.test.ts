import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should load default configuration values', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.JWT_SECRET = 'test-secret';

    const { config } = await import('./index.js');

    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('test');
    expect(config.jwt.secret).toBe('test-secret');
  });

  it('should use default port when not specified', async () => {
    delete process.env.PORT;
    process.env.NODE_ENV = 'test';

    vi.resetModules();
    const { config } = await import('./index.js');

    expect(config.port).toBe(3001);
  });

  it('should detect development mode', async () => {
    process.env.NODE_ENV = 'development';

    vi.resetModules();
    const { config } = await import('./index.js');

    expect(config.isDev).toBe(true);
  });

  it('should detect production mode', async () => {
    process.env.NODE_ENV = 'production';

    vi.resetModules();
    const { config } = await import('./index.js');

    expect(config.isDev).toBe(false);
  });

  it('should load rate limit configuration', async () => {
    process.env.RATE_LIMIT_WINDOW_MS = '120000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '200';

    vi.resetModules();
    const { config } = await import('./index.js');

    expect(config.rateLimit.windowMs).toBe(120000);
    expect(config.rateLimit.maxRequests).toBe(200);
  });

  it('should load CORS origin', async () => {
    process.env.CORS_ORIGIN = 'http://example.com';

    vi.resetModules();
    const { config } = await import('./index.js');

    expect(config.corsOrigin).toBe('http://example.com');
  });

  it('should load Alien.org configuration', async () => {
    process.env.ALIEN_API_URL = 'https://api.alien.test';
    process.env.ALIEN_APP_ID = 'test-app-id';
    process.env.ALIEN_APP_SECRET = 'test-app-secret';

    vi.resetModules();
    const { config } = await import('./index.js');

    expect(config.alien.apiUrl).toBe('https://api.alien.test');
    expect(config.alien.appId).toBe('test-app-id');
    expect(config.alien.appSecret).toBe('test-app-secret');
  });

  it('should load news crawler interval', async () => {
    process.env.NEWS_CRAWLER_INTERVAL_MS = '1800000';

    vi.resetModules();
    const { config } = await import('./index.js');

    expect(config.newsCrawler.intervalMs).toBe(1800000);
  });
});
