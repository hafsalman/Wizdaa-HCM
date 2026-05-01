import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';
import { HcmClientModule } from '../hcm-client/hcm-client.module';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalance]),
    HcmClientModule,
    EmployeeModule,
  ],
  providers: [BalanceService],
  controllers: [BalanceController],
  exports: [BalanceService],
})
export class BalanceModule {}
