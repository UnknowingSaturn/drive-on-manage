import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateDriverRequest {
  email: string;
  password: string;
  userData: {
    first_name: string;
    last_name: string;
    user_type: 'driver';
  };
  documentUrls?: {
    license: string;
    insurance: string;
    rightToWork: string;
    avatar: string;
  };
  driverData?: {
    driving_license_number?: string;
    license_expiry?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody: CreateDriverRequest = await req.json()
    console.log('Request payload received:', JSON.stringify(requestBody, null, 2))
    
    const { email, password, userData, documentUrls, driverData } = requestBody

    if (!email || !password || !userData) {
      console.error('Missing required fields')
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: email, password, and userData are required',
          success: false 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('Processing driver creation request for:', email);

    // Create Supabase admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get invitation details to extract company_id and rates
    const { data: invitation, error: invitationError } = await supabase
      .from('driver_invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (invitationError) {
      console.error('Error fetching invitation:', invitationError);
      throw new Error('Failed to fetch invitation details: ' + invitationError.message);
    }

    if (!invitation) {
      console.error('No valid invitation found for email:', email);
      throw new Error('No valid invitation found for this email address');
    }

    console.log('Found invitation:', invitation);

    // Extract rates (support both old hourly_rate and new parcel_rate)
    const parcelRate = invitation.parcel_rate || invitation.hourly_rate || 0;
    const coverRate = invitation.cover_rate || parcelRate;

    // Try to create user first, handle existing user case
    let userId: string;
    
    console.log('Creating new user account...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: userData,
      email_confirm: true // Bypass email confirmation
    });

    if (authError) {
      // If user already exists, try to find them and get their ID
      if (authError.message?.includes('already been registered') || authError.message?.includes('email_exists')) {
        console.log('User already exists, finding existing user...');
        
        // List all users and find by email (this is a workaround since getUserByEmail doesn't exist)
        const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
          console.error('Error listing users:', listError);
          throw new Error('Failed to find existing user: ' + listError.message);
        }
        
        const existingUser = usersList.users?.find(user => user.email === email);
        
        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }
        
        console.log('Found existing user:', existingUser.id);
        userId = existingUser.id;
        
        // If user exists but is not confirmed, confirm them
        if (!existingUser.email_confirmed_at) {
          console.log('User exists but not confirmed, confirming...');
          const { error: confirmError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { email_confirm: true }
          );
          
          if (confirmError) {
            console.error('Error confirming existing user:', confirmError);
            throw new Error('Failed to confirm existing user: ' + confirmError.message);
          }
        }
      } else {
        console.error('Error creating user:', authError);
        throw new Error('Failed to create user account: ' + authError.message);
      }
    } else {
      if (!authUser.user) {
        throw new Error('User creation failed - no user returned');
      }

      console.log('User created successfully:', authUser.user.id);
      userId = authUser.user.id;
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile entry
      const profileData = {
        user_id: userId,
        email: email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        user_type: 'driver' as const,
        company_id: invitation.company_id,
        is_active: true
      };

      console.log('Creating profile:', profileData);
      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        throw new Error('Failed to create user profile: ' + profileError.message);
      }
    } else {
      console.log('Profile already exists for user:', userId);
    }

    // Check if driver profile already exists
    const { data: existingDriverProfile } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let driverProfileId: string;

    if (!existingDriverProfile) {
      // Create driver profile entry with rates and document URLs
      const driverProfileData = {
        user_id: userId,
        company_id: invitation.company_id,
        parcel_rate: parcelRate,
        cover_rate: coverRate,
        status: 'active',
        onboarding_completed_at: new Date().toISOString(),
        onboarding_progress: {
          personal_info: true,
          account_setup: true,
          documents_uploaded: !!(documentUrls?.license && documentUrls?.insurance && documentUrls?.rightToWork),
          terms_accepted: true
        },
        // Add document URLs if provided
        ...(documentUrls?.license && { driving_license_document: documentUrls.license }),
        ...(documentUrls?.insurance && { insurance_document: documentUrls.insurance }),
        ...(documentUrls?.rightToWork && { right_to_work_document: documentUrls.rightToWork }),
        ...(documentUrls?.avatar && { avatar_url: documentUrls.avatar }),
        // Add driver data if provided
        ...(driverData?.driving_license_number && { driving_license_number: driverData.driving_license_number }),
        ...(driverData?.license_expiry && { license_expiry: driverData.license_expiry }),
      };

      console.log('Creating driver profile:', driverProfileData);
      const { data: driverProfile, error: driverError } = await supabase
        .from('driver_profiles')
        .insert(driverProfileData)
        .select()
        .single();

      if (driverError) {
        console.error('Error creating driver profile:', driverError);
        throw new Error('Failed to create driver profile: ' + driverError.message);
      }

      driverProfileId = driverProfile.id;
    } else {
      console.log('Driver profile already exists for user:', userId);
      driverProfileId = existingDriverProfile.id;
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('driver_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        driver_profile_id: driverProfileId
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      // Don't throw error here, user is already created
    }

    console.log('Driver onboarding completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Driver account created successfully',
        user: {
          id: userId,
          email: email,
          driver_profile_id: driverProfileId
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in create-confirmed-driver:', error);
    
    let statusCode = 400;
    let errorMessage = error.message || 'Unknown error occurred';
    let errorCode = 'unknown_error';
    
    // Handle specific error types
    if (error.message?.includes('already been registered')) {
      statusCode = 409;
      errorCode = 'email_exists';
      errorMessage = 'A user with this email address has already been registered';
    } else if (error.message?.includes('invalid') || error.message?.includes('validation')) {
      statusCode = 400;
      errorCode = 'validation_error';
    } else if (error.message?.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'rate_limit';
    } else if (error.message?.includes('No valid invitation')) {
      statusCode = 404;
      errorCode = 'invitation_not_found';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        code: errorCode,
        details: Deno.env.get('NODE_ENV') === 'development' ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      },
    );
  }
})