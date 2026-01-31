import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserPage from './UserPage';

// Mock the API
vi.mock('../lib/api', () => ({
  usersApi: {
    getById: vi.fn(),
    getComments: vi.fn(),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 days ago',
}));

const mockUser = {
  id: 'u1',
  displayName: 'TestUser',
  avatarUrl: null,
  bio: 'Test bio',
  karma: 500,
  isVerified: true,
  createdAt: '2024-01-01T00:00:00Z',
  commentCount: 10,
  totalUpvotes: 50,
  totalDownvotes: 5,
};

const mockComments = [
  {
    id: 'c1',
    content: 'Test comment',
    score: 5,
    replyCount: 2,
    createdAt: '2024-01-01T00:00:00Z',
    event: {
      id: 'e1',
      slug: 'test-event',
      title: 'Test Event',
    },
  },
];

const renderWithRouter = (userId: string = 'u1') => {
  return render(
    <MemoryRouter initialEntries={[`/user/${userId}`]}>
      <Routes>
        <Route path="/user/:userId" element={<UserPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('UserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton initially', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockImplementation(() => new Promise(() => {}));
    usersApi.getComments.mockImplementation(() => new Promise(() => {}));

    renderWithRouter();

    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('should display user profile after loading', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(mockUser);
    usersApi.getComments.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });
  });

  it('should display user karma', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(mockUser);
    usersApi.getComments.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('karma')).toBeInTheDocument();
    });
  });

  it('should display user bio', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(mockUser);
    usersApi.getComments.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Test bio')).toBeInTheDocument();
    });
  });

  it('should display user comments tab', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(mockUser);
    usersApi.getComments.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Comments')).toBeInTheDocument();
    });
  });

  it('should display user comments', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(mockUser);
    usersApi.getComments.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
  });

  it('should switch to about tab', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(mockUser);
    usersApi.getComments.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      fireEvent.click(screen.getByText('About'));
    });

    expect(screen.getByText('User Information')).toBeInTheDocument();
  });

  it('should display verification status', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(mockUser);
    usersApi.getComments.mockResolvedValue({ comments: mockComments, pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      fireEvent.click(screen.getByText('About'));
    });

    expect(screen.getByText(/Verified Human/)).toBeInTheDocument();
  });

  it('should display not found for missing user', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue(null);
    usersApi.getComments.mockResolvedValue({ comments: [], pagination: {} as any });

    renderWithRouter('non-existent');

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });

  it('should display empty comments message', async () => {
    const { usersApi } = vi.mocked(await import('../lib/api'));
    usersApi.getById.mockResolvedValue({ ...mockUser, commentCount: 0 });
    usersApi.getComments.mockResolvedValue({ comments: [], pagination: {} as any });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('No comments yet')).toBeInTheDocument();
    });
  });
});
