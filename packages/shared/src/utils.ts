import type { NewsCategory, BiasRating, Comment } from './types/index.js';

/**
 * Generate a URL-friendly slug from a title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 100);
}

/**
 * Calculate time ago string from a date
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

/**
 * Format a number with K/M suffixes for large numbers
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Calculate comment score from upvotes and downvotes
 */
export function calculateScore(upvotes: number, downvotes: number): number {
  return upvotes - downvotes;
}

/**
 * Calculate Wilson score for ranking comments (Reddit's "best" algorithm)
 * https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
 */
export function wilsonScore(upvotes: number, downvotes: number): number {
  const n = upvotes + downvotes;
  if (n === 0) return 0;

  const z = 1.96; // 95% confidence
  const p = upvotes / n;

  return (
    (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
}

/**
 * Calculate controversy score (comments with similar upvotes and downvotes)
 */
export function controversyScore(upvotes: number, downvotes: number): number {
  if (upvotes <= 0 || downvotes <= 0) return 0;
  const magnitude = upvotes + downvotes;
  const balance = Math.min(upvotes, downvotes) / Math.max(upvotes, downvotes);
  return magnitude * balance;
}

/**
 * Flatten nested comments into a flat array
 */
export function flattenComments(comments: Comment[]): Comment[] {
  const result: Comment[] = [];

  function traverse(comment: Comment) {
    result.push(comment);
    if (comment.replies) {
      comment.replies.forEach(traverse);
    }
  }

  comments.forEach(traverse);
  return result;
}

/**
 * Build a comment tree from flat comments
 */
export function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const roots: Comment[] = [];

  // First pass: create map of all comments
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree structure
  comments.forEach((comment) => {
    const mappedComment = commentMap.get(comment.id)!;
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(mappedComment);
      } else {
        // Parent not found, treat as root
        roots.push(mappedComment);
      }
    } else {
      roots.push(mappedComment);
    }
  });

  return roots;
}

/**
 * Validate a comment content
 */
export function validateCommentContent(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Comment cannot be empty' };
  }
  if (content.length > 10000) {
    return { valid: false, error: 'Comment exceeds maximum length of 10,000 characters' };
  }
  return { valid: true };
}

/**
 * Validate a display name
 */
export function validateDisplayName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Display name cannot be empty' };
  }
  if (name.length < 3) {
    return { valid: false, error: 'Display name must be at least 3 characters' };
  }
  if (name.length > 30) {
    return { valid: false, error: 'Display name cannot exceed 30 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { valid: false, error: 'Display name can only contain letters, numbers, underscores, and hyphens' };
  }
  return { valid: true };
}

/**
 * Check if a category is valid
 */
export function isValidCategory(category: string): category is NewsCategory {
  const validCategories: NewsCategory[] = [
    'politics',
    'technology',
    'business',
    'science',
    'health',
    'sports',
    'entertainment',
    'world',
    'environment',
    'other',
  ];
  return validCategories.includes(category as NewsCategory);
}

/**
 * Check if a bias rating is valid
 */
export function isValidBiasRating(rating: string): rating is BiasRating {
  const validRatings: BiasRating[] = [
    'far-left',
    'left',
    'center-left',
    'center',
    'center-right',
    'right',
    'far-right',
  ];
  return validRatings.includes(rating as BiasRating);
}

/**
 * Sanitize HTML from user input (basic implementation)
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
