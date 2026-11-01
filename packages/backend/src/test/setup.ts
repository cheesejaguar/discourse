import { vi, beforeEach, afterEach } from 'vitest';
import { TEST_DATABASE_URL } from './dbConfig.js';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = TEST_DATABASE_URL;

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});
