import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('Test driver creation function called');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasResendKey: !!resendKey
    });

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({
        error: 'Missing required environment variables',
        details: {
          hasSupabaseUrl: !!supabaseUrl,
          hasServiceKey: !!serviceKey,
          hasResendKey: !!resendKey
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Test database connection
    const { data: testData, error: testError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1);

    if (testError) {
      console.error('Database connection test failed:', testError);
      return new Response(JSON.stringify({
        error: 'Database connection failed',
        details: testError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test comprehensive-create-driver function
    const testDriverData = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'Driver',
      phone: '1234567890',
      companyId: testData?.[0]?.id || 'test-company-id',
      parcelRate: 0.75,
      coverRate: 1.0
    };

    console.log('Testing comprehensive-create-driver with:', testDriverData);
    
    const { data: createResult, error: createError } = await supabase.functions.invoke('comprehensive-create-driver', {
      body: testDriverData
    });

    console.log('Comprehensive create driver test result:', { createResult, createError });

    return new Response(JSON.stringify({
      success: true,
      environment: {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
        hasResendKey: !!resendKey
      },
      databaseConnection: {
        success: !testError,
        testData: testData
      },
      functionTest: {
        createResult,
        createError: createError?.message || null
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Test function error:', error);
    return new Response(JSON.stringify({
      error: 'Test function failed',
      message: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});