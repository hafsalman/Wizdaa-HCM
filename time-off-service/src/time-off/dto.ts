import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { LeaveType } from '../balance/leave-balance.entity';

export class CreateTimeOffRequestDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsEnum(LeaveType)
  leaveType!: LeaveType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  startHalf?: boolean;

  @IsOptional()
  @IsBoolean()
  endHalf?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListTimeOffRequestsDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
