import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PublicHoliday } from '../holiday/public-holiday.entity';

/**
 * Calculates working days between two dates, excluding weekends and public holidays.
 * Supports half-day leaves (startHalf / endHalf).
 */
@Injectable()
export class DayCalculatorService {
  constructor(
    @InjectRepository(PublicHoliday)
    private readonly holidayRepo: Repository<PublicHoliday>,
  ) {}

  /**
   * Calculate total leave days between two dates (inclusive).
   * Excludes weekends (Sat/Sun) and public holidays for the given location.
   * Supports half-day deductions at start and/or end.
   */
  async calculateLeaveDays(
    startDate: string,
    endDate: string,
    locationId: string,
    startHalf = false,
    endHalf = false,
  ): Promise<number> {
    const holidays = await this.getHolidayDates(startDate, endDate, locationId);
    const holidaySet = new Set(
      holidays.map((h) => h.toISOString().split('T')[0]),
    );

    const start = new Date(startDate);
    const end = new Date(endDate);

    let totalDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
        let dayValue = 1;

        // Half-day at start
        if (current.getTime() === start.getTime() && startHalf) {
          dayValue = 0.5;
        }
        // Half-day at end
        if (current.getTime() === end.getTime() && endHalf) {
          dayValue = 0.5;
        }
        // If same day, both halves would make it 0.5 + 0.5 = 1, but we want:
        // startHalf + endHalf on same day = 0.5 (only half the day)
        if (
          current.getTime() === start.getTime() &&
          current.getTime() === end.getTime() &&
          startHalf &&
          endHalf
        ) {
          dayValue = 0.5;
        }

        totalDays += dayValue;
      }

      current.setDate(current.getDate() + 1);
    }

    return totalDays;
  }

  /**
   * Get public holiday dates within a date range for a given location.
   */
  private async getHolidayDates(
    startDate: string,
    endDate: string,
    locationId: string,
  ): Promise<Date[]> {
    const holidays = await this.holidayRepo.find({
      where: [
        { locationId, date: Between(startDate, endDate) },
        { locationId: '*', date: Between(startDate, endDate) },
      ],
    });

    return holidays.map((h) => new Date(h.date));
  }
}
