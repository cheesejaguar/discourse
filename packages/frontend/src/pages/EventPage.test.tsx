import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventPage from './EventPage';
import { useAuthStore } from '../store/auth';
import { mockFetch, ok, fail, requestsTo, pending, MockReply } from '../test/fetch';

const NOW = new Date('2024-01-01T00:05:00Z');

const mockEvent = {
  id: 'e1',
  slug: 'test-event',
  title: 'Test Event Title',
  summary: 'Test event summary',
  category: 'TECHNOLOGY',
  imageUrl: null,
  isTrending: true,
  commentCount: 5,
  articles: [
    {
      id: 'a1',
      title: 'Article 1',
      url: 'https://example.com/article1',
      summary: 'Article summary',
      author: 'Jane Reporter',
      publishedAt: '2024-01-01T00:00:00Z',
      source: { id: 's1', name: 'Test Source', domain: 'example.com', biasRating: 'center' },
    },
    {
      id: 'a2',
      title: 'Article 2',
      url: 'https://example.org/article2',
      summary: null,
      author: null,
      publishedAt: '2024-01-01T00:00:00Z',
      source: { id: 's2', name: 'Unrated Source', domain: 'example.org', biasRating: null },
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const baseComment = {
  eventId: 'e1',
  parentId: null,
  upvotes: 5,
  downvotes: 0,
  replyCount: 0,
  isEdited: false,
  isDeleted: false,
  isHidden: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  userVote: null,
  replies: [],
};

const mockComments = [
  { ...baseComment, id: 'c1', content: 'First comment', score: 5, author: { id: 'u1', displayName: 'Alice', karma: 10 } },
  { ...baseComment, id: 'c2', content: 'Second comment', score: 1, author: { id: 'me', displayName: 'Me', karma: 3 } },
];

const renderPage = (eventId: string = 'test-event') =>
  render(
    <MemoryRouter initialEntries={[`/event/${eventId}`]}>
      <Routes>
        <Route path="/event/:eventId" element={<EventPage />} />
      </Routes>
    </MemoryRouter>
  );

function mockEventApi(extra: Parameters<typeof mockFetch>[0] = {}) {
  mockFetch({
    'GET /events/test-event': ok(mockEvent),
    'GET /comments': ok(mockComments, { page: 1, limit: 50, total: 2, totalPages: 1, hasMore: false }),
    ...extra,
  });
}

function loginAsMe() {
  useAuthStore.setState({
    user: { id: 'me', displayName: 'Me', karma: 3, isVerified: true, createdAt: '2024-01-01' },
    token: 'test-token',
    isAuthenticated: true,
  });
  useAuthStore.getState().setToken('test-token');
}

const commentCard = (text: string) => screen.getByText(text).closest('.group') as HTMLElement;

describe('EventPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  it('should show loading skeleton while the event is loading', () => {
    mockFetch({ 'GET /events/test-event': () => pending() });

    renderPage();

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should display event header from the API', async () => {
    mockEventApi();

    renderPage();

    expect(await screen.findByText('Test Event Title')).toBeInTheDocument();
    expect(screen.getByText('Test event summary')).toBeInTheDocument();
    expect(screen.getByText('Trending')).toBeInTheDocument();
    expect(screen.getByText('TECHNOLOGY')).toHaveClass('bg-blue-100');
    expect(screen.getByText('2 sources')).toBeInTheDocument();
    expect(screen.getByText('5 comments')).toBeInTheDocument();
  });

  it('should display articles linking out with source, bias, author and time', async () => {
    mockEventApi();

    renderPage();

    expect(await screen.findByText('Coverage from 2 Sources')).toBeInTheDocument();
    const article = screen.getByText('Article 1').closest('a')!;
    expect(article).toHaveAttribute('href', 'https://example.com/article1');
    expect(article).toHaveAttribute('target', '_blank');
    expect(within(article).getByText('Test Source')).toBeInTheDocument();
    expect(within(article).getByText('(center)')).toBeInTheDocument();
    expect(within(article).getByText('by Jane Reporter')).toBeInTheDocument();
    expect(within(article).getByText('5 minutes ago')).toBeInTheDocument();
    expect(article.querySelector('.bias-center')).toBeInTheDocument();

    const unrated = screen.getByText('Article 2').closest('a')!;
    expect(unrated.querySelector('.bg-gray-300')).toBeInTheDocument();
    expect(within(unrated).queryByText(/^by /)).not.toBeInTheDocument();
  });

  it('should load comments for the event sorted by best, limit 50', async () => {
    mockEventApi();

    renderPage();

    expect(await screen.findByText('First comment')).toBeInTheDocument();
    expect(screen.getByText('Second comment')).toBeInTheDocument();
    expect(screen.getByText(/Discussion \(5\)/)).toBeInTheDocument();
    expect(requestsTo('GET /comments')[0].query).toEqual({ eventId: 'e1', sort: 'best', limit: '50' });
  });

  it('should refetch comments when sort changes', async () => {
    mockEventApi();
    renderPage();
    await screen.findByText('First comment');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'new' } });

    await waitFor(() => expect(requestsTo('GET /comments')).toHaveLength(2));
    expect(requestsTo('GET /comments')[1].query.sort).toBe('new');
  });

  it('should show empty comments message', async () => {
    mockEventApi({ 'GET /comments': ok([], { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false }) });

    renderPage();

    expect(await screen.findByText('No comments yet. Be the first to share your thoughts!')).toBeInTheDocument();
  });

  it('should log and show empty comments when loading comments fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockEventApi({ 'GET /comments': fail(500, 'INTERNAL_ERROR', 'Boom') });

    renderPage();

    expect(await screen.findByText('No comments yet. Be the first to share your thoughts!')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch comments:', expect.objectContaining({ message: 'Boom' }));
  });

  it('should display not found when the API returns 404', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({ 'GET /events/non-existent': fail(404, 'EVENT_NOT_FOUND', 'Event not found') });

    renderPage('non-existent');

    expect(await screen.findByText('Event not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to home' })).toHaveAttribute('href', '/');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch event:', expect.anything());
    expect(requestsTo('GET /comments')).toHaveLength(0);
  });

  it('should display verified notice', async () => {
    mockEventApi();

    renderPage();

    expect(await screen.findByText(/All commenters are verified humans/)).toBeInTheDocument();
  });

  it('should show sign in prompt instead of the comment form when not authenticated', async () => {
    mockEventApi();

    renderPage();

    expect(await screen.findByText('Sign in with Alien ID to join the discussion')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Share your thoughts...')).not.toBeInTheDocument();
  });

  describe('when authenticated', () => {
    beforeEach(loginAsMe);

    it('should prepend a newly posted comment', async () => {
      const newComment = { ...baseComment, id: 'c3', content: 'Brand new', score: 1, author: { id: 'me', displayName: 'Me', karma: 3 } };
      mockEventApi({ 'POST /comments': ok(newComment) });
      renderPage();
      await screen.findByText('First comment');

      await userEvent.type(screen.getByPlaceholderText('Share your thoughts...'), 'Brand new');
      fireEvent.click(screen.getByRole('button', { name: 'Post' }));

      await screen.findByText('Brand new');
      const contents = screen.getAllByText(/comment$|Brand new/).map((el) => el.textContent);
      expect(contents).toEqual(['Brand new', 'First comment', 'Second comment']);
      expect(requestsTo('POST /comments')[0].body).toEqual({ eventId: 'e1', content: 'Brand new' });
    });

    it('should POST a vote and update the comment score from the response', async () => {
      mockEventApi({
        'POST /votes/c1': ok({ commentId: 'c1', score: 6, upvotes: 6, downvotes: 0, userVote: 'UP', action: 'created' }),
      });
      renderPage();
      await screen.findByText('First comment');

      const card = commentCard('First comment');
      fireEvent.click(within(card).getByTitle('Upvote'));

      expect(await within(card).findByText('6')).toBeInTheDocument();
      expect(within(card).getByTitle('Upvote')).toHaveClass('voted-up');
      expect(requestsTo('POST /votes/c1')[0].body).toEqual({ type: 'UP' });
    });

    it('should keep the score and log when voting fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockEventApi({ 'POST /votes/c1': fail(429, 'RATE_LIMIT_EXCEEDED', 'Slow down') });
      renderPage();
      await screen.findByText('First comment');

      const card = commentCard('First comment');
      fireEvent.click(within(card).getByTitle('Downvote'));

      await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Failed to vote:', expect.anything()));
      expect(within(card).getByText('5')).toBeInTheDocument();
    });

    it('should DELETE own comment and show it as deleted', async () => {
      mockEventApi({ 'DELETE /comments/c2': ok() });
      renderPage();
      await screen.findByText('Second comment');

      const card = commentCard('Second comment');
      fireEvent.click(within(card).getByText('Delete'));
      fireEvent.click(within(card).getAllByText('Delete')[1]);

      await waitFor(() => expect(screen.queryByText('Second comment')).not.toBeInTheDocument());
      expect(screen.getAllByText('[deleted]')).toHaveLength(2);
      expect(requestsTo('DELETE /comments/c2')).toHaveLength(1);
    });

    it('should keep the comment and log when deleting fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockEventApi({ 'DELETE /comments/c2': new MockReply(403, { success: false, error: { code: 'FORBIDDEN', message: 'No' } }) });
      renderPage();
      await screen.findByText('Second comment');

      const card = commentCard('Second comment');
      fireEvent.click(within(card).getByText('Delete'));
      fireEvent.click(within(card).getAllByText('Delete')[1]);

      await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Failed to delete comment:', expect.anything()));
      expect(screen.getByText('Second comment')).toBeInTheDocument();
    });

    it('should add a posted reply under its parent and bump the reply count', async () => {
      const reply = { ...baseComment, id: 'r1', parentId: 'c1', content: 'A reply', score: 1, author: { id: 'me', displayName: 'Me', karma: 3 } };
      mockEventApi({ 'POST /comments': ok(reply) });
      renderPage();
      await screen.findByText('First comment');

      const card = commentCard('First comment');
      fireEvent.click(within(card).getByText('Reply'));
      await userEvent.type(screen.getByPlaceholderText('Reply to Alice...'), 'A reply');
      fireEvent.click(within(card).getByRole('button', { name: 'Post' }));

      expect(await within(card).findByText(/Hide 1 reply/)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Reply to Alice...')).not.toBeInTheDocument();
      expect(within(card).getByText('A reply', { selector: 'div' })).toBeInTheDocument();
      expect(requestsTo('POST /comments')[0].body).toEqual({ eventId: 'e1', parentId: 'c1', content: 'A reply' });
    });
  });
});
