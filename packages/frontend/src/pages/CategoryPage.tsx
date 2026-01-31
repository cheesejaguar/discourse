import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { eventsApi, type NewsEvent, type PaginationInfo } from '../lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  politics: 'Politics',
  technology: 'Technology',
  business: 'Business',
  science: 'Science',
  health: 'Health',
  sports: 'Sports',
  entertainment: 'Entertainment',
  world: 'World',
  environment: 'Environment',
  other: 'Other',
};

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const categoryLabel = category ? CATEGORY_LABELS[category.toLowerCase()] || category : '';
  const categoryKey = category?.toUpperCase() || '';

  useEffect(() => {
    async function fetchEvents() {
      if (!category) return;
      setIsLoading(true);
      try {
        const { events: results, pagination: pag } = await eventsApi.list({
          category: categoryKey,
          page,
          limit: 20,
        });
        setEvents(results);
        setPagination(pag);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvents();
  }, [category, categoryKey, page]);

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <span className={clsx('badge', getCategoryBadgeClass(category || ''))}>
            {categoryLabel}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{categoryLabel} News</h1>
        {pagination && (
          <p className="text-gray-500 mt-1">
            {pagination.total} {pagination.total === 1 ? 'story' : 'stories'}
          </p>
        )}
      </header>

      {isLoading ? (
        <LoadingSkeleton />
      ) : events.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500">No {categoryLabel.toLowerCase()} news found</p>
          <Link to="/" className="link mt-4 inline-block">
            Browse all news
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
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

function EventCard({ event }: { event: NewsEvent }) {
  const timeAgo = formatDistanceToNow(new Date(event.createdAt), { addSuffix: true });

  return (
    <article className="card hover:shadow-md transition-shadow">
      <Link to={`/event/${event.slug}`} className="block p-4">
        <div className="flex items-start space-x-4">
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt=""
              className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              {event.isTrending && (
                <span className="badge bg-orange-100 text-orange-700">Trending</span>
              )}
            </div>

            <h2 className="text-lg font-semibold text-gray-900 hover:text-primary-600 line-clamp-2 transition-colors">
              {event.title}
            </h2>

            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.summary}</p>

            <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <span>{event.sourceCount || 0} sources</span>
              </span>

              <span className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>{event.commentCount} comments</span>
              </span>

              <span>{timeAgo}</span>
            </div>

            {/* Source indicators */}
            {event.sources && event.sources.length > 0 && (
              <div className="flex items-center space-x-1 mt-3">
                {event.sources.slice(0, 5).map((source) => (
                  <div
                    key={source.id}
                    className={clsx(
                      'w-2 h-2 rounded-full',
                      source.biasRating ? `bias-${source.biasRating}` : 'bg-gray-300'
                    )}
                    title={`${source.name} (${source.biasRating || 'Unknown bias'})`}
                  />
                ))}
                {event.sources.length > 5 && (
                  <span className="text-xs text-gray-400">+{event.sources.length - 5}</span>
                )}
              </div>
            )}
          </div>
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
          <div className="flex items-start space-x-4">
            <div className="skeleton w-24 h-24 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-6 w-full" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
