import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from './SearchPage';
import { mockFetch, ok, fail, requestsTo, pending } from '../test/fetch';

const NOW = new Date('2024-01-01T00:05:00Z');

const mockEvents = [
  {
    id: '1',
    slug: 'test-event',
    title: 'Test Event about technology',
    summary: 'A summary mentioning Technology twice: technology',
    category: 'TECHNOLOGY',
    isTrending: true,
    commentCount: 5,
    sourceCount: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

function pageInfo(page: number, total: number, totalPages: number) {
  return { page, limit: 20, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

const renderPage = (query: string = '') =>
  render(
    <MemoryRouter initialEntries={[`/search${query ? `?q=${encodeURIComponent(query)}` : ''}`]}>
      <SearchPage />
    </MemoryRouter>
  );

describe('SearchPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  it('should display search prompt and not hit the API without a query', async () => {
    mockFetch({});

    renderPage();

    expect(await screen.findByText('Enter a search term to find news discussions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should search with the query, page 1, limit 20', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 1, 1)) });

    renderPage('technology');

    await screen.findByText('5 comments');
    expect(requestsTo('GET /events')[0].query).toEqual({ search: 'technology', page: '1', limit: '20' });
  });

  it('should render result cards linking to the event', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 1, 1)) });

    renderPage('technology');

    const card = (await screen.findByText('5 comments')).closest('a');
    expect(card).toHaveAttribute('href', '/event/test-event');
    expect(screen.getByText('3 sources')).toBeInTheDocument();
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('TECHNOLOGY')).toHaveClass('bg-blue-100');
    expect(screen.getByText('Trending')).toBeInTheDocument();
  });

  it('should display search query in header', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 1, 1)) });

    renderPage('technology');

    expect(await screen.findByText('Search results for "technology"')).toBeInTheDocument();
  });

  it('should display singular result count', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 1, 1)) });

    renderPage('technology');

    expect(await screen.findByText('1 result found')).toBeInTheDocument();
  });

  it('should display plural result count', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 42, 3)) });

    renderPage('technology');

    expect(await screen.findByText('42 results found')).toBeInTheDocument();
  });

  it('should display no results message', async () => {
    mockFetch({ 'GET /events': ok([], pageInfo(1, 0, 0)) });

    renderPage('nonexistent');

    expect(await screen.findByText('No results found for "nonexistent"')).toBeInTheDocument();
    expect(screen.getByText('Try different keywords')).toBeInTheDocument();
  });

  it('should highlight every case-insensitive match of the search term', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 1, 1)) });

    renderPage('technology');

    await screen.findByText('5 comments');
    const marks = Array.from(document.querySelectorAll('mark')).map((m) => m.textContent);
    expect(marks).toEqual(['technology', 'Technology', 'technology']);
  });

  it('should treat regex metacharacters in the query literally', async () => {
    mockFetch({
      'GET /events': ok([{ ...mockEvents[0], title: 'Why C++ (still) matters', summary: 'cxx' }], pageInfo(1, 1, 1)),
    });

    renderPage('C++ (still)');

    expect(await screen.findByText('C++ (still)', { selector: 'mark' })).toBeInTheDocument();
    expect(document.querySelectorAll('mark')).toHaveLength(1);
  });

  it('should show loading skeleton while fetching', () => {
    mockFetch({ 'GET /events': () => pending() });

    renderPage('test');

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should log and show no results when the search fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({ 'GET /events': fail(500, 'INTERNAL_ERROR', 'Boom') });

    renderPage('test');

    expect(await screen.findByText('No results found for "test"')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith('Search failed:', expect.objectContaining({ message: 'Boom' }));
  });

  it('should paginate through results', async () => {
    mockFetch({
      'GET /events': (req) => {
        const page = Number(req.query.page);
        return ok([{ ...mockEvents[0], id: `p${page}`, title: `Result page ${page}` }], pageInfo(page, 50, 3));
      },
    });

    renderPage('test');

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();

    fireEvent.click(screen.getByText('Next'));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeEnabled();

    fireEvent.click(screen.getByText('Previous'));
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(requestsTo('GET /events').map((r) => r.query.page)).toEqual(['1', '2', '1']);
  });

  it('should not show pagination for a single page', async () => {
    mockFetch({ 'GET /events': ok(mockEvents, pageInfo(1, 1, 1)) });

    renderPage('technology');

    await screen.findByText('5 comments');
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });
});
