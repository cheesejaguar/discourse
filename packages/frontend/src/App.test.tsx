import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useAuthStore } from './store/auth';
import { mockFetch, ok, fail, requests } from './test/fetch';

const pagination = { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

const event = {
  id: 'e1',
  slug: 'test-event',
  title: 'Routed Event',
  summary: 'summary',
  category: 'WORLD',
  isTrending: false,
  commentCount: 0,
  articles: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const user = {
  id: 'test-user',
  displayName: 'RoutedUser',
  karma: 1,
  isVerified: true,
  createdAt: '2024-01-01T00:00:00Z',
  commentCount: 0,
  totalUpvotes: 0,
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

describe('App', () => {
  it('should render the home page inside the layout at /', async () => {
    mockFetch({ 'GET /events': ok([], pagination), 'GET /events/trending': ok([]) });

    renderAt('/');

    expect(await screen.findByText('Latest News')).toBeInTheDocument();
    expect(screen.getByText('Human-Verified News')).toBeInTheDocument();
  });

  it('should render the event page at /event/:eventId', async () => {
    mockFetch({ 'GET /events/test-event': ok(event), 'GET /comments': ok([], pagination) });

    renderAt('/event/test-event');

    expect(await screen.findByRole('heading', { name: 'Routed Event' })).toBeInTheDocument();
  });

  it('should render the user page at /user/:userId', async () => {
    mockFetch({ 'GET /users/test-user': ok(user), 'GET /users/test-user/comments': ok([], pagination) });

    renderAt('/user/test-user');

    expect(await screen.findByRole('heading', { name: 'RoutedUser' })).toBeInTheDocument();
  });

  it('should render the search page at /search', async () => {
    mockFetch({});

    renderAt('/search');

    expect(await screen.findByText('Enter a search term to find news discussions')).toBeInTheDocument();
  });

  it('should render the category page at /category/:category', async () => {
    mockFetch({ 'GET /events': ok([], pagination) });

    renderAt('/category/technology');

    expect(await screen.findByText('Technology News')).toBeInTheDocument();
  });

  it('should not call /auth/me on mount without a stored token', async () => {
    mockFetch({});

    renderAt('/search');
    await screen.findByText('Enter a search term to find news discussions');

    expect(requests).toHaveLength(0);
  });

  it('should refresh the user from /auth/me on mount when a token is stored', async () => {
    useAuthStore.setState({ token: 'stored-token' });
    mockFetch({ 'GET /auth/me': ok({ ...user, displayName: 'RestoredUser' }) });

    renderAt('/search');

    expect(await screen.findByText('RestoredUser')).toBeInTheDocument();
    expect(requests[0].headers.Authorization).toBe('Bearer stored-token');
  });

  it('should sign out locally when the stored token is rejected on mount', async () => {
    useAuthStore.setState({ token: 'expired-token' });
    mockFetch({ 'GET /auth/me': fail(401, 'AUTH_TOKEN_EXPIRED', 'Session has expired') });

    renderAt('/search');

    expect(await screen.findByText('Sign In')).toBeInTheDocument();
    await screen.findByText('Enter a search term to find news discussions');
    expect(useAuthStore.getState().token).toBeNull();
  });
});
