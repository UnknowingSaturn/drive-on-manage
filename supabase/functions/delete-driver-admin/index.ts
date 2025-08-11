import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteDriverRequest {
  driverId: string;
  cleanupUser?: boolean;
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

    const { driverId, cleanupUser = true }: DeleteDriverRequest = await req.json();

    console.log('Deleting driver with admin API:', { driverId, cleanupUser });

    const { data: driverProfile, error: fetchError } = await supabaseAdmin
      .from('driver_profiles')
      .select('user_id, status, company_id')
      .eq('id', driverId)
      .single();

    if (fetchError) {
      console.error('Error fetching driver profile:', fetchError);
      throw new Error(`Failed to fetch driver profile: ${fetchError.message}`);
    }

    const userId = driverProfile.user_id;
    const isPending = driverProfile.status === 'pending_onboarding';

    // Check if driver has any active logs
    const { data: activeLogs } = await supabaseAdmin
      .from('daily_logs')
      .select('id')
      .eq('driver_id', driverId)
      .eq('status', 'in_progress')
      .limit(1);

    if (activeLogs && activeLogs.length > 0) {
      throw new Error('Cannot remove driver with active daily logs. Please complete or cancel their current shift first.');
    }

    // Check if user has other roles in the system
    const { data: otherProfiles, error: profileCheckError } = await supabaseAdmin
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
    const { error: profileError } = await supabaseAdmin
      .from('driver_profiles')
      .delete()
      .eq('id', driverId);

    if (profileError) {
      throw new Error(`Failed to delete driver profile: ${profileError.message}`);
    }

    console.log('Driver profile deleted successfully');

    // For pending drivers or if user has no other roles, clean up completely
    if (isPending || !hasOtherRoles) {
      // Delete user profile
      const { error: deleteProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (deleteProfileError) {
        console.error('Error deleting profile:', deleteProfileError);
        // Don't throw error - driver profile is already deleted
      } else {
        console.log('Profile deleted successfully');
      }

      // Delete user account (only for pending drivers or users with no other roles)
      if (isPending || !hasOtherRoles) {
        try {
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
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
      console.log('Keeping user account - has other roles');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Driver removed successfully',
        cleanedUp: isPending || !hasOtherRoles,
        driverId: driverId
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in delete-driver-admin function:', error);
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