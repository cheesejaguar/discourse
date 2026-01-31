import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventPage from './EventPage';

// Mock the API
vi.mock('../lib/api', () => ({
  eventsApi: {
    getById: vi.fn(),
  },
  commentsApi: {
    list: vi.fn(),
  },
  votesApi: {
    vote: vi.fn(),
  },
}));

// Mock the auth store
vi.mock('../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '../store/auth';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}));

// Mock child components
vi.mock('../components/CommentForm', () => ({
  default: () => <div data-testid="comment-form">Comment Form</div>,
}));

vi.mock('../components/CommentItem', () => ({
  default: () => <div data-testid="comment-item">Comment Item</div>,
}));

const mockEvent = {
  id: '1',
  slug: 'test-event',
  title: 'Test Event Title',
  summary: 'Test event summary',
  category: 'technology',
  imageUrl: null,
  isTrending: true,
  commentCount: 5,
  articles: [
    {
      id: 'a1',
      title: 'Article 1',
      url: 'https://example.com/article1',
      summary: 'Article summary',
      publishedAt: '2024-01-01T00:00:00Z',
      source: {
        id: 's1',
        name: 'Test Source',
        domain: 'example.com',
        biasRating: 'center',
      },
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockComments = [
  {
    id: 'c1',
    content: 'Test comment',
    score: 5,
    upvotes: 5,
    downvotes: 0,
    replyCount: 0,
    author: { id: 'u1', displayName: 'User' },
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const renderWithRouter = (eventId: string = 'test-event') => {
  return render(
    <MemoryRouter initialEntries={[`/event/${eventId}`]}>
      <Routes>
        <Route path="/event/:eventId" element={<EventPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('EventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: false,
      user: null,
    });
  });

  it('should show loading skeleton initially', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockImplementation(() => new Promise(() => {}));

    renderWithRouter();

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should display event after loading', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Test Event Title')).toBeInTheDocument();
    });
  });

  it('should display event summary', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Test event summary')).toBeInTheDocument();
    });
  });

  it('should display trending badge', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Trending')).toBeInTheDocument();
    });
  });

  it('should display articles section', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/Coverage from 1 Sources/)).toBeInTheDocument();
    });
  });

  it('should display article source', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Test Source')).toBeInTheDocument();
    });
  });

  it('should display discussion section', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/Discussion \(5\)/)).toBeInTheDocument();
    });
  });

  it('should display not found message for missing event', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(null);

    renderWithRouter('non-existent');

    await waitFor(() => {
      expect(screen.getByText('Event not found')).toBeInTheDocument();
    });
  });

  it('should display verified notice', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/All commenters are verified humans/)).toBeInTheDocument();
    });
  });

  it('should display sign in prompt when not authenticated', async () => {
    const { eventsApi, commentsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.getById.mockResolvedValue(mockEvent);
    commentsApi.list.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/Sign in with Alien ID/)).toBeInTheDocument();
    });
  });
});
