import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlienAuthService, alienAuthService } from './alienAuth.js';

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    isDev: true,
    alien: {
      apiUrl: 'https://api.alien.test',
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
    },
    corsOrigin: 'http://localhost:5173',
  },
}));

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

    it('should accept payload without alienId in dev mode (falls through to API mock)', async () => {
      // In dev mode, even incomplete payloads are accepted via the API mock
      const payload = {
        alienId: '',
        signature: 'test',
        timestamp: Date.now(),
        nonce: 'test',
      };

      const result = await service.verifyPayload(payload);

      // Dev mode accepts all payloads with valid timestamp
      expect(result.isValid).toBe(true);
    });

    it('should accept payload without signature in dev mode (falls through to API mock)', async () => {
      // In dev mode, even incomplete payloads are accepted via the API mock
      const payload = {
        alienId: 'test',
        signature: '',
        timestamp: Date.now(),
        nonce: 'test',
      };

      const result = await service.verifyPayload(payload);

      // Dev mode accepts all payloads with valid timestamp
      expect(result.isValid).toBe(true);
    });

    it('should accept payload without nonce in dev mode (falls through to API mock)', async () => {
      // In dev mode, even incomplete payloads are accepted via the API mock
      const payload = {
        alienId: 'test',
        signature: 'test',
        timestamp: Date.now(),
        nonce: '',
      };

      const result = await service.verifyPayload(payload);

      // Dev mode accepts all payloads with valid timestamp
      expect(result.isValid).toBe(true);
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

      expect(payload).toHaveProperty('alienId');
      expect(payload).toHaveProperty('signature');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('nonce');
      expect(payload.alienId).toMatch(/^alien_/);
      expect(payload.signature).toBeTruthy();
      expect(payload.timestamp).toBeGreaterThan(0);
      expect(payload.nonce).toBeTruthy();
    });

    it('should use provided alienId', () => {
      const alienId = 'alien_test123';
      const payload = AlienAuthService.generateMockPayload(alienId);

      expect(payload.alienId).toBe(alienId);
    });
  });

  describe('alienAuthService singleton', () => {
    it('should be an instance of AlienAuthService', () => {
      expect(alienAuthService).toBeInstanceOf(AlienAuthService);
    });
  });
});
