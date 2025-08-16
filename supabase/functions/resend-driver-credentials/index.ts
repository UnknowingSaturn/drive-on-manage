import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendCredentialsRequest {
  email: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !serviceKey || !resendKey) {
      return new Response(JSON.stringify({
        error: 'Configuration error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email }: ResendCredentialsRequest = await req.json();
    
    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendKey);

    console.log('Looking up driver with email:', email);
    
    // First get the driver profile by email
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .eq('user_type', 'driver')
      .single();

    if (profileError || !profileData) {
      console.error('Driver profile not found:', profileError);
      return new Response(JSON.stringify({
        error: 'Driver not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get driver details with company info
    const { data: driverData, error: driverError } = await supabase
      .from('driver_profiles')
      .select(`
        user_id,
        company_id,
        companies!inner(name)
      `)
      .eq('user_id', profileData.user_id)
      .single();

    if (driverError || !driverData) {
      console.error('Driver profile details not found:', driverError);
      return new Response(JSON.stringify({
        error: 'Driver profile not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get profile details
    const { data: userProfile, error: userProfileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', profileData.user_id)
      .single();

    if (userProfileError || !userProfile) {
      console.error('User profile not found:', userProfileError);
      return new Response(JSON.stringify({
        error: 'User profile not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Generate new password in original format
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    console.log('Generated new temp password for:', email);

    // Update password in auth.users
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      driverData.user_id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return new Response(JSON.stringify({
        error: 'Failed to update password'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Password updated successfully');

    // Generate login URL
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com';
    const loginUrl = `${origin}/auth`;

    // Send credentials email
    const emailResponse = await resend.emails.send({
      from: "Driver Portal <noreply@unflawed.uk>",
      to: [email],
      subject: `🔄 Updated Login Credentials for ${driverData.companies.name}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔄 Credentials Updated!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your login password has been reset</p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hi <strong>${userProfile.first_name}</strong>,</p>
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
              Your login credentials have been updated. You can now log in using the new password below.
            </p>
            
            <div style="background: #f7fafc; border-left: 4px solid #4299e1; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
              <h3 style="margin: 0 0 15px 0; color: #2d3748;">🔑 Your Updated Login Credentials</h3>
              <div style="background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="margin: 0 0 10px 0; color: #4a5568;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 0; color: #4a5568;"><strong>New Password:</strong> <code style="background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background: linear-gradient(90deg, #4299e1, #3182ce); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);">
                🚀 Login Now
              </a>
            </div>
            
            <div style="background-color: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #276749; font-size: 14px;">
                📞 <strong>Need Help?</strong> If you continue to have login issues, please contact your administrator.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 14px; margin: 0;">
                This email was sent from the ${driverData.companies.name} Driver Portal.<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(JSON.stringify({
      success: true,
      emailId: emailResponse.data?.id,
      newPassword: tempPassword
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error resending credentials:', error);
    return new Response(JSON.stringify({
      error: 'Failed to resend credentials',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});