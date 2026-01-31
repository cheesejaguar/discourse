import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CategoryPage from './CategoryPage';

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
    slug: 'tech-event-1',
    title: 'Technology News Event',
    summary: 'Summary of tech event',
    category: 'technology',
    isTrending: true,
    commentCount: 10,
    sourceCount: 5,
    createdAt: '2024-01-01T00:00:00Z',
    imageUrl: 'https://example.com/image.jpg',
    sources: [
      { id: 's1', name: 'TechNews', biasRating: 'CENTER' },
      { id: 's2', name: 'CNN', biasRating: 'LEFT' },
    ],
  },
  {
    id: '2',
    slug: 'tech-event-2',
    title: 'Another Tech Story',
    summary: 'Another summary',
    category: 'technology',
    isTrending: false,
    commentCount: 3,
    sourceCount: 2,
    createdAt: '2024-01-02T00:00:00Z',
    imageUrl: null,
    sources: [],
  },
];

const renderWithRouter = (category: string = 'technology') => {
  return render(
    <MemoryRouter initialEntries={[`/category/${category}`]}>
      <Routes>
        <Route path="/category/:category" element={<CategoryPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('CategoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display category header', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter('technology');

    await waitFor(() => {
      expect(screen.getByText('Technology News')).toBeInTheDocument();
    });
  });

  it('should display category badge', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter('technology');

    await waitFor(() => {
      expect(screen.getByText('Technology')).toBeInTheDocument();
    });
  });

  it('should display story count', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('2 stories')).toBeInTheDocument();
    });
  });

  it('should display singular story count', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: [mockEvents[0]],
      pagination: { page: 1, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('1 story')).toBeInTheDocument();
    });
  });

  it('should display event cards', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Technology News Event')).toBeInTheDocument();
      expect(screen.getByText('Another Tech Story')).toBeInTheDocument();
    });
  });

  it('should display trending badge for trending events', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Trending')).toBeInTheDocument();
    });
  });

  it('should display event image when available', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      const images = document.querySelectorAll('img');
      expect(images.length).toBe(1);
      expect(images[0]).toHaveAttribute('src', 'https://example.com/image.jpg');
    });
  });

  it('should display source and comment counts', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('5 sources')).toBeInTheDocument();
      expect(screen.getByText('10 comments')).toBeInTheDocument();
    });
  });

  it('should display time ago', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      const timeElements = screen.getAllByText('5 minutes ago');
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  it('should display source bias indicators', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      const biasIndicators = document.querySelectorAll('.rounded-full.w-2.h-2');
      expect(biasIndicators.length).toBeGreaterThan(0);
    });
  });

  it('should show loading skeleton while fetching', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockImplementation(() => new Promise(() => {}));

    renderWithRouter();

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should display empty state when no events', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: [],
      pagination: { page: 1, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No technology news found')).toBeInTheDocument();
      expect(screen.getByText('Browse all news')).toBeInTheDocument();
    });
  });

  it('should display pagination when multiple pages', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 50, totalPages: 3, hasNext: true, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('should disable previous button on first page', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 50, totalPages: 3, hasNext: true, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      const prevButton = screen.getByText('Previous');
      expect(prevButton).toBeDisabled();
    });
  });

  it('should navigate to next page', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 50, totalPages: 3, hasNext: true, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(eventsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it('should navigate to previous page', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list
      .mockResolvedValueOnce({
        events: mockEvents,
        pagination: { page: 1, total: 50, totalPages: 3, hasNext: true, hasPrev: false },
      })
      .mockResolvedValueOnce({
        events: mockEvents,
        pagination: { page: 2, total: 50, totalPages: 3, hasNext: true, hasPrev: true },
      })
      .mockResolvedValueOnce({
        events: mockEvents,
        pagination: { page: 1, total: 50, totalPages: 3, hasNext: true, hasPrev: false },
      });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    // Go to page 2
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Previous')).not.toBeDisabled();
    });

    // Go back to page 1
    fireEvent.click(screen.getByText('Previous'));

    await waitFor(() => {
      expect(eventsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });

  it('should handle different categories', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: [],
      pagination: { page: 1, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });

    renderWithRouter('politics');

    await waitFor(() => {
      expect(screen.getByText('Politics News')).toBeInTheDocument();
      expect(screen.getByText('No politics news found')).toBeInTheDocument();
    });
  });

  it('should handle unknown category', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: [],
      pagination: { page: 1, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });

    renderWithRouter('unknown');

    await waitFor(() => {
      expect(screen.getByText('unknown News')).toBeInTheDocument();
    });
  });

  it('should call API with correct category parameter', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter('science');

    await waitFor(() => {
      expect(eventsApi.list).toHaveBeenCalledWith({
        category: 'SCIENCE',
        page: 1,
        limit: 20,
      });
    });
  });

  it('should show more than 5 sources indicator', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    const eventWithManySources = {
      ...mockEvents[0],
      sources: [
        { id: 's1', name: 'Source1', biasRating: 'CENTER' },
        { id: 's2', name: 'Source2', biasRating: 'LEFT' },
        { id: 's3', name: 'Source3', biasRating: 'RIGHT' },
        { id: 's4', name: 'Source4', biasRating: 'CENTER' },
        { id: 's5', name: 'Source5', biasRating: 'LEFT' },
        { id: 's6', name: 'Source6', biasRating: 'RIGHT' },
        { id: 's7', name: 'Source7', biasRating: 'CENTER' },
      ],
    };
    eventsApi.list.mockResolvedValue({
      events: [eventWithManySources],
      pagination: { page: 1, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    eventsApi.list.mockRejectedValue(new Error('API Error'));

    renderWithRouter();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should not show pagination for single page', async () => {
    const { eventsApi } = vi.mocked(await import('../lib/api'));
    eventsApi.list.mockResolvedValue({
      events: mockEvents,
      pagination: { page: 1, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Technology News Event')).toBeInTheDocument();
    });

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });
});
