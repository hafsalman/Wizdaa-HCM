import { HcmClientService } from '../../src/hcm-client/hcm-client.service';

describe('HcmClientService', () => {
  describe('calculateBackoff', () => {
    let service: HcmClientService;

    beforeEach(() => {
      const mockConfig = {
        get: jest
          .fn()
          .mockImplementation((key: string, defaultVal: any) => defaultVal),
      };
      service = new HcmClientService(mockConfig as any);
    });

    it('should return base of 1000ms for retry 0', () => {
      const backoff = service.calculateBackoff(0);
      expect(backoff).toBeGreaterThanOrEqual(1000);
      expect(backoff).toBeLessThanOrEqual(2000);
    });

    it('should return base of 2000ms for retry 1', () => {
      const backoff = service.calculateBackoff(1);
      expect(backoff).toBeGreaterThanOrEqual(2000);
      expect(backoff).toBeLessThanOrEqual(3000);
    });

    it('should return base of 4000ms for retry 2', () => {
      const backoff = service.calculateBackoff(2);
      expect(backoff).toBeGreaterThanOrEqual(4000);
      expect(backoff).toBeLessThanOrEqual(5000);
    });

    it('should return base of 8000ms for retry 3', () => {
      const backoff = service.calculateBackoff(3);
      expect(backoff).toBeGreaterThanOrEqual(8000);
      expect(backoff).toBeLessThanOrEqual(9000);
    });

    it('should return base of 16000ms for retry 4', () => {
      const backoff = service.calculateBackoff(4);
      expect(backoff).toBeGreaterThanOrEqual(16000);
      expect(backoff).toBeLessThanOrEqual(17000);
    });

    it('should include jitter (not always exact power of 2)', () => {
      const results = new Set<number>();
      for (let i = 0; i < 10; i++) {
        results.add(service.calculateBackoff(0));
      }
      // With jitter, we should see variation
      expect(results.size).toBeGreaterThan(1);
    });
  });
});
