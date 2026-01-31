// User types
export interface User {
  id: string;
  alienId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  karma: number;
  createdAt: Date;
  updatedAt: Date;
  isVerified: boolean;
  isBanned: boolean;
  banReason?: string;
}

export interface UserProfile extends User {
  commentCount: number;
  totalUpvotes: number;
  totalDownvotes: number;
}

// News Source types
export interface NewsSource {
  id: string;
  name: string;
  domain: string;
  logoUrl?: string;
  biasRating?: BiasRating;
  isActive: boolean;
  createdAt: Date;
}

export type BiasRating = 'far-left' | 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'far-right';

// News Article types
export interface NewsArticle {
  id: string;
  sourceId: string;
  source?: NewsSource;
  eventId?: string;
  title: string;
  url: string;
  summary?: string;
  imageUrl?: string;
  publishedAt: Date;
  fetchedAt: Date;
  author?: string;
}

// News Event types (aggregated stories)
export interface NewsEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: NewsCategory;
  imageUrl?: string;
  articles: NewsArticle[];
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  isTrending: boolean;
}

export type NewsCategory =
  | 'politics'
  | 'technology'
  | 'business'
  | 'science'
  | 'health'
  | 'sports'
  | 'entertainment'
  | 'world'
  | 'environment'
  | 'other';

// Comment types
export interface Comment {
  id: string;
  eventId: string;
  authorId: string;
  author?: User;
  parentId?: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  replies?: Comment[];
  replyCount: number;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentWithVote extends Comment {
  userVote?: VoteType;
}

// Vote types
export type VoteType = 'up' | 'down';

export interface Vote {
  id: string;
  userId: string;
  commentId: string;
  type: VoteType;
  createdAt: Date;
}

// Authentication types
export interface AlienAuthPayload {
  alienId: string;
  signature: string;
  timestamp: number;
  nonce: string;
}

export interface AlienVerificationResult {
  isValid: boolean;
  alienId?: string;
  error?: string;
}

export interface Session {
  id: string;
  userId: string;
  alienId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Request types
export interface CreateCommentRequest {
  eventId: string;
  parentId?: string;
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface VoteRequest {
  commentId: string;
  type: VoteType;
}

export interface SearchRequest {
  query: string;
  category?: NewsCategory;
  page?: number;
  limit?: number;
}

// Moderation types
export interface Report {
  id: string;
  reporterId: string;
  commentId: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate-speech'
  | 'misinformation'
  | 'off-topic'
  | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

// WebSocket Event types
export interface WSEvent {
  type: WSEventType;
  payload: unknown;
}

export type WSEventType =
  | 'comment:new'
  | 'comment:updated'
  | 'comment:deleted'
  | 'vote:updated'
  | 'event:updated';
