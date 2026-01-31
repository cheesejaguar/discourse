import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CommentItem from './CommentItem';
import { useAuthStore } from '../store/auth';

// Mock the auth store
vi.mock('../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}));

const mockComment = {
  id: 'c1',
  eventId: 'e1',
  parentId: null,
  content: 'Test comment content',
  score: 5,
  upvotes: 7,
  downvotes: 2,
  replyCount: 2,
  isEdited: false,
  isDeleted: false,
  isHidden: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  author: {
    id: 'u1',
    displayName: 'TestUser',
    avatarUrl: null,
    karma: 100,
  },
  userVote: null,
  replies: [],
};

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('CommentItem', () => {
  const mockOnVote = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnReplyAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'u2', displayName: 'OtherUser' },
      isAuthenticated: true,
    });
  });

  it('should render comment content', () => {
    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    expect(screen.getByText('Test comment content')).toBeInTheDocument();
  });

  it('should render author info', () => {
    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('100 karma')).toBeInTheDocument();
  });

  it('should render vote score', () => {
    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should call onVote when upvote clicked', async () => {
    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    const upvoteButton = screen.getAllByRole('button')[0];
    fireEvent.click(upvoteButton);

    await waitFor(() => {
      expect(mockOnVote).toHaveBeenCalledWith('c1', 'UP');
    });
  });

  it('should call onVote when downvote clicked', async () => {
    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    const downvoteButton = screen.getAllByRole('button')[1];
    fireEvent.click(downvoteButton);

    await waitFor(() => {
      expect(mockOnVote).toHaveBeenCalledWith('c1', 'DOWN');
    });
  });

  it('should not vote when not authenticated', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    const upvoteButton = screen.getAllByRole('button')[0];
    fireEvent.click(upvoteButton);

    expect(mockOnVote).not.toHaveBeenCalled();
  });

  it('should show reply count', () => {
    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    expect(screen.getByText(/2 replies/)).toBeInTheDocument();
  });

  it('should toggle reply form when reply button clicked', () => {
    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    const replyButton = screen.getByText('Reply');
    fireEvent.click(replyButton);

    expect(screen.getByPlaceholderText(/Reply to TestUser/)).toBeInTheDocument();
  });

  it('should show delete button for author', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'u1', displayName: 'TestUser' },
      isAuthenticated: true,
    });

    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should show delete confirmation when delete clicked', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'u1', displayName: 'TestUser' },
      isAuthenticated: true,
    });

    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText('Are you sure you want to delete this comment?')).toBeInTheDocument();
  });

  it('should call onDelete when confirmed', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 'u1', displayName: 'TestUser' },
      isAuthenticated: true,
    });

    mockOnDelete.mockResolvedValue(undefined);

    renderWithRouter(
      <CommentItem
        comment={mockComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getAllByText('Delete')[1]);

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith('c1');
    });
  });

  it('should show [deleted] for deleted comments', () => {
    const deletedComment = {
      ...mockComment,
      isDeleted: true,
      content: '[deleted]',
      author: null,
    };

    renderWithRouter(
      <CommentItem
        comment={deletedComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    // [deleted] appears in both author name and content areas
    const deletedElements = screen.getAllByText('[deleted]');
    expect(deletedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show edited indicator', () => {
    const editedComment = {
      ...mockComment,
      isEdited: true,
      editedAt: '2024-01-02T00:00:00Z',
    };

    renderWithRouter(
      <CommentItem
        comment={editedComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    expect(screen.getByText('edited')).toBeInTheDocument();
  });

  it('should highlight upvoted comment', () => {
    const upvotedComment = {
      ...mockComment,
      userVote: 'UP',
    };

    renderWithRouter(
      <CommentItem
        comment={upvotedComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    const upvoteButton = screen.getAllByRole('button')[0];
    expect(upvoteButton).toHaveClass('voted-up');
  });

  it('should highlight downvoted comment', () => {
    const downvotedComment = {
      ...mockComment,
      userVote: 'DOWN',
    };

    renderWithRouter(
      <CommentItem
        comment={downvotedComment}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    const downvoteButton = screen.getAllByRole('button')[1];
    expect(downvoteButton).toHaveClass('voted-down');
  });

  it('should render nested replies', () => {
    const commentWithReplies = {
      ...mockComment,
      replyCount: 1,
      replies: [
        {
          ...mockComment,
          id: 'c2',
          parentId: 'c1',
          content: 'Nested reply',
          replyCount: 0,
          replies: [],
        },
      ],
    };

    renderWithRouter(
      <CommentItem
        comment={commentWithReplies}
        eventId="e1"
        onVote={mockOnVote}
        onDelete={mockOnDelete}
        onReplyAdded={mockOnReplyAdded}
      />
    );

    // For depth 0, replies are shown by default (showReplies = depth < 2)
    // So the nested reply should already be visible
    expect(screen.getByText('Nested reply')).toBeInTheDocument();
  });
});
