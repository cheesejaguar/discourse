import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  api,
  ApiError,
  authApi,
  eventsApi,
  commentsApi,
  votesApi,
  usersApi,
  reportsApi,
} from './api';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.setToken(null);
  });

  describe('api core', () => {
    it('should set and get token', () => {
      api.setToken('test-token');
      expect(api.getToken()).toBe('test-token');
    });

    it('should clear token', () => {
      api.setToken('test-token');
      api.setToken(null);
      expect(api.getToken()).toBeNull();
    });

    it('should include auth header when token is set', async () => {
      api.setToken('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await api.get('/test', { page: 1, search: 'query' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test?page=1&search=query',
        expect.any(Object)
      );
    });

    it('should skip undefined query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await api.get('/test', { page: 1, search: undefined });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test?page=1',
        expect.any(Object)
      );
    });

    it('should throw ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
          }),
      });

      await expect(api.get('/test')).rejects.toThrow(ApiError);
    });

    it('should make POST requests with body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await api.post('/test', { name: 'value' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'value' }),
        })
      );
    });

    it('should make PATCH requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await api.patch('/test', { name: 'value' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    it('should make DELETE requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await api.delete('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('ApiError', () => {
    it('should create error with correct properties', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 400);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.status).toBe(400);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('authApi', () => {
    it('should call devLogin endpoint', async () => {
      const mockResponse = {
        user: { id: '1', displayName: 'Test' },
        token: 'token',
        expiresAt: '2024-12-31',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockResponse }),
      });

      const result = await authApi.devLogin('TestUser');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/dev-login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ displayName: 'TestUser' }),
        })
      );
    });

    it('should call getMe endpoint', async () => {
      const mockUser = { id: '1', displayName: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockUser }),
      });

      const result = await authApi.getMe();

      expect(result).toEqual(mockUser);
    });

    it('should call updateProfile endpoint', async () => {
      const mockUser = { id: '1', displayName: 'NewName' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockUser }),
      });

      const result = await authApi.updateProfile({ displayName: 'NewName' });

      expect(result).toEqual(mockUser);
    });

    it('should call logout endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await authApi.logout();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('eventsApi', () => {
    it('should list events', async () => {
      const mockEvents = [{ id: '1', title: 'Event 1' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockEvents,
            pagination: { page: 1, total: 1 },
          }),
      });

      const result = await eventsApi.list({ page: 1 });

      expect(result.events).toEqual(mockEvents);
    });

    it('should get trending events', async () => {
      const mockEvents = [{ id: '1', title: 'Trending' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockEvents }),
      });

      const result = await eventsApi.getTrending(5);

      expect(result).toEqual(mockEvents);
    });

    it('should get categories', async () => {
      const mockCategories = [{ category: 'tech', count: 10 }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockCategories }),
      });

      const result = await eventsApi.getCategories();

      expect(result).toEqual(mockCategories);
    });

    it('should get event by id', async () => {
      const mockEvent = { id: '1', title: 'Event' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockEvent }),
      });

      const result = await eventsApi.getById('1');

      expect(result).toEqual(mockEvent);
    });

    it('should get related events', async () => {
      const mockEvents = [{ id: '2', title: 'Related' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockEvents }),
      });

      const result = await eventsApi.getRelated('1', 5);

      expect(result).toEqual(mockEvents);
    });
  });

  describe('commentsApi', () => {
    it('should list comments', async () => {
      const mockComments = [{ id: '1', content: 'Comment' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockComments,
            pagination: { page: 1, total: 1 },
          }),
      });

      const result = await commentsApi.list({ eventId: 'e1' });

      expect(result.comments).toEqual(mockComments);
    });

    it('should get comment by id', async () => {
      const mockComment = { id: '1', content: 'Comment' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockComment }),
      });

      const result = await commentsApi.getById('1');

      expect(result).toEqual(mockComment);
    });

    it('should create comment', async () => {
      const mockComment = { id: '1', content: 'New comment' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockComment }),
      });

      const result = await commentsApi.create({
        eventId: 'e1',
        content: 'New comment',
      });

      expect(result).toEqual(mockComment);
    });

    it('should update comment', async () => {
      const mockComment = { id: '1', content: 'Updated' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockComment }),
      });

      const result = await commentsApi.update('1', 'Updated');

      expect(result).toEqual(mockComment);
    });

    it('should delete comment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await commentsApi.delete('1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/comments/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should get replies', async () => {
      const mockReplies = [{ id: '2', content: 'Reply' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockReplies,
            pagination: { page: 1, total: 1 },
          }),
      });

      const result = await commentsApi.getReplies('1');

      expect(result.comments).toEqual(mockReplies);
    });
  });

  describe('votesApi', () => {
    it('should vote on comment', async () => {
      const mockResult = {
        commentId: '1',
        score: 5,
        upvotes: 6,
        downvotes: 1,
        userVote: 'UP',
        action: 'created',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockResult }),
      });

      const result = await votesApi.vote('1', 'UP');

      expect(result).toEqual(mockResult);
    });

    it('should remove vote', async () => {
      const mockResult = {
        commentId: '1',
        score: 4,
        upvotes: 5,
        downvotes: 1,
        userVote: null,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockResult }),
      });

      const result = await votesApi.removeVote('1');

      expect(result).toEqual(mockResult);
    });

    it('should get user votes', async () => {
      const mockVotes = { '1': 'UP', '2': 'DOWN' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockVotes }),
      });

      const result = await votesApi.getUserVotes(['1', '2']);

      expect(result).toEqual(mockVotes);
    });
  });

  describe('usersApi', () => {
    it('should get user by id', async () => {
      const mockUser = { id: '1', displayName: 'User' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockUser }),
      });

      const result = await usersApi.getById('1');

      expect(result).toEqual(mockUser);
    });

    it('should get user comments', async () => {
      const mockComments = [{ id: '1', content: 'Comment' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockComments,
            pagination: { page: 1, total: 1 },
          }),
      });

      const result = await usersApi.getComments('1');

      expect(result.comments).toEqual(mockComments);
    });
  });

  describe('reportsApi', () => {
    it('should create report', async () => {
      const mockResult = { id: 'r1' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockResult }),
      });

      const result = await reportsApi.create({
        commentId: '1',
        reason: 'spam',
      });

      expect(result).toEqual(mockResult);
    });
  });
});
