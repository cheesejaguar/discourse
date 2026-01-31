import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi, type NewsEvent } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export default function HomePage() {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<NewsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [eventsRes, trendingRes] = await Promise.all([
          eventsApi.list({ limit: 20 }),
          eventsApi.getTrending(5),
        ]);
        setEvents(eventsRes.events);
        setTrendingEvents(trendingRes);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Latest News</h1>

        {events.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-500">No news events found</p>
          </div>
        ) : (
          events.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>

      {/* Sidebar */}
      <aside className="space-y-6">
        {/* Trending */}
        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
            </svg>
            <span>Trending</span>
          </h2>
          <div className="space-y-3">
            {trendingEvents.map((event, index) => (
              <Link
                key={event.id}
                to={`/event/${event.slug}`}
                className="block group"
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg font-bold text-gray-300 group-hover:text-primary-500 transition-colors">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 line-clamp-2 transition-colors">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {event.commentCount} comments
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-3">About</h2>
          <p className="text-sm text-gray-600 mb-4">
            Human-Verified News aggregates stories from multiple sources and provides
            a universal comment section where every user is verified as a unique human
            through Alien.org.
          </p>
          <div className="flex items-center space-x-2 text-sm">
            <span className="w-2 h-2 bg-alien-500 rounded-full"></span>
            <span className="text-gray-600">Bot-free discussions</span>
          </div>
        </div>

        {/* Categories */}
        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {['Politics', 'Technology', 'Business', 'Science', 'Health', 'Sports', 'Entertainment', 'World', 'Environment'].map(
              (cat) => (
                <Link
                  key={cat}
                  to={`/category/${cat.toLowerCase()}`}
                  className="badge-gray hover:bg-gray-200 transition-colors"
                >
                  {cat}
                </Link>
              )
            )}
          </div>
        </div>
      </aside>
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
              <span className={clsx('badge', getCategoryBadgeClass(event.category))}>
                {event.category}
              </span>
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
                <span>{event.sourceCount || event.sources?.length || 0} sources</span>
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="skeleton h-8 w-40" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start space-x-4">
              <div className="skeleton w-24 h-24 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-6 w-full" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <aside className="space-y-6">
        <div className="card p-4">
          <div className="skeleton h-6 w-24 mb-4" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-12 w-full mb-3" />
          ))}
        </div>
      </aside>
    </div>
  );
}
