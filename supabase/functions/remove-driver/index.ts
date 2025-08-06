import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RemoveDriverRequest {
  driverId: string;
  cleanupUser?: boolean; // Whether to delete the user account completely
}

serve(async (req) => {
  console.log('=== Remove Driver Function Started ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { driverId, cleanupUser = false }: RemoveDriverRequest = await req.json();
    console.log('Removing driver:', driverId, 'Cleanup user:', cleanupUser);

    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing required environment variables');
    }

    // Import and initialize client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Supabase client initialized');

    // Get driver profile details
    const { data: driverProfile, error: fetchError } = await supabase
      .from('driver_profiles')
      .select('user_id, status, company_id')
      .eq('id', driverId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch driver profile: ${fetchError.message}`);
    }

    console.log('Driver profile found:', driverProfile);

    const userId = driverProfile.user_id;
    const isPending = driverProfile.status === 'pending';

    // Check if driver has any active logs
    const { data: activeLogs } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('driver_id', driverId)
      .eq('status', 'in_progress')
      .limit(1);

    if (activeLogs && activeLogs.length > 0) {
      throw new Error('Cannot remove driver with active daily logs. Please complete or cancel their current shift first.');
    }

    // Check if user has other roles in the system
    const { data: otherProfiles, error: profileCheckError } = await supabase
      .from('profiles')
      .select('user_type, company_id')
      .eq('user_id', userId);

    if (profileCheckError) {
      console.error('Error checking other profiles:', profileCheckError);
    }

    const hasOtherRoles = otherProfiles && otherProfiles.some(p => 
      p.user_type === 'admin' || p.company_id !== driverProfile.company_id
    );

    console.log('User has other roles:', hasOtherRoles);

    // Delete driver profile first
    const { error: profileError } = await supabase
      .from('driver_profiles')
      .delete()
      .eq('id', driverId);

    if (profileError) {
      throw new Error(`Failed to delete driver profile: ${profileError.message}`);
    }

    console.log('Driver profile deleted successfully');

    // For pending drivers or if explicitly requested, and user has no other roles
    if ((isPending || cleanupUser) && !hasOtherRoles) {
      console.log('Cleaning up user account and profile...');

      // Delete user profile
      const { error: deleteProfileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (deleteProfileError) {
        console.error('Error deleting profile:', deleteProfileError);
        // Don't throw error - driver profile is already deleted
      } else {
        console.log('Profile deleted successfully');
      }

      // Delete user account (only for pending drivers or explicit cleanup)
      if (isPending || cleanupUser) {
        try {
          const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
          if (deleteUserError) {
            console.error('Error deleting user account:', deleteUserError);
            // Don't throw error - driver profile is already deleted
          } else {
            console.log('User account deleted successfully');
          }
        } catch (authError) {
          console.error('Auth deletion error:', authError);
          // Don't throw error - driver profile is already deleted
        }
      }
    } else {
      console.log('Keeping user account - has other roles or not pending');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Driver removed successfully',
      cleanedUp: (isPending || cleanupUser) && !hasOtherRoles,
      driverId: driverId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error:', error?.message);
    console.error('Stack:', error?.stack);

    return new Response(JSON.stringify({
      error: error?.message || 'Failed to remove driver',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});