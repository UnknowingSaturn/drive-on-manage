import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ValidationRequest {
  type: 'invitation' | 'onboarding' | 'sod' | 'eod' | 'incident' | 'file_upload';
  data: any;
  user_id?: string;
}

export async function validateServerSide(request: ValidationRequest): Promise<{
  valid: boolean;
  errors: string[];
  sanitized_data?: any;
}> {
  const errors: string[] = [];
  let sanitizedData = { ...request.data };

  try {
    switch (request.type) {
      case 'invitation':
        return validateDriverInvitation(sanitizedData);
      
      case 'onboarding':
        return validateDriverOnboarding(sanitizedData);
      
      case 'sod':
        return validateStartOfDay(sanitizedData);
      
      case 'eod':
        return validateEndOfDay(sanitizedData);
      
      case 'incident':
        return validateIncidentReport(sanitizedData);
      
      case 'file_upload':
        return await validateFileUpload(sanitizedData, request.user_id);
      
      default:
        errors.push('Invalid validation type');
    }
  } catch (error) {
    console.error('Validation error:', error);
    errors.push('Server validation failed');
  }

  return { valid: false, errors };
}

function validateDriverInvitation(data: any) {
  const errors: string[] = [];
  const sanitized: any = {};

  // Email validation
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push('Invalid email format');
  } else {
    sanitized.email = data.email.toLowerCase().trim();
  }

  // Name validation
  if (!data.first_name || data.first_name.length < 1 || data.first_name.length > 50) {
    errors.push('First name must be 1-50 characters');
  } else {
    sanitized.first_name = sanitizeText(data.first_name);
  }

  if (!data.last_name || data.last_name.length < 1 || data.last_name.length > 50) {
    errors.push('Last name must be 1-50 characters');
  } else {
    sanitized.last_name = sanitizeText(data.last_name);
  }

  // Phone validation (optional)
  if (data.phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(data.phone)) {
      errors.push('Invalid phone format');
    } else {
      sanitized.phone = data.phone.trim();
    }
  }

  // Hourly rate validation (optional)
  if (data.hourly_rate !== undefined) {
    const rate = Number(data.hourly_rate);
    if (isNaN(rate) || rate < 0 || rate > 1000) {
      errors.push('Hourly rate must be between 0 and 1000');
    } else {
      sanitized.hourly_rate = rate;
    }
  }

  // Company ID validation
  if (!data.company_id || !isValidUUID(data.company_id)) {
    errors.push('Invalid company ID');
  } else {
    sanitized.company_id = data.company_id;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized_data: sanitized
  };
}

