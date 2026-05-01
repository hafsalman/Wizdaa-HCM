import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TimeOffRequest,
  RequestStatus,
  HcmStatus,
} from './time-off-request.entity';
import { CreateTimeOffRequestDto } from './dto';
import { BalanceService } from '../balance/balance.service';
import { HcmClientService } from '../hcm-client/hcm-client.service';
import { DayCalculatorService } from '../core/day-calculator.service';
import { IdempotencyService } from '../core/idempotency.service';
import { EmployeeService } from '../employee/employee.service';
import {
  Events,
  RequestApprovedEvent,
  RequestRejectedEvent,
  RequestCancelledEvent,
  HcmSyncFailedEvent,
} from '../events';

@Injectable()
export class TimeOffService {
  private readonly logger = new Logger(TimeOffService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly repo: Repository<TimeOffRequest>,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClientService,
    private readonly dayCalculator: DayCalculatorService,
    private readonly idempotencyService: IdempotencyService,
    private readonly employeeService: EmployeeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new time-off request.
   * 1. Check idempotency key
   * 2. Calculate total days (weekends + holidays excluded)
   * 3. Validate balance (defensively: pick lower of local vs HCM)
   * 4. Create request + increment pendingDays
   */
  async createRequest(
    dto: CreateTimeOffRequestDto,
    idempotencyKey?: string,
  ): Promise<TimeOffRequest> {
    // 1. Idempotency check
    if (idempotencyKey) {
      const existing =
        await this.idempotencyService.getExisting(idempotencyKey);
      if (existing) {
        return JSON.parse(existing.responseBody) as TimeOffRequest;
      }
    }

    // 2. Calculate total days
    const totalDays = await this.dayCalculator.calculateLeaveDays(
      dto.startDate,
      dto.endDate,
      dto.locationId,
      dto.startHalf || false,
      dto.endHalf || false,
    );

    if (totalDays <= 0) {
      throw new BadRequestException(
        'Selected date range has no working days (all weekends/holidays)',
      );
    }

    // 3. Validate balance — pull from HCM (soft state) and compare with local
    let availableDays: number;
    try {
      const employee = await this.employeeService.findById(dto.employeeId);
      const hcmBalance = await this.hcmClient.getBalance(
        employee.externalId,
        dto.locationId,
        dto.leaveType,
      );
      const hcmAvailable = hcmBalance.totalDays - hcmBalance.usedDays;

      // Also check local balance
      try {
        const localBalances = await this.balanceService.getBalance(
          dto.employeeId,
          dto.locationId,
          dto.leaveType,
        );
        const localBalance = localBalances[0];
        const localAvailable = localBalance
          ? localBalance.availableDays
          : Infinity;

        // Defensive: pick the lower of the two
        availableDays = Math.min(hcmAvailable, localAvailable);
      } catch {
        availableDays = hcmAvailable;
      }
    } catch {
      // If HCM is unreachable, fall back to local balance only
      this.logger.warn(
        'HCM unreachable during request creation, using local balance',
      );
      const localBalances = await this.balanceService.getBalance(
        dto.employeeId,
        dto.locationId,
        dto.leaveType,
      );
      const localBalance = localBalances[0];
      if (!localBalance) {
        throw new UnprocessableEntityException(
          'No balance record found and HCM is unreachable',
        );
      }
      availableDays = localBalance.availableDays;
    }

    if (availableDays < totalDays) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        message: `Available balance (${availableDays} days) is less than requested (${totalDays} days)`,
        details: {
          available: availableDays,
          requested: totalDays,
          locationId: dto.locationId,
        },
      });
    }

    // 4. Create request and increment pending days
    const request = this.repo.create({
      ...dto,
      totalDays,
      status: RequestStatus.PENDING,
      hcmStatus: HcmStatus.NOT_SUBMITTED,
      idempotencyKey,
    });

    const saved = await this.repo.save(request);

    // Increment pending days with optimistic lock
    await this.balanceService.incrementPendingDays(
      dto.employeeId,
      dto.locationId,
      dto.leaveType,
      totalDays,
    );

    // Store idempotency response
    if (idempotencyKey) {
      await this.idempotencyService.store(idempotencyKey, 201, saved);
    }

    this.eventEmitter.emit(Events.REQUEST_SUBMITTED, {
      requestId: saved.id,
      employeeId: saved.employeeId,
    });

    this.logger.log(
      `Time-off request created: id=${saved.id} employee=${saved.employeeId} days=${totalDays}`,
    );

    return saved;
  }

  /**
   * Approve a time-off request (Manager action).
   * 1. Re-validate with HCM (soft state)
   * 2. Submit to HCM
   * 3. Move pending → used in local balance
   */
  async approveRequest(
    requestId: string,
    approverId: string,
  ): Promise<TimeOffRequest> {
    const request = await this.findOneOrFail(requestId);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve request in ${request.status} status`,
      );
    }

    // Re-validate with HCM (Soft State Strategy)
    const employee = await this.employeeService.findById(request.employeeId);
    try {
      const hcmBalance = await this.hcmClient.getBalance(
        employee.externalId,
        request.locationId,
        request.leaveType,
      );

      const hcmAvailable = hcmBalance.totalDays - hcmBalance.usedDays;
      if (hcmAvailable < Number(request.totalDays)) {
        // HCM says insufficient — reject
        request.status = RequestStatus.REJECTED;
        request.hcmStatus = HcmStatus.FAILED;
        await this.repo.save(request);

        await this.balanceService.releasePendingDays(
          request.employeeId,
          request.locationId,
          request.leaveType,
          Number(request.totalDays),
        );

        throw new UnprocessableEntityException({
          error: 'HCM_INSUFFICIENT_BALANCE',
          message: `HCM reports insufficient balance (${hcmAvailable} available, ${request.totalDays} requested)`,
        });
      }
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      this.logger.warn(
        'HCM unreachable during approval, proceeding with local state',
      );
    }

    // Submit to HCM
    try {
      const result = await this.hcmClient.submitRequest({
        employeeExternalId: employee.externalId,
        locationId: request.locationId,
        leaveType: request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: Number(request.totalDays),
      });

      request.hcmTransactionId = result.transactionId;
      request.hcmStatus = HcmStatus.CONFIRMED;
      request.status = RequestStatus.APPROVED;
    } catch {
      // HCM unreachable — mark for retry
      request.hcmStatus = HcmStatus.PENDING;
      request.status = RequestStatus.APPROVED;
      request.retryCount = 0;
      request.nextRetryAt = new Date(Date.now() + 60000);
      this.logger.warn(
        `HCM submission failed for request ${requestId}, scheduled for retry`,
      );

      const failEvent: HcmSyncFailedEvent = {
        requestId,
        error: 'HCM unreachable during approval',
        retryCount: 0,
      };
      this.eventEmitter.emit(Events.HCM_SYNC_FAILED, failEvent);
    }

    await this.repo.save(request);

    // Move pending → used
    await this.balanceService.approveBalance(
      request.employeeId,
      request.locationId,
      request.leaveType,
      Number(request.totalDays),
    );

    const approvedEvent: RequestApprovedEvent = {
      requestId: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      leaveType: request.leaveType,
      totalDays: Number(request.totalDays),
    };
    this.eventEmitter.emit(Events.REQUEST_APPROVED, approvedEvent);

    this.logger.log(`Request approved: id=${requestId} by=${approverId}`);

    return request;
  }

  /**
   * Reject a time-off request (Manager action).
   */
  async rejectRequest(
    requestId: string,
    reason?: string,
  ): Promise<TimeOffRequest> {
    const request = await this.findOneOrFail(requestId);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject request in ${request.status} status`,
      );
    }

    request.status = RequestStatus.REJECTED;
    if (reason) request.reason = reason;
    await this.repo.save(request);

    // Release pending days
    await this.balanceService.releasePendingDays(
      request.employeeId,
      request.locationId,
      request.leaveType,
      Number(request.totalDays),
    );

    const event: RequestRejectedEvent = {
      requestId: request.id,
      employeeId: request.employeeId,
      totalDays: Number(request.totalDays),
      locationId: request.locationId,
      leaveType: request.leaveType,
    };
    this.eventEmitter.emit(Events.REQUEST_REJECTED, event);

    return request;
  }

  /**
   * Cancel a time-off request (Employee action — only DRAFT/PENDING).
   */
  async cancelRequest(
    requestId: string,
    employeeId: string,
  ): Promise<TimeOffRequest> {
    const request = await this.findOneOrFail(requestId);

    if (request.employeeId !== employeeId) {
      throw new BadRequestException('You can only cancel your own requests');
    }

    if (
      request.status !== RequestStatus.DRAFT &&
      request.status !== RequestStatus.PENDING
    ) {
      throw new BadRequestException(
        `Cannot cancel request in ${request.status} status`,
      );
    }

    // If it was submitted to HCM, try to cancel there too
    if (request.hcmTransactionId) {
      try {
        await this.hcmClient.cancelRequest(request.hcmTransactionId);
      } catch {
        this.logger.warn(
          `Failed to cancel HCM transaction ${request.hcmTransactionId}`,
        );
      }
    }

    request.status = RequestStatus.CANCELLED;
    await this.repo.save(request);

    // Release pending days
    await this.balanceService.releasePendingDays(
      request.employeeId,
      request.locationId,
      request.leaveType,
      Number(request.totalDays),
    );

    const event: RequestCancelledEvent = {
      requestId: request.id,
      employeeId: request.employeeId,
      totalDays: Number(request.totalDays),
      locationId: request.locationId,
      leaveType: request.leaveType,
    };
    this.eventEmitter.emit(Events.REQUEST_CANCELLED, event);

    return request;
  }

  /**
   * List requests with optional filters.
   */
  async listRequests(filters: {
    employeeId?: string;
    status?: string;
    locationId?: string;
  }): Promise<TimeOffRequest[]> {
    const where: Record<string, unknown> = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.locationId) where.locationId = filters.locationId;

    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['employee'],
    });
  }

  /**
   * Find a request by ID or throw.
   */
  async findOneOrFail(id: string): Promise<TimeOffRequest> {
    const request = await this.repo.findOne({
      where: { id },
      relations: ['employee'],
    });
    if (!request) {
      throw new NotFoundException(`Time-off request ${id} not found`);
    }
    return request;
  }

  /**
   * Get requests with pending HCM status for retry.
   */
  async getPendingHcmRequests(): Promise<TimeOffRequest[]> {
    return this.repo.find({
      where: {
        hcmStatus: HcmStatus.PENDING,
        status: RequestStatus.APPROVED,
      },
      relations: ['employee'],
    });
  }
}
