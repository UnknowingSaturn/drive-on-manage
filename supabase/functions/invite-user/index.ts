import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  role: 'admin' | 'supervisor' | 'driver';
  companyId: string;
  firstName?: string;
  lastName?: string;
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
    const appUrl = Deno.env.get('APP_URL') || 'https://drive-on-manage.lovable.app';
    
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

    const { email, role, companyId, firstName, lastName }: InviteRequest = await req.json();

    console.log('Inviting user:', { email, role, companyId });

    // Validate required fields
    if (!email || !role || !companyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, role, companyId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate role
    if (!['admin', 'supervisor', 'driver'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin, supervisor, or driver' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    
    // Create user with password
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || '',
        last_name: lastName || '',
        user_type: role
      },
      app_metadata: {
        role: role,
        company_ids: [companyId]
      }
    });

    if (authError) {
      console.error('Auth create error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${authError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('User created successfully:', authData.user?.id);

    // Send credentials email (using Resend API)
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const emailBody = {
          from: 'DriveOn Manager <onboarding@resend.dev>',
          to: [email],
          subject: `Welcome to DriveOn Manager - Your ${role} Account`,
          html: `
            <h2>Welcome to DriveOn Manager!</h2>
            <p>Hi ${firstName},</p>
            <p>Your ${role} account has been created. Here are your login credentials:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Email:</strong> ${email}<br>
              <strong>Temporary Password:</strong> ${tempPassword}
            </div>
            <p>Please log in at: <a href="${appUrl}/auth">${appUrl}/auth</a></p>
            <p><strong>Important:</strong> Please change your password after your first login.</p>
            <p>Best regards,<br>The DriveOn Manager Team</p>
          `
        };

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailBody)
        });

        if (!emailResponse.ok) {
          console.error('Failed to send email:', await emailResponse.text());
        } else {
          console.log('Credentials email sent successfully');
        }
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the whole operation for email issues
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user?.id,
        tempPassword: tempPassword,
        message: `User created and credentials sent to ${email}` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Invite user error:', error);
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