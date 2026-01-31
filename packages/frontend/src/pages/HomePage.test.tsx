import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HomePage from './HomePage';

// Mock the API
vi.mock('../lib/api', () => ({
  eventsApi: {
    list: vi.fn(),
    getTrending: vi.fn(),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}));

const mockEvents = [
  {
    id: '1',
    slug: 'test-event',
    title: 'Test Event',
    summary: 'Test summary',
    category: 'technology',
    imageUrl: null,
    isTrending: false,
    commentCount: 5,
    sourceCount: 3,
    sources: [
      { id: 's1', name: 'Source 1', biasRating: 'center' },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockTrendingEvents = [
  {
    id: '2',
    slug: 'trending-event',
    title: 'Trending Event',
    summary: 'Trending summary',
    category: 'politics',
    commentCount: 100,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton initially', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockImplementation(() => new Promise(() => {}));
    eventsApi.getTrending.mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<HomePage />);

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should display events after loading', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: mockEvents, pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue(mockTrendingEvents);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });
  });

  it('should display trending section', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: mockEvents, pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue(mockTrendingEvents);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Trending')).toBeInTheDocument();
      expect(screen.getByText('Trending Event')).toBeInTheDocument();
    });
  });

  it('should display about section', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: mockEvents, pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue(mockTrendingEvents);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('About')).toBeInTheDocument();
    });
  });

  it('should display categories section', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: mockEvents, pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue(mockTrendingEvents);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });
  });

  it('should show empty message when no events', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: [], pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue([]);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('No news events found')).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockRejectedValue(new Error('API Error'));
    eventsApi.getTrending.mockRejectedValue(new Error('API Error'));

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.queryByText('Test Event')).not.toBeInTheDocument();
    });
  });

  it('should display event source count', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: mockEvents, pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue(mockTrendingEvents);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('3 sources')).toBeInTheDocument();
    });
  });

  it('should display event comment count', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: mockEvents, pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue(mockTrendingEvents);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('5 comments')).toBeInTheDocument();
    });
  });

  it('should display category badge', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({ events: mockEvents, pagination: {} as any });
    eventsApi.getTrending.mockResolvedValue(mockTrendingEvents);

    renderWithRouter(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('technology')).toBeInTheDocument();
    });
  });
});
