import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('public_holidays')
export class PublicHoliday {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: '*' })
  locationId!: string;

  @Column()
  name!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column()
  year!: number;

  @Column({ default: false })
  isRecurring!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
