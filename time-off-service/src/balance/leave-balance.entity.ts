import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Employee } from '../employee/employee.entity';

export enum LeaveType {
  VACATION = 'VACATION',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  UNPAID = 'UNPAID',
}

@Entity('leave_balances')
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  employeeId!: string;

  @ManyToOne(() => Employee, (employee) => employee.balances)
  @JoinColumn({ name: 'employeeId' })
  employee!: Employee;

  @Column()
  locationId!: string;

  @Column({ type: 'enum', enum: LeaveType })
  leaveType!: LeaveType;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalDays!: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  usedDays!: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  pendingDays!: number;

  @VersionColumn()
  version!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastHcmSyncAt?: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  get availableDays(): number {
    return (
      Number(this.totalDays) - Number(this.usedDays) - Number(this.pendingDays)
    );
  }
}
