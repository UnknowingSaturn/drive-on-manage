import { z } from 'zod';

// Core validation schemas
export const emailSchema = z.string().email('Invalid email format').min(1, 'Email is required');
export const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long');
export const phoneSchema = z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number');
export const parcelCountSchema = z.number().int().min(0, 'Parcel count cannot be negative').max(9999, 'Parcel count too high');
export const mileageSchema = z.number().int().min(0, 'Mileage cannot be negative').max(999999, 'Invalid mileage');
export const payRateSchema = z.number().min(0, 'Rate cannot be negative').max(1000, 'Rate too high');

// Driver profile update validation
export const driverProfileUpdateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  licenseNumber: z.string().min(5, 'License number too short').max(20, 'License number too long'),
  licenseExpiry: z.string().refine((date) => new Date(date) > new Date(), 'License must not be expired'),
  rightToWorkDocument: z.string().url().optional(),
  drivingLicenseDocument: z.string().url().optional(),
  insuranceDocument: z.string().url().optional(),
});

// SOD validation
export const sodLogSchema = z.object({
  parcelCount: parcelCountSchema,
  startingMileage: mileageSchema,
  vanConfirmed: z.boolean().refine(val => val === true, 'Van confirmation required'),
  vehicleCheckCompleted: z.boolean().refine(val => val === true, 'Vehicle check must be completed'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

// EOD validation
export const eodReportSchema = z.object({
  parcelsDelivered: parcelCountSchema,
  screenshot: z.instanceof(File).refine(
    (file) => file.size <= 5 * 1024 * 1024,
    'File size must be less than 5MB'
  ).refine(
    (file) => file.type.startsWith('image/'),
    'File must be an image'
  ),
  issuesReported: z.string().max(1000, 'Issues report too long').optional(),
});

// Validation functions
export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateDriverProfile(data: unknown) {
  try {
    return driverProfileUpdateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(firstError.path.join('.'), firstError.message);
    }
    throw error;
  }
}

export function validateSOD(data: unknown) {
  try {
    return sodLogSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(firstError.path.join('.'), firstError.message);
    }
    throw error;
  }
}

export function validateEOD(data: unknown) {
  try {
    return eodReportSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(firstError.path.join('.'), firstError.message);
    }
    throw error;
  }
}

// Business logic validation
export function validateParcelDeliveryLogic(startCount: number, deliveredCount: number): boolean {
  if (deliveredCount > startCount) {
    throw new ValidationError('parcelsDelivered', 'Cannot deliver more parcels than started with');
  }
  return true;
}

export function validateDateLogic(logDate: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (logDate !== today) {
    throw new ValidationError('logDate', 'Can only log for today');
  }
  return true;
}

export function validateVehicleAssignment(driverId: string, vanId: string | null): boolean {
  if (!vanId) {
    throw new ValidationError('vanAssignment', 'Driver must have an assigned vehicle');
  }
  return true;
}