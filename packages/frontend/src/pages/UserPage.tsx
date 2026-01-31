import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { usersApi, type UserProfile, type Comment } from '../lib/api';

export default function UserPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'comments' | 'about'>('comments');

  useEffect(() => {
    async function fetchUser() {
      if (!userId) return;
      try {
        const [userData, commentsData] = await Promise.all([
          usersApi.getById(userId),
          usersApi.getComments(userId, { limit: 20 }),
        ]);
        setUser(userData);
        setComments(commentsData.comments);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, [userId]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">User not found</h1>
        <Link to="/" className="link mt-4 inline-block">
          Return to home
        </Link>
      </div>
    );
  }

  const joinedAgo = formatDistanceToNow(new Date(user.createdAt), { addSuffix: true });

  return (
    <div className="max-w-4xl mx-auto">
      {/* User Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start space-x-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
            <span className="text-white text-3xl font-bold">
              {user.displayName[0].toUpperCase()}
            </span>
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">{user.displayName}</h1>
              {user.isVerified && (
                <span className="flex items-center space-x-1 text-alien-600" title="Verified Human">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>

            {user.bio && <p className="text-gray-600 mt-2">{user.bio}</p>}

            <div className="flex items-center space-x-6 mt-4 text-sm">
              <div>
                <span className="font-semibold text-gray-900">{user.karma}</span>
                <span className="text-gray-500 ml-1">karma</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">{user.commentCount}</span>
                <span className="text-gray-500 ml-1">comments</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">{user.totalUpvotes}</span>
                <span className="text-gray-500 ml-1">upvotes received</span>
              </div>
              <div className="text-gray-500">Joined {joinedAgo}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('comments')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'comments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'about'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            About
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500">No comments yet</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="card p-4">
                <Link
                  to={`/event/${comment.event?.slug || comment.eventId}`}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {comment.event?.title || 'View discussion'}
                </Link>

                <div className="mt-2 text-gray-800 line-clamp-3">{comment.content}</div>

                <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <span>{comment.score} points</span>
                  </span>
                  <span>{comment.replyCount} replies</span>
                  <span>
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">User Information</h2>

          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500">Display Name</dt>
              <dd className="text-gray-900">{user.displayName}</dd>
            </div>

            {user.bio && (
              <div>
                <dt className="text-sm text-gray-500">Bio</dt>
                <dd className="text-gray-900">{user.bio}</dd>
              </div>
            )}

            <div>
              <dt className="text-sm text-gray-500">Karma</dt>
              <dd className="text-gray-900">{user.karma} points</dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Member Since</dt>
              <dd className="text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Verification Status</dt>
              <dd className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-alien-500 rounded-full"></span>
                <span className="text-gray-900">Verified Human (Alien.org)</span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card p-6 mb-6">
        <div className="flex items-start space-x-4">
          <div className="skeleton w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-8 w-48" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="skeleton h-4 w-48 mb-2" />
            <div className="skeleton h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
