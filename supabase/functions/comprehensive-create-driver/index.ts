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
  companyId: string;
  parcelRate?: number;
  coverRate?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting comprehensive driver creation process...');
    
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

    console.log('Supabase admin client created');

    const { 
      email, 
      firstName, 
      lastName, 
      phone, 
      companyId, 
      parcelRate = 0.75, 
      coverRate = 1.0 
    }: CreateDriverRequest = await req.json();
    
    console.log('Request data:', { email, firstName, lastName, phone, companyId, parcelRate, coverRate });

    // Check for existing setup more comprehensively
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      // Check if this user already has a driver profile for this company
      const { data: existingDriver } = await supabaseAdmin
        .from('driver_profiles')
        .select('id')
        .eq('user_id', existingProfile.user_id)
        .eq('company_id', companyId)
        .maybeSingle();
        
      if (existingDriver) {
        throw new Error('A driver with this email already exists in this company');
      } else {
        throw new Error('A user with this email already exists');
      }
    }

    // Generate password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    console.log('Generated temp password');

    // Step 1: Create user with metadata (don't auto-confirm to avoid password issues)
    console.log('Creating user with metadata...');
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        user_type: 'driver'
      },
      email_confirm: false // Don't auto-confirm to avoid password being reset
    });

    // Manually confirm the email and ensure password is properly set
    if (userData.user) {
      // Update user to confirm email and ensure proper password
      await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
        email_confirm: true,
        password: tempPassword // Set password again to ensure it's correct
      });
      
      console.log('User email confirmed and password set');
    }

    if (createError || !userData.user) {
      console.error('User creation failed:', createError);
      throw new Error(createError?.message || 'Failed to create user');
    }

    const userId = userData.user.id;
    console.log('User created successfully, user ID:', userId);

    // Step 2: Wait for profile to be created by trigger, or create manually
    console.log('Ensuring profile exists...');
    let profileCreated = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!profileCreated && attempts < maxAttempts) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (profile) {
        profileCreated = true;
        console.log('Profile found:', profile);
      } else {
        attempts++;
        console.log(`Profile not found, attempt ${attempts}/${maxAttempts}`);
        
        if (attempts === maxAttempts) {
          // Create profile manually
          console.log('Creating profile manually...');
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              user_id: userId,
              email: email,
              first_name: firstName,
              last_name: lastName,
              phone: phone || null,
              user_type: 'driver',
              is_active: true
            });
            
          if (profileError && profileError.code !== '23505') {
            console.error('Manual profile creation failed:', profileError);
            throw new Error(`Failed to create user profile: ${profileError.message}`);
          }
          profileCreated = true;
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Step 3: Create user-company association FIRST (using admin privileges)
    console.log('Creating user-company association...');
    const { error: userCompanyError } = await supabaseAdmin
      .from('user_companies')
      .insert({
        user_id: userId,
        company_id: companyId,
        role: 'member'
      });

    if (userCompanyError) {
      console.error('User-company association failed:', userCompanyError);
      throw new Error(`Failed to associate user with company: ${userCompanyError.message}`);
    }

    console.log('User-company association created successfully');

    // Step 4: Create driver profile (now the user has company association)
    console.log('Creating driver profile...');
    const { data: driverProfile, error: driverProfileError } = await supabaseAdmin
      .from('driver_profiles')
      .insert({
        user_id: userId,
        company_id: companyId,
        parcel_rate: parcelRate,
        cover_rate: coverRate,
        status: 'pending_onboarding',
        requires_onboarding: true,
        first_login_completed: false
      })
      .select()
      .single();

    if (driverProfileError) {
      console.error('Driver profile creation failed:', driverProfileError);
      throw new Error(`Failed to create driver profile: ${driverProfileError.message}`);
    }

    console.log('Driver profile created successfully:', driverProfile);

    // Send credentials email
    try {
      console.log('Sending credentials email...');
      const emailResponse = await supabaseAdmin.functions.invoke('send-driver-credentials', {
        body: {
          email: email,
          firstName: firstName,
          lastName: lastName,
          tempPassword: tempPassword,
          companyId: companyId
        }
      });
      console.log('Email response:', emailResponse);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the whole operation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        tempPassword: tempPassword,
        driverProfileId: driverProfile.id
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);