import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';
import { mockFetch, ok, fail, requestsTo, pending } from '../test/fetch';

const NOW = new Date('2024-01-01T00:05:00Z');

const mockEvents = [
  {
    id: '1',
    slug: 'test-event',
    title: 'Test Event',
    summary: 'Test summary',
    category: 'TECHNOLOGY',
    imageUrl: 'https://img.example.com/1.jpg',
    isTrending: true,
    commentCount: 5,
    sourceCount: 3,
    sources: [
      { id: 's1', name: 'Source 1', biasRating: 'CENTER' },
      { id: 's2', name: 'Source 2', biasRating: null },
      { id: 's3', name: 'Source 3', biasRating: 'LEFT' },
      { id: 's4', name: 'Source 4', biasRating: 'RIGHT' },
      { id: 's5', name: 'Source 5', biasRating: 'CENTER' },
      { id: 's6', name: 'Source 6', biasRating: 'CENTER' },
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
    category: 'POLITICS',
    isTrending: true,
    commentCount: 100,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

function mockHomeApi(events: unknown[] = mockEvents, trending: unknown[] = mockTrendingEvents) {
  mockFetch({
    'GET /events': ok(events, { page: 1, limit: 20, total: events.length, totalPages: 1, hasMore: false }),
    'GET /events/trending': ok(trending),
  });
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  it('should show loading skeleton while requests are pending', () => {
    mockFetch({ 'GET /events': () => pending(), 'GET /events/trending': () => pending() });

    renderPage();

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Latest News')).not.toBeInTheDocument();
  });

  it('should request 20 latest events and 5 trending events', async () => {
    mockHomeApi();

    renderPage();
    await screen.findByText('Test Event');

    expect(requestsTo('GET /events')[0].query).toEqual({ limit: '20' });
    expect(requestsTo('GET /events/trending')[0].query).toEqual({ limit: '5' });
  });

  it('should render an event card linking to the event', async () => {
    mockHomeApi();

    renderPage();

    const title = await screen.findByText('Test Event');
    expect(title.closest('a')).toHaveAttribute('href', '/event/test-event');
    expect(screen.getByText('Test summary')).toBeInTheDocument();
    expect(document.querySelector('img[src="https://img.example.com/1.jpg"]')).toBeInTheDocument();
  });

  it('should display category badge with category colour', async () => {
    mockHomeApi();

    renderPage();

    const badge = await screen.findByText('TECHNOLOGY');
    expect(badge).toHaveClass('bg-blue-100');
  });

  it('should display source count, comment count, and relative time', async () => {
    mockHomeApi();

    renderPage();

    expect(await screen.findByText('3 sources')).toBeInTheDocument();
    expect(screen.getByText('5 comments')).toBeInTheDocument();
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('should show up to five source indicators and an overflow count', async () => {
    mockHomeApi();

    renderPage();
    await screen.findByText('Test Event');

    expect(screen.getByTitle('Source 1 (CENTER)')).toHaveClass('bias-CENTER');
    expect(screen.getByTitle('Source 2 (Unknown bias)')).toHaveClass('bg-gray-300');
    expect(screen.queryByTitle('Source 6 (CENTER)')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should display trending events ranked with links', async () => {
    mockHomeApi();

    renderPage();

    const trending = await screen.findByText('Trending Event');
    expect(trending.closest('a')).toHaveAttribute('href', '/event/trending-event');
    expect(screen.getByText('100 comments')).toBeInTheDocument();
  });

  it('should display about and categories sections', async () => {
    mockHomeApi();

    renderPage();

    expect(await screen.findByText('About')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Environment' })).toHaveAttribute('href', '/category/environment');
  });

  it('should show empty message when no events', async () => {
    mockHomeApi([], []);

    renderPage();

    expect(await screen.findByText('No news events found')).toBeInTheDocument();
  });

  it('should log the error and render the empty page when the API fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({
      'GET /events': fail(500, 'INTERNAL_ERROR', 'Boom'),
      'GET /events/trending': ok([]),
    });

    renderPage();

    expect(await screen.findByText('No news events found')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch events:', expect.objectContaining({ message: 'Boom' }));
  });
});
