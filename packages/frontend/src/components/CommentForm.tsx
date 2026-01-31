import { useState } from 'react';
import { commentsApi, type Comment } from '../lib/api';
import { useAuthStore } from '../store/auth';

interface CommentFormProps {
  eventId: string;
  parentId?: string;
  onCommentAdded: (comment: Comment) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function CommentForm({
  eventId,
  parentId,
  onCommentAdded,
  onCancel,
  placeholder = 'Share your thoughts...',
  autoFocus = false,
}: CommentFormProps) {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const comment = await commentsApi.create({
        eventId,
        parentId,
        content: content.trim(),
      });
      setContent('');
      onCommentAdded(comment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-4">
      <div className="flex space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-medium">
            {user?.displayName[0].toUpperCase()}
          </span>
        </div>

        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            className="textarea w-full"
            rows={3}
            maxLength={10000}
            autoFocus={autoFocus}
          />

          {error && (
            <p className="text-red-500 text-sm mt-1">{error}</p>
          )}

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {content.length}/10,000 characters
            </span>

            <div className="flex items-center space-x-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-ghost btn-sm"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="btn-primary btn-sm"
              >
                {isSubmitting ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  'Post'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
