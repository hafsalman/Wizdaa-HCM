import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveBalance, LeaveType } from './leave-balance.entity';
import { HcmClientService } from '../hcm-client/hcm-client.service';
import { EmployeeService } from '../employee/employee.service';
import { Events, BalanceRefreshedEvent } from '../events';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @InjectRepository(LeaveBalance)
    private readonly repo: Repository<LeaveBalance>,
    private readonly hcmClient: HcmClientService,
    private readonly employeeService: EmployeeService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get balance for a specific employee/location/leaveType.
   * If revalidate=true, pulls from HCM first.
   */
  async getBalance(
    employeeId: string,
    locationId: string,
    leaveType?: string,
    revalidate = false,
  ): Promise<LeaveBalance[]> {
    if (revalidate) {
      await this.refreshFromHcm(employeeId, locationId, leaveType);
    }

    const where: Record<string, unknown> = { employeeId, locationId };
    if (leaveType) where.leaveType = leaveType;

    return this.repo.find({ where });
  }

  /**
   * Get a single balance record or throw.
   */
  async getOneOrFail(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<LeaveBalance> {
    const balance = await this.repo.findOne({
      where: { employeeId, locationId, leaveType: leaveType as LeaveType },
    });
    if (!balance) {
      throw new NotFoundException(
        `No balance found for employee=${employeeId} location=${locationId} type=${leaveType}`,
      );
    }
    return balance;
  }

  /**
   * Refresh balance from HCM (real-time API).
   * Updates local DB and emits BALANCE_REFRESHED if values changed.
   */
  async refreshFromHcm(
    employeeId: string,
    locationId: string,
    leaveType?: string,
  ): Promise<void> {
    const employee = await this.employeeService.findById(employeeId);
    const types = leaveType ? [leaveType] : Object.values(LeaveType);

    for (const type of types) {
      try {
        const hcmBalance = await this.hcmClient.getBalance(
          employee.externalId,
          locationId,
          type,
        );

        let local = await this.repo.findOne({
          where: { employeeId, locationId, leaveType: type as LeaveType },
        });

        const before = local
          ? {
              totalDays: Number(local.totalDays),
              usedDays: Number(local.usedDays),
            }
          : { totalDays: 0, usedDays: 0 };

        if (!local) {
          local = this.repo.create({
            employeeId,
            locationId,
            leaveType: type as LeaveType,
            totalDays: hcmBalance.totalDays,
            usedDays: hcmBalance.usedDays,
            pendingDays: 0,
            lastHcmSyncAt: new Date(),
          });
        } else {
          // Only update totalDays from HCM (entitlement).
          // Preserve local usedDays/pendingDays so approved leaves aren't wiped.
          local.totalDays = hcmBalance.totalDays;
          local.lastHcmSyncAt = new Date();
        }

        await this.repo.save(local);

        const after = {
          totalDays: hcmBalance.totalDays,
          usedDays: hcmBalance.usedDays,
        };

        if (
          before.totalDays !== after.totalDays ||
          before.usedDays !== after.usedDays
        ) {
          const event: BalanceRefreshedEvent = {
            employeeId,
            locationId,
            leaveType: type,
            before,
            after,
          };
          this.eventEmitter.emit(Events.BALANCE_REFRESHED, event);
          this.logger.log(
            `Balance drift detected for employee=${employeeId} type=${type}: ` +
              `total ${before.totalDays}→${after.totalDays}, used ${before.usedDays}→${after.usedDays}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to refresh balance from HCM for employee=${employeeId} type=${type}: ${error}`,
        );
      }
    }
  }

  /**
   * Increment pending days with optimistic locking.
   * Returns the updated balance or throws ConflictException on version mismatch.
   */
  async incrementPendingDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
    maxRetries = 3,
  ): Promise<LeaveBalance> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const balance = await this.getOneOrFail(
        employeeId,
        locationId,
        leaveType,
      );
      const currentVersion = balance.version;

      balance.pendingDays = Number(balance.pendingDays) + days;

      try {
        const saved = await this.repo.save(balance);
        return saved;
      } catch {
        if (attempt === maxRetries) {
          throw new ConflictException(
            `Optimistic lock conflict after ${maxRetries} retries. ` +
              `Balance version changed from ${currentVersion}.`,
          );
        }
        this.logger.warn(
          `Optimistic lock conflict (attempt ${attempt + 1}/${maxRetries}), retrying...`,
        );
      }
    }

    throw new ConflictException('Failed to update balance');
  }

  /**
   * Move days from pending to used (on approval).
   */
  async approveBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<LeaveBalance> {
    const balance = await this.getOneOrFail(employeeId, locationId, leaveType);
    balance.usedDays = Number(balance.usedDays) + days;
    balance.pendingDays = Number(balance.pendingDays) - days;
    return this.repo.save(balance);
  }

  /**
   * Release pending days (on rejection or cancellation).
   */
  async releasePendingDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<LeaveBalance> {
    const balance = await this.getOneOrFail(employeeId, locationId, leaveType);
    balance.pendingDays = Math.max(0, Number(balance.pendingDays) - days);
    return this.repo.save(balance);
  }

  /**
   * Batch upsert from HCM batch payload.
   */
  async batchUpsert(
    records: Array<{
      employeeId: string;
      locationId: string;
      leaveType: string;
      totalDays: number;
      usedDays: number;
    }>,
  ): Promise<{ updated: number; created: number; drifted: number }> {
    let updated = 0;
    let created = 0;
    let drifted = 0;

    for (const record of records) {
      let local = await this.repo.findOne({
        where: {
          employeeId: record.employeeId,
          locationId: record.locationId,
          leaveType: record.leaveType as LeaveType,
        },
      });

      const before = local
        ? {
            totalDays: Number(local.totalDays),
            usedDays: Number(local.usedDays),
          }
        : null;

      if (!local) {
        local = this.repo.create({
          ...record,
          leaveType: record.leaveType as LeaveType,
          pendingDays: 0,
          lastHcmSyncAt: new Date(),
        });
        created++;
      } else {
        if (
          Number(local.totalDays) !== record.totalDays ||
          Number(local.usedDays) !== record.usedDays
        ) {
          drifted++;
        }
        local.totalDays = record.totalDays;
        local.usedDays = record.usedDays;
        local.lastHcmSyncAt = new Date();
        updated++;
      }

      await this.repo.save(local);

      if (
        before &&
        (before.totalDays !== record.totalDays ||
          before.usedDays !== record.usedDays)
      ) {
        this.eventEmitter.emit(Events.BALANCE_REFRESHED, {
          employeeId: record.employeeId,
          locationId: record.locationId,
          leaveType: record.leaveType,
          before,
          after: { totalDays: record.totalDays, usedDays: record.usedDays },
        });
      }
    }

    return { updated, created, drifted };
  }
}
