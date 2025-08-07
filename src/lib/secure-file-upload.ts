import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedName?: string;
}

export function validateFileUpload(
  file: File | { name: string; size: number; type: string },
  maxSize: number = 10485760, // 10MB default
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf']
): FileValidationResult {
  // Validate file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
    };
  }

  // Validate MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  // Validate file extension
  const allowedExtensions = allowedTypes.map(type => {
    switch (type) {
      case 'image/jpeg': return ['.jpg', '.jpeg'];
      case 'image/png': return ['.png'];
      case 'application/pdf': return ['.pdf'];
      case 'application/msword': return ['.doc'];
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return ['.docx'];
      default: return [];
    }
  }).flat();

  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: `Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`
    };
  }

  // Sanitize filename
  const sanitizedName = sanitizeFileName(file.name);
  
  // Validate filename length
  if (sanitizedName.length === 0 || sanitizedName.length > 100) {
    return {
      isValid: false,
      error: 'Invalid filename length'
    };
  }

  return {
    isValid: true,
    sanitizedName
  };
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace unsafe characters
    .replace(/\.{2,}/g, '.') // Remove consecutive dots
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .substring(0, 100); // Limit length
}

export function generateSecureFilePath(
  userId: string,
  folder: string,
  originalName: string,
  timestamp: number = Date.now()
): string {
  const sanitizedName = sanitizeFileName(originalName);
  const extension = sanitizedName.split('.').pop();
  const nameWithoutExt = sanitizedName.replace(/\.[^/.]+$/, '');
  
  // Create unique filename with timestamp
  const uniqueName = `${nameWithoutExt}_${timestamp}.${extension}`;
  
  return `${userId}/${folder}/${uniqueName}`;
}

export function validateStoragePath(path: string, userId: string): boolean {
  // Check for directory traversal
  if (path.includes('..') || path.includes('//') || path.includes('\\')) {
    return false;
  }

  // Ensure path starts with user ID
  if (!path.startsWith(`${userId}/`)) {
    return false;
  }

  // Validate allowed folders
  const allowedFolders = ['documents', 'photos', 'avatars', 'reports'];
  const pathParts = path.split('/');
  if (pathParts.length < 3 || !allowedFolders.includes(pathParts[1])) {
    return false;
  }

  return true;
}

// Virus scanning simulation (replace with actual virus scanner in production)
export async function scanFileForViruses(fileBuffer: ArrayBuffer): Promise<{ isSafe: boolean; threat?: string }> {
  // In production, integrate with actual virus scanning service
  // For now, check for suspicious file signatures
  
  const uint8Array = new Uint8Array(fileBuffer);
  
  // Check for executable file signatures
  const executableSignatures = [
    [0x4D, 0x5A], // PE executable (Windows)
    [0x7F, 0x45, 0x4C, 0x46], // ELF executable (Linux)
    [0xFE, 0xED, 0xFA, 0xCE], // Mach-O executable (macOS)
  ];

  for (const signature of executableSignatures) {
    if (uint8Array.length >= signature.length) {
      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (uint8Array[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return { isSafe: false, threat: 'Executable file detected' };
      }
    }
  }

  // Check for suspicious strings
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const content = decoder.decode(uint8Array.slice(0, 1024)); // Check first 1KB
  
  const suspiciousPatterns = [
    /javascript:/i,
    /<script/i,
    /eval\(/i,
    /document\.write/i,
    /window\.location/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      return { isSafe: false, threat: 'Suspicious script content detected' };
    }
  }

  return { isSafe: true };
}

export async function processSecureUpload(
  supabase: any,
  file: File,
  userId: string,
  bucket: string,
  folder: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Validate file
    const validation = validateFileUpload(file);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Generate secure path
    const filePath = generateSecureFilePath(userId, folder, validation.sanitizedName!);
    
    // Validate storage path
    if (!validateStoragePath(filePath, userId)) {
      return { success: false, error: 'Invalid storage path' };
    }

    // Scan for viruses
    const fileBuffer = await file.arrayBuffer();
    const scanResult = await scanFileForViruses(fileBuffer);
    if (!scanResult.isSafe) {
      return { success: false, error: `Security threat detected: ${scanResult.threat}` };
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        metadata: {
          originalName: file.name,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          scanned: 'true'
        }
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: 'Upload failed' };
    }

    return { success: true, data: { path: filePath, ...data } };
  } catch (error) {
    console.error('Secure upload error:', error);
    return { success: false, error: 'Upload processing failed' };
  }
}

// Edge function helper for file validation
export function createFileValidationResponse(
  isValid: boolean,
  error?: string,
  data?: any
): Response {
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: error || 'File validation failed' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }
  );
}