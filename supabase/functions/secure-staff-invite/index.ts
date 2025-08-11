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
  parcelRate?: string;
  coverRate?: string;
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

const validateParcelRate = (rate: string): { valid: boolean; error?: string } => {
  if (!rate) return { valid: true }; // Optional field
  const numRate = parseFloat(rate);
  if (isNaN(numRate) || numRate < 0 || numRate > 50) {
    return { valid: false, error: 'Parcel rate must be between 0-50' };
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

// Generate secure temporary password
const generateTempPassword = (): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const all = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
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

    const { email, firstName, lastName, phone, parcelRate, coverRate, companyId } = requestBody;

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
    
    const parcelRateValidation = validateParcelRate(parcelRate || '');
    if (!parcelRateValidation.valid) validationErrors.push(parcelRateValidation.error!);
    
    const coverRateValidation = validateParcelRate(coverRate || '');
    if (!coverRateValidation.valid) validationErrors.push(coverRateValidation.error!);
    
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
      parcelRate: parcelRate ? parseFloat(parcelRate) : null,
      coverRate: coverRate ? parseFloat(coverRate) : null
    };

    // Check for existing driver with same email (skip invitations check)
    const { data: existingUser } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    
    const userWithEmail = existingUser.users?.find(u => u.email === sanitizedData.email);
    if (userWithEmail) {
      return new Response(JSON.stringify({
        error: 'User exists',
        message: 'A user with this email already exists'
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    
    // Create user account with temporary password
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: sanitizedData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        user_type: 'driver',
        onboarding_incomplete: true,
        requires_password_change: true
      }
    });

    if (createUserError) {
      console.error('Failed to create user:', createUserError);
      return new Response(JSON.stringify({
        error: 'User creation failed',
        message: 'Failed to create user account'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: newUser.user.id,
        email: sanitizedData.email,
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        phone: sanitizedData.phone,
        user_type: 'driver',
        company_id: companyId,
        is_active: true
      });

    if (profileError) {
      console.error('Failed to create profile:', profileError);
      // Clean up user if profile creation fails
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({
        error: 'Profile creation failed',
        message: 'Failed to create user profile'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create driver profile
    const { data: driverProfile, error: driverError } = await supabase
      .from('driver_profiles')
      .insert({
        user_id: newUser.user.id,
        company_id: companyId,
        parcel_rate: sanitizedData.parcelRate,
        cover_rate: sanitizedData.coverRate,
        status: 'pending',
        onboarding_progress: { step: 'created', completed_steps: [] }
      })
      .select()
      .single();

    if (driverError) {
      console.error('Failed to create driver profile:', driverError);
      // Clean up user and profile if driver profile creation fails
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({
        error: 'Driver profile creation failed',
        message: 'Failed to create driver profile'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get company info for email
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    // Generate login URL
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com';
    const loginUrl = `${origin}/auth`;

    // Send driver credentials email
    try {
      const emailResponse = await resend.emails.send({
        from: "Driver Portal <noreply@unflawed.uk>",
        to: [sanitizedData.email],
        subject: `🚗 Welcome to ${company?.name || 'our Driver Team'} - Your Login Credentials`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🚗 Welcome to the Team!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your Driver Account is Ready</p>
            </div>
            
            <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hi <strong>${sanitizedData.firstName}</strong>,</p>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                Welcome to ${company?.name || 'our driver team'}! Your account has been created and you can now log in using the credentials below.
              </p>
              
              <div style="background: #f7fafc; border-left: 4px solid #4299e1; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 15px 0; color: #2d3748;">🔑 Your Login Credentials</h3>
                <div style="background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 10px 0; color: #4a5568;"><strong>Email:</strong> ${sanitizedData.email}</p>
                  <p style="margin: 0; color: #4a5568;"><strong>Temporary Password:</strong> <code style="background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" 
                   style="background: linear-gradient(90deg, #4299e1, #3182ce); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);">
                  🚀 Login Now
                </a>
              </div>
              
              <div style="background-color: #fef5e7; border-left: 4px solid #ed8936; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #9c4221; font-weight: 500;">
                  ⚠️ <strong>Important:</strong> You must complete your onboarding profile before gaining full access to driver features. You'll be prompted to do this after your first login.
                </p>
              </div>
              
              <div style="background-color: #fed7d7; border-left: 4px solid #e53e3e; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #9b2c2c; font-weight: 500;">
                  🔒 <strong>Security Notice:</strong> Please change your password after logging in. Keep your login credentials secure and do not share them with others.
                </p>
              </div>
              
              <div style="margin-top: 30px; padding: 20px; background-color: #f7fafc; border-radius: 8px; text-align: center;">
                <p style="color: #718096; font-size: 14px; margin: 0;">
                  If you have questions or need help, contact your administrator.<br>
                  <strong>Welcome to ${company?.name || 'the team'}!</strong>
                </p>
              </div>
            </div>
          </div>
        `,
      });

      // Log successful driver creation
      await logAuditEvent(supabase, driverProfile.id, 'DRIVER_CREATED', user.id, {
        recipient_email: sanitizedData.email,
        recipient_name: `${sanitizedData.firstName} ${sanitizedData.lastName}`,
        email_id: emailResponse.id,
        user_id: newUser.user.id,
        driver_profile_id: driverProfile.id
      }, req);

      return new Response(JSON.stringify({
        success: true,
        message: 'Driver account created successfully',
        driverId: driverProfile.id,
        userId: newUser.user.id,
        emailSent: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (emailError: any) {
      console.error('Email sending failed:', emailError);
      
      // Note: Don't clean up user account if email fails, admin should be notified
      await logAuditEvent(supabase, driverProfile.id, 'EMAIL_SENDING_FAILED', user.id, {
        error: emailError.message,
        recipient_email: sanitizedData.email,
        user_id: newUser.user.id,
        note: 'User account created but email failed'
      }, req);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Driver account created but email delivery failed',
        driverId: driverProfile.id,
        userId: newUser.user.id,
        emailSent: false,
        warning: 'Please manually provide login credentials to the driver'
      }), {
        status: 200,
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