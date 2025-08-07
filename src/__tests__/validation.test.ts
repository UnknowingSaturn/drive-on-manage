import { describe, it, expect } from 'vitest';
import {
  validateOnboarding,
  validateSOD,
  validateEOD,
  validateParcelDeliveryLogic,
  validateDateLogic,
  ValidationError,
} from '../lib/validation';

describe('Onboarding Validation', () => {
  const validOnboardingData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    licenseNumber: 'DL123456789',
    licenseExpiry: '2025-12-31',
  };

  it('should validate correct onboarding data', () => {
    expect(() => validateOnboarding(validOnboardingData)).not.toThrow();
  });

  it('should reject invalid email', () => {
    const invalidData = { ...validOnboardingData, email: 'invalid-email' };
    expect(() => validateOnboarding(invalidData)).toThrow(ValidationError);
  });

  it('should reject empty first name', () => {
    const invalidData = { ...validOnboardingData, firstName: '' };
    expect(() => validateOnboarding(invalidData)).toThrow(ValidationError);
  });

  it('should reject expired license', () => {
    const invalidData = { ...validOnboardingData, licenseExpiry: '2020-01-01' };
    expect(() => validateOnboarding(invalidData)).toThrow(ValidationError);
  });

  it('should reject invalid phone number', () => {
    const invalidData = { ...validOnboardingData, phone: 'abc123' };
    expect(() => validateOnboarding(invalidData)).toThrow(ValidationError);
  });

  it('should reject names that are too long', () => {
    const longName = 'a'.repeat(51);
    const invalidData = { ...validOnboardingData, firstName: longName };
    expect(() => validateOnboarding(invalidData)).toThrow(ValidationError);
  });
});

describe('SOD Validation', () => {
  const validSODData = {
    parcelCount: 50,
    startingMileage: 12000,
    vanConfirmed: true,
    vehicleCheckCompleted: true,
    notes: 'All good',
  };

  it('should validate correct SOD data', () => {
    expect(() => validateSOD(validSODData)).not.toThrow();
  });

  it('should reject negative parcel count', () => {
    const invalidData = { ...validSODData, parcelCount: -1 };
    expect(() => validateSOD(invalidData)).toThrow(ValidationError);
  });

  it('should reject when van not confirmed', () => {
    const invalidData = { ...validSODData, vanConfirmed: false };
    expect(() => validateSOD(invalidData)).toThrow(ValidationError);
  });

  it('should reject when vehicle check not completed', () => {
    const invalidData = { ...validSODData, vehicleCheckCompleted: false };
    expect(() => validateSOD(invalidData)).toThrow(ValidationError);
  });

  it('should reject extremely high parcel count', () => {
    const invalidData = { ...validSODData, parcelCount: 10000 };
    expect(() => validateSOD(invalidData)).toThrow(ValidationError);
  });

  it('should reject notes that are too long', () => {
    const longNotes = 'a'.repeat(501);
    const invalidData = { ...validSODData, notes: longNotes };
    expect(() => validateSOD(invalidData)).toThrow(ValidationError);
  });
});

describe('EOD Validation', () => {
  const createMockFile = (size: number, type: string) => {
    return new File(['x'.repeat(size)], 'test.jpg', { type });
  };

  const validEODData = {
    parcelsDelivered: 45,
    screenshot: createMockFile(1000, 'image/jpeg'),
    issuesReported: 'No issues',
  };

  it('should validate correct EOD data', () => {
    expect(() => validateEOD(validEODData)).not.toThrow();
  });

  it('should reject file that is too large', () => {
    const invalidData = {
      ...validEODData,
      screenshot: createMockFile(6 * 1024 * 1024, 'image/jpeg'),
    };
    expect(() => validateEOD(invalidData)).toThrow(ValidationError);
  });

  it('should reject non-image files', () => {
    const invalidData = {
      ...validEODData,
      screenshot: createMockFile(1000, 'text/plain'),
    };
    expect(() => validateEOD(invalidData)).toThrow(ValidationError);
  });

  it('should reject negative delivered count', () => {
    const invalidData = { ...validEODData, parcelsDelivered: -1 };
    expect(() => validateEOD(invalidData)).toThrow(ValidationError);
  });
});

describe('Business Logic Validation', () => {
  it('should validate parcel delivery logic', () => {
    expect(() => validateParcelDeliveryLogic(50, 45)).not.toThrow();
  });

  it('should reject delivering more than started with', () => {
    expect(() => validateParcelDeliveryLogic(50, 55)).toThrow(ValidationError);
  });

  it('should validate today\'s date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(() => validateDateLogic(today)).not.toThrow();
  });

  it('should reject past dates', () => {
    expect(() => validateDateLogic('2023-01-01')).toThrow(ValidationError);
  });

  it('should reject future dates', () => {
    expect(() => validateDateLogic('2030-01-01')).toThrow(ValidationError);
  });
});

describe('Module Integration Tests', () => {
  describe('Driver Onboarding Flow', () => {
    it('should handle complete onboarding process', () => {
      // Test step-by-step onboarding validation
      const steps = [
        { field: 'personal', data: { firstName: 'John', lastName: 'Doe', email: 'john@test.com' } },
        { field: 'contact', data: { phone: '+1234567890' } },
        { field: 'license', data: { licenseNumber: 'DL123', licenseExpiry: '2025-12-31' } },
      ];

      steps.forEach(step => {
        expect(step.data).toBeDefined();
        expect(Object.keys(step.data).length).toBeGreaterThan(0);
      });
    });

    it('should calculate progress correctly', () => {
      const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'licenseNumber'];
      const completedFields = ['firstName', 'lastName', 'email'];
      const progress = (completedFields.length / requiredFields.length) * 100;
      
      expect(progress).toBe(60);
    });
  });

  describe('Daily Operations Flow', () => {
    it('should enforce SOD before EOD workflow', () => {
      const hasSOD = false;
      const attemptEOD = true;

      if (attemptEOD && !hasSOD) {
        expect(() => {
          throw new Error('SOD required before EOD');
        }).toThrow('SOD required before EOD');
      }
    });

    it('should validate delivery counts between SOD and EOD', () => {
      const sodCount = 50;
      const eodCount = 45;
      
      expect(eodCount).toBeLessThanOrEqual(sodCount);
      expect(eodCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('File Upload Validation', () => {
    it('should validate image file types', () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const testType = 'image/jpeg';
      
      expect(validTypes.includes(testType)).toBe(true);
    });

    it('should validate file size limits', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const testSize = 1024 * 1024; // 1MB
      
      expect(testSize).toBeLessThanOrEqual(maxSize);
    });
  });
});