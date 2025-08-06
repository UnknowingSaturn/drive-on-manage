import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteDriverRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  hourlyRate: string;
  companyId: string;
}

serve(async (req) => {
  console.log('=== Edge Function Started ===');
  console.log('Method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing POST request');
    
    // Parse request body
    const { email, firstName, lastName, phone, hourlyRate, companyId }: InviteDriverRequest = await req.json();
    
    console.log('Request data received:', {
      email,
      firstName,
      lastName,
      phone,
      hourlyRate,
      companyId
    });

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    console.log('Environment check:');
    console.log('SUPABASE_URL:', supabaseUrl ? `SET (${supabaseUrl})` : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'MISSING');
    console.log('RESEND_API_KEY:', resendApiKey ? 'SET' : 'MISSING');

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase admin client
    console.log('Initializing Supabase admin client...');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('Supabase admin client initialized successfully');

    // Initialize Resend
    console.log('Initializing Resend...');
    const resend = new Resend(resendApiKey);
    console.log('Resend initialized successfully');

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    console.log('Generated temporary password');

    // Create user with admin privileges
    console.log('Creating user with admin client...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        user_type: 'driver'
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    console.log('User created successfully:', authData.user.id);

    // Create driver profile
    console.log('Creating driver profile...');
    const { error: profileError } = await supabaseAdmin
      .from('driver_profiles')
      .insert({
        user_id: authData.user.id,
        company_id: companyId,
        hourly_rate: parseFloat(hourlyRate) || null,
        status: 'pending'
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      throw new Error(`Failed to create driver profile: ${profileError.message}`);
    }

    console.log('Driver profile created successfully');

    // Send invitation email
    console.log('Sending invitation email...');
    const emailResponse = await resend.emails.send({
      from: "Driver Portal <onboarding@resend.dev>", // Using Resend's default domain temporarily
      to: [email],
      subject: "Welcome to the Driver Portal - Account Created",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to the Driver Portal!</h2>
          <p>Hi ${firstName},</p>
          <p>Your driver account has been created successfully. Here are your login credentials:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background-color: #e0e0e0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          
          <p>Please log in and complete your profile setup:</p>
          <ul>
            <li>Upload your driving license</li>
            <li>Upload right to work documents</li>
            <li>Upload insurance documents</li>
            <li>Change your password</li>
          </ul>
          
          <div style="margin: 30px 0;">
            <a href="https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com/auth" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Login to Your Account
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you have any questions, please contact your administrator.
          </p>
        </div>
      `,
    });

    console.log('Invitation email sent:', emailResponse);

    console.log('=== Driver invitation completed successfully ===');
    
    return new Response(JSON.stringify({
      success: true,
      userId: authData.user.id,
      message: 'Driver invited successfully',
      emailResponse: emailResponse
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('=== Error in invite-driver function ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);

    return new Response(JSON.stringify({
      error: error.message || 'Failed to invite driver',
      details: error.hint || error.details || 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});