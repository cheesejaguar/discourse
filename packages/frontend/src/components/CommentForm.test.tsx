import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommentForm from './CommentForm';
import { useAuthStore } from '../store/auth';

// Mock the auth store
vi.mock('../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Mock the commentsApi
vi.mock('../lib/api', () => ({
  commentsApi: {
    create: vi.fn(),
  },
}));

describe('CommentForm', () => {
  const mockOnCommentAdded = vi.fn();
  const mockOnCancel = vi.fn();
  const mockUser = {
    id: '1',
    displayName: 'TestUser',
    karma: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
    });
  });

  it('should render the form', () => {
    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    expect(screen.getByPlaceholderText('Share your thoughts...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Post/i })).toBeInTheDocument();
  });

  it('should display user avatar initial', () => {
    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should use custom placeholder', () => {
    render(
      <CommentForm
        eventId="e1"
        onCommentAdded={mockOnCommentAdded}
        placeholder="Custom placeholder"
      />
    );

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('should show cancel button when onCancel provided', () => {
    render(
      <CommentForm
        eventId="e1"
        onCommentAdded={mockOnCommentAdded}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('should call onCancel when cancel button clicked', () => {
    render(
      <CommentForm
        eventId="e1"
        onCommentAdded={mockOnCommentAdded}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show character count', async () => {
    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    await userEvent.type(textarea, 'Hello');

    expect(screen.getByText('5/10,000 characters')).toBeInTheDocument();
  });

  it('should disable post button when content is empty', () => {
    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    const postButton = screen.getByRole('button', { name: /Post/i });
    expect(postButton).toBeDisabled();
  });

  it('should enable post button when content is not empty', async () => {
    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    await userEvent.type(textarea, 'Test comment');

    const postButton = screen.getByRole('button', { name: /Post/i });
    expect(postButton).not.toBeDisabled();
  });

  it('should submit comment successfully', async () => {
    const mockComment = { id: 'c1', content: 'Test comment' };
    const { commentsApi } = await import('../lib/api');
    vi.mocked(commentsApi.create).mockResolvedValue(mockComment as any);

    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    await userEvent.type(textarea, 'Test comment');

    const postButton = screen.getByRole('button', { name: /Post/i });
    fireEvent.click(postButton);

    await waitFor(() => {
      expect(commentsApi.create).toHaveBeenCalledWith({
        eventId: 'e1',
        parentId: undefined,
        content: 'Test comment',
      });
      expect(mockOnCommentAdded).toHaveBeenCalledWith(mockComment);
    });
  });

  it('should include parentId when replying', async () => {
    const mockComment = { id: 'c1', content: 'Reply' };
    const { commentsApi } = await import('../lib/api');
    vi.mocked(commentsApi.create).mockResolvedValue(mockComment as any);

    render(
      <CommentForm
        eventId="e1"
        parentId="p1"
        onCommentAdded={mockOnCommentAdded}
      />
    );

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    await userEvent.type(textarea, 'Reply');

    const postButton = screen.getByRole('button', { name: /Post/i });
    fireEvent.click(postButton);

    await waitFor(() => {
      expect(commentsApi.create).toHaveBeenCalledWith({
        eventId: 'e1',
        parentId: 'p1',
        content: 'Reply',
      });
    });
  });

  it('should show error on submit failure', async () => {
    const { commentsApi } = await import('../lib/api');
    vi.mocked(commentsApi.create).mockRejectedValue(new Error('Failed to post'));

    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    await userEvent.type(textarea, 'Test');

    const postButton = screen.getByRole('button', { name: /Post/i });
    fireEvent.click(postButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to post')).toBeInTheDocument();
    });
  });

  it('should show error for empty content', async () => {
    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...');
    await userEvent.type(textarea, '   ');
    await userEvent.clear(textarea);

    // Type and submit to trigger validation
    const form = textarea.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Comment cannot be empty')).toBeInTheDocument();
    });
  });

  it('should clear content after successful submit', async () => {
    const mockComment = { id: 'c1', content: 'Test' };
    const { commentsApi } = await import('../lib/api');
    vi.mocked(commentsApi.create).mockResolvedValue(mockComment as any);

    render(<CommentForm eventId="e1" onCommentAdded={mockOnCommentAdded} />);

    const textarea = screen.getByPlaceholderText('Share your thoughts...') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'Test');

    const postButton = screen.getByRole('button', { name: /Post/i });
    fireEvent.click(postButton);

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });
});
