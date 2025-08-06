import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== Edge Function Started ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing request...');
    
    // Test environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    console.log('Environment check:');
    console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SERVICE_ROLE_KEY:', serviceKey ? 'SET' : 'MISSING');
    console.log('RESEND_API_KEY:', resendKey ? 'SET' : 'MISSING');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is missing');
    }
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing');
    }
    if (!resendKey) {
      throw new Error('RESEND_API_KEY environment variable is missing');
    }

    // Parse request body
    const body = await req.json();
    console.log('Request body:', body);

    // Test Supabase client creation
    console.log('Testing Supabase client...');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    console.log('Supabase client created successfully');

    // Test a simple query to verify connection
    const { data, error } = await supabase.from('companies').select('id').limit(1);
    if (error) {
      throw new Error(`Supabase connection test failed: ${error.message}`);
    }
    console.log('Supabase connection test passed');

    // Test Resend import
    console.log('Testing Resend import...');
    const { Resend } = await import('npm:resend@2.0.0');
    const resend = new Resend(resendKey);
    console.log('Resend client created successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'All tests passed!',
      environmentVariables: {
        supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
        serviceKey: serviceKey ? 'SET' : 'MISSING',
        resendKey: resendKey ? 'SET' : 'MISSING'
      },
      receivedBody: body,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error:', error);

    return new Response(JSON.stringify({
      error: error?.message || 'Unknown error',
      type: typeof error,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});