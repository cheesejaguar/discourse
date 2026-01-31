import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { type Comment } from '../lib/api';
import { useAuthStore } from '../store/auth';
import CommentForm from './CommentForm';

interface CommentItemProps {
  comment: Comment;
  eventId: string;
  depth?: number;
  onVote: (commentId: string, type: 'UP' | 'DOWN') => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReplyAdded: (reply: Comment) => void;
}

export default function CommentItem({
  comment,
  eventId,
  depth = 0,
  onVote,
  onDelete,
  onReplyAdded,
}: CommentItemProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(depth < 2);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAuthor = user?.id === comment.author?.id;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  const handleVote = async (type: 'UP' | 'DOWN') => {
    if (!isAuthenticated) return;
    await onVote(comment.id, type);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleReplyAdded = (reply: Comment) => {
    onReplyAdded(reply);
    setIsReplying(false);
    setShowReplies(true);
  };

  return (
    <div className={clsx('group', depth > 0 && 'ml-6 border-l-2 border-gray-100 pl-4')}>
      <div className="card p-4 hover:bg-gray-50 transition-colors">
        <div className="flex space-x-3">
          {/* Vote Buttons */}
          <div className="flex flex-col items-center space-y-1">
            <button
              onClick={() => handleVote('UP')}
              disabled={!isAuthenticated || comment.isDeleted}
              className={clsx(
                'vote-btn p-1 rounded hover:bg-gray-100',
                comment.userVote === 'UP' && 'voted-up',
                (!isAuthenticated || comment.isDeleted) && 'opacity-50 cursor-not-allowed'
              )}
              title={isAuthenticated ? 'Upvote' : 'Sign in to vote'}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>

            <span
              className={clsx(
                'text-sm font-medium',
                comment.score > 0 && 'text-orange-500',
                comment.score < 0 && 'text-blue-500',
                comment.score === 0 && 'text-gray-500'
              )}
            >
              {comment.score}
            </span>

            <button
              onClick={() => handleVote('DOWN')}
              disabled={!isAuthenticated || comment.isDeleted}
              className={clsx(
                'vote-btn p-1 rounded hover:bg-gray-100',
                comment.userVote === 'DOWN' && 'voted-down',
                (!isAuthenticated || comment.isDeleted) && 'opacity-50 cursor-not-allowed'
              )}
              title={isAuthenticated ? 'Downvote' : 'Sign in to vote'}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center space-x-2 text-sm">
              {comment.author ? (
                <>
                  <Link
                    to={`/user/${comment.author.id}`}
                    className="font-medium text-gray-900 hover:text-primary-600"
                  >
                    {comment.author.displayName}
                  </Link>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{comment.author.karma} karma</span>
                </>
              ) : (
                <span className="text-gray-500 italic">[deleted]</span>
              )}
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{timeAgo}</span>
              {comment.isEdited && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-400 text-xs">edited</span>
                </>
              )}
            </div>

            {/* Body */}
            <div className="mt-2 text-gray-800 whitespace-pre-wrap break-words">
              {comment.content}
            </div>

            {/* Actions */}
            {!comment.isDeleted && (
              <div className="flex items-center space-x-4 mt-2">
                {isAuthenticated && (
                  <button
                    onClick={() => setIsReplying(!isReplying)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span>Reply</span>
                  </button>
                )}

                {comment.replyCount > 0 && (
                  <button
                    onClick={() => setShowReplies(!showReplies)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                  >
                    <svg
                      className={clsx('w-4 h-4 transition-transform', showReplies && 'rotate-90')}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>
                      {showReplies ? 'Hide' : 'Show'} {comment.replyCount}{' '}
                      {comment.replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                  </button>
                )}

                {isAuthor && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm text-red-500 hover:text-red-700 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800 mb-2">
                  Are you sure you want to delete this comment?
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="btn-sm bg-red-600 text-white hover:bg-red-700"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn-sm btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply Form */}
      {isReplying && (
        <div className="mt-2 ml-6">
          <CommentForm
            eventId={eventId}
            parentId={comment.id}
            onCommentAdded={handleReplyAdded}
            onCancel={() => setIsReplying(false)}
            placeholder={`Reply to ${comment.author?.displayName || 'this comment'}...`}
            autoFocus
          />
        </div>
      )}

      {/* Replies */}
      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              eventId={eventId}
              depth={depth + 1}
              onVote={onVote}
              onDelete={onDelete}
              onReplyAdded={onReplyAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
