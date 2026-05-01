import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublicHoliday } from './public-holiday.entity';

/**
 * Pakistan's gazetted national holidays for seeding.
 * Lunar holidays use approximate 2026 dates.
 */
const PAKISTAN_HOLIDAYS_2026 = [
  { name: 'Kashmir Day', date: '2026-02-05', isRecurring: false },
  { name: 'Pakistan Day', date: '2026-03-23', isRecurring: false },
  { name: 'Labour Day', date: '2026-05-01', isRecurring: false },
  // Eid ul Fitr (approximate — 3 days)
  { name: 'Eid ul Fitr (Day 1)', date: '2026-03-20', isRecurring: false },
  { name: 'Eid ul Fitr (Day 2)', date: '2026-03-21', isRecurring: false },
  { name: 'Eid ul Fitr (Day 3)', date: '2026-03-22', isRecurring: false },
  // Independence Day
  { name: 'Independence Day', date: '2026-08-14', isRecurring: false },
  // Eid ul Adha (approximate — 3 days)
  { name: 'Eid ul Adha (Day 1)', date: '2026-05-27', isRecurring: false },
  { name: 'Eid ul Adha (Day 2)', date: '2026-05-28', isRecurring: false },
  { name: 'Eid ul Adha (Day 3)', date: '2026-05-29', isRecurring: false },
  { name: 'Eid ul Adha Holiday', date: '2026-05-30', isRecurring: false },
  // Ashura (Muharram) — 2 days
  { name: 'Ashura (Day 1)', date: '2026-07-16', isRecurring: false },
  { name: 'Ashura (Day 2)', date: '2026-07-17', isRecurring: false },
  // Eid Milad-un-Nabi
  { name: 'Eid Milad-un-Nabi', date: '2026-09-24', isRecurring: false },
  // Allama Iqbal Day
  { name: 'Allama Iqbal Day', date: '2026-11-09', isRecurring: false },
  // Quaid-e-Azam Day / Christmas
  { name: 'Quaid-e-Azam Day', date: '2026-12-25', isRecurring: false },
];

@Injectable()
export class HolidayService {
  constructor(
    @InjectRepository(PublicHoliday)
    private readonly repo: Repository<PublicHoliday>,
  ) {}

  async findAll(year?: number, locationId?: string): Promise<PublicHoliday[]> {
    const where: Record<string, unknown> = {};
    if (year) where.year = year;
    if (locationId) where.locationId = locationId;
    return this.repo.find({ where, order: { date: 'ASC' } });
  }

  async findById(id: string): Promise<PublicHoliday | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(
    id: string,
    updates: Partial<PublicHoliday>,
  ): Promise<PublicHoliday> {
    await this.repo.update(id, updates);
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Seed Pakistan holidays for a given year.
   * Idempotent — skips if holidays already exist for that year.
   */
  async seedPakistanHolidays(year = 2026): Promise<{ seeded: number }> {
    const existing = await this.repo.count({ where: { year } });
    if (existing > 0) {
      return { seeded: 0 };
    }

    const holidays = PAKISTAN_HOLIDAYS_2026.map((h) => {
      const adjustedDate = h.date.replace('2026', String(year));
      return this.repo.create({
        ...h,
        date: adjustedDate,
        year,
        locationId: '*',
      });
    });

    await this.repo.save(holidays);
    return { seeded: holidays.length };
  }
}
