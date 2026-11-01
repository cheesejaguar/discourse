import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CommentItem from './CommentItem';
import { useAuthStore } from '../store/auth';
import type { Comment, User } from '../lib/api';
import { mockFetch, ok, requests } from '../test/fetch';

const NOW = new Date('2024-01-01T00:05:00Z');

const mockComment: Comment = {
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

const otherUser: User = { id: 'u2', displayName: 'OtherUser', karma: 1, isVerified: true, createdAt: '2024-01-01' };
const author: User = { id: 'u1', displayName: 'TestUser', karma: 100, isVerified: true, createdAt: '2024-01-01' };

function loginAs(user: User | null) {
  useAuthStore.setState({ user, isAuthenticated: !!user, token: user ? 'test-token' : null });
}

function renderItem(comment: Comment = mockComment, props: Partial<React.ComponentProps<typeof CommentItem>> = {}) {
  const handlers = {
    onVote: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onReplyAdded: vi.fn(),
  };
  render(
    <MemoryRouter>
      <CommentItem comment={comment} eventId="e1" {...handlers} {...props} />
    </MemoryRouter>
  );
  return handlers;
}

const upvoteButton = () => screen.getAllByRole('button')[0];
const downvoteButton = () => screen.getAllByRole('button')[1];

describe('CommentItem', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    loginAs(otherUser);
  });

  it('should render comment content and relative time', () => {
    renderItem();

    expect(screen.getByText('Test comment content')).toBeInTheDocument();
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('should render author info linking to the author profile', () => {
    renderItem();

    expect(screen.getByRole('link', { name: 'TestUser' })).toHaveAttribute('href', '/user/u1');
    expect(screen.getByText('100 karma')).toBeInTheDocument();
  });

  it.each([
    [5, 'text-orange-500'],
    [-3, 'text-blue-500'],
    [0, 'text-gray-500'],
  ])('should render score %i with class %s', (score, className) => {
    renderItem({ ...mockComment, score });

    expect(screen.getByText(String(score))).toHaveClass(className);
  });

  it('should call onVote when upvote clicked', async () => {
    const { onVote } = renderItem();

    fireEvent.click(upvoteButton());

    await waitFor(() => expect(onVote).toHaveBeenCalledWith('c1', 'UP'));
    expect(upvoteButton()).toHaveAttribute('title', 'Upvote');
  });

  it('should call onVote when downvote clicked', async () => {
    const { onVote } = renderItem();

    fireEvent.click(downvoteButton());

    await waitFor(() => expect(onVote).toHaveBeenCalledWith('c1', 'DOWN'));
  });

  it('should disable voting and hide reply when not authenticated', () => {
    loginAs(null);
    const { onVote } = renderItem();

    expect(upvoteButton()).toBeDisabled();
    expect(upvoteButton()).toHaveAttribute('title', 'Sign in to vote');
    fireEvent.click(upvoteButton());

    expect(onVote).not.toHaveBeenCalled();
    expect(screen.queryByText('Reply')).not.toBeInTheDocument();
  });

  it('should toggle replies visibility with pluralised count', () => {
    renderItem({
      ...mockComment,
      replies: [{ ...mockComment, id: 'c2', parentId: 'c1', content: 'Nested reply', replyCount: 0 }],
    });

    expect(screen.getByText('Nested reply')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Hide 2 replies/));
    expect(screen.queryByText('Nested reply')).not.toBeInTheDocument();
    expect(screen.getByText(/Show 2 replies/)).toBeInTheDocument();
  });

  it('should use singular "reply" for one reply', () => {
    renderItem({ ...mockComment, replyCount: 1 });

    expect(screen.getByText(/Hide 1 reply$/)).toBeInTheDocument();
  });

  it('should collapse replies by default at depth 2', () => {
    renderItem(
      { ...mockComment, replies: [{ ...mockComment, id: 'c2', content: 'Deep reply', replyCount: 0 }] },
      { depth: 2 }
    );

    expect(screen.queryByText('Deep reply')).not.toBeInTheDocument();
    expect(screen.getByText(/Show 2 replies/)).toBeInTheDocument();
  });

  it('should toggle the real reply form when reply button clicked', () => {
    renderItem();

    fireEvent.click(screen.getByText('Reply'));
    expect(screen.getByPlaceholderText('Reply to TestUser...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('Reply to TestUser...')).not.toBeInTheDocument();
  });

  it('should post a reply with parentId, notify the parent and close the form', async () => {
    const reply = { ...mockComment, id: 'c9', parentId: 'c1', content: 'My reply' };
    mockFetch({ 'POST /comments': ok(reply) });
    const { onReplyAdded } = renderItem();

    fireEvent.click(screen.getByText('Reply'));
    await userEvent.type(screen.getByPlaceholderText('Reply to TestUser...'), 'My reply');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(onReplyAdded).toHaveBeenCalledWith(reply));
    expect(requests[0].body).toEqual({ eventId: 'e1', parentId: 'c1', content: 'My reply' });
    expect(screen.queryByPlaceholderText('Reply to TestUser...')).not.toBeInTheDocument();
  });

  it('should not show delete button to non-authors', () => {
    renderItem();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should show delete button for author', () => {
    loginAs(author);
    renderItem();

    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should show and cancel delete confirmation', () => {
    loginAs(author);
    renderItem();

    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Are you sure you want to delete this comment?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Are you sure you want to delete this comment?')).not.toBeInTheDocument();
  });

  it('should call onDelete when confirmed and close the confirmation', async () => {
    loginAs(author);
    const { onDelete } = renderItem();

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getAllByText('Delete')[1]);

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('c1'));
    await waitFor(() =>
      expect(screen.queryByText('Are you sure you want to delete this comment?')).not.toBeInTheDocument()
    );
  });

  it('should show "Deleting..." while delete is in progress', async () => {
    loginAs(author);
    renderItem(mockComment, { onDelete: () => new Promise(() => {}) });

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getAllByText('Delete')[1]);

    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
  });

  it('should show [deleted] author and hide actions for deleted comments', () => {
    renderItem({ ...mockComment, isDeleted: true, content: '[deleted]', author: null });

    expect(screen.getAllByText('[deleted]')).toHaveLength(2);
    expect(upvoteButton()).toBeDisabled();
    expect(screen.queryByText('Reply')).not.toBeInTheDocument();
  });

  it('should show edited indicator', () => {
    renderItem({ ...mockComment, isEdited: true, editedAt: '2024-01-02T00:00:00Z' });

    expect(screen.getByText('edited')).toBeInTheDocument();
  });

  it('should highlight upvoted comment', () => {
    renderItem({ ...mockComment, userVote: 'UP' });

    expect(upvoteButton()).toHaveClass('voted-up');
    expect(downvoteButton()).not.toHaveClass('voted-down');
  });

  it('should highlight downvoted comment', () => {
    renderItem({ ...mockComment, userVote: 'DOWN' });

    expect(downvoteButton()).toHaveClass('voted-down');
    expect(upvoteButton()).not.toHaveClass('voted-up');
  });

  it('should render nested replies indented', () => {
    renderItem({
      ...mockComment,
      replyCount: 1,
      replies: [{ ...mockComment, id: 'c2', parentId: 'c1', content: 'Nested reply', replyCount: 0, replies: [] }],
    });

    const nested = screen.getByText('Nested reply').closest('.group');
    expect(nested).toHaveClass('ml-6');
  });
});
