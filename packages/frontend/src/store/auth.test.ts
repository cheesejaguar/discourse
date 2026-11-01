import { describe, it, expect } from 'vitest';
import { useAuthStore } from './auth';
import { api, type User } from '../lib/api';
import { mockFetch, ok, fail, requests, requestsTo } from '../test/fetch';

const testUser: User = {
  id: '1',
  displayName: 'TestUser',
  karma: 100,
  isVerified: true,
  createdAt: '2024-01-01',
};

describe('Auth Store', () => {
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
      useAuthStore.getState().setUser(testUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(testUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should clear authentication when user is null', () => {
      useAuthStore.setState({ user: testUser, isAuthenticated: true });

      useAuthStore.getState().setUser(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setToken', () => {
    it('should store the token and use it for API requests', () => {
      useAuthStore.getState().setToken('test-token');

      expect(useAuthStore.getState().token).toBe('test-token');
      expect(api.getToken()).toBe('test-token');
    });

    it('should clear token', () => {
      useAuthStore.getState().setToken('test-token');
      useAuthStore.getState().setToken(null);

      expect(useAuthStore.getState().token).toBeNull();
      expect(api.getToken()).toBeNull();
    });

    it('should persist only the token to localStorage', () => {
      useAuthStore.setState({ user: testUser, isAuthenticated: true });
      useAuthStore.getState().setToken('persisted-token');

      const stored = JSON.parse(localStorage.getItem('auth-storage')!);
      expect(stored.state).toEqual({ token: 'persisted-token' });
    });
  });

  describe('login', () => {
    it('should login via dev-login and authenticate subsequent requests', async () => {
      mockFetch({
        'POST /auth/dev-login': ok({ user: testUser, token: 'test-token', expiresAt: '2024-12-31' }),
      });

      await useAuthStore.getState().login('TestUser');

      expect(requests[0].body).toEqual({ displayName: 'TestUser' });
      const state = useAuthStore.getState();
      expect(state.user).toEqual(testUser);
      expect(state.token).toBe('test-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(api.getToken()).toBe('test-token');
    });

    it('should set isLoading while the login request is in flight', async () => {
      let release!: () => void;
      mockFetch({
        'POST /auth/dev-login': () =>
          new Promise((resolve) => {
            release = () => resolve(ok({ user: testUser, token: 't', expiresAt: '2024-12-31' }));
          }),
      });

      const loginPromise = useAuthStore.getState().login();
      expect(useAuthStore.getState().isLoading).toBe(true);

      await new Promise((r) => setTimeout(r, 0));
      release();
      await loginPromise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should surface the server error and stay logged out', async () => {
      mockFetch({ 'POST /auth/dev-login': fail(400, 'VALIDATION_ERROR', 'Display name taken') });

      await expect(useAuthStore.getState().login('Taken')).rejects.toThrow('Display name taken');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
    });
  });

  describe('logout', () => {
    it('should call the logout endpoint with the token and clear state', async () => {
      useAuthStore.setState({ user: testUser, isAuthenticated: true });
      useAuthStore.getState().setToken('test-token');
      mockFetch({ 'POST /auth/logout': ok() });

      await useAuthStore.getState().logout();

      expect(requests[0].headers.Authorization).toBe('Bearer test-token');
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(api.getToken()).toBeNull();
    });

    it('should clear state even on logout error', async () => {
      useAuthStore.setState({ user: testUser, token: 'test-token', isAuthenticated: true });
      mockFetch({ 'POST /auth/logout': fail(500, 'INTERNAL_ERROR', 'Logout failed') });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('refreshUser', () => {
    it('should fetch /auth/me with the stored token and set the user', async () => {
      useAuthStore.setState({ token: 'test-token' });
      mockFetch({ 'GET /auth/me': ok({ ...testUser, commentCount: 3, totalUpvotes: 10 }) });

      await useAuthStore.getState().refreshUser();

      expect(requests[0].headers.Authorization).toBe('Bearer test-token');
      const state = useAuthStore.getState();
      expect(state.user).toMatchObject(testUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should not hit the network when there is no token', async () => {
      mockFetch({});

      await useAuthStore.getState().refreshUser();

      expect(fetch).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should clear state when the token is rejected', async () => {
      useAuthStore.setState({ user: testUser, token: 'invalid-token', isAuthenticated: true });
      mockFetch({ 'GET /auth/me': fail(401, 'AUTH_INVALID_TOKEN', 'Invalid token') });

      await useAuthStore.getState().refreshUser();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(api.getToken()).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should PATCH the profile and store the returned user', async () => {
      const updatedUser = { ...testUser, displayName: 'NewName' };
      mockFetch({ 'PATCH /auth/me': ok(updatedUser) });

      await useAuthStore.getState().updateProfile({ displayName: 'NewName' });

      expect(requestsTo('PATCH /auth/me')[0].body).toEqual({ displayName: 'NewName' });
      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });
  });
});
