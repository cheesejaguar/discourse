import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { AlienAuthService, alienAuthService } from './alienAuth.js';
import { config } from '../config/index.js';

describe('AlienAuthService', () => {
  let service: AlienAuthService;

  beforeEach(() => {
    service = new AlienAuthService();
  });

  describe('generateChallenge', () => {
    it('should generate a valid challenge', async () => {
      const challenge = await service.generateChallenge();

      expect(challenge).toHaveProperty('challengeId');
      expect(challenge).toHaveProperty('qrCodeUrl');
      expect(challenge).toHaveProperty('expiresAt');
      expect(challenge.challengeId).toBeTruthy();
      expect(challenge.qrCodeUrl).toContain('alien://verify');
      expect(challenge.expiresAt).toBeInstanceOf(Date);
      expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should encode the app id, challenge id and callback URL in the QR payload', async () => {
      const before = Date.now();
      const challenge = await service.generateChallenge();

      const url = new URL(challenge.qrCodeUrl);
      expect(url.protocol).toBe('alien:');
      const data = JSON.parse(Buffer.from(url.searchParams.get('data')!, 'base64').toString());
      expect(data).toEqual({
        appId: config.alien.appId,
        challengeId: challenge.challengeId,
        nonce: expect.stringMatching(/^[a-f0-9]{64}$/),
        timestamp: expect.any(Number),
        callbackUrl: `${config.corsOrigin}/auth/callback`,
      });
      expect(challenge.expiresAt.getTime()).toBe(data.timestamp + 5 * 60 * 1000);
      expect(data.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('should generate unique challenge IDs', async () => {
      const challenge1 = await service.generateChallenge();
      const challenge2 = await service.generateChallenge();

      expect(challenge1.challengeId).not.toBe(challenge2.challengeId);
    });
  });

  describe('verifyPayload', () => {
    it('should verify a valid payload in dev mode', async () => {
      const payload = AlienAuthService.generateMockPayload();
      const result = await service.verifyPayload(payload);

      expect(result.isValid).toBe(true);
      expect(result.alienId).toBe(payload.alienId);
    });

    it('should reject expired payload', async () => {
      const payload = AlienAuthService.generateMockPayload();
      payload.timestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago

      const result = await service.verifyPayload(payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Authentication payload has expired');
    });

    it('should reject future timestamp', async () => {
      const payload = AlienAuthService.generateMockPayload();
      payload.timestamp = Date.now() + 10 * 60 * 1000; // 10 minutes in future

      const result = await service.verifyPayload(payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Authentication payload has expired');
    });

    it.each([
      ['alienId', { alienId: '', signature: 'sig', nonce: 'nonce' }],
      ['signature', { alienId: 'alien_1', signature: '', nonce: 'nonce' }],
      ['nonce', { alienId: 'alien_1', signature: 'sig', nonce: '' }],
    ])('should reject a payload missing %s', async (_field, fields) => {
      const result = await service.verifyPayload({ ...fields, timestamp: Date.now() });

      expect(result).toEqual({ isValid: false, error: 'Invalid authentication payload' });
    });
  });

  describe('verifyAlienIdStatus', () => {
    it('should return true in dev mode', async () => {
      const result = await service.verifyAlienIdStatus('test-alien-id');

      expect(result).toBe(true);
    });
  });

  describe('generateMockAlienId', () => {
    it('should generate a valid mock alien ID', () => {
      const alienId = AlienAuthService.generateMockAlienId();

      expect(alienId).toMatch(/^alien_[a-f0-9]{32}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = AlienAuthService.generateMockAlienId();
      const id2 = AlienAuthService.generateMockAlienId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('generateMockPayload', () => {
    it('should generate a valid mock payload', () => {
      const payload = AlienAuthService.generateMockPayload();

      expect(payload.alienId).toMatch(/^alien_[a-f0-9]{32}$/);
      expect(payload.nonce).toMatch(/^[a-f0-9]{32}$/);
      expect(Math.abs(payload.timestamp - Date.now())).toBeLessThan(5000);
      const expectedSignature = crypto
        .createHash('sha256')
        .update(`${payload.alienId}:${payload.timestamp}:${payload.nonce}`)
        .digest('hex');
      expect(payload.signature).toBe(expectedSignature);
    });

    it('should use provided alienId', () => {
      const alienId = 'alien_test123';
      const payload = AlienAuthService.generateMockPayload(alienId);

      expect(payload.alienId).toBe(alienId);
    });
  });

  describe('in production mode', () => {
    let ProdService: typeof AlienAuthService;

    beforeEach(async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      ({ AlienAuthService: ProdService } = await import('./alienAuth.js'));
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
      vi.resetModules();
    });

    it('should not accept payloads without a configured Alien API', async () => {
      const result = await new ProdService().verifyPayload(ProdService.generateMockPayload());

      expect(result).toEqual({
        isValid: false,
        error: 'Alien.org API credentials not configured',
      });
    });

    it('should not report an Alien ID as verified', async () => {
      await expect(new ProdService().verifyAlienIdStatus('alien_1')).resolves.toBe(false);
    });
  });

  describe('alienAuthService singleton', () => {
    it('should be an instance of AlienAuthService', () => {
      expect(alienAuthService).toBeInstanceOf(AlienAuthService);
    });
  });
});
