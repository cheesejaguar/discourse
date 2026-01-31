import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create mock function with vi.hoisted so it's available during mock setup
const mockRefreshUser = vi.hoisted(() => vi.fn());

// Mock the auth store - useAuthStore accepts a selector function
vi.mock('./store/auth', () => ({
  useAuthStore: (selector?: (state: any) => any) => {
    const state = {
      refreshUser: mockRefreshUser,
      user: null,
      isAuthenticated: false,
      logout: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// Mock the pages
vi.mock('./pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home Page</div>,
}));

vi.mock('./pages/EventPage', () => ({
  default: () => <div data-testid="event-page">Event Page</div>,
}));

vi.mock('./pages/UserPage', () => ({
  default: () => <div data-testid="user-page">User Page</div>,
}));

vi.mock('./pages/SearchPage', () => ({
  default: () => <div data-testid="search-page">Search Page</div>,
}));

vi.mock('./pages/CategoryPage', () => ({
  default: () => <div data-testid="category-page">Category Page</div>,
}));

// Mock the Layout component - use Outlet for child route rendering
vi.mock('./components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    default: () => (
      <div data-testid="layout">
        <Outlet />
      </div>
    ),
  };
});

// Import after mocks
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render home page at root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('should render event page at /event/:eventId', () => {
    render(
      <MemoryRouter initialEntries={['/event/test-event']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('event-page')).toBeInTheDocument();
  });

  it('should render user page at /user/:userId', () => {
    render(
      <MemoryRouter initialEntries={['/user/test-user']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('user-page')).toBeInTheDocument();
  });

  it('should render search page at /search', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('search-page')).toBeInTheDocument();
  });

  it('should render category page at /category/:category', () => {
    render(
      <MemoryRouter initialEntries={['/category/technology']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('category-page')).toBeInTheDocument();
  });

  it('should call refreshUser on mount', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('should wrap routes in Layout', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});
