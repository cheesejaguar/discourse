import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { eventsApi, commentsApi, votesApi, type NewsEventDetail, type Comment } from '../lib/api';
import { useAuthStore } from '../store/auth';
import CommentForm from '../components/CommentForm';
import CommentItem from '../components/CommentItem';

type SortOption = 'best' | 'top' | 'new' | 'controversial';

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isAuthenticated } = useAuthStore();
  const [event, setEvent] = useState<NewsEventDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('best');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      if (!eventId) return;
      try {
        const eventData = await eventsApi.getById(eventId);
        setEvent(eventData);
      } catch (error) {
        console.error('Failed to fetch event:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    async function fetchComments() {
      if (!event) return;
      setIsLoadingComments(true);
      try {
        const { comments: fetchedComments } = await commentsApi.list({
          eventId: event.id,
          sort: sortBy,
          limit: 50,
        });
        setComments(fetchedComments);
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      } finally {
        setIsLoadingComments(false);
      }
    }
    fetchComments();
  }, [event, sortBy]);

  const handleCommentAdded = (comment: Comment) => {
    setComments((prev) => [comment, ...prev]);
  };

  const handleVote = async (commentId: string, type: 'UP' | 'DOWN') => {
    try {
      const result = await votesApi.vote(commentId, type);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                score: result.score,
                upvotes: result.upvotes,
                downvotes: result.downvotes,
                userVote: result.userVote,
              }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await commentsApi.delete(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, isDeleted: true, content: '[deleted]', author: null } : c
        )
      );
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Event not found</h1>
        <Link to="/" className="link mt-4 inline-block">
          Return to home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Event Header */}
      <header className="mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <span
            className={clsx(
              'badge',
              getCategoryBadgeClass(event.category)
            )}
          >
            {event.category}
          </span>
          {event.isTrending && (
            <span className="badge bg-orange-100 text-orange-700">Trending</span>
          )}
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">{event.title}</h1>

        <p className="text-lg text-gray-600 mb-6">{event.summary}</p>

        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
          <span>{event.articles.length} sources</span>
          <span>{event.commentCount} comments</span>
        </div>
      </header>

      {/* Sources */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Coverage from {event.articles.length} Sources
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {event.articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start space-x-3">
                <div
                  className={clsx(
                    'w-3 h-3 rounded-full flex-shrink-0 mt-1.5',
                    article.source.biasRating
                      ? `bias-${article.source.biasRating}`
                      : 'bg-gray-300'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {article.source.name}
                    </span>
                    {article.source.biasRating && (
                      <span className="text-xs text-gray-500 capitalize">
                        ({article.source.biasRating.replace('-', ' ')})
                      </span>
                    )}
                  </div>
                  <h3 className="text-gray-700 group-hover:text-primary-600 line-clamp-2 transition-colors">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                    <span>
                      {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                    </span>
                    {article.author && <span>by {article.author}</span>}
                  </div>
                </div>
                <svg
                  className="w-4 h-4 text-gray-400 group-hover:text-primary-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </a>
          ))}
        </div>

        {/* Bias Legend */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">Source Bias Indicators:</p>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bias-far-left" />
              <span>Far Left</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bias-left" />
              <span>Left</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bias-center-left" />
              <span>Center Left</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bias-center" />
              <span>Center</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bias-center-right" />
              <span>Center Right</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bias-right" />
              <span>Right</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bias-far-right" />
              <span>Far Right</span>
            </span>
          </div>
        </div>
      </section>

      {/* Comments Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Discussion ({event.commentCount})
          </h2>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="best">Best</option>
              <option value="top">Top</option>
              <option value="new">New</option>
              <option value="controversial">Controversial</option>
            </select>
          </div>
        </div>

        {/* Verified Notice */}
        <div className="bg-alien-50 border border-alien-200 rounded-lg p-3 mb-4 flex items-center space-x-2">
          <svg className="w-5 h-5 text-alien-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-sm text-alien-800">
            All commenters are verified humans through Alien.org
          </span>
        </div>

        {/* New Comment Form */}
        {isAuthenticated ? (
          <CommentForm eventId={event.id} onCommentAdded={handleCommentAdded} />
        ) : (
          <div className="card p-4 mb-6 text-center">
            <p className="text-gray-600">Sign in with Alien ID to join the discussion</p>
          </div>
        )}

        {/* Comments List */}
        {isLoadingComments ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4">
                <div className="flex space-x-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-16 w-full" />
                    <div className="skeleton h-4 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-500">No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                eventId={event.id}
                onVote={handleVote}
                onDelete={handleDelete}
                onReplyAdded={(reply) => {
                  // Add reply to the comment's replies
                  setComments((prev) =>
                    prev.map((c) =>
                      c.id === comment.id
                        ? { ...c, replyCount: c.replyCount + 1, replies: [...(c.replies || []), reply] }
                        : c
                    )
                  );
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
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
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="skeleton h-6 w-24 mb-2" />
        <div className="skeleton h-10 w-full mb-4" />
        <div className="skeleton h-6 w-3/4 mb-6" />
        <div className="skeleton h-4 w-48" />
      </header>
      <section className="mb-8">
        <div className="skeleton h-8 w-48 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-20 w-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
