import { prisma } from '../db/client.js';

/**
 * Empties every table in the test database. Call from beforeEach in tests
 * that touch the database so each test starts from a known state.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "reports", "votes", "comments", "news_articles", "news_events", "news_sources", "sessions", "users" CASCADE'
  );
}

let counter = 0;

export async function createUser(overrides: Partial<{ displayName: string; isBanned: boolean; banReason: string | null }> = {}) {
  counter++;
  return prisma.user.create({
    data: {
      alienId: `alien-${counter}-${Date.now()}`,
      displayName: overrides.displayName ?? `User${counter}${Date.now()}`,
      isBanned: overrides.isBanned ?? false,
      banReason: overrides.banReason ?? null,
    },
  });
}
