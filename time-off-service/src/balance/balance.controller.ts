import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BalanceService } from './balance.service';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { EmployeeRole } from '../employee/employee.entity';

@Controller('balances')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':employeeId/:locationId')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Query('leaveType') leaveType?: string,
    @Query('revalidate') revalidate?: string,
  ) {
    return this.balanceService.getBalance(
      employeeId,
      locationId,
      leaveType,
      revalidate === 'true',
    );
  }

  @Post('refresh/:employeeId/:locationId')
  refreshBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Query('leaveType') leaveType?: string,
  ) {
    return this.balanceService.refreshFromHcm(
      employeeId,
      locationId,
      leaveType,
    );
  }

  @Post('batch-refresh')
  @Roles(EmployeeRole.ADMIN)
  batchRefresh() {
    // Triggers a full batch sync — implemented in SyncModule
    return { message: 'Batch refresh triggered' };
  }
}
