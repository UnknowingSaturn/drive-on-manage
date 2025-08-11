import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDriverRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  parcelRate?: number;
  coverRate?: number;
  companyId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const {
      email,
      firstName,
      lastName,
      phone,
      parcelRate,
      coverRate,
      companyId
    }: CreateDriverRequest = await req.json();

    console.log('Creating driver with admin API:', {
      email,
      firstName,
      lastName,
      phone,
      parcelRate,
      coverRate,
      companyId
    });

    // Check if user already exists in auth.users
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing users' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const existingUser = existingUsers.users.find(user => user.email === email);
    
    if (existingUser) {
      // Check if they have a profile in our system
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, company_id')
        .eq('user_id', existingUser.id)
        .single();
      
      if (existingProfile) {
        return new Response(
          JSON.stringify({ 
            error: `A user with email ${email} already exists and is registered with ${existingProfile.company_id === companyId ? 'your company' : 'another company'}.` 
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      } else {
        // Orphaned auth user - delete and recreate
        console.log('Found orphaned auth user, cleaning up...');
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      }
    }

    // Generate temporary password
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

    const tempPassword = generateTempPassword();

    // Create user with admin client
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        user_type: 'driver',
        role: 'driver',
        company_id: companyId
      },
      email_confirm: true // Auto-confirm email
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (!userData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log('User created successfully:', userData.user.id);

    // Wait a moment for the trigger to create the profile, then update it
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the profile created by the trigger with additional driver info
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone,
        company_id: companyId,
        is_active: true
      })
      .eq('user_id', userData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Cleanup: delete the user if profile update fails
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile with driver information' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log('Profile updated successfully');

    // Create driver profile with onboarding status
    const { error: driverProfileError } = await supabaseAdmin
      .from('driver_profiles')
      .insert({
        id: userData.user.id,
        user_id: userData.user.id,
        company_id: companyId,
        driving_license_number: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        parcel_rate: parseFloat(String(parcelRate)) || 0.75,
        cover_rate: parseFloat(String(coverRate)) || 1.0,
        status: 'pending_onboarding',
        requires_onboarding: true,
        first_login_completed: false
      });

    if (driverProfileError) {
      console.error('Error creating driver profile:', driverProfileError);
      // Cleanup: delete the user and profile if driver profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      await supabaseAdmin.from('profiles').delete().eq('user_id', userData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create driver profile' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log('Driver profile created successfully');

    // Send credentials email using the existing function
    try {
      const { error: emailError } = await supabaseAdmin.functions.invoke('send-driver-credentials', {
        body: {
          email,
          firstName,
          lastName,
          tempPassword
        }
      });

      if (emailError) {
        console.error('Error sending credentials email:', emailError);
        // Don't fail the whole operation if email fails, just log it
      }
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the whole operation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: userData.user.id,
        tempPassword // Return for admin reference
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in create-driver-admin function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
      status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);