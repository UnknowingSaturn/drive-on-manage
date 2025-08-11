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
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting driver creation process...');
    
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

    const { email, firstName, lastName, phone, companyId }: CreateDriverRequest = await req.json();
    console.log('Request data:', { email, firstName, lastName, phone, companyId });

    // Simple password generation
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    console.log('Generated temp password');

    // Single operation: Create user with all metadata (removed company_id since we no longer have that column)
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
      email_confirm: true
    });

    console.log('User creation result:', { userData: !!userData, createError });

    if (createError || !userData.user) {
      console.error('User creation failed:', createError);
      throw new Error(createError?.message || 'Failed to create user');
    }

    console.log('User created successfully, user ID:', userData.user.id);

    return new Response(
      JSON.stringify({
        success: true,
        userId: userData.user.id,
        tempPassword
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