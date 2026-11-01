import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CategoryPage from './CategoryPage';
import { mockFetch, ok, fail, requestsTo, pending } from '../test/fetch';

const NOW = new Date('2024-01-02T00:05:00Z');

const mockEvents = [
  {
    id: '1',
    slug: 'tech-event-1',
    title: 'Technology News Event',
    summary: 'Summary of tech event',
    category: 'TECHNOLOGY',
    isTrending: true,
    commentCount: 10,
    sourceCount: 5,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
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
    category: 'TECHNOLOGY',
    isTrending: false,
    commentCount: 3,
    sourceCount: 2,
    createdAt: '2024-01-01T00:05:00Z',
    updatedAt: '2024-01-01T00:05:00Z',
    imageUrl: null,
    sources: [],
  },
];

function pageInfo(page: number, total: number, totalPages: number) {
  return { page, limit: 20, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

const renderPage = (category: string = 'technology') =>
  render(
    <MemoryRouter initialEntries={[`/category/${category}`]}>
      <Routes>
        <Route path="/category/:category" element={<CategoryPage />} />
      </Routes>
    </MemoryRouter>
  );

/** Paged backend: the title of each event includes the page it came from */
function mockPagedEvents(totalPages: number) {
  mockFetch({
    'GET /events': (req) => {
      const page = Number(req.query.page);
      return ok(
        [{ ...mockEvents[0], id: `p${page}`, title: `Story on page ${page}` }],
        pageInfo(page, totalPages * 20, totalPages)
      );
    },
  });
}

describe('CategoryPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  it('should request the upper-cased category, page 1, limit 20', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();
    await screen.findByText('Technology News Event');

    expect(requestsTo('GET /events')[0].query).toEqual({ category: 'TECHNOLOGY', page: '1', limit: '20' });
  });

  it('should display category header and badge', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    expect(await screen.findByText('Technology News')).toBeInTheDocument();
    expect(screen.getByText('Technology', { selector: 'span' })).toHaveClass('bg-blue-100');
  });

  it('should display plural story count', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    expect(await screen.findByText('2 stories')).toBeInTheDocument();
  });

  it('should display singular story count', async () => {
    mockFetch({ 'GET /events': ok([mockEvents[0]], pageInfo(1, 1, 1)) });

    renderPage();

    expect(await screen.findByText('1 story')).toBeInTheDocument();
  });

  it('should display event cards linking to events', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    expect((await screen.findByText('Technology News Event')).closest('a')).toHaveAttribute('href', '/event/tech-event-1');
    expect(screen.getByText('Another Tech Story').closest('a')).toHaveAttribute('href', '/event/tech-event-2');
    expect(screen.getByText('Summary of tech event')).toBeInTheDocument();
  });

  it('should display trending badge only for trending events', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    await screen.findByText('Technology News Event');
    expect(screen.getAllByText('Trending')).toHaveLength(1);
  });

  it('should display event image only when available', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    await screen.findByText('Technology News Event');
    const images = document.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should display source and comment counts', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    expect(await screen.findByText('5 sources')).toBeInTheDocument();
    expect(screen.getByText('10 comments')).toBeInTheDocument();
    expect(screen.getByText('2 sources')).toBeInTheDocument();
    expect(screen.getByText('3 comments')).toBeInTheDocument();
  });

  it('should display relative time for each event', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    expect(await screen.findByText('5 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('1 day ago')).toBeInTheDocument();
  });

  it('should display source bias indicators', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    await screen.findByText('Technology News Event');
    expect(screen.getByTitle('TechNews (CENTER)')).toHaveClass('bias-CENTER');
    expect(screen.getByTitle('CNN (LEFT)')).toHaveClass('bias-LEFT');
  });

  it('should show at most 5 source indicators plus an overflow count', async () => {
    const sources = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, name: `Source ${i}`, biasRating: null }));
    mockFetch({ 'GET /events': ok([{ ...mockEvents[0], sources }], pageInfo(1, 1, 1)) });

    renderPage();

    await screen.findByText('Technology News Event');
    expect(screen.getAllByTitle(/Unknown bias/)).toHaveLength(5);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('should show loading skeleton while fetching', () => {
    mockFetch({ 'GET /events': () => pending() });

    renderPage();

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should display empty state when no events', async () => {
    mockFetch({ 'GET /events': ok([], pageInfo(1, 0, 0)) });

    renderPage();

    expect(await screen.findByText('No technology news found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all news' })).toHaveAttribute('href', '/');
  });

  it('should display pagination when multiple pages', async () => {
    mockPagedEvents(3);

    renderPage();

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();
    expect(screen.getByText('Next')).toBeEnabled();
  });

  it('should load the next page when Next is clicked', async () => {
    mockPagedEvents(3);
    renderPage();
    await screen.findByText('Story on page 1');

    fireEvent.click(screen.getByText('Next'));

    expect(await screen.findByText('Story on page 2')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(requestsTo('GET /events').map((r) => r.query.page)).toEqual(['1', '2']);
  });

  it('should load the previous page when Previous is clicked', async () => {
    mockPagedEvents(3);
    renderPage();
    await screen.findByText('Story on page 1');

    fireEvent.click(screen.getByText('Next'));
    await screen.findByText('Story on page 2');
    fireEvent.click(screen.getByText('Previous'));

    expect(await screen.findByText('Story on page 1')).toBeInTheDocument();
    expect(requestsTo('GET /events').map((r) => r.query.page)).toEqual(['1', '2', '1']);
  });

  it('should disable Next on the last page', async () => {
    mockPagedEvents(2);
    renderPage();
    await screen.findByText('Story on page 1');

    fireEvent.click(screen.getByText('Next'));

    await screen.findByText('Page 2 of 2');
    expect(screen.getByText('Next')).toBeDisabled();
    expect(screen.getByText('Previous')).toBeEnabled();
  });

  it('should label other known categories', async () => {
    mockFetch({ 'GET /events': ok([], pageInfo(1, 0, 0)) });

    renderPage('politics');

    expect(await screen.findByText('Politics News')).toBeInTheDocument();
    expect(screen.getByText('Politics', { selector: 'span' })).toHaveClass('bg-purple-100');
    expect(requestsTo('GET /events')[0].query.category).toBe('POLITICS');
  });

  it('should fall back to the raw name and grey badge for an unknown category', async () => {
    mockFetch({ 'GET /events': ok([], pageInfo(1, 0, 0)) });

    renderPage('unknown-cat');

    expect(await screen.findByText('unknown-cat News')).toBeInTheDocument();
    expect(screen.getByText('unknown-cat', { selector: 'span' })).toHaveClass('bg-gray-100');
    expect(requestsTo('GET /events')[0].query.category).toBe('UNKNOWN-CAT');
  });

  it('should log and show the empty state on API errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({ 'GET /events': fail(500, 'INTERNAL_ERROR', 'API Error') });

    renderPage();

    expect(await screen.findByText('No technology news found')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch events:', expect.objectContaining({ message: 'API Error' }));
  });

  it('should not show pagination for a single page', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 2, 1)) });

    renderPage();

    await screen.findByText('Technology News Event');
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });
});
