import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { EmployeeRole } from '../employee/employee.entity';

@Controller('audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(EmployeeRole.ADMIN, EmployeeRole.MANAGER)
  findAll(@Query('limit') limit?: number) {
    return this.auditService.findAll(limit);
  }

  @Get('entity')
  @Roles(EmployeeRole.ADMIN, EmployeeRole.MANAGER)
  findByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.findByEntity(entityType, entityId, limit);
  }
}
