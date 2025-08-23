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

    // Create user invite with metadata
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${appUrl}/auth/callback?next=/onboarding`,
        data: {
          first_name: firstName || '',
          last_name: lastName || '',
          user_type: role,
          role: role,
          company_ids: [companyId]
        }
      }
    );

    if (authError) {
      console.error('Auth invite error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to invite user: ${authError.message}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('User invited successfully:', authData.user?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user?.id,
        message: `Invitation sent to ${email}` 
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