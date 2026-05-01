import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HolidayService } from './holiday.service';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { EmployeeRole } from '../employee/employee.entity';

@Controller('holidays')
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Get()
  findAll(
    @Query('year') year?: number,
    @Query('locationId') locationId?: string,
  ) {
    return this.holidayService.findAll(year, locationId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(EmployeeRole.ADMIN)
  updateHoliday(
    @Param('id') id: string,
    @Body() updates: { name?: string; date?: string },
  ) {
    return this.holidayService.update(id, updates);
  }

  @Post('seed')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(EmployeeRole.ADMIN)
  seedHolidays(@Body('year') year?: number) {
    return this.holidayService.seedPakistanHolidays(year);
  }
}
