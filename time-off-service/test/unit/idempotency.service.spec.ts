import { IdempotencyService } from '../../src/core/idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new IdempotencyService(mockRepo);
  });

  describe('getExisting', () => {
    it('should return null if no record exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.getExisting('key-123');
      expect(result).toBeNull();
    });

    it('should return record if found and not expired', async () => {
      const record = {
        key: 'key-123',
        responseStatus: 201,
        responseBody: '{"id":"abc"}',
        expiresAt: new Date(Date.now() + 86400000), // 24h from now
      };
      mockRepo.findOne.mockResolvedValue(record);
      const result = await service.getExisting('key-123');
      expect(result).toEqual(record);
    });

    it('should delete and return null if record is expired', async () => {
      const record = {
        key: 'key-123',
        responseStatus: 201,
        responseBody: '{"id":"abc"}',
        expiresAt: new Date(Date.now() - 1000), // expired
      };
      mockRepo.findOne.mockResolvedValue(record);
      const result = await service.getExisting('key-123');
      expect(result).toBeNull();
      expect(mockRepo.delete).toHaveBeenCalledWith('key-123');
    });
  });

  describe('store', () => {
    it('should store a response with 24h TTL', async () => {
      await service.store('key-456', 201, { id: 'abc' });
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'key-456',
          responseStatus: 201,
          responseBody: '{"id":"abc"}',
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired records', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 5 });
      const result = await service.cleanupExpired();
      expect(result).toBe(5);
    });
  });
});
