import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CONFIG_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'ALIEN_API_URL',
  'ALIEN_APP_ID',
  'ALIEN_APP_SECRET',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'CORS_ORIGIN',
  'NEWS_CRAWLER_INTERVAL_MS',
];

describe('Config', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = Object.fromEntries(CONFIG_ENV_VARS.map((key) => [key, process.env[key]]));
    vi.resetModules();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('should load default configuration values', async () => {
    // Empty strings are not overwritten by dotenv and fall through to the defaults.
    for (const key of CONFIG_ENV_VARS) process.env[key] = '';

    const { config } = await import('./index.js');

    expect(config).toEqual({
      port: 3001,
      nodeEnv: 'development',
      isDev: true,
      databaseUrl: '',
      jwt: { secret: 'dev-secret-change-in-production', expiresIn: '7d' },
      alien: { apiUrl: 'https://api.alien.org', appId: '', appSecret: '' },
      rateLimit: { windowMs: 60000, maxRequests: 100 },
      corsOrigin: 'http://localhost:5173',
      newsCrawler: { intervalMs: 900000 },
    });
  });

  it('should load values from the environment', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const { config } = await import('./index.js');

    expect(config.port).toBe(4000);
    expect(config.nodeEnv).toBe('test');
    expect(config.jwt.secret).toBe('test-secret');
    expect(config.jwt.expiresIn).toBe('1h');
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
