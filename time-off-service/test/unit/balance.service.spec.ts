import { BalanceService } from '../../src/balance/balance.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LeaveType } from '../../src/balance/leave-balance.entity';

describe('BalanceService', () => {
  let service: BalanceService;
  let mockRepo: any;
  let mockHcmClient: any;
  let mockEmployeeService: any;
  let mockEventEmitter: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d: any) => ({ ...d, version: 1 })),
      save: jest.fn().mockImplementation((d: any) => Promise.resolve(d)),
    };
    mockHcmClient = {
      getBalance: jest.fn().mockResolvedValue({ totalDays: 20, usedDays: 5 }),
    };
    mockEmployeeService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'emp-1', externalId: 'HCM-1' }),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    mockDataSource = {};

    service = new BalanceService(
      mockRepo,
      mockHcmClient,
      mockEmployeeService,
      mockEventEmitter,
      mockDataSource,
    );
  });

  describe('getOneOrFail', () => {
    it('should return balance if found', async () => {
      const balance = {
        id: 'b1',
        employeeId: 'e1',
        locationId: 'PKR-01',
        leaveType: 'VACATION',
      };
      mockRepo.findOne.mockResolvedValue(balance);
      const result = await service.getOneOrFail('e1', 'PKR-01', 'VACATION');
      expect(result).toEqual(balance);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getOneOrFail('e1', 'PKR-01', 'VACATION'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('incrementPendingDays', () => {
    it('should increment pending days successfully', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'b1',
        employeeId: 'e1',
        pendingDays: 2,
        version: 1,
      });
      mockRepo.save.mockResolvedValue({
        id: 'b1',
        employeeId: 'e1',
        pendingDays: 5,
        version: 2,
      });

      const result = await service.incrementPendingDays(
        'e1',
        'PKR-01',
        'VACATION',
        3,
      );
      expect(Number(result.pendingDays)).toBe(5);
    });

    it('should retry on optimistic lock conflict', async () => {
      const balance = {
        id: 'b1',
        employeeId: 'e1',
        pendingDays: 2,
        version: 1,
      };
      mockRepo.findOne.mockResolvedValue(balance);

      // First save fails (optimistic lock), second succeeds
      mockRepo.save
        .mockRejectedValueOnce(new Error('Optimistic lock'))
        .mockResolvedValue({ ...balance, pendingDays: 5, version: 2 });

      const result = await service.incrementPendingDays(
        'e1',
        'PKR-01',
        'VACATION',
        3,
      );
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException after max retries', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'b1',
        pendingDays: 2,
        version: 1,
      });
      mockRepo.save.mockRejectedValue(new Error('Optimistic lock'));

      await expect(
        service.incrementPendingDays('e1', 'PKR-01', 'VACATION', 3, 2),
      ).rejects.toThrow(ConflictException);
      expect(mockRepo.save).toHaveBeenCalledTimes(3); // 0, 1, 2
    });
  });

  describe('approveBalance', () => {
    it('should move days from pending to used', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'b1',
        usedDays: 5,
        pendingDays: 3,
        version: 1,
      });
      mockRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.approveBalance(
        'e1',
        'PKR-01',
        'VACATION',
        3,
      );
      expect(Number(result.usedDays)).toBe(8);
      expect(Number(result.pendingDays)).toBe(0);
    });
  });

  describe('releasePendingDays', () => {
    it('should reduce pending days', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'b1',
        pendingDays: 5,
        version: 1,
      });
      mockRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.releasePendingDays(
        'e1',
        'PKR-01',
        'VACATION',
        3,
      );
      expect(Number(result.pendingDays)).toBe(2);
    });

    it('should not go below 0', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'b1',
        pendingDays: 1,
        version: 1,
      });
      mockRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.releasePendingDays(
        'e1',
        'PKR-01',
        'VACATION',
        5,
      );
      expect(Number(result.pendingDays)).toBe(0);
    });
  });

  describe('batchUpsert', () => {
    it('should create new records for unknown balances', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((d: any) => d);
      mockRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.batchUpsert([
        {
          employeeId: 'e1',
          locationId: 'PKR-01',
          leaveType: 'VACATION',
          totalDays: 20,
          usedDays: 0,
        },
      ]);

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('should detect drift on existing records', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'b1',
        totalDays: 15,
        usedDays: 3,
        version: 1,
      });
      mockRepo.save.mockImplementation((d: any) => Promise.resolve(d));

      const result = await service.batchUpsert([
        {
          employeeId: 'e1',
          locationId: 'PKR-01',
          leaveType: 'VACATION',
          totalDays: 20,
          usedDays: 5,
        },
      ]);

      expect(result.drifted).toBe(1);
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });
  });
});
