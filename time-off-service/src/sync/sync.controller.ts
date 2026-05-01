import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from './sync.service';
import { HcmBatchRecord } from '../hcm-client/hcm-client.service';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { EmployeeRole } from '../employee/employee.entity';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Webhook endpoint for HCM to push batch data.
   * Not JWT-protected — uses API key (validated by HCM mock).
   */
  @Post('hcm/webhook')
  handleBatchWebhook(@Body() body: { records: HcmBatchRecord[] }) {
    return this.syncService.handleBatchWebhook(body.records);
  }

  @Post('trigger')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(EmployeeRole.ADMIN)
  triggerSync(
    @Body('employeeId') employeeId: string,
    @Body('locationId') locationId: string,
  ) {
    return this.syncService.triggerManualSync(employeeId, locationId);
  }

  @Get('jobs')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(EmployeeRole.ADMIN)
  listJobs(@Query('limit') limit?: number) {
    return this.syncService.listJobs(limit);
  }
}
