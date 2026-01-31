import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PrismaClient
const mockPrismaInstance = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrismaInstance),
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    isDev: true,
  },
}));

describe('Database Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prisma', () => {
    it('should export prisma client', async () => {
      const { prisma } = await import('./client.js');

      expect(prisma).toBeDefined();
    });
  });

  describe('connectDatabase', () => {
    it('should connect to database', async () => {
      mockPrismaInstance.$connect.mockResolvedValue(undefined);
      const { connectDatabase, prisma } = await import('./client.js');

      await connectDatabase();

      expect(prisma.$connect).toHaveBeenCalled();
    });

    it('should exit process on connection failure', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      mockPrismaInstance.$connect.mockRejectedValue(new Error('Connection failed'));

      vi.resetModules();
      const { connectDatabase } = await import('./client.js');

      await connectDatabase();

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('disconnectDatabase', () => {
    it('should disconnect from database', async () => {
      mockPrismaInstance.$disconnect.mockResolvedValue(undefined);
      const { disconnectDatabase, prisma } = await import('./client.js');

      await disconnectDatabase();

      expect(prisma.$disconnect).toHaveBeenCalled();
    });
  });
});
