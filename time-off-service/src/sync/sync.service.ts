import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SyncJob,
  SyncJobType,
  SyncJobStatus,
  SyncTrigger,
} from './sync-job.entity';
import { BalanceService } from '../balance/balance.service';
import {
  HcmClientService,
  HcmBatchRecord,
} from '../hcm-client/hcm-client.service';
import { TimeOffService } from '../time-off/time-off.service';
import { EmployeeService } from '../employee/employee.service';
import { Events, HcmBatchReceivedEvent } from '../events';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncJob)
    private readonly syncJobRepo: Repository<SyncJob>,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClientService,
    private readonly timeOffService: TimeOffService,
    private readonly employeeService: EmployeeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle incoming batch webhook from HCM.
   * Parses the payload and upserts all balance records.
   */
  async handleBatchWebhook(records: HcmBatchRecord[]): Promise<SyncJob> {
    const job = this.syncJobRepo.create({
      type: SyncJobType.BATCH,
      status: SyncJobStatus.RUNNING,
      triggeredBy: SyncTrigger.WEBHOOK,
    });
    await this.syncJobRepo.save(job);

    try {
      // Map external IDs to internal IDs
      const mappedRecords = [];
      for (const record of records) {
        try {
          const employee = await this.employeeService.findByExternalId(
            record.employeeExternalId,
          );
          mappedRecords.push({
            employeeId: employee.id,
            locationId: record.locationId,
            leaveType: record.leaveType,
            totalDays: record.totalDays,
            usedDays: record.usedDays,
          });
        } catch {
          this.logger.warn(
            `Skipping batch record for unknown external ID: ${record.employeeExternalId}`,
          );
        }
      }

      const result = await this.balanceService.batchUpsert(mappedRecords);

      job.status = SyncJobStatus.DONE;
      job.result = {
        totalRecords: records.length,
        mapped: mappedRecords.length,
        ...result,
      };

      const event: HcmBatchReceivedEvent = {
        jobId: job.id,
        recordCount: records.length,
      };
      this.eventEmitter.emit(Events.HCM_BATCH_RECEIVED, event);

      this.logger.log(
        `Batch sync completed: ${mappedRecords.length}/${records.length} records processed, ${result.drifted} drifted`,
      );
    } catch (error) {
      job.status = SyncJobStatus.FAILED;
      job.result = { error: String(error) };
      this.logger.error(`Batch sync failed: ${error}`);
    }

    await this.syncJobRepo.save(job);
    return job;
  }

  /**
   * Retry pending HCM submissions every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryPendingSubmissions(): Promise<void> {
    const pendingRequests = await this.timeOffService.getPendingHcmRequests();

    if (pendingRequests.length === 0) return;

    this.logger.log(
      `Retrying ${pendingRequests.length} pending HCM submissions`,
    );

    for (const request of pendingRequests) {
      try {
        const employee = await this.employeeService.findById(
          request.employeeId,
        );
        const result = await this.hcmClient.submitRequest({
          employeeExternalId: employee.externalId,
          locationId: request.locationId,
          leaveType: request.leaveType,
          startDate: request.startDate,
          endDate: request.endDate,
          totalDays: Number(request.totalDays),
        });

        request.hcmTransactionId = result.transactionId;
        request.hcmStatus = 'CONFIRMED' as never;
        request.nextRetryAt = undefined;
        // Repo save will be done by TimeOffService

        this.logger.log(
          `Successfully retried HCM submission for request ${request.id}`,
        );
      } catch (error) {
        request.retryCount += 1;
        const backoff = Math.pow(2, request.retryCount) * 60000;
        request.nextRetryAt = new Date(Date.now() + backoff);

        this.logger.warn(
          `Retry failed for request ${request.id} (attempt ${request.retryCount}): ${error}`,
        );

        this.eventEmitter.emit(Events.HCM_SYNC_FAILED, {
          requestId: request.id,
          error: String(error),
          retryCount: request.retryCount,
        });
      }
    }
  }

  /**
   * List sync job history.
   */
  async listJobs(limit = 50): Promise<SyncJob[]> {
    return this.syncJobRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Trigger a manual sync for a specific employee.
   */
  async triggerManualSync(
    employeeId: string,
    locationId: string,
  ): Promise<SyncJob> {
    const job = this.syncJobRepo.create({
      type: SyncJobType.REAL_TIME,
      status: SyncJobStatus.RUNNING,
      employeeId,
      locationId,
      triggeredBy: SyncTrigger.MANUAL,
    });
    await this.syncJobRepo.save(job);

    try {
      await this.balanceService.refreshFromHcm(employeeId, locationId);
      job.status = SyncJobStatus.DONE;
      job.result = { message: 'Sync completed successfully' };
    } catch (error) {
      job.status = SyncJobStatus.FAILED;
      job.result = { error: String(error) };
    }

    await this.syncJobRepo.save(job);
    return job;
  }
}
