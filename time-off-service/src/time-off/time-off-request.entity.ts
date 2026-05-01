import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { Employee } from '../employee/employee.entity';

export enum RequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum HcmStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  employeeId!: string;

  @ManyToOne(() => Employee, (employee) => employee.timeOffRequests)
  @JoinColumn({ name: 'employeeId' })
  employee!: Employee;

  @Column()
  locationId!: string;

  @Column()
  leaveType!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({ default: false })
  startHalf!: boolean;

  @Column({ default: false })
  endHalf!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  totalDays!: number;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.DRAFT,
  })
  status!: RequestStatus;

  @Column({ nullable: true })
  reason?: string;

  @Index({ unique: true })
  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  @Column({ nullable: true })
  hcmTransactionId?: string;

  @Column({
    type: 'enum',
    enum: HcmStatus,
    default: HcmStatus.NOT_SUBMITTED,
  })
  hcmStatus!: HcmStatus;

  @Column({ default: 0 })
  retryCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt?: Date;

  @VersionColumn()
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
