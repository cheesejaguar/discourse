import { describe, it, expect } from 'vitest';
import {
  API_VERSION,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
  MAX_COMMENT_DEPTH,
  COMMENT_EDIT_WINDOW_MINUTES,
  RATE_LIMIT_COMMENTS_PER_MINUTE,
  RATE_LIMIT_VOTES_PER_MINUTE,
  RATE_LIMIT_REPORTS_PER_HOUR,
  SESSION_DURATION_HOURS,
  SESSION_REFRESH_THRESHOLD_HOURS,
  NEWS_CATEGORIES,
  BIAS_RATINGS,
  COMMENT_SORT_OPTIONS,
  REPORT_REASONS,
  ERROR_CODES,
} from './constants.js';

describe('Constants', () => {
  describe('API Constants', () => {
    it('should have correct API_VERSION', () => {
      expect(API_VERSION).toBe('v1');
    });

    it('should have valid pagination defaults', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(20);
      expect(MAX_PAGE_SIZE).toBe(100);
      expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    });
  });

  describe('Comment Constants', () => {
    it('should have valid comment length limits', () => {
      expect(MAX_COMMENT_LENGTH).toBe(10000);
      expect(MIN_COMMENT_LENGTH).toBe(1);
      expect(MIN_COMMENT_LENGTH).toBeLessThan(MAX_COMMENT_LENGTH);
    });

    it('should have valid comment depth', () => {
      expect(MAX_COMMENT_DEPTH).toBe(10);
    });

    it('should have valid edit window', () => {
      expect(COMMENT_EDIT_WINDOW_MINUTES).toBe(10);
    });
  });

  describe('Rate Limiting Constants', () => {
    it('should have positive rate limits', () => {
      expect(RATE_LIMIT_COMMENTS_PER_MINUTE).toBeGreaterThan(0);
      expect(RATE_LIMIT_VOTES_PER_MINUTE).toBeGreaterThan(0);
      expect(RATE_LIMIT_REPORTS_PER_HOUR).toBeGreaterThan(0);
    });

    it('should have reasonable values', () => {
      expect(RATE_LIMIT_COMMENTS_PER_MINUTE).toBe(5);
      expect(RATE_LIMIT_VOTES_PER_MINUTE).toBe(30);
      expect(RATE_LIMIT_REPORTS_PER_HOUR).toBe(10);
    });
  });

  describe('Session Constants', () => {
    it('should have valid session duration', () => {
      expect(SESSION_DURATION_HOURS).toBe(168); // 7 days
    });

    it('should have valid refresh threshold', () => {
      expect(SESSION_REFRESH_THRESHOLD_HOURS).toBe(24);
      expect(SESSION_REFRESH_THRESHOLD_HOURS).toBeLessThan(SESSION_DURATION_HOURS);
    });
  });

  describe('NEWS_CATEGORIES', () => {
    it('should have all expected categories', () => {
      expect(NEWS_CATEGORIES).toHaveProperty('politics', 'Politics');
      expect(NEWS_CATEGORIES).toHaveProperty('technology', 'Technology');
      expect(NEWS_CATEGORIES).toHaveProperty('business', 'Business');
      expect(NEWS_CATEGORIES).toHaveProperty('science', 'Science');
      expect(NEWS_CATEGORIES).toHaveProperty('health', 'Health');
      expect(NEWS_CATEGORIES).toHaveProperty('sports', 'Sports');
      expect(NEWS_CATEGORIES).toHaveProperty('entertainment', 'Entertainment');
      expect(NEWS_CATEGORIES).toHaveProperty('world', 'World');
      expect(NEWS_CATEGORIES).toHaveProperty('environment', 'Environment');
      expect(NEWS_CATEGORIES).toHaveProperty('other', 'Other');
    });

    it('should have 10 categories', () => {
      expect(Object.keys(NEWS_CATEGORIES)).toHaveLength(10);
    });
  });

  describe('BIAS_RATINGS', () => {
    it('should have all expected bias ratings', () => {
      expect(BIAS_RATINGS).toHaveProperty('far-left', 'Far Left');
      expect(BIAS_RATINGS).toHaveProperty('left', 'Left');
      expect(BIAS_RATINGS).toHaveProperty('center-left', 'Center Left');
      expect(BIAS_RATINGS).toHaveProperty('center', 'Center');
      expect(BIAS_RATINGS).toHaveProperty('center-right', 'Center Right');
      expect(BIAS_RATINGS).toHaveProperty('right', 'Right');
      expect(BIAS_RATINGS).toHaveProperty('far-right', 'Far Right');
    });

    it('should have 7 ratings', () => {
      expect(Object.keys(BIAS_RATINGS)).toHaveLength(7);
    });
  });

  describe('COMMENT_SORT_OPTIONS', () => {
    it('should have all expected sort options', () => {
      expect(COMMENT_SORT_OPTIONS).toHaveProperty('best', 'Best');
      expect(COMMENT_SORT_OPTIONS).toHaveProperty('top', 'Top');
      expect(COMMENT_SORT_OPTIONS).toHaveProperty('new', 'Newest');
      expect(COMMENT_SORT_OPTIONS).toHaveProperty('controversial', 'Controversial');
    });
  });

  describe('REPORT_REASONS', () => {
    it('should have all expected report reasons', () => {
      expect(REPORT_REASONS).toHaveProperty('spam', 'Spam or advertising');
      expect(REPORT_REASONS).toHaveProperty('harassment', 'Harassment or bullying');
      expect(REPORT_REASONS).toHaveProperty('hate-speech', 'Hate speech');
      expect(REPORT_REASONS).toHaveProperty('misinformation', 'Misinformation');
      expect(REPORT_REASONS).toHaveProperty('off-topic', 'Off-topic');
      expect(REPORT_REASONS).toHaveProperty('other', 'Other');
    });
  });

  describe('ERROR_CODES', () => {
    it('should have authentication error codes', () => {
      expect(ERROR_CODES.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
      expect(ERROR_CODES.AUTH_INVALID_TOKEN).toBe('AUTH_INVALID_TOKEN');
      expect(ERROR_CODES.AUTH_TOKEN_EXPIRED).toBe('AUTH_TOKEN_EXPIRED');
      expect(ERROR_CODES.AUTH_ALIEN_VERIFICATION_FAILED).toBe('AUTH_ALIEN_VERIFICATION_FAILED');
    });

    it('should have user error codes', () => {
      expect(ERROR_CODES.USER_NOT_FOUND).toBe('USER_NOT_FOUND');
      expect(ERROR_CODES.USER_BANNED).toBe('USER_BANNED');
      expect(ERROR_CODES.USER_DISPLAY_NAME_TAKEN).toBe('USER_DISPLAY_NAME_TAKEN');
    });

    it('should have comment error codes', () => {
      expect(ERROR_CODES.COMMENT_NOT_FOUND).toBe('COMMENT_NOT_FOUND');
      expect(ERROR_CODES.COMMENT_TOO_LONG).toBe('COMMENT_TOO_LONG');
      expect(ERROR_CODES.COMMENT_TOO_SHORT).toBe('COMMENT_TOO_SHORT');
      expect(ERROR_CODES.COMMENT_EDIT_WINDOW_EXPIRED).toBe('COMMENT_EDIT_WINDOW_EXPIRED');
      expect(ERROR_CODES.COMMENT_ALREADY_DELETED).toBe('COMMENT_ALREADY_DELETED');
      expect(ERROR_CODES.COMMENT_DEPTH_EXCEEDED).toBe('COMMENT_DEPTH_EXCEEDED');
    });

    it('should have vote error codes', () => {
      expect(ERROR_CODES.VOTE_OWN_COMMENT).toBe('VOTE_OWN_COMMENT');
      expect(ERROR_CODES.VOTE_ALREADY_EXISTS).toBe('VOTE_ALREADY_EXISTS');
    });

    it('should have general error codes', () => {
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
