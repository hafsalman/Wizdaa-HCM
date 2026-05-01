import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { IdempotencyRecord } from './idempotency-record.entity';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly repo: Repository<IdempotencyRecord>,
  ) {}

  /**
   * Check if an idempotency key has been used. If so, return the cached response.
   */
  async getExisting(key: string): Promise<IdempotencyRecord | null> {
    const record = await this.repo.findOne({ where: { key } });

    if (record && record.expiresAt < new Date()) {
      // Expired — clean it up
      await this.repo.delete(key);
      return null;
    }

    return record;
  }

  /**
   * Store a response against an idempotency key (24h TTL).
   */
  async store(
    key: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const record = this.repo.create({
      key,
      responseStatus,
      responseBody: JSON.stringify(responseBody),
      expiresAt,
    });

    await this.repo.save(record);
    this.logger.debug(`Stored idempotency key: ${key}`);
  }

  /**
   * Cleanup expired records (called by scheduled job).
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.repo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }
}
