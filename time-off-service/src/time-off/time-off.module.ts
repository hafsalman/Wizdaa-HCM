import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffService } from './time-off.service';
import { TimeOffController } from './time-off.controller';
import { BalanceModule } from '../balance/balance.module';
import { HcmClientModule } from '../hcm-client/hcm-client.module';
import { CoreModule } from '../core/core.module';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest]),
    BalanceModule,
    HcmClientModule,
    CoreModule,
    EmployeeModule,
  ],
  providers: [TimeOffService],
  controllers: [TimeOffController],
  exports: [TimeOffService],
})
export class TimeOffModule {}
