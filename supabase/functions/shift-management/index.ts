import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShiftData {
  action: 'start' | 'pause' | 'resume' | 'end';
  driver_id: string;
  consent_given?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the session user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (req.method === 'POST') {
      const shiftData: ShiftData = await req.json()
      
      // Verify driver belongs to user
      const { data: driverProfile, error: driverError } = await supabaseClient
        .from('driver_profiles')
        .select('id, company_id')
        .eq('id', shiftData.driver_id)
        .eq('user_id', user.id)
        .single()
      
      if (driverError || !driverProfile) {
        return new Response(
          JSON.stringify({ error: 'Driver profile not found or unauthorized' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      let result;

      switch (shiftData.action) {
        case 'start':
          // End any existing active shifts for this driver
          await supabaseClient
            .from('driver_shifts')
            .update({ 
              status: 'ended',
              end_time: new Date().toISOString()
            })
            .eq('driver_id', shiftData.driver_id)
            .eq('status', 'active')

          // Create new shift
          const { data: newShift, error: createError } = await supabaseClient
            .from('driver_shifts')
            .insert({
              driver_id: shiftData.driver_id,
              company_id: driverProfile.company_id,
              status: 'active',
              consent_given: shiftData.consent_given || false,
              start_time: new Date().toISOString()
            })
            .select()
            .single()

          if (createError) throw createError
          result = newShift
          break

        case 'pause':
          const { data: pausedShift, error: pauseError } = await supabaseClient
            .from('driver_shifts')
            .update({ status: 'paused' })
            .eq('driver_id', shiftData.driver_id)
            .eq('status', 'active')
            .select()
            .single()

          if (pauseError) throw pauseError
          result = pausedShift
          break

        case 'resume':
          const { data: resumedShift, error: resumeError } = await supabaseClient
            .from('driver_shifts')
            .update({ status: 'active' })
            .eq('driver_id', shiftData.driver_id)
            .eq('status', 'paused')
            .select()
            .single()

          if (resumeError) throw resumeError
          result = resumedShift
          break

        case 'end':
          const { data: endedShift, error: endError } = await supabaseClient
            .from('driver_shifts')
            .update({ 
              status: 'ended',
              end_time: new Date().toISOString()
            })
            .eq('driver_id', shiftData.driver_id)
            .in('status', ['active', 'paused'])
            .select()
            .single()

          if (endError) throw endError
          result = endedShift
          break

        default:
          throw new Error('Invalid action')
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          shift: result,
          message: `Shift ${shiftData.action} successful`
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Shift management error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})