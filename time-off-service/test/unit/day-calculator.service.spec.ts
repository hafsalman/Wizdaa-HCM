import { DayCalculatorService } from '../../src/core/day-calculator.service';

// Mock repository for holidays
const mockHolidayRepo = {
  find: jest.fn().mockResolvedValue([]),
};

describe('DayCalculatorService', () => {
  let service: DayCalculatorService;

  beforeEach(() => {
    mockHolidayRepo.find.mockResolvedValue([]);
    service = new DayCalculatorService(mockHolidayRepo as any);
  });

  describe('calculateLeaveDays', () => {
    it('should count weekdays only (Mon-Fri)', async () => {
      // Mon Jun 1 to Fri Jun 5, 2026 = 5 working days
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-05',
        'PKR-01',
      );
      expect(result).toBe(5);
    });

    it('should exclude weekends', async () => {
      // Mon Jun 1 to Sun Jun 7, 2026 = 5 working days (Sat+Sun excluded)
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-07',
        'PKR-01',
      );
      expect(result).toBe(5);
    });

    it('should handle single day leave', async () => {
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-01',
        'PKR-01',
      );
      expect(result).toBe(1);
    });

    it('should return 0 for weekend-only range', async () => {
      // Sat Jun 6 to Sun Jun 7, 2026
      const result = await service.calculateLeaveDays(
        '2026-06-06',
        '2026-06-07',
        'PKR-01',
      );
      expect(result).toBe(0);
    });

    it('should handle half-day at start', async () => {
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-02',
        'PKR-01',
        true,
        false,
      );
      expect(result).toBe(1.5);
    });

    it('should handle half-day at end', async () => {
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-02',
        'PKR-01',
        false,
        true,
      );
      expect(result).toBe(1.5);
    });

    it('should handle half-day at both start and end', async () => {
      // 2 days, half on each = 1 full day
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-02',
        'PKR-01',
        true,
        true,
      );
      expect(result).toBe(1);
    });

    it('should handle same-day half-day (both flags)', async () => {
      // Same day, startHalf + endHalf = 0.5
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-01',
        'PKR-01',
        true,
        true,
      );
      expect(result).toBe(0.5);
    });

    it('should handle single day startHalf only', async () => {
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-01',
        'PKR-01',
        true,
        false,
      );
      expect(result).toBe(0.5);
    });

    it('should exclude public holidays', async () => {
      // Seed a holiday on Jun 3, 2026 (Wednesday)
      mockHolidayRepo.find.mockResolvedValue([{ date: '2026-06-03' }]);

      // Mon Jun 1 to Fri Jun 5 = 5 days - 1 holiday = 4
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-05',
        'PKR-01',
      );
      expect(result).toBe(4);
    });

    it('should exclude multiple holidays', async () => {
      mockHolidayRepo.find.mockResolvedValue([
        { date: '2026-06-03' },
        { date: '2026-06-04' },
      ]);

      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-05',
        'PKR-01',
      );
      expect(result).toBe(3);
    });

    it('should handle two-week span correctly', async () => {
      // Mon Jun 1 to Fri Jun 12, 2026 = 10 working days
      const result = await service.calculateLeaveDays(
        '2026-06-01',
        '2026-06-12',
        'PKR-01',
      );
      expect(result).toBe(10);
    });

    it('should handle Pakistan Independence Day (Aug 14)', async () => {
      mockHolidayRepo.find.mockResolvedValue([{ date: '2026-08-14' }]);

      // Aug 14, 2026 is Friday — should be excluded
      const result = await service.calculateLeaveDays(
        '2026-08-10',
        '2026-08-14',
        'PKR-01',
      );
      expect(result).toBe(4); // Mon-Thu = 4, Fri is holiday
    });
  });
});
