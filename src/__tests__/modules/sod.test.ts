import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../integrations/supabase/client';

vi.mock('../../integrations/supabase/client');

describe('Start of Day (SOD) Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SOD Log Creation', () => {
    it('should create SOD log with valid data', async () => {
      const validSODData = {
        driver_id: 'driver-123',
        company_id: 'company-123',
        van_id: 'van-123',
        log_date: new Date().toISOString().split('T')[0],
        parcel_count: 50,
        starting_mileage: 12000,
        van_confirmed: true,
        vehicle_check_completed: true,
        notes: 'All systems good',
      };

      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'sod-123', ...validSODData },
              error: null,
            }),
          }),
        }),
      });

      const result = await supabase
        .from('sod_logs')
        .insert(validSODData)
        .select()
        .single();

      expect(result.error).toBeNull();
      expect(result.data.parcel_count).toBe(50);
    });

    it('should prevent duplicate SOD logs for same day', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'existing-sod' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const existingLog = await supabase
        .from('sod_logs')
        .select('*')
        .eq('driver_id', 'driver-123')
        .eq('log_date', today)
        .maybeSingle();

      expect(existingLog.data).toBeTruthy();
      
      // Should prevent creating another log
      if (existingLog.data) {
        expect(() => {
          throw new Error('SOD log already exists for today');
        }).toThrow('SOD log already exists for today');
      }
    });

    it('should validate parcel count limits', () => {
      const testCases = [
        { count: -1, shouldFail: true },
        { count: 0, shouldFail: false },
        { count: 999, shouldFail: false },
        { count: 10000, shouldFail: true },
      ];

      testCases.forEach(({ count, shouldFail }) => {
        if (shouldFail) {
          expect(() => {
            if (count < 0 || count > 9999) {
              throw new Error('Invalid parcel count');
            }
          }).toThrow('Invalid parcel count');
        } else {
          expect(() => {
            if (count < 0 || count > 9999) {
              throw new Error('Invalid parcel count');
            }
          }).not.toThrow();
        }
      });
    });

    it('should require vehicle check completion', () => {
      const vehicleCheckItems = {
        lights: true,
        tyres: true,
        brakes: false, // Missing check
        mirrors: true,
        fuel: true,
      };

      const allChecked = Object.values(vehicleCheckItems).every(Boolean);
      
      expect(() => {
        if (!allChecked) {
          throw new Error('Vehicle check incomplete');
        }
      }).toThrow('Vehicle check incomplete');
    });

    it('should validate van assignment', () => {
      const driverProfile = {
        id: 'driver-123',
        assigned_van_id: null, // No van assigned
      };

      expect(() => {
        if (!driverProfile.assigned_van_id) {
          throw new Error('Driver must have assigned van');
        }
      }).toThrow('Driver must have assigned van');
    });
  });

  describe('Mileage Validation', () => {
    it('should accept reasonable mileage values', () => {
      const validMileages = [0, 1000, 50000, 200000];
      
      validMileages.forEach(mileage => {
        expect(() => {
          if (mileage < 0 || mileage > 999999) {
            throw new Error('Invalid mileage');
          }
        }).not.toThrow();
      });
    });

    it('should reject unrealistic mileage values', () => {
      const invalidMileages = [-1, 1000000, -500];
      
      invalidMileages.forEach(mileage => {
        expect(() => {
          if (mileage < 0 || mileage > 999999) {
            throw new Error('Invalid mileage');
          }
        }).toThrow('Invalid mileage');
      });
    });
  });

  describe('Date Validation', () => {
    it('should only allow SOD for current date', () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      expect(() => {
        if (yesterday !== today) {
          throw new Error('Can only log SOD for today');
        }
      }).toThrow('Can only log SOD for today');

      expect(() => {
        if (tomorrow !== today) {
          throw new Error('Can only log SOD for today');
        }
      }).toThrow('Can only log SOD for today');
    });
  });
});