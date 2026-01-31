import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  timeAgo,
  formatNumber,
  calculateScore,
  wilsonScore,
  controversyScore,
  flattenComments,
  buildCommentTree,
  validateCommentContent,
  validateDisplayName,
  isValidCategory,
  isValidBiasRating,
  sanitizeHtml,
  extractDomain,
  truncateText,
} from './utils.js';
import type { Comment } from './types/index.js';

describe('Utils', () => {
  describe('generateSlug', () => {
    it('should convert title to slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(generateSlug('Hello, World!')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('Hello   World')).toBe('hello-world');
    });

    it('should handle leading/trailing spaces', () => {
      // Spaces are converted to dashes first, then trim() only removes whitespace (not dashes)
      expect(generateSlug('  Hello World  ')).toBe('-hello-world-');
    });

    it('should truncate long titles', () => {
      const longTitle = 'a'.repeat(150);
      expect(generateSlug(longTitle).length).toBeLessThanOrEqual(100);
    });

    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('');
    });
  });

  describe('timeAgo', () => {
    it('should return "just now" for recent times', () => {
      const now = new Date();
      expect(timeAgo(now)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      expect(timeAgo(date)).toBe('5m ago');
    });

    it('should return hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(timeAgo(date)).toBe('3h ago');
    });

    it('should return days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(timeAgo(date)).toBe('2d ago');
    });

    it('should return weeks ago', () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      expect(timeAgo(date)).toBe('2w ago');
    });

    it('should return months ago', () => {
      // 45 days equals approximately 1.5 months, which floors to 1mo
      const date = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      expect(timeAgo(date)).toBe('1mo ago');
    });

    it('should return years ago', () => {
      const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      expect(timeAgo(date)).toBe('1y ago');
    });

    it('should handle string dates', () => {
      const dateStr = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(timeAgo(dateStr)).toBe('5m ago');
    });
  });

  describe('formatNumber', () => {
    it('should format small numbers as-is', () => {
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(999)).toBe('999');
    });

    it('should format thousands with K', () => {
      expect(formatNumber(1000)).toBe('1K');
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(10000)).toBe('10K');
    });

    it('should format millions with M', () => {
      expect(formatNumber(1000000)).toBe('1M');
      expect(formatNumber(2500000)).toBe('2.5M');
    });

    it('should remove trailing .0', () => {
      expect(formatNumber(2000)).toBe('2K');
      expect(formatNumber(3000000)).toBe('3M');
    });
  });

  describe('calculateScore', () => {
    it('should calculate score correctly', () => {
      expect(calculateScore(10, 5)).toBe(5);
      expect(calculateScore(5, 10)).toBe(-5);
      expect(calculateScore(0, 0)).toBe(0);
    });
  });

  describe('wilsonScore', () => {
    it('should return 0 for no votes', () => {
      expect(wilsonScore(0, 0)).toBe(0);
    });

    it('should return higher score for more upvotes', () => {
      const score1 = wilsonScore(10, 0);
      const score2 = wilsonScore(5, 0);
      expect(score1).toBeGreaterThan(score2);
    });

    it('should return lower score with more downvotes', () => {
      const score1 = wilsonScore(10, 0);
      const score2 = wilsonScore(10, 5);
      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle equal upvotes and downvotes', () => {
      const score = wilsonScore(5, 5);
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('controversyScore', () => {
    it('should return 0 if no upvotes', () => {
      expect(controversyScore(0, 5)).toBe(0);
    });

    it('should return 0 if no downvotes', () => {
      expect(controversyScore(5, 0)).toBe(0);
    });

    it('should return higher score for balanced votes with high magnitude', () => {
      const score1 = controversyScore(100, 100);
      const score2 = controversyScore(10, 10);
      expect(score1).toBeGreaterThan(score2);
    });

    it('should return lower score for unbalanced votes', () => {
      const score1 = controversyScore(50, 50);
      const score2 = controversyScore(90, 10);
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('flattenComments', () => {
    it('should flatten nested comments', () => {
      const comments: Comment[] = [
        {
          id: '1',
          eventId: 'e1',
          authorId: 'a1',
          content: 'Comment 1',
          score: 0,
          upvotes: 0,
          downvotes: 0,
          replyCount: 1,
          isEdited: false,
          isDeleted: false,
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          replies: [
            {
              id: '2',
              eventId: 'e1',
              authorId: 'a2',
              parentId: '1',
              content: 'Reply 1',
              score: 0,
              upvotes: 0,
              downvotes: 0,
              replyCount: 0,
              isEdited: false,
              isDeleted: false,
              isHidden: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      const flat = flattenComments(comments);
      expect(flat).toHaveLength(2);
      expect(flat[0].id).toBe('1');
      expect(flat[1].id).toBe('2');
    });

    it('should handle empty array', () => {
      expect(flattenComments([])).toEqual([]);
    });
  });

  describe('buildCommentTree', () => {
    it('should build tree from flat comments', () => {
      const comments: Comment[] = [
        {
          id: '1',
          eventId: 'e1',
          authorId: 'a1',
          content: 'Comment 1',
          score: 0,
          upvotes: 0,
          downvotes: 0,
          replyCount: 1,
          isEdited: false,
          isDeleted: false,
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          eventId: 'e1',
          authorId: 'a2',
          parentId: '1',
          content: 'Reply 1',
          score: 0,
          upvotes: 0,
          downvotes: 0,
          replyCount: 0,
          isEdited: false,
          isDeleted: false,
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const tree = buildCommentTree(comments);
      expect(tree).toHaveLength(1);
      expect(tree[0].replies).toHaveLength(1);
      expect(tree[0].replies![0].id).toBe('2');
    });

    it('should handle orphaned comments', () => {
      const comments: Comment[] = [
        {
          id: '2',
          eventId: 'e1',
          authorId: 'a2',
          parentId: 'non-existent',
          content: 'Orphan',
          score: 0,
          upvotes: 0,
          downvotes: 0,
          replyCount: 0,
          isEdited: false,
          isDeleted: false,
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const tree = buildCommentTree(comments);
      expect(tree).toHaveLength(1);
    });
  });

  describe('validateCommentContent', () => {
    it('should accept valid content', () => {
      expect(validateCommentContent('Valid comment')).toEqual({ valid: true });
    });

    it('should reject empty content', () => {
      expect(validateCommentContent('')).toEqual({
        valid: false,
        error: 'Comment cannot be empty',
      });
    });

    it('should reject whitespace-only content', () => {
      expect(validateCommentContent('   ')).toEqual({
        valid: false,
        error: 'Comment cannot be empty',
      });
    });

    it('should reject content over 10000 chars', () => {
      expect(validateCommentContent('a'.repeat(10001))).toEqual({
        valid: false,
        error: 'Comment exceeds maximum length of 10,000 characters',
      });
    });
  });

  describe('validateDisplayName', () => {
    it('should accept valid names', () => {
      expect(validateDisplayName('JohnDoe')).toEqual({ valid: true });
      expect(validateDisplayName('user_123')).toEqual({ valid: true });
      expect(validateDisplayName('test-user')).toEqual({ valid: true });
    });

    it('should reject empty names', () => {
      expect(validateDisplayName('')).toEqual({
        valid: false,
        error: 'Display name cannot be empty',
      });
    });

    it('should reject names under 3 chars', () => {
      expect(validateDisplayName('ab')).toEqual({
        valid: false,
        error: 'Display name must be at least 3 characters',
      });
    });

    it('should reject names over 30 chars', () => {
      expect(validateDisplayName('a'.repeat(31))).toEqual({
        valid: false,
        error: 'Display name cannot exceed 30 characters',
      });
    });

    it('should reject names with invalid characters', () => {
      expect(validateDisplayName('user@name')).toEqual({
        valid: false,
        error: 'Display name can only contain letters, numbers, underscores, and hyphens',
      });
    });
  });

  describe('isValidCategory', () => {
    it('should accept valid categories', () => {
      expect(isValidCategory('politics')).toBe(true);
      expect(isValidCategory('technology')).toBe(true);
      expect(isValidCategory('other')).toBe(true);
    });

    it('should reject invalid categories', () => {
      expect(isValidCategory('invalid')).toBe(false);
      expect(isValidCategory('')).toBe(false);
    });
  });

  describe('isValidBiasRating', () => {
    it('should accept valid bias ratings', () => {
      expect(isValidBiasRating('left')).toBe(true);
      expect(isValidBiasRating('center')).toBe(true);
      expect(isValidBiasRating('far-right')).toBe(true);
    });

    it('should reject invalid bias ratings', () => {
      expect(isValidBiasRating('invalid')).toBe(false);
      expect(isValidBiasRating('')).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape ampersands', () => {
      expect(sanitizeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape single quotes', () => {
      expect(sanitizeHtml("it's")).toBe('it&#039;s');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
      expect(extractDomain('http://example.com')).toBe('example.com');
    });

    it('should remove www prefix', () => {
      expect(extractDomain('https://www.test.com')).toBe('test.com');
    });

    it('should return empty string for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBe('');
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
    });

    it('should handle exact length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });
  });
});
