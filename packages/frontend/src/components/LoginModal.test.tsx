import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginModal from './LoginModal';
import { useAuthStore } from '../store/auth';

// Mock the auth store
vi.mock('../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

describe('LoginModal', () => {
  const mockOnClose = vi.fn();
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: false,
    });
  });

  it('should render the modal', () => {
    render(<LoginModal onClose={mockOnClose} />);

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Alien.org to join the discussion')).toBeInTheDocument();
  });

  it('should render display name input', () => {
    render(<LoginModal onClose={mockOnClose} />);

    expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', () => {
    render(<LoginModal onClose={mockOnClose} />);

    const backdrop = document.querySelector('.bg-black\\/50');
    fireEvent.click(backdrop!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', () => {
    render(<LoginModal onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call login on form submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginModal onClose={mockOnClose} />);

    const input = screen.getByLabelText(/Display Name/i);
    await userEvent.type(input, 'TestUser');

    const submitButton = screen.getByRole('button', { name: /Sign in with Alien ID/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('TestUser');
    });
  });

  it('should call login without display name if empty', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginModal onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /Sign in with Alien ID/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(undefined);
    });
  });

  it('should display error on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Login failed'));
    render(<LoginModal onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /Sign in with Alien ID/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      login: mockLogin,
      isLoading: true,
    });

    render(<LoginModal onClose={mockOnClose} />);

    // During loading, button shows only spinner (no text), find by type="submit"
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeInTheDocument();
    expect(submitButton?.querySelector('svg.animate-spin')).toBeInTheDocument();
  });

  it('should close modal on successful login', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginModal onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /Sign in with Alien ID/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
