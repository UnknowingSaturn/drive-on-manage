import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  userId: string;
  companyId: string;
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

    const { userId, companyId }: DeleteUserRequest = await req.json();

    console.log('Deleting user:', { userId, companyId });

    // Validate required fields
    if (!userId || !companyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, companyId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // First, remove user from user_companies to break the association
    const { error: companyError } = await supabase
      .from('user_companies')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (companyError) {
      console.error('Error removing user from company:', companyError);
      return new Response(
        JSON.stringify({ error: `Failed to remove user from company: ${companyError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('User removed from company successfully');

    // Check if user has any other company associations
    const { data: otherCompanies, error: checkError } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', userId);

    if (checkError) {
      console.error('Error checking other companies:', checkError);
      return new Response(
        JSON.stringify({ error: `Failed to check user associations: ${checkError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If user has no other company associations, delete from auth.users
    // This will cascade delete from profiles due to foreign key constraint
    if (!otherCompanies || otherCompanies.length === 0) {
      console.log('User has no other company associations, deleting from auth.users');
      
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Error deleting user from auth:', authError);
        return new Response(
          JSON.stringify({ error: `Failed to delete user from auth: ${authError.message}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('User deleted from auth.users successfully');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User completely removed from system',
          deleted_from_auth: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // User has other company associations, just deactivate profile
      console.log('User has other company associations, deactivating profile only');
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Error deactivating profile:', profileError);
        return new Response(
          JSON.stringify({ error: `Failed to deactivate user profile: ${profileError.message}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User removed from company, profile deactivated',
          deleted_from_auth: false
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Delete user error:', error);
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