function validateDriverOnboarding(data: any) {
  const errors: string[] = [];
  const sanitized: any = {};

  // Employee ID
  if (!data.employee_id || data.employee_id.length < 1 || data.employee_id.length > 20) {
    errors.push('Employee ID must be 1-20 characters');
  } else {
    sanitized.employee_id = sanitizeText(data.employee_id);
  }

  // Driving license
  if (!data.driving_license_number || data.driving_license_number.length < 1 || data.driving_license_number.length > 50) {
    errors.push('Driving license number must be 1-50 characters');
  } else {
    sanitized.driving_license_number = sanitizeText(data.driving_license_number);
  }

  // License expiry
  if (!data.license_expiry) {
    errors.push('License expiry date is required');
  } else {
    const expiryDate = new Date(data.license_expiry);
    const today = new Date();
    if (expiryDate <= today) {
      errors.push('License must not be expired');
    } else {
      sanitized.license_expiry = data.license_expiry;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized_data: sanitized
  };
}

function validateStartOfDay(data: any) {
  const errors: string[] = [];
  const sanitized: any = {};

  // Parcel count
  const parcelCount = Number(data.parcel_count);
  if (isNaN(parcelCount) || parcelCount < 0 || parcelCount > 1000) {
    errors.push('Parcel count must be between 0 and 1000');
  } else {
    sanitized.parcel_count = parcelCount;
  }

  // Starting mileage
  const mileage = Number(data.starting_mileage);
  if (isNaN(mileage) || mileage < 0 || mileage > 999999) {
    errors.push('Starting mileage must be between 0 and 999999');
  } else {
    sanitized.starting_mileage = mileage;
  }

  // Boolean validations
  sanitized.van_confirmed = Boolean(data.van_confirmed);
  sanitized.vehicle_check_completed = Boolean(data.vehicle_check_completed);

  // Notes (optional)
  if (data.notes) {
    if (data.notes.length > 500) {
      errors.push('Notes must be 500 characters or less');
    } else {
      sanitized.notes = sanitizeText(data.notes);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized_data: sanitized
  };
}

function validateEndOfDay(data: any) {
  const errors: string[] = [];
  const sanitized: any = {};

  // Parcels delivered
  const delivered = Number(data.parcels_delivered);
  if (isNaN(delivered) || delivered < 0 || delivered > 1000) {
    errors.push('Parcels delivered must be between 0 and 1000');
  } else {
    sanitized.parcels_delivered = delivered;
  }

  // Issues reported (optional)
  if (data.issues_reported) {
    if (data.issues_reported.length > 1000) {
      errors.push('Issues report must be 1000 characters or less');
    } else {
      sanitized.issues_reported = sanitizeText(data.issues_reported);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized_data: sanitized
  };
}

function validateIncidentReport(data: any) {
  const errors: string[] = [];
  const sanitized: any = {};

  // Incident type
  const validTypes = ['accident', 'theft', 'damage', 'safety', 'other'];
  if (!data.incident_type || !validTypes.includes(data.incident_type)) {
    errors.push('Invalid incident type');
  } else {
    sanitized.incident_type = data.incident_type;
  }

  // Description
  if (!data.description || data.description.length < 10 || data.description.length > 2000) {
    errors.push('Description must be 10-2000 characters');
  } else {
    sanitized.description = sanitizeText(data.description);
  }

  // Location (optional)
  if (data.location) {
    if (data.location.length > 200) {
      errors.push('Location must be 200 characters or less');
    } else {
      sanitized.location = sanitizeText(data.location);
    }
  }

  // Incident date
  if (!data.incident_date) {
    errors.push('Incident date is required');
  } else {
    const incidentDate = new Date(data.incident_date);
    if (isNaN(incidentDate.getTime())) {
      errors.push('Invalid incident date format');
    } else {
      sanitized.incident_date = data.incident_date;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized_data: sanitized
  };
}

async function validateFileUpload(data: any, userId?: string) {
  const errors: string[] = [];
  const sanitized: any = {};

  if (!data.file) {
    errors.push('File is required');
    return { valid: false, errors, sanitized_data: sanitized };
  }

  const file = data.file;

  // File size validation (max 10MB)
  if (file.size > 10485760) {
    errors.push('File too large (max 10MB)');
  }

  if (file.size <= 0) {
    errors.push('File is empty');
  }

  // File type validation
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (!allowedTypes.includes(file.type)) {
    errors.push('Invalid file type');
  }

  // File extension validation
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    errors.push('Invalid file extension');
  }

  // Filename validation
  if (file.name.length > 100 || file.name.length < 1) {
    errors.push('Invalid filename length');
  }

  // Check for dangerous characters
  if (/[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
    errors.push('Filename contains invalid characters');
  }

  // Sanitize filename
  sanitized.sanitized_name = sanitizeFileName(file.name);

  // Generate secure path
  if (userId) {
    sanitized.secure_path = generateSecureFilePath(userId, data.document_type || 'documents', sanitized.sanitized_name);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized_data: sanitized
  };
}

// Utility functions
function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .trim()
    .substring(0, 1000); // Limit length
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace unsafe characters
    .replace(/\.{2,}/g, '.') // Remove consecutive dots
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .substring(0, 100); // Limit length
}

function generateSecureFilePath(userId: string, folder: string, originalName: string): string {
  const timestamp = Date.now();
  const sanitizedName = sanitizeFileName(originalName);
  const extension = sanitizedName.split('.').pop();
  const nameWithoutExt = sanitizedName.replace(/\.[^/.]+$/, '');
  
  const uniqueName = `${nameWithoutExt}_${timestamp}.${extension}`;
  return `${userId}/${folder}/${uniqueName}`;
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Main edge function handler
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data, user_id } = await req.json();

    const validationResult = await validateServerSide({ type, data, user_id });

    return new Response(JSON.stringify(validationResult), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: validationResult.valid ? 200 : 400
    });
  } catch (error) {
    console.error('Server validation error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        errors: ['Server validation failed'],
        message: 'Internal server error' 
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 500
      }
    );
  }
});