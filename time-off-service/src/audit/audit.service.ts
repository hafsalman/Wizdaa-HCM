import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLog } from './audit-log.entity';
import { Events } from '../events';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async createLog(data: {
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }): Promise<AuditLog> {
    const log = this.repo.create(data);
    return this.repo.save(log);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    limit = 50,
  ): Promise<AuditLog[]> {
    return this.repo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findAll(limit = 100): Promise<AuditLog[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Auto-log events
  @OnEvent(Events.REQUEST_APPROVED)
  async onRequestApproved(payload: { requestId: string; employeeId: string }) {
    await this.createLog({
      entityType: 'REQUEST',
      entityId: payload.requestId,
      action: 'APPROVED',
      actorId: payload.employeeId,
    });
  }

  @OnEvent(Events.REQUEST_REJECTED)
  async onRequestRejected(payload: { requestId: string; employeeId: string }) {
    await this.createLog({
      entityType: 'REQUEST',
      entityId: payload.requestId,
      action: 'REJECTED',
    });
  }

  @OnEvent(Events.BALANCE_REFRESHED)
  async onBalanceRefreshed(payload: {
    employeeId: string;
    locationId: string;
    leaveType: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }) {
    await this.createLog({
      entityType: 'BALANCE',
      entityId: `${payload.employeeId}:${payload.locationId}:${payload.leaveType}`,
      action: 'HCM_SYNC',
      before: payload.before,
      after: payload.after,
    });
  }
}
