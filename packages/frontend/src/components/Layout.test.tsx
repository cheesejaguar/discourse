import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './Layout';
import { useAuthStore } from '../store/auth';
import { mockFetch, ok, requests } from '../test/fetch';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div data-testid="outlet">Outlet Content</div>} />
          <Route path="*" element={<div data-testid="child-route">Child</div>} />
        </Route>
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );

const testUser = {
  id: 'u1',
  displayName: 'testUser',
  karma: 100,
  isVerified: true,
  createdAt: '2024-01-01',
};

describe('Layout', () => {
  describe('when not authenticated', () => {
    it('should render header', () => {
      renderLayout();

      expect(screen.getByText('Human-Verified News')).toBeInTheDocument();
    });

    it('should render sign in button', () => {
      renderLayout();

      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('should show the real login modal when sign in clicked', () => {
      renderLayout();

      fireEvent.click(screen.getByText('Sign In'));

      expect(screen.getByText('Sign in with Alien.org to join the discussion')).toBeInTheDocument();
    });

    it('should close login modal from its close button', () => {
      renderLayout();

      fireEvent.click(screen.getByText('Sign In'));
      fireEvent.click(screen.getByRole('button', { name: '' }));

      expect(screen.queryByText('Welcome')).not.toBeInTheDocument();
    });

    it('should close login modal and show the user after a successful login', async () => {
      mockFetch({
        'POST /auth/dev-login': ok({ user: testUser, token: 't', expiresAt: '2024-12-31' }),
      });
      renderLayout();

      fireEvent.click(screen.getByText('Sign In'));
      fireEvent.click(screen.getByRole('button', { name: /Sign in with Alien ID/i }));

      expect(await screen.findByText('testUser')).toBeInTheDocument();
      expect(screen.queryByText('Welcome')).not.toBeInTheDocument();
    });

    it('should render category navigation links', () => {
      renderLayout();

      expect(screen.getByRole('link', { name: 'Politics' })).toHaveAttribute('href', '/category/politics');
      expect(screen.getByRole('link', { name: 'Technology' })).toHaveAttribute('href', '/category/technology');
      expect(screen.getByRole('link', { name: 'World' })).toHaveAttribute('href', '/category/world');
    });

    it('should render the child route in the outlet', () => {
      renderLayout();

      expect(screen.getByTestId('outlet')).toHaveTextContent('Outlet Content');
    });

    it('should render footer', () => {
      renderLayout();

      expect(screen.getByText('Human-Verified News Platform')).toBeInTheDocument();
      expect(screen.getByText('All users are verified humans')).toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: testUser, token: 'test-token', isAuthenticated: true });
    });

    it('should display user name and capitalised initial', () => {
      renderLayout();

      expect(screen.getByText('testUser')).toBeInTheDocument();
      expect(screen.getByText('T')).toBeInTheDocument();
      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('should open user menu when clicked', () => {
      renderLayout();

      fireEvent.click(screen.getByText('testUser'));

      expect(screen.getByText('100 karma')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Your Profile' })).toHaveAttribute('href', '/user/u1');
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('should close user menu when backdrop clicked', () => {
      renderLayout();

      fireEvent.click(screen.getByText('testUser'));
      fireEvent.click(document.querySelector('.fixed.inset-0.z-40')!);

      expect(screen.queryByText('Your Profile')).not.toBeInTheDocument();
    });

    it('should log out via the API and show sign in when sign out clicked', async () => {
      mockFetch({ 'POST /auth/logout': ok() });
      renderLayout();

      fireEvent.click(screen.getByText('testUser'));
      fireEvent.click(screen.getByText('Sign Out'));

      expect(await screen.findByText('Sign In')).toBeInTheDocument();
      expect(requests[0]).toMatchObject({ method: 'POST', path: '/auth/logout' });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should navigate to the profile and close the menu when profile link clicked', () => {
      renderLayout();

      fireEvent.click(screen.getByText('testUser'));
      fireEvent.click(screen.getByText('Your Profile'));

      expect(screen.getByTestId('location')).toHaveTextContent('/user/u1');
      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should navigate to the encoded, trimmed search URL on submit', async () => {
      renderLayout();

      const searchInput = screen.getByPlaceholderText('Search news...');
      fireEvent.change(searchInput, { target: { value: '  test & query  ' } });
      fireEvent.submit(searchInput.closest('form')!);

      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent('/search?q=test%20%26%20query');
      });
    });

    it('should not navigate with a whitespace-only query', () => {
      renderLayout();

      const searchInput = screen.getByPlaceholderText('Search news...');
      fireEvent.change(searchInput, { target: { value: '   ' } });
      fireEvent.submit(searchInput.closest('form')!);

      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    });
  });
});
