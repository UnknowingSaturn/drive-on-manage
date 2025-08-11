import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecureInviteRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hourlyRate?: string;
  companyId: string;
}

// XSS/SQL Injection protection
const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>\"']/g, '') // Remove HTML/script chars
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control chars
    .trim()
    .slice(0, 255); // Limit length
};

// Advanced input validation
const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitized = sanitizeInput(email);
  
  if (!emailRegex.test(sanitized)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  // Check for common disposable email domains
  const disposableProviders = ['10minutemail', 'tempmail', 'guerrillamail', 'mailinator'];
  const domain = sanitized.split('@')[1].toLowerCase();
  if (disposableProviders.some(provider => domain.includes(provider))) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }
  
  return { valid: true };
};

const validateName = (name: string): { valid: boolean; error?: string } => {
  const sanitized = sanitizeInput(name);
  if (sanitized.length < 2 || sanitized.length > 50) {
    return { valid: false, error: 'Name must be between 2-50 characters' };
  }
  if (!/^[a-zA-Z\s'-]+$/.test(sanitized)) {
    return { valid: false, error: 'Name contains invalid characters' };
  }
  return { valid: true };
};

const validatePhone = (phone: string): { valid: boolean; error?: string } => {
  if (!phone) return { valid: true }; // Optional field
  const sanitized = sanitizeInput(phone);
  if (!/^[\+]?[\d\s\-\(\)]{10,15}$/.test(sanitized)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  return { valid: true };
};

const validateHourlyRate = (rate: string): { valid: boolean; error?: string } => {
  if (!rate) return { valid: true }; // Optional field
  const numRate = parseFloat(rate);
  if (isNaN(numRate) || numRate < 0 || numRate > 1000) {
    return { valid: false, error: 'Hourly rate must be between 0-1000' };
  }
  return { valid: true };
};

const validateUuid = (id: string): { valid: boolean; error?: string } => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return { valid: false, error: 'Invalid company ID format' };
  }
  return { valid: true };
};

// Rate limiting check
const checkRateLimit = async (supabase: any, userId: string, companyId: string): Promise<{ allowed: boolean; error?: string }> => {
  const now = new Date();
  const oneHour = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Get current rate limit record
  const { data: rateLimit, error } = await supabase
    .from('invitation_rate_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .gte('window_start', oneHour.toISOString())
    .maybeSingle();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Rate limit check error:', error);
    return { allowed: true }; // Fail open for now
  }

  const maxInvitationsPerHour = 10; // Security limit
  
  if (rateLimit) {
    if (rateLimit.invitations_sent >= maxInvitationsPerHour) {
      return { 
        allowed: false, 
        error: `Rate limit exceeded. Maximum ${maxInvitationsPerHour} invitations per hour allowed.` 
      };
    }
    
    // Update count
    await supabase
      .from('invitation_rate_limits')
      .update({ 
        invitations_sent: rateLimit.invitations_sent + 1,
        updated_at: now.toISOString()
      })
      .eq('id', rateLimit.id);
  } else {
    // Create new rate limit record
    await supabase
      .from('invitation_rate_limits')
      .insert({
        user_id: userId,
        company_id: companyId,
        invitations_sent: 1,
        window_start: now.toISOString()
      });
  }

  return { allowed: true };
};

// Audit logging
const logAuditEvent = async (
  supabase: any, 
  invitationId: string | null, 
  action: string, 
  performedBy: string, 
  details: any,
  req: Request
) => {
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const xForwardedFor = req.headers.get('x-forwarded-for');
  const xRealIp = req.headers.get('x-real-ip');
  const ipAddress = xForwardedFor || xRealIp || 'unknown';

  await supabase
    .from('invitation_audit_log')
    .insert({
      invitation_id: invitationId,
      action,
      performed_by: performedBy,
      details,
      ip_address: ipAddress,
      user_agent: userAgent
    });
};

// Generate cryptographically secure token
const generateSecureToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

