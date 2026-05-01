import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TimeOffService } from './time-off.service';
import { CreateTimeOffRequestDto } from './dto';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { EmployeeRole } from '../employee/employee.entity';

@Controller('time-off/requests')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRequest(
    @Body() dto: CreateTimeOffRequestDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.timeOffService.createRequest(dto, idempotencyKey);
  }

  @Get()
  listRequests(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.timeOffService.listRequests({ employeeId, status, locationId });
  }

  @Get(':id')
  getRequest(@Param('id') id: string) {
    return this.timeOffService.findOneOrFail(id);
  }

  @Patch(':id/approve')
  @Roles(EmployeeRole.MANAGER, EmployeeRole.ADMIN)
  approveRequest(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.timeOffService.approveRequest(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles(EmployeeRole.MANAGER, EmployeeRole.ADMIN)
  rejectRequest(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.timeOffService.rejectRequest(id, reason);
  }

  @Delete(':id')
  cancelRequest(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.timeOffService.cancelRequest(id, req.user.id);
  }
}
