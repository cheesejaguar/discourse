import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { eventsApi, type NewsEvent, type PaginationInfo } from '../lib/api';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function search() {
      if (!query.trim()) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { events: results, pagination: pag } = await eventsApi.list({
          search: query,
          page,
          limit: 20,
        });
        setEvents(results);
        setPagination(pag);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    search();
  }, [query, page]);

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {query ? `Search results for "${query}"` : 'Search'}
        </h1>
        {pagination && (
          <p className="text-gray-500 mt-1">
            {pagination.total} {pagination.total === 1 ? 'result' : 'results'} found
          </p>
        )}
      </header>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !query.trim() ? (
        <div className="card p-8 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-gray-500">Enter a search term to find news discussions</p>
        </div>
      ) : events.length === 0 ? (
        <div className="card p-8 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-gray-500">No results found for "{query}"</p>
          <p className="text-sm text-gray-400 mt-2">Try different keywords</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} query={query} />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrev}
                className="btn-secondary btn-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNext}
                className="btn-secondary btn-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event, query }: { event: NewsEvent; query: string }) {
  const timeAgo = formatDistanceToNow(new Date(event.createdAt), { addSuffix: true });

  // Highlight matching text
  const highlightText = (text: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <article className="card hover:shadow-md transition-shadow">
      <Link to={`/event/${event.slug}`} className="block p-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className={clsx('badge', getCategoryBadgeClass(event.category))}>
            {event.category}
          </span>
          {event.isTrending && (
            <span className="badge bg-orange-100 text-orange-700">Trending</span>
          )}
        </div>

        <h2 className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors">
          {highlightText(event.title)}
        </h2>

        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {highlightText(event.summary)}
        </p>

        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
          <span>{event.sourceCount || 0} sources</span>
          <span>{event.commentCount} comments</span>
          <span>{timeAgo}</span>
        </div>
      </Link>
    </article>
  );
}

function getCategoryBadgeClass(category: string): string {
  const classes: Record<string, string> = {
    politics: 'bg-purple-100 text-purple-800',
    technology: 'bg-blue-100 text-blue-800',
    business: 'bg-green-100 text-green-800',
    science: 'bg-indigo-100 text-indigo-800',
    health: 'bg-pink-100 text-pink-800',
    sports: 'bg-yellow-100 text-yellow-800',
    entertainment: 'bg-red-100 text-red-800',
    world: 'bg-cyan-100 text-cyan-800',
    environment: 'bg-emerald-100 text-emerald-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return classes[category.toLowerCase()] || classes.other;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card p-4">
          <div className="skeleton h-4 w-20 mb-2" />
          <div className="skeleton h-6 w-full mb-2" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