serve(async (req) => {
  console.log('=== Secure Staff Invite Function Started ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Environment validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceKey || !resendKey) {
      return new Response(JSON.stringify({
        error: 'Configuration error',
        message: 'Server configuration incomplete'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request with error handling
    let requestBody: SecureInviteRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({
        error: 'Invalid request',
        message: 'Request body must be valid JSON'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, firstName, lastName, phone, hourlyRate, companyId } = requestBody;

    // Comprehensive input validation with sanitization
    const validationErrors: string[] = [];
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) validationErrors.push(emailValidation.error!);
    
    const firstNameValidation = validateName(firstName);
    if (!firstNameValidation.valid) validationErrors.push(firstNameValidation.error!);
    
    const lastNameValidation = validateName(lastName);
    if (!lastNameValidation.valid) validationErrors.push(lastNameValidation.error!);
    
    const phoneValidation = validatePhone(phone || '');
    if (!phoneValidation.valid) validationErrors.push(phoneValidation.error!);
    
    const rateValidation = validateHourlyRate(hourlyRate || '');
    if (!rateValidation.valid) validationErrors.push(rateValidation.error!);
    
    const companyValidation = validateUuid(companyId);
    if (!companyValidation.valid) validationErrors.push(companyValidation.error!);

    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        message: 'Input validation errors',
        details: validationErrors
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize secure clients
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const resend = new Resend(resendKey);

    // Get authenticated user info for permission check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid authentication token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is admin and belongs to the company
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type, company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.user_type !== 'admin' || profile.company_id !== companyId) {
      await logAuditEvent(supabase, null, 'UNAUTHORIZED_INVITE_ATTEMPT', user.id, { 
        attempted_company: companyId,
        user_company: profile?.company_id,
        user_type: profile?.user_type 
      }, req);
      
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Insufficient permissions to invite drivers for this company'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting check
    const rateLimitCheck = await checkRateLimit(supabase, user.id, companyId);
    if (!rateLimitCheck.allowed) {
      await logAuditEvent(supabase, null, 'RATE_LIMIT_EXCEEDED', user.id, { 
        attempted_email: sanitizeInput(email) 
      }, req);
      
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: rateLimitCheck.error
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize all inputs before processing
    const sanitizedData = {
      email: sanitizeInput(email).toLowerCase(),
      firstName: sanitizeInput(firstName),
      lastName: sanitizeInput(lastName),
      phone: phone ? sanitizeInput(phone) : null,
      hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null
    };

    // Check for existing invitations and drivers
    const { data: existingInvite } = await supabase
      .from('driver_invitations')
      .select('id, status, expires_at')
      .eq('email', sanitizedData.email)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
      return new Response(JSON.stringify({
        error: 'Invitation exists',
        message: 'An active invitation for this email already exists'
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for existing driver with same email
    const { data: existingDrivers } = await supabase
      .from('driver_profiles')
      .select('user_id')
      .eq('company_id', companyId);

    if (existingDrivers && existingDrivers.length > 0) {
      const userIds = existingDrivers.map(d => d.user_id);
      const { data: profilesWithEmail } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', sanitizedData.email)
        .in('user_id', userIds);

      if (profilesWithEmail && profilesWithEmail.length > 0) {
        return new Response(JSON.stringify({
          error: 'Driver exists',
          message: 'A driver with this email already exists in your company'
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate secure token with expiration (7 days)
    const inviteToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('driver_invitations')
      .insert({
        email: sanitizedData.email,
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        phone: sanitizedData.phone,
        hourly_rate: sanitizedData.hourlyRate,
        company_id: companyId,
        invite_token: inviteToken,
        created_by: user.id,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Failed to create invitation:', inviteError);
      await logAuditEvent(supabase, null, 'INVITATION_CREATION_FAILED', user.id, { 
        error: inviteError.message,
        email: sanitizedData.email 
      }, req);
      
      return new Response(JSON.stringify({
        error: 'Database error',
        message: 'Failed to create invitation'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate secure onboarding URL - use request origin for dynamic URL
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com';
    const onboardingUrl = `${origin}/onboarding?token=${inviteToken}`;

    // Send secure invitation email
    try {
      const emailResponse = await resend.emails.send({
        from: "Driver Portal <noreply@unflawed.uk>",
        to: [sanitizedData.email],
        subject: "🚗 Secure Driver Invitation - Complete Your Onboarding",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🚗 Driver Invitation</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Secure Access • Expires in 7 Days</p>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hi <strong>${sanitizedData.firstName}</strong>,</p>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                You've been securely invited to join our driver team. This invitation contains advanced security features to protect your data.
              </p>
              
              <div style="background: #f7fafc; border-left: 4px solid #4299e1; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 15px 0; color: #2d3748;">🔐 Security Features</h3>
                <ul style="margin: 0; color: #4a5568; line-height: 1.8;">
                  <li>Cryptographically secure invitation token</li>
                  <li>Input validation and XSS protection</li>
                  <li>Rate limiting and audit logging</li>
                  <li>7-day expiration for enhanced security</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${onboardingUrl}" 
                   style="background: linear-gradient(90deg, #4299e1, #3182ce); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);">
                  🚀 Start Secure Onboarding
                </a>
              </div>
              
              <div style="background-color: #fed7d7; border-left: 4px solid #e53e3e; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #9b2c2c; font-weight: 500;">
                  ⚠️ <strong>Security Notice:</strong> This link expires on ${expiresAt.toLocaleDateString()}. Do not share this invitation with others.
                </p>
              </div>
              
              <div style="margin-top: 30px; padding: 20px; background-color: #f7fafc; border-radius: 8px; text-align: center;">
                <p style="color: #718096; font-size: 14px; margin: 0;">
                  If you have questions, contact your administrator.<br>
                  <strong>This is a secure, one-time use invitation token.</strong>
                </p>
              </div>
            </div>
          </div>
        `,
      });

      // Log successful invitation
      await logAuditEvent(supabase, invitation.id, 'INVITATION_SENT', user.id, {
        recipient_email: sanitizedData.email,
        recipient_name: `${sanitizedData.firstName} ${sanitizedData.lastName}`,
        email_id: emailResponse.id,
        expires_at: expiresAt.toISOString()
      }, req);

      return new Response(JSON.stringify({
        success: true,
        invitationId: invitation.id,
        message: 'Secure driver invitation sent successfully',
        emailId: emailResponse.id,
        expiresAt: invitation.expires_at,
        securityFeatures: [
          'XSS/SQL injection protection',
          'Rate limiting enabled',
          'Audit logging active',
          'Secure token generation',
          'Permission validation'
        ]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (emailError) {
      console.error('Email delivery failed:', emailError);
      
      // Clean up invitation on email failure
      await supabase
        .from('driver_invitations')
        .delete()
        .eq('id', invitation.id);

      await logAuditEvent(supabase, invitation.id, 'EMAIL_DELIVERY_FAILED', user.id, {
        email_error: emailError.message,
        recipient: sanitizedData.email
      }, req);

      return new Response(JSON.stringify({
        error: 'Email delivery failed',
        message: 'Failed to send invitation email. The invitation has been cancelled.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('=== UNEXPECTED ERROR ===', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});