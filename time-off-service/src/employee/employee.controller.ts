import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmployeeService } from './employee.service';

@Controller('employees')
@UseGuards(AuthGuard('jwt'))
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get()
  findAll() {
    return this.employeeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeeService.findById(id);
  }

  @Get(':id/balances')
  async getBalances(@Param('id') id: string) {
    const employee = await this.employeeService.findById(id);
    return employee.balances;
  }
}
