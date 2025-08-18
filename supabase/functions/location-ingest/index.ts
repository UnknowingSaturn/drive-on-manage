import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LocationPoint {
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  activity_type?: string;
  shift_id?: string;
  is_offline_sync?: boolean;
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
      const locationData: LocationPoint | LocationPoint[] = await req.json()
      
      // Handle single point or batch of points
      const points = Array.isArray(locationData) ? locationData : [locationData]
      
      // Validate and process each point
      const processedPoints = []
      
      for (const point of points) {
        // Basic validation
        if (!point.driver_id || !point.latitude || !point.longitude) {
          continue // Skip invalid points
        }
        
        // Verify driver belongs to user
        const { data: driverProfile } = await supabaseClient
          .from('driver_profiles')
          .select('id, company_id')
          .eq('id', point.driver_id)
          .eq('user_id', user.id)
          .single()
        
        if (!driverProfile) {
          continue // Skip unauthorized driver
        }
        
        // Check for active shift
        const { data: activeShift } = await supabaseClient
          .from('driver_shifts')
          .select('id')
          .eq('driver_id', point.driver_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        // Prepare location point data
        const locationPoint = {
          driver_id: point.driver_id,
          company_id: driverProfile.company_id,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy || null,
          speed: point.speed || null,
          heading: point.heading || null,
          battery_level: point.battery_level || null,
          activity_type: point.activity_type || 'automotive',
          shift_id: activeShift?.id || null,
          is_offline_sync: point.is_offline_sync || false,
          timestamp: new Date().toISOString()
        }
        
        processedPoints.push(locationPoint)
      }
      
      if (processedPoints.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid location points to process' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      // Insert location points
      const { data, error } = await supabaseClient
        .from('location_points')
        .insert(processedPoints)
        .select()
      
      if (error) {
        console.error('Database error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to save location data' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          points_saved: data.length,
          message: `Successfully saved ${data.length} location points` 
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
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})