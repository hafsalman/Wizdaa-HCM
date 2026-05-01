import { TimeOffService } from '../../src/time-off/time-off.service';
import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  RequestStatus,
  HcmStatus,
} from '../../src/time-off/time-off-request.entity';

describe('TimeOffService', () => {
  let service: TimeOffService;
  let mockRepo: any,
    mockBalSvc: any,
    mockHcm: any,
    mockDayCal: any,
    mockIdem: any,
    mockEmpSvc: any,
    mockEE: any;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn((d: any) => ({ id: 'req-1', ...d })),
      save: jest.fn((d: any) => Promise.resolve(d)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    mockBalSvc = {
      getBalance: jest
        .fn()
        .mockResolvedValue([
          { totalDays: 20, usedDays: 5, pendingDays: 0, availableDays: 15 },
        ]),
      incrementPendingDays: jest.fn().mockResolvedValue({}),
      approveBalance: jest.fn().mockResolvedValue({}),
      releasePendingDays: jest.fn().mockResolvedValue({}),
    };
    mockHcm = {
      getBalance: jest.fn().mockResolvedValue({ totalDays: 20, usedDays: 5 }),
      submitRequest: jest
        .fn()
        .mockResolvedValue({ transactionId: 'tx-1', status: 'CONFIRMED' }),
      cancelRequest: jest.fn(),
    };
    mockDayCal = { calculateLeaveDays: jest.fn().mockResolvedValue(3) };
    mockIdem = {
      getExisting: jest.fn().mockResolvedValue(null),
      store: jest.fn(),
    };
    mockEmpSvc = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'emp-1', externalId: 'HCM-1' }),
    };
    mockEE = { emit: jest.fn() };
    service = new TimeOffService(
      mockRepo,
      mockBalSvc,
      mockHcm,
      mockDayCal,
      mockIdem,
      mockEmpSvc,
      mockEE,
    );
  });

  const dto = {
    employeeId: 'emp-1',
    locationId: 'PKR-01',
    leaveType: 'VACATION' as any,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
  };

  it('should create request successfully', async () => {
    const r = await service.createRequest(dto);
    expect(r.status).toBe(RequestStatus.PENDING);
    expect(mockBalSvc.incrementPendingDays).toHaveBeenCalled();
  });

  it('should replay idempotent response', async () => {
    mockIdem.getExisting.mockResolvedValue({ responseBody: '{"id":"req-1"}' });
    const r = await service.createRequest(dto, 'key-1');
    expect(r.id).toBe('req-1');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should throw on 0 working days', async () => {
    mockDayCal.calculateLeaveDays.mockResolvedValue(0);
    await expect(service.createRequest(dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw INSUFFICIENT_BALANCE', async () => {
    mockDayCal.calculateLeaveDays.mockResolvedValue(20);
    await expect(service.createRequest(dto)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('should approve and submit to HCM', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'PKR-01',
      leaveType: 'VACATION',
      totalDays: 3,
      status: RequestStatus.PENDING,
    });
    const r = await service.approveRequest('req-1', 'mgr-1');
    expect(r.status).toBe(RequestStatus.APPROVED);
    expect(r.hcmStatus).toBe(HcmStatus.CONFIRMED);
  });

  it('should schedule retry when HCM fails on approve', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'PKR-01',
      leaveType: 'VACATION',
      totalDays: 3,
      status: RequestStatus.PENDING,
    });
    mockHcm.submitRequest.mockRejectedValue(new Error('timeout'));
    const r = await service.approveRequest('req-1', 'mgr-1');
    expect(r.hcmStatus).toBe(HcmStatus.PENDING);
  });

  it('should reject and release pending days', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'PKR-01',
      leaveType: 'VACATION',
      totalDays: 3,
      status: RequestStatus.PENDING,
    });
    const r = await service.rejectRequest('req-1');
    expect(r.status).toBe(RequestStatus.REJECTED);
    expect(mockBalSvc.releasePendingDays).toHaveBeenCalled();
  });

  it('should cancel own pending request', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-1',
      locationId: 'PKR-01',
      leaveType: 'VACATION',
      totalDays: 3,
      status: RequestStatus.PENDING,
    });
    const r = await service.cancelRequest('req-1', 'emp-1');
    expect(r.status).toBe(RequestStatus.CANCELLED);
  });

  it('should throw on cancelling other employee request', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'req-1',
      employeeId: 'emp-2',
      status: RequestStatus.PENDING,
    });
    await expect(service.cancelRequest('req-1', 'emp-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw on approving non-PENDING request', async () => {
    mockRepo.findOne.mockResolvedValue({
      id: 'req-1',
      status: RequestStatus.APPROVED,
    });
    await expect(service.approveRequest('req-1', 'mgr-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
