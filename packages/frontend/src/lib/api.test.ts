import { describe, it, expect, beforeEach } from 'vitest';
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
import { mockFetch, ok, fail, requests, MockReply } from '../test/fetch';

const pagination = { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false };

describe('API Client', () => {
  beforeEach(() => {
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

    it('should send JSON content type and no auth header without a token', async () => {
      mockFetch({ 'GET /test': ok({}) });

      await api.get('/test');

      expect(requests[0].headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should include auth header when token is set', async () => {
      api.setToken('test-token');
      mockFetch({ 'GET /test': ok({}) });

      await api.get('/test');

      expect(requests[0].headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      });
    });

    it('should handle query parameters', async () => {
      mockFetch({ 'GET /test': ok({}) });

      await api.get('/test', { page: 1, search: 'query', trending: true });

      expect(fetch).toHaveBeenCalledWith(
        '/api/test?page=1&search=query&trending=true',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should skip undefined query parameters', async () => {
      mockFetch({ 'GET /test': ok({}) });

      await api.get('/test', { page: 1, search: undefined });

      expect(fetch).toHaveBeenCalledWith('/api/test?page=1', expect.any(Object));
    });

    it('should omit the query string when all parameters are undefined', async () => {
      mockFetch({ 'GET /test': ok({}) });

      await api.get('/test', { search: undefined });

      expect(fetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    });

    it('should return the parsed response envelope', async () => {
      mockFetch({ 'GET /test': ok({ a: 1 }, pagination) });

      await expect(api.get('/test')).resolves.toEqual({
        success: true,
        data: { a: 1 },
        pagination,
      });
    });

    it('should throw ApiError with message, code and status from a non-ok response', async () => {
      mockFetch({ 'GET /test': fail(400, 'VALIDATION_ERROR', 'Invalid input') });

      const error = await api.get('/test').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.status).toBe(400);
    });

    it('should fall back to a generic ApiError when the error body has no details', async () => {
      mockFetch({ 'GET /test': new MockReply(500, {}) });

      const error = await api.get('/test').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('An error occurred');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.status).toBe(500);
    });

    it('should make POST requests with a JSON body', async () => {
      mockFetch({ 'POST /test': ok({}) });

      await api.post('/test', { name: 'value' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'value' }) })
      );
    });

    it('should make POST requests without a body', async () => {
      mockFetch({ 'POST /test': ok() });

      await api.post('/test');

      expect(requests[0]).toMatchObject({ method: 'POST', body: undefined });
    });

    it('should make PATCH requests with a JSON body', async () => {
      mockFetch({ 'PATCH /test': ok({}) });

      await api.patch('/test', { name: 'value' });

      expect(requests[0]).toMatchObject({ method: 'PATCH', body: { name: 'value' } });
    });

    it('should make PATCH requests without a body', async () => {
      mockFetch({ 'PATCH /test': ok({}) });

      await api.patch('/test');

      expect(requests[0]).toMatchObject({ method: 'PATCH', body: undefined });
    });

    it('should make DELETE requests', async () => {
      mockFetch({ 'DELETE /test': ok() });

      await api.delete('/test');

      expect(requests[0]).toMatchObject({ method: 'DELETE', path: '/test', body: undefined });
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
    it('should POST display name to dev-login and return the data', async () => {
      const data = {
        user: { id: '1', displayName: 'TestUser' },
        token: 'token',
        expiresAt: '2024-12-31',
      };
      mockFetch({ 'POST /auth/dev-login': ok(data) });

      const result = await authApi.devLogin('TestUser');

      expect(result).toEqual(data);
      expect(requests[0].body).toEqual({ displayName: 'TestUser' });
    });

    it('should GET /auth/me', async () => {
      const user = { id: '1', displayName: 'Test' };
      mockFetch({ 'GET /auth/me': ok(user) });

      await expect(authApi.getMe()).resolves.toEqual(user);
    });

    it('should PATCH /auth/me with the profile changes', async () => {
      const user = { id: '1', displayName: 'NewName' };
      mockFetch({ 'PATCH /auth/me': ok(user) });

      const result = await authApi.updateProfile({ displayName: 'NewName' });

      expect(result).toEqual(user);
      expect(requests[0].body).toEqual({ displayName: 'NewName' });
    });

    it('should POST /auth/logout', async () => {
      mockFetch({ 'POST /auth/logout': ok() });

      await authApi.logout();

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ method: 'POST', path: '/auth/logout' });
    });
  });

  describe('eventsApi', () => {
    it('should list events with filters and return events and pagination', async () => {
      const events = [{ id: '1', title: 'Event 1' }];
      mockFetch({ 'GET /events': ok(events, pagination) });

      const result = await eventsApi.list({ page: 2, category: 'TECHNOLOGY', search: 'ai' });

      expect(result).toEqual({ events, pagination });
      expect(requests[0].query).toEqual({ page: '2', category: 'TECHNOLOGY', search: 'ai' });
    });

    it('should get trending events with limit', async () => {
      const events = [{ id: '1', title: 'Trending' }];
      mockFetch({ 'GET /events/trending': ok(events) });

      await expect(eventsApi.getTrending(5)).resolves.toEqual(events);
      expect(requests[0].query).toEqual({ limit: '5' });
    });

    it('should get categories', async () => {
      const categories = [{ category: 'TECHNOLOGY', count: 10 }];
      mockFetch({ 'GET /events/categories': ok(categories) });

      await expect(eventsApi.getCategories()).resolves.toEqual(categories);
    });

    it('should get event by id', async () => {
      const event = { id: '1', title: 'Event' };
      mockFetch({ 'GET /events/1': ok(event) });

      await expect(eventsApi.getById('1')).resolves.toEqual(event);
    });

    it('should get related events with limit', async () => {
      const events = [{ id: '2', title: 'Related' }];
      mockFetch({ 'GET /events/1/related': ok(events) });

      await expect(eventsApi.getRelated('1', 5)).resolves.toEqual(events);
      expect(requests[0].query).toEqual({ limit: '5' });
    });
  });

  describe('commentsApi', () => {
    it('should list comments for an event with sort', async () => {
      const comments = [{ id: '1', content: 'Comment' }];
      mockFetch({ 'GET /comments': ok(comments, pagination) });

      const result = await commentsApi.list({ eventId: 'e1', sort: 'new' });

      expect(result).toEqual({ comments, pagination });
      expect(requests[0].query).toEqual({ eventId: 'e1', sort: 'new' });
    });

    it('should get comment by id', async () => {
      const comment = { id: '1', content: 'Comment' };
      mockFetch({ 'GET /comments/1': ok(comment) });

      await expect(commentsApi.getById('1')).resolves.toEqual(comment);
    });

    it('should POST a new comment', async () => {
      const comment = { id: '1', content: 'New comment' };
      mockFetch({ 'POST /comments': ok(comment) });

      const result = await commentsApi.create({ eventId: 'e1', parentId: 'p1', content: 'New comment' });

      expect(result).toEqual(comment);
      expect(requests[0].body).toEqual({ eventId: 'e1', parentId: 'p1', content: 'New comment' });
    });

    it('should PATCH comment content', async () => {
      const comment = { id: '1', content: 'Updated' };
      mockFetch({ 'PATCH /comments/1': ok(comment) });

      const result = await commentsApi.update('1', 'Updated');

      expect(result).toEqual(comment);
      expect(requests[0].body).toEqual({ content: 'Updated' });
    });

    it('should DELETE a comment', async () => {
      mockFetch({ 'DELETE /comments/1': ok() });

      await commentsApi.delete('1');

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ method: 'DELETE', path: '/comments/1' });
    });

    it('should get replies with paging', async () => {
      const replies = [{ id: '2', content: 'Reply' }];
      mockFetch({ 'GET /comments/1/replies': ok(replies, pagination) });

      const result = await commentsApi.getReplies('1', { page: 2 });

      expect(result).toEqual({ comments: replies, pagination });
      expect(requests[0].query).toEqual({ page: '2' });
    });
  });

  describe('votesApi', () => {
    it('should POST the vote type', async () => {
      const data = { commentId: '1', score: 5, upvotes: 6, downvotes: 1, userVote: 'UP', action: 'created' };
      mockFetch({ 'POST /votes/1': ok(data) });

      await expect(votesApi.vote('1', 'UP')).resolves.toEqual(data);
      expect(requests[0].body).toEqual({ type: 'UP' });
    });

    it('should DELETE a vote', async () => {
      const data = { commentId: '1', score: 4, upvotes: 5, downvotes: 1, userVote: null };
      mockFetch({ 'DELETE /votes/1': ok(data) });

      await expect(votesApi.removeVote('1')).resolves.toEqual(data);
    });

    it('should request user votes for comma-joined ids', async () => {
      const votes = { '1': 'UP', '2': 'DOWN' };
      mockFetch({ 'GET /votes/user': ok(votes) });

      await expect(votesApi.getUserVotes(['1', '2'])).resolves.toEqual(votes);
      expect(requests[0].query).toEqual({ commentIds: '1,2' });
    });
  });

  describe('usersApi', () => {
    it('should get user by id', async () => {
      const user = { id: '1', displayName: 'User' };
      mockFetch({ 'GET /users/1': ok(user) });

      await expect(usersApi.getById('1')).resolves.toEqual(user);
    });

    it('should get user comments with sort', async () => {
      const comments = [{ id: '1', content: 'Comment' }];
      mockFetch({ 'GET /users/1/comments': ok(comments, pagination) });

      const result = await usersApi.getComments('1', { sort: 'top' });

      expect(result).toEqual({ comments, pagination });
      expect(requests[0].query).toEqual({ sort: 'top' });
    });
  });

  describe('reportsApi', () => {
    it('should POST a report', async () => {
      mockFetch({ 'POST /reports': ok({ id: 'r1' }) });

      const result = await reportsApi.create({ commentId: '1', reason: 'SPAM', description: 'ads' });

      expect(result).toEqual({ id: 'r1' });
      expect(requests[0].body).toEqual({ commentId: '1', reason: 'SPAM', description: 'ads' });
    });
  });
});
