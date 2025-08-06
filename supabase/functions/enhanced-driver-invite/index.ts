import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnhancedInviteRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hourlyRate?: string;
  companyId: string;
}

// Input validation functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 50;
};

const validatePhone = (phone: string): boolean => {
  if (!phone) return true; // Optional field
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,15}$/;
  return phoneRegex.test(phone);
};

const validateHourlyRate = (rate: string): boolean => {
  if (!rate) return true; // Optional field
  const numRate = parseFloat(rate);
  return !isNaN(numRate) && numRate >= 0 && numRate <= 1000;
};

const validateUuid = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

serve(async (req) => {
  console.log('=== Enhanced Driver Invite Function Started ===');
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error('Invalid method:', req.method);
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse and validate request body
    let requestBody: EnhancedInviteRequest;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully');
    } catch (parseError) {
      console.error('Invalid JSON in request body:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid request body',
        message: 'Request body must be valid JSON'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, firstName, lastName, phone, hourlyRate, companyId } = requestBody;

    // Input validation
    console.log('Validating input data...');
    const validationErrors: string[] = [];

    if (!email || !validateEmail(email)) {
      validationErrors.push('Valid email address is required');
    }
    if (!firstName || !validateName(firstName)) {
      validationErrors.push('First name must be between 2-50 characters');
    }
    if (!lastName || !validateName(lastName)) {
      validationErrors.push('Last name must be between 2-50 characters');
    }
    if (phone && !validatePhone(phone)) {
      validationErrors.push('Phone number format is invalid');
    }
    if (hourlyRate && !validateHourlyRate(hourlyRate)) {
      validationErrors.push('Hourly rate must be a valid number between 0-1000');
    }
    if (!companyId || !validateUuid(companyId)) {
      validationErrors.push('Valid company ID is required');
    }

    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
      return new Response(JSON.stringify({
        error: 'Validation failed',
        message: 'Input validation errors',
        details: validationErrors
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing enhanced driver invitation for:', email);

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceKey || !resendKey) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({
        error: 'Configuration error',
        message: 'Server configuration is incomplete'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Import and initialize clients
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    const { Resend } = await import('npm:resend@2.0.0');
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const resend = new Resend(resendKey);

    console.log('Clients initialized successfully');

    // Check for existing active invitation
    console.log('Checking for existing invitations...');
    const { data: existingInvite, error: inviteCheckError } = await supabase
      .from('driver_invitations')
      .select('id, status, expires_at')
      .eq('email', email.toLowerCase().trim())
      .eq('company_id', companyId)
      .in('status', ['pending'])
      .maybeSingle();

    if (inviteCheckError) {
      console.error('Error checking existing invitations:', inviteCheckError);
      return new Response(JSON.stringify({
        error: 'Database error',
        message: 'Failed to check existing invitations'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingInvite) {
      // Check if invitation has expired
      const isExpired = new Date(existingInvite.expires_at) < new Date();
      
      if (!isExpired) {
        console.log('Active invitation already exists for this email');
        return new Response(JSON.stringify({
          error: 'Invitation already exists',
          message: `An active invitation for ${email} already exists. Please wait for it to be accepted or expire before sending a new one.`
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Update expired invitation to cancelled
        console.log('Updating expired invitation to cancelled');
        await supabase
          .from('driver_invitations')
          .update({ status: 'expired' })
          .eq('id', existingInvite.id);
      }
    }

    // Check for existing driver with same email
    console.log('Checking for existing driver profiles...');
    const { data: existingDrivers, error: driverCheckError } = await supabase
      .from('driver_profiles')
      .select('id, status, user_id')
      .eq('company_id', companyId);

    if (driverCheckError) {
      console.error('Error checking existing drivers:', driverCheckError);
      return new Response(JSON.stringify({
        error: 'Database error',
        message: 'Failed to check existing drivers'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if any existing driver has this email by querying profiles separately
    if (existingDrivers && existingDrivers.length > 0) {
      const userIds = existingDrivers.map(d => d.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: profilesWithEmail, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, email')
          .eq('email', email.toLowerCase().trim())
          .in('user_id', userIds);

        if (profilesError) {
          console.error('Error checking existing profiles:', profilesError);
          return new Response(JSON.stringify({
            error: 'Database error',
            message: 'Failed to check existing profiles'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (profilesWithEmail && profilesWithEmail.length > 0) {
          console.log('Driver with this email already exists');
          return new Response(JSON.stringify({
            error: 'Driver already exists',
            message: `A driver with email ${email} already exists in your company.`
          }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Generate secure invite token
    console.log('Generating secure invite token...');
    const inviteToken = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    
    // Create driver invitation record
    console.log('Creating driver invitation record...');
    const { data: invitation, error: inviteError } = await supabase
      .from('driver_invitations')
      .insert({
        email: email.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone?.trim() || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        company_id: companyId,
        invite_token: inviteToken,
        created_by: companyId, // Use company_id as a valid UUID
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Failed to create invitation:', inviteError);
      return new Response(JSON.stringify({
        error: 'Database error',
        message: 'Failed to create driver invitation',
        details: inviteError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Invitation created successfully:', invitation.id);

    // Generate secure onboarding link
    const onboardingUrl = `https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com/onboarding?token=${inviteToken}`;

    // Send invitation email
    console.log('Sending invitation email...');
    try {
      const emailResponse = await resend.emails.send({
        from: "Driver Portal <onboarding@resend.dev>",
        to: [email.toLowerCase().trim()],
        subject: "🚗 Welcome to the Driver Team - Complete Your Onboarding",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1a202c; margin: 0; font-size: 28px;">🚗 Welcome to the Team!</h1>
                <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #3b82f6, #10b981); margin: 15px auto; border-radius: 2px;"></div>
              </div>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hi <strong>${firstName}</strong>,</p>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                Congratulations! You've been invited to join our driver team. We're excited to have you on board and can't wait to get you started.
              </p>
              
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 10px; margin: 25px 0; color: white;">
                <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎯 Next Steps</h3>
                <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Click the secure link below to start your onboarding</li>
                  <li>Complete your profile and upload required documents</li>
                  <li>Set up your secure password</li>
                  <li>Access your personalized driver dashboard</li>
                </ol>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${onboardingUrl}" 
                   style="background: linear-gradient(90deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                  🚀 Start Onboarding
                </a>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-weight: 500;">
                  ⏰ <strong>Important:</strong> This invitation expires in 7 days. Please complete your onboarding before then.
                </p>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <h4 style="color: #2d3748; margin: 0 0 10px 0;">📋 What You'll Need:</h4>
                <ul style="color: #4a5568; margin: 0; line-height: 1.6;">
                  <li>Valid driving license</li>
                  <li>Insurance documents</li>
                  <li>Right to work documentation</li>
                  <li>Bank details for payments</li>
                </ul>
              </div>
              
              <div style="margin-top: 30px; padding: 20px; background-color: #f7fafc; border-radius: 8px; text-align: center;">
                <p style="color: #718096; font-size: 14px; margin: 0;">
                  If you have any questions, reply to this email or contact your administrator.<br>
                  <strong>This is a secure, one-time use link. Do not share it with others.</strong>
                </p>
              </div>
            </div>
          </div>
        `,
      });

      console.log('Email sent successfully:', emailResponse.id);

      return new Response(JSON.stringify({
        success: true,
        invitationId: invitation.id,
        inviteToken: inviteToken,
        onboardingUrl: onboardingUrl,
        message: 'Driver invitation sent successfully',
        emailId: emailResponse.id,
        expiresAt: invitation.expires_at
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      
      // Clean up the invitation record since email failed
      await supabase
        .from('driver_invitations')
        .delete()
        .eq('id', invitation.id);

      return new Response(JSON.stringify({
        error: 'Email delivery failed',
        message: 'Failed to send invitation email. Please check the email address and try again.',
        details: emailError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error:', error?.message);
    console.error('Stack:', error?.stack);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});