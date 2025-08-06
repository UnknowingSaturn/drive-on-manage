import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== Edge Function Started ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing POST request');
    
    // Get request body
    const body = await req.text();
    console.log('Raw body:', body);
    
    let requestData;
    try {
      requestData = JSON.parse(body);
      console.log('Parsed request data:', requestData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    console.log('Environment check:');
    console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'MISSING');
    console.log('RESEND_API_KEY:', resendApiKey ? 'SET' : 'MISSING');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is missing');
    }
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing');
    }
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is missing');
    }

    // Basic validation
    const { email, firstName, lastName, companyId } = requestData;
    if (!email || !firstName || !lastName || !companyId) {
      throw new Error('Missing required fields: email, firstName, lastName, companyId');
    }

    console.log('Validation passed - all required fields present');

    // For now, just return success without actually creating the user
    console.log('=== Test successful - returning mock success ===');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Edge function is working - user creation disabled for testing',
      receivedData: requestData,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('=== Error in edge function ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error:', error);

    return new Response(JSON.stringify({
      error: error?.message || 'Unknown error occurred',
      type: typeof error,
      timestamp: new Date().toISOString(),
      details: 'Check edge function logs for more information'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});