import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncJob } from './sync-job.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { BalanceModule } from '../balance/balance.module';
import { HcmClientModule } from '../hcm-client/hcm-client.module';
import { TimeOffModule } from '../time-off/time-off.module';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncJob]),
    BalanceModule,
    HcmClientModule,
    TimeOffModule,
    EmployeeModule,
  ],
  providers: [SyncService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
