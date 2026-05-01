import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicHoliday } from './public-holiday.entity';
import { HolidayService } from './holiday.service';
import { HolidayController } from './holiday.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PublicHoliday])],
  providers: [HolidayService],
  controllers: [HolidayController],
  exports: [HolidayService],
})
export class HolidayModule {}
