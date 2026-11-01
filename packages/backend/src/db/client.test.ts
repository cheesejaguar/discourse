import { describe, it, expect, vi, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DATABASE_URL } from '../test/dbConfig.js';

type GlobalWithPrisma = typeof globalThis & { prisma?: PrismaClient };

describe('Database Client', () => {
  afterEach(() => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
  });

  describe('prisma', () => {
    it('should export a PrismaClient connected to the configured database', async () => {
      const { prisma } = await import('./client.js');

      expect(prisma).toBeInstanceOf(PrismaClient);
      const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
      expect(rows).toEqual([{ db: 'hvnp_test' }]);
    });

    it('should reuse the global client outside production', async () => {
      const { prisma } = await import('./client.js');

      expect((globalThis as GlobalWithPrisma).prisma).toBe(prisma);
    });
  });

  describe('connectDatabase', () => {
    it('should connect to database', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { connectDatabase, prisma } = await import('./client.js');

      await connectDatabase();

      expect(logSpy).toHaveBeenCalledWith('Database connected successfully');
      await expect(prisma.user.count()).resolves.toBeTypeOf('number');
    });

    it('should exit process on connection failure', async () => {
      // process.exit would kill the test runner, so it is the one thing stubbed here.
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const g = globalThis as GlobalWithPrisma;
      const sharedClient = g.prisma;

      g.prisma = undefined;
      process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/unreachable';
      vi.resetModules();
      const { connectDatabase, prisma } = await import('./client.js');

      try {
        await connectDatabase();

        expect(mockExit).toHaveBeenCalledWith(1);
        expect(errorSpy).toHaveBeenCalledWith('Failed to connect to database:', expect.any(Error));
      } finally {
        await prisma.$disconnect();
        g.prisma = sharedClient;
        vi.resetModules();
      }
    });
  });

  describe('disconnectDatabase', () => {
    it('should disconnect from database', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { disconnectDatabase } = await import('./client.js');

      await disconnectDatabase();

      expect(logSpy).toHaveBeenCalledWith('Database disconnected');
    });
  });
});
