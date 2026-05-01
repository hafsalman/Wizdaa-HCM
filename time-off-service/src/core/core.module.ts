import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyRecord } from './idempotency-record.entity';
import { IdempotencyService } from './idempotency.service';
import { DayCalculatorService } from './day-calculator.service';
import { PublicHoliday } from '../holiday/public-holiday.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyRecord, PublicHoliday])],
  providers: [IdempotencyService, DayCalculatorService],
  exports: [IdempotencyService, DayCalculatorService],
})
export class CoreModule {}
