import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('idempotency_records')
export class IdempotencyRecord {
  @PrimaryColumn()
  key!: string;

  @Column({ type: 'int' })
  responseStatus!: number;

  @Column({ type: 'text' })
  responseBody!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
