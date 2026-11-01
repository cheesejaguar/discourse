import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { resetFetchLog, unhandledRequests } from './fetch';

// The backend is the only external boundary: stub fetch globally.
// Tests install routes with mockFetch() from ./fetch.
global.fetch = vi.fn();

// window.matchMedia is not implemented by jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Reset mocks and real app state before each test
beforeEach(() => {
  vi.clearAllMocks();
  resetFetchLog();
  localStorage.clear();
  api.setToken(null);
  useAuthStore.setState({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
  });
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (unhandledRequests.length > 0) {
    const unhandled = [...unhandledRequests];
    resetFetchLog();
    throw new Error(`Test made requests with no mocked route: ${unhandled.join(', ')}`);
  }
});
