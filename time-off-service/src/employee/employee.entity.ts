import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { LeaveBalance } from '../balance/leave-balance.entity';
import { TimeOffRequest } from '../time-off/time-off-request.entity';

export enum EmployeeRole {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  externalId!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ default: 'Asia/Karachi' })
  timezone!: string;

  @Column({
    type: 'enum',
    enum: EmployeeRole,
    default: EmployeeRole.EMPLOYEE,
  })
  role!: EmployeeRole;

  @Column({ nullable: true })
  managerId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => LeaveBalance, (balance) => balance.employee)
  balances!: LeaveBalance[];

  @OneToMany(() => TimeOffRequest, (request) => request.employee)
  timeOffRequests!: TimeOffRequest[];
}
