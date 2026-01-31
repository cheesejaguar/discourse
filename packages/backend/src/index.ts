import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { newsCrawlerService } from './services/newsCrawler.js';

// Import routes
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import commentsRoutes from './routes/comments.js';
import votesRoutes from './routes/votes.js';
import usersRoutes from './routes/users.js';
import reportsRoutes from './routes/reports.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Request parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use('/api', generalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Human-Verified News Platform API',
    version: '1.0.0',
    description: 'API for aggregated news with human-verified discussions',
    endpoints: {
      auth: {
        'POST /api/auth/challenge': 'Generate Alien.org auth challenge',
        'POST /api/auth/verify': 'Verify Alien.org authentication',
        'POST /api/auth/dev-login': 'Development login (dev only)',
        'POST /api/auth/logout': 'End current session',
        'GET /api/auth/me': 'Get current user profile',
        'PATCH /api/auth/me': 'Update current user profile',
        'GET /api/auth/sessions': 'List active sessions',
        'DELETE /api/auth/sessions/:sessionId': 'End specific session',
      },
      events: {
        'GET /api/events': 'List news events (with pagination/filtering)',
        'GET /api/events/trending': 'Get trending news events',
        'GET /api/events/categories': 'Get event counts by category',
        'GET /api/events/:eventId': 'Get single event with articles',
        'GET /api/events/:eventId/related': 'Get related events',
      },
      comments: {
        'GET /api/comments': 'List comments for an event',
        'GET /api/comments/:commentId': 'Get comment with replies',
        'POST /api/comments': 'Create a new comment',
        'PATCH /api/comments/:commentId': 'Edit a comment',
        'DELETE /api/comments/:commentId': 'Delete a comment',
        'GET /api/comments/:commentId/replies': 'Get comment replies',
      },
      votes: {
        'POST /api/votes/:commentId': 'Vote on a comment',
        'DELETE /api/votes/:commentId': 'Remove vote',
        'GET /api/votes/user': 'Get user votes for comments',
      },
      users: {
        'GET /api/users/:userId': 'Get user profile',
        'GET /api/users/:userId/comments': 'Get user comment history',
        'GET /api/users/search': 'Search users',
      },
      reports: {
        'POST /api/reports': 'Report a comment',
        'GET /api/reports/my-reports': 'Get submitted reports',
      },
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  newsCrawlerService.stop();
  await disconnectDatabase();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize news sources
    await newsCrawlerService.initializeSources();

    // Start news crawler
    newsCrawlerService.start();

    // Start Express server
    app.listen(config.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Human-Verified News Platform API                        ║
║                                                           ║
║   Server running on http://localhost:${config.port}              ║
║   Environment: ${config.nodeEnv.padEnd(40)}║
║                                                           ║
║   API Documentation: http://localhost:${config.port}/api         ║
║   Health Check: http://localhost:${config.port}/health           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app };
