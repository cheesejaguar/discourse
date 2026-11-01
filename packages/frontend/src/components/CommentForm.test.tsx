import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommentForm from './CommentForm';
import { useAuthStore } from '../store/auth';
import { mockFetch, ok, fail, requests, pending } from '../test/fetch';

const createdComment = {
  id: 'c1',
  eventId: 'e1',
  parentId: null,
  content: 'Test comment',
  score: 1,
  upvotes: 1,
  downvotes: 0,
  replyCount: 0,
  isEdited: false,
  isDeleted: false,
  isHidden: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  author: { id: '1', displayName: 'testUser', karma: 100 },
};

describe('CommentForm', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: '1', displayName: 'testUser', karma: 100, isVerified: true, createdAt: '2024-01-01' },
      token: 'test-token',
      isAuthenticated: true,
    });
    useAuthStore.getState().setToken('test-token');
  });

  it('should render the form', () => {
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    expect(screen.getByPlaceholderText('Share your thoughts...')).toHaveAttribute('maxLength', '10000');
    expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('should display the capitalised user avatar initial', () => {
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should use custom placeholder', () => {
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} placeholder="Custom placeholder" />);

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should show character count', async () => {
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('Share your thoughts...'), 'Hello');

    expect(screen.getByText('5/10,000 characters')).toBeInTheDocument();
  });

  it('should disable post button when content is empty or whitespace', async () => {
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Share your thoughts...'), '   ');
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
  });

  it('should enable post button when content is not empty', async () => {
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('Share your thoughts...'), 'Test comment');

    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled();
  });

  it('should POST the trimmed comment with auth and pass the created comment back', async () => {
    mockFetch({ 'POST /comments': ok(createdComment) });
    const onCommentAdded = vi.fn();
    render(<CommentForm eventId="e1" onCommentAdded={onCommentAdded} />);

    await userEvent.type(screen.getByPlaceholderText('Share your thoughts...'), '  Test comment  ');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(onCommentAdded).toHaveBeenCalledWith(createdComment));
    expect(requests[0].body).toEqual({ eventId: 'e1', content: 'Test comment' });
    expect(requests[0].headers.Authorization).toBe('Bearer test-token');
  });

  it('should include parentId when replying', async () => {
    mockFetch({ 'POST /comments': ok({ ...createdComment, parentId: 'p1', content: 'Reply' }) });
    const onCommentAdded = vi.fn();
    render(<CommentForm eventId="e1" parentId="p1" onCommentAdded={onCommentAdded} />);

    await userEvent.type(screen.getByPlaceholderText('Share your thoughts...'), 'Reply');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(onCommentAdded).toHaveBeenCalled());
    expect(requests[0].body).toEqual({ eventId: 'e1', parentId: 'p1', content: 'Reply' });
  });

  it('should show a spinner and disable the button while submitting', async () => {
    mockFetch({ 'POST /comments': () => pending() });
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('Share your thoughts...'), 'Test');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      const submit = document.querySelector('button[type="submit"]')!;
      expect(submit).toBeDisabled();
      expect(submit.querySelector('svg.animate-spin')).toBeInTheDocument();
    });
  });

  it('should show the server error and keep the content on submit failure', async () => {
    mockFetch({ 'POST /comments': fail(429, 'RATE_LIMIT_EXCEEDED', 'Comment rate limit exceeded.') });
    const onCommentAdded = vi.fn();
    render(<CommentForm eventId="e1" onCommentAdded={onCommentAdded} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'Test');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Comment rate limit exceeded.')).toBeInTheDocument();
    expect(textarea.value).toBe('Test');
    expect(onCommentAdded).not.toHaveBeenCalled();
  });

  it('should show a validation error and not POST when submitting empty content', async () => {
    mockFetch({});
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    fireEvent.submit(screen.getByPlaceholderText('Share your thoughts...').closest('form')!);

    expect(await screen.findByText('Comment cannot be empty')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should clear content after successful submit', async () => {
    mockFetch({ 'POST /comments': ok(createdComment) });
    render(<CommentForm eventId="e1" onCommentAdded={vi.fn()} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'Test');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(textarea.value).toBe(''));
  });
});
