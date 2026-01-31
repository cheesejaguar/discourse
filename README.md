# Human-Verified News Platform

A universal news commentary platform that aggregates news stories from multiple sources and provides a human-verified comment section for each story. Every commenter is verified as human via Alien.org's identity technology.

## Features

- **Multi-Source News Aggregation**: Collates coverage of events from outlets like CNN, BBC, The New York Times, etc.
- **Human-Only Discussions**: All users verified through Alien.org's Continuous Human Verification Protocol
- **Reddit-Style Comments**: Upvotes, downvotes, and nested replies
- **Source Bias Indicators**: Visual indicators showing political leaning of news sources
- **API-First Architecture**: Modular backend ready for mobile apps

## Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Authentication**: Alien.org integration (mock for development)
- **State Management**: Zustand

## Project Structure

```
packages/
├── shared/        # Shared types and utilities
├── backend/       # Express.js API server
└── frontend/      # React web application
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd discourse
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database credentials
```

4. Set up the database:
```bash
npm run db:migrate -w @hvnp/backend
npm run db:seed -w @hvnp/backend
```

5. Start development servers:
```bash
npm run dev
```

The backend will run on http://localhost:3001 and frontend on http://localhost:5173.

## API Endpoints

### Authentication
- `POST /api/auth/challenge` - Generate Alien.org auth challenge
- `POST /api/auth/verify` - Verify Alien.org authentication
- `POST /api/auth/dev-login` - Development login (dev only)
- `POST /api/auth/logout` - End current session
- `GET /api/auth/me` - Get current user profile
- `PATCH /api/auth/me` - Update current user profile

### News Events
- `GET /api/events` - List news events (with pagination/filtering)
- `GET /api/events/trending` - Get trending news events
- `GET /api/events/categories` - Get event counts by category
- `GET /api/events/:eventId` - Get single event with articles

### Comments
- `GET /api/comments` - List comments for an event
- `POST /api/comments` - Create a new comment
- `PATCH /api/comments/:commentId` - Edit a comment
- `DELETE /api/comments/:commentId` - Delete a comment

### Votes
- `POST /api/votes/:commentId` - Vote on a comment
- `DELETE /api/votes/:commentId` - Remove vote

### Users
- `GET /api/users/:userId` - Get user profile
- `GET /api/users/:userId/comments` - Get user comment history

### Reports
- `POST /api/reports` - Report a comment

## Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
```

### Database Management
```bash
# Generate Prisma client
npm run db:generate -w @hvnp/backend

# Run migrations
npm run db:migrate -w @hvnp/backend

# Open Prisma Studio
npm run db:studio -w @hvnp/backend

# Seed database
npm run db:seed -w @hvnp/backend
```

## Architecture

### News Aggregation
The platform crawls RSS feeds from configured news sources and clusters articles about the same event using keyword matching. Each news event aggregates multiple source articles with bias indicators.

### Comment System
Reddit-style nested comments with:
- Wilson score ranking for "best" sorting
- Controversy score for contentious discussions
- Edit window (10 minutes)
- Soft deletion preserving thread structure

### Authentication
Alien.org integration provides:
- QR code-based authentication
- One human = one account (Sybil resistance)
- Privacy-preserving verification
- Session-based access tokens

## License

MIT
