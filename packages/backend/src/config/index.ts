import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Alien.org
  alien: {
    apiUrl: process.env.ALIEN_API_URL || 'https://api.alien.org',
    appId: process.env.ALIEN_APP_ID || '',
    appSecret: process.env.ALIEN_APP_SECRET || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // News Crawler
  newsCrawler: {
    intervalMs: parseInt(process.env.NEWS_CRAWLER_INTERVAL_MS || '900000', 10),
  },
};

export type Config = typeof config;
