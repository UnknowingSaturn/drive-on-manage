import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { email, firstName, lastName, phone, hourlyRate, companyId }: InviteDriverRequest = await req.json();
    console.log('Processing driver invitation for:', email);

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

    // Check if user already exists
    console.log('Checking if user exists...');
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser.users.find(user => user.email === email);

    let userId: string;
    let tempPassword: string;

    if (userExists) {
      console.log('User already exists:', userExists.id);
      userId = userExists.id;
      tempPassword = 'existing-user'; // Won't be used in email
      
      // Check if driver profile already exists
      const { data: existingProfile } = await supabase
        .from('driver_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingProfile) {
        throw new Error('Driver profile already exists for this email');
      }
    } else {
      // Generate temporary password
      tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      // Create user
      console.log('Creating new user account...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
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

      console.log('User created:', authData.user.id);
      userId = authData.user.id;
    }

    // Create driver profile
    console.log('Creating driver profile...');
    const { error: profileError } = await supabase
      .from('driver_profiles')
      .insert({
        user_id: userId,
        company_id: companyId,
        hourly_rate: parseFloat(hourlyRate) || null,
        status: 'pending'
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      throw new Error(`Failed to create driver profile: ${profileError.message}`);
    }

    console.log('Driver profile created successfully');

    // Send invitation email only for new users
    if (!userExists) {
      console.log('Sending invitation email...');
      const emailResponse = await resend.emails.send({
        from: "Driver Portal <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to the Driver Portal - Account Created",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">Welcome to the Driver Portal!</h2>
            
            <p>Hi ${firstName},</p>
            
            <p>Your driver account has been created successfully. Here are your login credentials:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
              <h3 style="margin-top: 0; color: #007bff;">Login Credentials</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Click the login button below</li>
              <li>Use the credentials above to sign in</li>
              <li>Complete your profile setup</li>
              <li>Upload required documents (license, insurance, etc.)</li>
              <li>Change your password to something memorable</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://5ece6ac1-a29e-48e5-8b0e-6b9cb11d1253.lovableproject.com/auth" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Login to Your Account
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <p style="color: #6c757d; font-size: 14px; text-align: center;">
              If you have any questions, please contact your administrator.<br>
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        `,
      });

      console.log('Email sent successfully:', emailResponse.id);

      return new Response(JSON.stringify({
        success: true,
        userId: userId,
        message: 'Driver invited successfully',
        emailId: emailResponse.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log('Driver profile created for existing user');

      return new Response(JSON.stringify({
        success: true,
        userId: userId,
        message: 'Driver profile created for existing user',
        emailId: null
      }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error:', error?.message);
    console.error('Stack:', error?.stack);

    return new Response(JSON.stringify({
      error: error?.message || 'Failed to invite driver',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});