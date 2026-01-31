// API Constants
export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Comment Constants
export const MAX_COMMENT_LENGTH = 10000;
export const MIN_COMMENT_LENGTH = 1;
export const MAX_COMMENT_DEPTH = 10;
export const COMMENT_EDIT_WINDOW_MINUTES = 10;

// Rate Limiting
export const RATE_LIMIT_COMMENTS_PER_MINUTE = 5;
export const RATE_LIMIT_VOTES_PER_MINUTE = 30;
export const RATE_LIMIT_REPORTS_PER_HOUR = 10;

// Session
export const SESSION_DURATION_HOURS = 168; // 7 days
export const SESSION_REFRESH_THRESHOLD_HOURS = 24;

// News Categories with labels
export const NEWS_CATEGORIES = {
  politics: 'Politics',
  technology: 'Technology',
  business: 'Business',
  science: 'Science',
  health: 'Health',
  sports: 'Sports',
  entertainment: 'Entertainment',
  world: 'World',
  environment: 'Environment',
  other: 'Other',
} as const;

// Bias Rating Labels
export const BIAS_RATINGS = {
  'far-left': 'Far Left',
  left: 'Left',
  'center-left': 'Center Left',
  center: 'Center',
  'center-right': 'Center Right',
  right: 'Right',
  'far-right': 'Far Right',
} as const;

// Comment Sort Options
export const COMMENT_SORT_OPTIONS = {
  best: 'Best',
  top: 'Top',
  new: 'Newest',
  controversial: 'Controversial',
} as const;

export type CommentSortOption = keyof typeof COMMENT_SORT_OPTIONS;

// Report Reasons with labels
export const REPORT_REASONS = {
  spam: 'Spam or advertising',
  harassment: 'Harassment or bullying',
  'hate-speech': 'Hate speech',
  misinformation: 'Misinformation',
  'off-topic': 'Off-topic',
  other: 'Other',
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_ALIEN_VERIFICATION_FAILED: 'AUTH_ALIEN_VERIFICATION_FAILED',

  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_BANNED: 'USER_BANNED',
  USER_DISPLAY_NAME_TAKEN: 'USER_DISPLAY_NAME_TAKEN',

  // Comment errors
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  COMMENT_TOO_LONG: 'COMMENT_TOO_LONG',
  COMMENT_TOO_SHORT: 'COMMENT_TOO_SHORT',
  COMMENT_EDIT_WINDOW_EXPIRED: 'COMMENT_EDIT_WINDOW_EXPIRED',
  COMMENT_ALREADY_DELETED: 'COMMENT_ALREADY_DELETED',
  COMMENT_DEPTH_EXCEEDED: 'COMMENT_DEPTH_EXCEEDED',

  // Vote errors
  VOTE_OWN_COMMENT: 'VOTE_OWN_COMMENT',
  VOTE_ALREADY_EXISTS: 'VOTE_ALREADY_EXISTS',

  // Event errors
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
