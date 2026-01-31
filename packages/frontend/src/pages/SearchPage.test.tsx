import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from './SearchPage';

// Mock the API
vi.mock('../lib/api', () => ({
  eventsApi: {
    list: vi.fn(),
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
    title: 'Test Event with Query',
    summary: 'Test summary with query word',
    category: 'technology',
    isTrending: false,
    commentCount: 5,
    sourceCount: 3,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const renderWithRouter = (search: string = '') => {
  return render(
    <MemoryRouter initialEntries={[`/search${search}`]}>
      <SearchPage />
    </MemoryRouter>
  );
};

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display search prompt without query', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Enter a search term to find news discussions')).toBeInTheDocument();
    });
    expect(eventsApi.list).not.toHaveBeenCalled();
  });

  it('should search and display results', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter('?q=query');

    await waitFor(() => {
      // Text may be broken up by highlight marks, so check for title container
      expect(screen.getByText(/Test Event with/)).toBeInTheDocument();
    });
  });

  it('should display search query in header', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter('?q=test');

    await waitFor(() => {
      expect(screen.getByText('Search results for "test"')).toBeInTheDocument();
    });
  });

  it('should display result count', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter('?q=test');

    await waitFor(() => {
      expect(screen.getByText('1 result found')).toBeInTheDocument();
    });
  });

  it('should display no results message', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: [],
      pagination: { page: 1, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });

    renderWithRouter('?q=nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No results found for "nonexistent"')).toBeInTheDocument();
    });
  });

  it('should highlight search terms', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter('?q=Query');

    await waitFor(() => {
      const marks = document.querySelectorAll('mark');
      expect(marks.length).toBeGreaterThan(0);
    });
  });

  it('should show loading skeleton while fetching', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockImplementation(() => new Promise(() => {}));

    renderWithRouter('?q=test');

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should display pagination when multiple pages', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 50, totalPages: 3, hasNext: true, hasPrev: false },
    });

    renderWithRouter('?q=test');

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });
});
