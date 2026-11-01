import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginModal from './LoginModal';
import { useAuthStore } from '../store/auth';
import { mockFetch, ok, fail, requests, pending } from '../test/fetch';

const loginResponse = {
  user: { id: '1', displayName: 'TestUser', karma: 0, isVerified: true, createdAt: '2024-01-01' },
  token: 'jwt-token',
  expiresAt: '2024-12-31',
};

describe('LoginModal', () => {
  it('should render the modal', () => {
    render(<LoginModal onClose={vi.fn()} />);

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Alien.org to join the discussion')).toBeInTheDocument();
  });

  it('should render display name input', () => {
    render(<LoginModal onClose={vi.fn()} />);

    expect(screen.getByLabelText(/Display Name/i)).toHaveAttribute('placeholder', 'Choose a username');
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<LoginModal onClose={onClose} />);

    fireEvent.click(document.querySelector('.bg-black\\/50')!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<LoginModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should log in with the typed display name and close', async () => {
    mockFetch({ 'POST /auth/dev-login': ok(loginResponse) });
    const onClose = vi.fn();
    render(<LoginModal onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Display Name/i), 'TestUser');
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Alien ID/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(requests[0].body).toEqual({ displayName: 'TestUser' });
    expect(useAuthStore.getState()).toMatchObject({
      token: 'jwt-token',
      isAuthenticated: true,
      user: loginResponse.user,
    });
  });

  it('should log in without a display name if empty', async () => {
    mockFetch({ 'POST /auth/dev-login': ok(loginResponse) });
    const onClose = vi.fn();
    render(<LoginModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Sign in with Alien ID/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // undefined displayName is dropped by JSON.stringify
    expect(requests[0].body).toEqual({});
  });

  it('should display the server error on login failure and stay open', async () => {
    mockFetch({ 'POST /auth/dev-login': fail(400, 'VALIDATION_ERROR', 'Display name already taken') });
    const onClose = vi.fn();
    render(<LoginModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Sign in with Alien ID/i }));

    expect(await screen.findByText('Display name already taken')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should show a disabled spinner button while logging in', async () => {
    mockFetch({ 'POST /auth/dev-login': () => pending() });
    render(<LoginModal onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Sign in with Alien ID/i }));

    await waitFor(() => {
      const submitButton = document.querySelector('button[type="submit"]');
      expect(submitButton).toBeDisabled();
      expect(submitButton?.querySelector('svg.animate-spin')).toBeInTheDocument();
    });
    expect(screen.queryByText('Sign in with Alien ID')).not.toBeInTheDocument();
  });
});
