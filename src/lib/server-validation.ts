import { z } from 'zod';

// Core validation schemas for all forms
export const createDriverInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  first_name: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone format').optional(),
  parcel_rate: z.number().min(0, 'Parcel rate must be positive').optional(),
  company_id: z.string().uuid('Invalid company ID'),
});

export const driverOnboardingSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required').max(20, 'Employee ID too long'),
  driving_license_number: z.string().min(1, 'License number is required').max(50, 'License number too long'),
  license_expiry: z.string().refine((date) => {
    const expiry = new Date(date);
    const today = new Date();
    return expiry > today;
  }, 'License must not be expired'),
  personal_info: z.object({
    first_name: z.string().min(1, 'First name is required').max(50),
    last_name: z.string().min(1, 'Last name is required').max(50),
    email: z.string().email('Invalid email format'),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone format'),
  }),
});

export const startOfDaySchema = z.object({
  parcel_count: z.number().int().min(0, 'Parcel count must be non-negative').max(1000, 'Parcel count too high'),
  starting_mileage: z.number().int().min(0, 'Mileage must be non-negative'),
  van_confirmed: z.boolean(),
  vehicle_check_completed: z.boolean(),
  notes: z.string().max(500, 'Notes too long').optional(),
  vehicle_check_items: z.record(z.boolean()).optional(),
});

export const endOfDaySchema = z.object({
  parcels_delivered: z.number().int().min(0, 'Delivered count must be non-negative'),
  issues_reported: z.string().max(1000, 'Issues report too long').optional(),
  screenshot_file: z.object({
    name: z.string(),
    size: z.number().max(10485760, 'File too large (max 10MB)'),
    type: z.string().refine((type) => 
      ['image/jpeg', 'image/png', 'image/jpg'].includes(type),
      'Only JPEG/PNG images allowed'
    ),
  }).optional(),
});

export const incidentReportSchema = z.object({
  incident_type: z.enum(['accident', 'theft', 'damage', 'safety', 'other']),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description too long'),
  location: z.string().max(200, 'Location too long').optional(),
  incident_date: z.string().datetime('Invalid date format'),
  photos: z.array(z.object({
    name: z.string(),
    size: z.number().max(5242880, 'Image too large (max 5MB)'),
    type: z.string().refine((type) => 
      ['image/jpeg', 'image/png', 'image/jpg'].includes(type),
      'Only JPEG/PNG images allowed'
    ),
  })).max(5, 'Maximum 5 photos allowed').optional(),
});

export const vehicleCheckSchema = z.object({
  exterior_condition: z.enum(['good', 'minor_issues', 'major_issues']).optional(),
  interior_condition: z.enum(['good', 'minor_issues', 'major_issues']).optional(),
  fuel_level: z.number().int().min(0).max(100, 'Fuel level must be 0-100%').optional(),
  mileage: z.number().int().min(0, 'Mileage must be non-negative').optional(),
  issues_reported: z.string().max(1000, 'Issues report too long').optional(),
  photos: z.array(z.object({
    name: z.string(),
    size: z.number().max(5242880, 'Image too large (max 5MB)'),
    type: z.string().refine((type) => 
      ['image/jpeg', 'image/png', 'image/jpg'].includes(type),
      'Only JPEG/PNG images allowed'
    ),
  })).max(10, 'Maximum 10 photos allowed').optional(),
});

// File upload validation
export const documentUploadSchema = z.object({
  file: z.object({
    name: z.string().refine((name) => {
      const allowedExtensions = /\.(jpg|jpeg|png|pdf|doc|docx)$/i;
      return allowedExtensions.test(name);
    }, 'Invalid file type. Only JPG, PNG, PDF, DOC, DOCX allowed'),
    size: z.number().max(10485760, 'File too large (max 10MB)'),
    type: z.string().refine((type) => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/jpg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      return allowedTypes.includes(type);
    }, 'Invalid MIME type'),
  }),
  document_type: z.enum(['driving_license', 'right_to_work', 'insurance', 'other']),
});

// API validation utilities
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

// Sanitization functions
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .trim()
    .substring(0, 1000); // Limit length
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace unsafe characters
    .replace(/\.{2,}/g, '.') // Remove double dots
    .replace(/^\./, '') // Remove leading dot
    .substring(0, 100); // Limit length
}

// Path validation
export function validateFilePath(path: string, userId: string): boolean {
  // Ensure path doesn't contain directory traversal
  if (path.includes('..') || path.includes('//')) {
    return false;
  }
  
  // Ensure path starts with user ID for security
  if (!path.startsWith(`${userId}/`)) {
    return false;
  }
  
  // Validate path length
  if (path.length > 200) {
    return false;
  }
  
  return true;
}

// Rate limiting validation
export function validateRateLimit(attempts: number, windowMinutes: number = 60): boolean {
  const maxAttempts = windowMinutes === 60 ? 10 : 5; // 10 per hour, 5 per shorter window
  return attempts < maxAttempts;
}

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  errors: ValidationError[];
};