import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnhancedInviteRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  hourlyRate: string;
  companyId: string;
}

serve(async (req) => {
  console.log('=== Enhanced Driver Invite Function Started ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { email, firstName, lastName, phone, hourlyRate, companyId }: EnhancedInviteRequest = await req.json();
    console.log('Processing enhanced driver invitation for:', email);

    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceKey || !resendKey) {
      throw new Error('Missing required environment variables');
    }

    // Import and initialize clients
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    const { Resend } = await import('npm:resend@2.0.0');
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const resend = new Resend(resendKey);

    console.log('Clients initialized successfully');

    // Check for existing invitation
    const { data: existingInvite } = await supabase
      .from('driver_invitations')
      .select('id, status')
      .eq('email', email)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      throw new Error('An active invitation already exists for this email');
    }

    // Generate secure invite token directly
    const inviteToken = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);

    // Create driver invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('driver_invitations')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        company_id: companyId,
        invite_token: inviteToken,
        created_by: 'system' // This would be the admin's user ID in a real scenario
      })
      .select()
      .single();

    if (inviteError) {
      throw new Error(`Failed to create invitation: ${inviteError.message}`);
    }

    console.log('Invitation created:', invitation.id);

    // Generate secure onboarding link
    const onboardingUrl = `https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com/onboarding?token=${inviteToken}`;

    // Send invitation email
    console.log('Sending enhanced invitation email...');
    const emailResponse = await resend.emails.send({
      from: "Driver Portal <onboarding@resend.dev>",
      to: [email],
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
      emailId: emailResponse.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error:', error?.message);
    console.error('Stack:', error?.stack);

    return new Response(JSON.stringify({
      error: error?.message || 'Failed to send driver invitation',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});