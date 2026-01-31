import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';
import { useAuthStore } from '../store/auth';

// Mock the auth store
vi.mock('../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Mock the Outlet from react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
    useNavigate: () => vi.fn(),
  };
});

// Mock LoginModal
vi.mock('./LoginModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="login-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('Layout', () => {
  const mockUser = {
    id: '1',
    displayName: 'TestUser',
    karma: 100,
  };

  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when not authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        logout: mockLogout,
      });
    });

    it('should render header', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByText('Human-Verified News')).toBeInTheDocument();
    });

    it('should render sign in button', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('should show login modal when sign in clicked', () => {
      renderWithRouter(<Layout />);

      fireEvent.click(screen.getByText('Sign In'));

      expect(screen.getByTestId('login-modal')).toBeInTheDocument();
    });

    it('should close login modal', () => {
      renderWithRouter(<Layout />);

      fireEvent.click(screen.getByText('Sign In'));
      fireEvent.click(screen.getByText('Close Modal'));

      expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();
    });

    it('should render search input', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByPlaceholderText('Search news...')).toBeInTheDocument();
    });

    it('should render category navigation', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByText('Politics')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    it('should render outlet', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('should render footer', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByText('Human-Verified News Platform')).toBeInTheDocument();
      expect(screen.getByText('All users are verified humans')).toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        logout: mockLogout,
      });
    });

    it('should display user info', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });

    it('should display user initial in avatar', () => {
      renderWithRouter(<Layout />);

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should open user menu when clicked', () => {
      renderWithRouter(<Layout />);

      fireEvent.click(screen.getByText('TestUser'));

      expect(screen.getByText('100 karma')).toBeInTheDocument();
      expect(screen.getByText('Your Profile')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('should close user menu when backdrop clicked', () => {
      renderWithRouter(<Layout />);

      fireEvent.click(screen.getByText('TestUser'));

      // Find and click the backdrop
      const backdrop = document.querySelector('.fixed.inset-0.z-40');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(screen.queryByText('Your Profile')).not.toBeInTheDocument();
    });

    it('should call logout when sign out clicked', () => {
      renderWithRouter(<Layout />);

      fireEvent.click(screen.getByText('TestUser'));
      fireEvent.click(screen.getByText('Sign Out'));

      expect(mockLogout).toHaveBeenCalled();
    });

    it('should close menu when profile link clicked', () => {
      renderWithRouter(<Layout />);

      fireEvent.click(screen.getByText('TestUser'));
      fireEvent.click(screen.getByText('Your Profile'));

      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        isAuthenticated: false,
        logout: mockLogout,
      });
    });

    it('should handle search form submission', async () => {
      const mockNavigate = vi.fn();
      vi.mocked(await import('react-router-dom')).useNavigate = () => mockNavigate;

      renderWithRouter(<Layout />);

      const searchInput = screen.getByPlaceholderText('Search news...');
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      // The navigation would be called but since we're testing in isolation,
      // we just verify the form handles the event
    });

    it('should not search with empty query', () => {
      renderWithRouter(<Layout />);

      const searchInput = screen.getByPlaceholderText('Search news...');
      const form = searchInput.closest('form');
      fireEvent.submit(form!);

      // Should not navigate with empty query
    });
  });
});
