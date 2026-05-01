import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AuthService } from './auth.service';
import { EmployeeRole } from '../employee/employee.entity';

class SeedDto {
  @IsString()
  name!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsEnum(EmployeeRole)
  role?: EmployeeRole;
}

/**
 * Development-only auth endpoints. In production, Supabase Auth issues JWTs.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('seed-token')
  async seedAndGetToken(@Body() dto: SeedDto) {
    return this.authService.seedAndGetToken(
      dto.name,
      dto.email,
      dto.role || EmployeeRole.EMPLOYEE,
    );
  }
}
