import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum SyncJobType {
  REAL_TIME = 'REAL_TIME',
  BATCH = 'BATCH',
}

export enum SyncJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export enum SyncTrigger {
  WEBHOOK = 'WEBHOOK',
  SCHEDULE = 'SCHEDULE',
  MANUAL = 'MANUAL',
}

@Entity('sync_jobs')
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: SyncJobType })
  type!: SyncJobType;

  @Column({ type: 'enum', enum: SyncJobStatus, default: SyncJobStatus.PENDING })
  status!: SyncJobStatus;

  @Column({ nullable: true })
  employeeId?: string;

  @Column({ nullable: true })
  locationId?: string;

  @Column({ type: 'enum', enum: SyncTrigger })
  triggeredBy!: SyncTrigger;

  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
