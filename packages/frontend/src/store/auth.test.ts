import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './auth';
import { api } from '../lib/api';

// Mock the API
vi.mock('../lib/api', () => ({
  api: {
    setToken: vi.fn(),
    getToken: vi.fn(),
  },
  authApi: {
    devLogin: vi.fn(),
    getMe: vi.fn(),
    updateProfile: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should set user and isAuthenticated', () => {
      const mockUser = {
        id: '1',
        displayName: 'TestUser',
        karma: 100,
        isVerified: true,
        createdAt: '2024-01-01',
      };

      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should clear authentication when user is null', () => {
      useAuthStore.setState({ user: { id: '1' } as any, isAuthenticated: true });

      useAuthStore.getState().setUser(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setToken', () => {
    it('should set token and call api.setToken', () => {
      useAuthStore.getState().setToken('test-token');

      expect(api.setToken).toHaveBeenCalledWith('test-token');
      expect(useAuthStore.getState().token).toBe('test-token');
    });

    it('should clear token', () => {
      useAuthStore.getState().setToken(null);

      expect(api.setToken).toHaveBeenCalledWith(null);
      expect(useAuthStore.getState().token).toBeNull();
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const mockUser = {
        id: '1',
        displayName: 'TestUser',
        karma: 100,
        isVerified: true,
        createdAt: '2024-01-01',
      };
      const mockResponse = {
        user: mockUser,
        token: 'test-token',
        expiresAt: '2024-12-31',
      };

      const { authApi } = await import('../lib/api');
      vi.mocked(authApi.devLogin).mockResolvedValue(mockResponse);

      await useAuthStore.getState().login('TestUser');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('test-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle login error', async () => {
      const { authApi } = await import('../lib/api');
      vi.mocked(authApi.devLogin).mockRejectedValue(new Error('Login failed'));

      await expect(useAuthStore.getState().login()).rejects.toThrow('Login failed');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      useAuthStore.setState({
        user: { id: '1' } as any,
        token: 'test-token',
        isAuthenticated: true,
      });

      const { authApi } = await import('../lib/api');
      vi.mocked(authApi.logout).mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should clear state even on logout error', async () => {
      useAuthStore.setState({
        user: { id: '1' } as any,
        token: 'test-token',
        isAuthenticated: true,
      });

      const { authApi } = await import('../lib/api');
      vi.mocked(authApi.logout).mockRejectedValue(new Error('Logout failed'));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('refreshUser', () => {
    it('should refresh user when token exists', async () => {
      const mockUser = {
        id: '1',
        displayName: 'TestUser',
        karma: 100,
        isVerified: true,
        createdAt: '2024-01-01',
      };

      useAuthStore.setState({ token: 'test-token' });

      const { authApi } = await import('../lib/api');
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser as any);

      await useAuthStore.getState().refreshUser();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should do nothing when no token', async () => {
      useAuthStore.setState({ token: null });

      await useAuthStore.getState().refreshUser();

      const { authApi } = await import('../lib/api');
      expect(authApi.getMe).not.toHaveBeenCalled();
    });

    it('should clear state on refresh error', async () => {
      useAuthStore.setState({
        user: { id: '1' } as any,
        token: 'invalid-token',
        isAuthenticated: true,
      });

      const { authApi } = await import('../lib/api');
      vi.mocked(authApi.getMe).mockRejectedValue(new Error('Token invalid'));

      await useAuthStore.getState().refreshUser();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updatedUser = {
        id: '1',
        displayName: 'NewName',
        karma: 100,
        isVerified: true,
        createdAt: '2024-01-01',
      };

      const { authApi } = await import('../lib/api');
      vi.mocked(authApi.updateProfile).mockResolvedValue(updatedUser);

      await useAuthStore.getState().updateProfile({ displayName: 'NewName' });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(updatedUser);
    });
  });
});
