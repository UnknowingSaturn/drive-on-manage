import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userType: 'admin' | 'supervisor' | 'driver';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
    
    // Generate dynamic login URL from request origin
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://drive-on-manage.lovable.app';
    const loginUrl = `${origin}/auth`;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { userId, email, firstName, lastName, userType }: ResetPasswordRequest = await req.json();

    console.log('Resetting password for user:', { userId, email, userType });

    // Validate required fields
    if (!userId || !email || !userType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email, userType' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate new temporary password
    const newTempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    
    // Update user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newTempPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update password: ${updateError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Password updated successfully for user:', userId);

    // Send password reset email
    try {
      const { error: emailError } = await resend.emails.send({
        from: 'DriveOn Manager <onboarding@resend.dev>',
        to: [email],
        subject: `Password Reset - DriveOn Manager`,
        html: `
          <h2>Password Reset - DriveOn Manager</h2>
          <p>Hi ${firstName || 'there'},</p>
          <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Email:</strong> ${email}<br>
            <strong>New Temporary Password:</strong> ${newTempPassword}
          </div>
          <p>Please log in at: <a href="${loginUrl}">${loginUrl}</a></p>
          <p><strong>Important:</strong> Please change your password after logging in for security.</p>
          <p>Best regards,<br>The DriveOn Manager Team</p>
        `
      });

      if (emailError) {
        console.error('Failed to send password reset email:', emailError);
        throw emailError;
      } else {
        console.log('Password reset email sent successfully');
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Return success but mention email issue
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Password reset successfully but email delivery failed. Please contact the user directly.',
          tempPassword: newTempPassword
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Password reset successfully. New credentials sent to ${email}`,
        tempPassword: newTempPassword
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);