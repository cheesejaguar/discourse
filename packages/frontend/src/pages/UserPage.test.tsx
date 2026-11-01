import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserPage from './UserPage';
import { mockFetch, ok, fail, requestsTo, pending } from '../test/fetch';

const NOW = new Date('2024-01-06T00:00:00Z');

const mockUser = {
  id: 'u1',
  displayName: 'testUser',
  avatarUrl: null,
  bio: 'Test bio',
  karma: 500,
  isVerified: true,
  createdAt: '2024-01-01T00:00:00Z',
  commentCount: 10,
  totalUpvotes: 50,
  totalDownvotes: 5,
};

const mockComments = [
  {
    id: 'c1',
    eventId: 'e1',
    content: 'Test comment',
    score: 5,
    upvotes: 5,
    downvotes: 0,
    replyCount: 2,
    isEdited: false,
    isDeleted: false,
    isHidden: false,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
    author: null,
    event: { id: 'e1', slug: 'test-event', title: 'Test Event' },
  },
  {
    id: 'c2',
    eventId: 'e2',
    content: 'Comment without event details',
    score: -1,
    upvotes: 0,
    downvotes: 1,
    replyCount: 0,
    isEdited: false,
    isDeleted: false,
    isHidden: false,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
    author: null,
  },
];

const pagination = { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false };

const renderPage = (userId: string = 'u1') =>
  render(
    <MemoryRouter initialEntries={[`/user/${userId}`]}>
      <Routes>
        <Route path="/user/:userId" element={<UserPage />} />
      </Routes>
    </MemoryRouter>
  );

function mockUserApi(user: unknown = mockUser, comments: unknown[] = mockComments) {
  mockFetch({
    'GET /users/u1': ok(user),
    'GET /users/u1/comments': ok(comments, pagination),
  });
}

describe('UserPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  it('should show loading skeleton while loading', () => {
    mockFetch({ 'GET /users/u1': () => pending(), 'GET /users/u1/comments': () => pending() });

    renderPage();

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should request the profile and the latest 20 comments', async () => {
    mockUserApi();

    renderPage();
    await screen.findByRole('heading', { name: 'testUser' });

    expect(requestsTo('GET /users/u1')).toHaveLength(1);
    expect(requestsTo('GET /users/u1/comments')[0].query).toEqual({ limit: '20' });
  });

  it('should display the user profile header', async () => {
    mockUserApi();

    renderPage();

    expect(await screen.findByRole('heading', { name: 'testUser' })).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByTitle('Verified Human')).toBeInTheDocument();
    expect(screen.getByText('Test bio')).toBeInTheDocument();
    expect(screen.getByText('Joined 5 days ago')).toBeInTheDocument();
  });

  it('should display karma, comment and upvote stats', async () => {
    mockUserApi();

    renderPage();

    expect((await screen.findByText('500')).nextSibling).toHaveTextContent('karma');
    expect(screen.getByText('10').nextSibling).toHaveTextContent('comments');
    expect(screen.getByText('50').nextSibling).toHaveTextContent('upvotes received');
  });

  it('should omit verified badge and bio when absent', async () => {
    mockUserApi({ ...mockUser, isVerified: false, bio: null });

    renderPage();

    await screen.findByRole('heading', { name: 'testUser' });
    expect(screen.queryByTitle('Verified Human')).not.toBeInTheDocument();
    expect(screen.queryByText('Test bio')).not.toBeInTheDocument();
  });

  it('should show the comments tab by default', async () => {
    mockUserApi();

    renderPage();

    expect(await screen.findByRole('button', { name: 'Comments' })).toHaveClass('text-primary-600');
    expect(screen.getByRole('button', { name: 'About' })).not.toHaveClass('text-primary-600');
  });

  it('should display user comments linking to their events', async () => {
    mockUserApi();

    renderPage();

    expect(await screen.findByText('Test comment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Test Event' })).toHaveAttribute('href', '/event/test-event');
    expect(screen.getByText('5 points')).toBeInTheDocument();
    expect(screen.getByText('2 replies')).toBeInTheDocument();
    expect(screen.getAllByText('1 day ago')).toHaveLength(2);
  });

  it('should fall back to eventId link when the comment has no event details', async () => {
    mockUserApi();

    renderPage();

    await screen.findByText('Comment without event details');
    expect(screen.getByRole('link', { name: 'View discussion' })).toHaveAttribute('href', '/event/e2');
  });

  it('should switch to the about tab with user information', async () => {
    mockUserApi();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'About' }));

    expect(screen.getByText('User Information')).toBeInTheDocument();
    expect(screen.getByText('500 points')).toBeInTheDocument();
    expect(screen.getByText(new Date(mockUser.createdAt).toLocaleDateString())).toBeInTheDocument();
    expect(screen.getByText('Verified Human (Alien.org)')).toBeInTheDocument();
    expect(screen.queryByText('Test comment')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));
    expect(screen.getByText('Test comment')).toBeInTheDocument();
  });

  it('should display not found when the API returns 404', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({
      'GET /users/missing': fail(404, 'USER_NOT_FOUND', 'User not found'),
      'GET /users/missing/comments': ok([], pagination),
    });

    renderPage('missing');

    expect(await screen.findByText('User not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to home' })).toHaveAttribute('href', '/');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch user:', expect.objectContaining({ code: 'USER_NOT_FOUND' }));
  });

  it('should display empty comments message', async () => {
    mockUserApi(mockUser, []);

    renderPage();

    expect(await screen.findByText('No comments yet')).toBeInTheDocument();
  });
});
