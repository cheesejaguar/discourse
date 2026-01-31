import type { ApiResponse, PaginationInfo } from '@hvnp/shared';

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<ApiResponse<T>> {
    const { params, ...fetchOptions } = options;

    let url = `${API_BASE}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error?.message || 'An error occurred',
        data.error?.code || 'UNKNOWN_ERROR',
        response.status
      );
    }

    return data;
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const api = new ApiClient();

// Auth API
export const authApi = {
  async devLogin(displayName?: string) {
    const res = await api.post<{
      user: User;
      token: string;
      expiresAt: string;
    }>('/auth/dev-login', { displayName });
    return res.data!;
  },

  async getMe() {
    const res = await api.get<UserProfile>('/auth/me');
    return res.data!;
  },

  async updateProfile(data: { displayName?: string; bio?: string; avatarUrl?: string | null }) {
    const res = await api.patch<User>('/auth/me', data);
    return res.data!;
  },

  async logout() {
    await api.post('/auth/logout');
  },
};

// Events API
export const eventsApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    category?: string;
    trending?: boolean;
    search?: string;
  }) {
    const res = await api.get<NewsEvent[]>('/events', params as Record<string, string | number | boolean | undefined>);
    return { events: res.data!, pagination: res.pagination! };
  },

  async getTrending(limit?: number) {
    const res = await api.get<NewsEvent[]>('/events/trending', { limit });
    return res.data!;
  },

  async getCategories() {
    const res = await api.get<{ category: string; count: number }[]>('/events/categories');
    return res.data!;
  },

  async getById(eventId: string) {
    const res = await api.get<NewsEventDetail>(`/events/${eventId}`);
    return res.data!;
  },

  async getRelated(eventId: string, limit?: number) {
    const res = await api.get<NewsEvent[]>(`/events/${eventId}/related`, { limit });
    return res.data!;
  },
};

// Comments API
export const commentsApi = {
  async list(params: {
    eventId: string;
    page?: number;
    limit?: number;
    sort?: 'best' | 'top' | 'new' | 'controversial';
    parentId?: string;
  }) {
    const res = await api.get<Comment[]>('/comments', params as Record<string, string | number | boolean | undefined>);
    return { comments: res.data!, pagination: res.pagination! };
  },

  async getById(commentId: string) {
    const res = await api.get<Comment>(`/comments/${commentId}`);
    return res.data!;
  },

  async create(data: { eventId: string; parentId?: string; content: string }) {
    const res = await api.post<Comment>('/comments', data);
    return res.data!;
  },

  async update(commentId: string, content: string) {
    const res = await api.patch<Comment>(`/comments/${commentId}`, { content });
    return res.data!;
  },

  async delete(commentId: string) {
    await api.delete(`/comments/${commentId}`);
  },

  async getReplies(commentId: string, params?: { page?: number; limit?: number; sort?: string }) {
    const res = await api.get<Comment[]>(`/comments/${commentId}/replies`, params as Record<string, string | number | boolean | undefined>);
    return { comments: res.data!, pagination: res.pagination! };
  },
};

// Votes API
export const votesApi = {
  async vote(commentId: string, type: 'UP' | 'DOWN') {
    const res = await api.post<{
      commentId: string;
      score: number;
      upvotes: number;
      downvotes: number;
      userVote: string | null;
      action: string;
    }>(`/votes/${commentId}`, { type });
    return res.data!;
  },

  async removeVote(commentId: string) {
    const res = await api.delete<{
      commentId: string;
      score: number;
      upvotes: number;
      downvotes: number;
      userVote: null;
    }>(`/votes/${commentId}`);
    return res.data!;
  },

  async getUserVotes(commentIds: string[]) {
    const res = await api.get<Record<string, string>>('/votes/user', {
      commentIds: commentIds.join(','),
    });
    return res.data!;
  },
};

// Users API
export const usersApi = {
  async getById(userId: string) {
    const res = await api.get<UserProfile>(`/users/${userId}`);
    return res.data!;
  },

  async getComments(userId: string, params?: { page?: number; limit?: number; sort?: string }) {
    const res = await api.get<Comment[]>(`/users/${userId}/comments`, params as Record<string, string | number | boolean | undefined>);
    return { comments: res.data!, pagination: res.pagination! };
  },
};

// Reports API
export const reportsApi = {
  async create(data: { commentId: string; reason: string; description?: string }) {
    const res = await api.post<{ id: string }>('/reports', data);
    return res.data!;
  },
};

// Types
export interface User {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  karma: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile extends User {
  commentCount: number;
  totalUpvotes: number;
  totalDownvotes?: number;
}

export interface NewsSource {
  id: string;
  name: string;
  domain: string;
  logoUrl?: string | null;
  biasRating?: string | null;
}

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  summary?: string | null;
  imageUrl?: string | null;
  author?: string | null;
  publishedAt: string;
  source: NewsSource;
}

export interface NewsEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  imageUrl?: string | null;
  isTrending: boolean;
  commentCount: number;
  sourceCount?: number;
  sources?: { id: string; name: string; biasRating?: string | null; logoUrl?: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface NewsEventDetail extends NewsEvent {
  articles: NewsArticle[];
}

export interface Comment {
  id: string;
  eventId: string;
  parentId?: string | null;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  replyCount: number;
  isEdited: boolean;
  editedAt?: string | null;
  isDeleted: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    karma: number;
  } | null;
  userVote?: string | null;
  replies?: Comment[];
  event?: {
    id: string;
    slug: string;
    title: string;
  };
}
