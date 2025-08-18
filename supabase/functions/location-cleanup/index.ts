import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'POST') {
      console.log('Starting location data cleanup...')
      
      // Clean up location points older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: deletedPoints, error: deleteError } = await supabaseClient
        .from('location_points')
        .delete()
        .lt('timestamp', thirtyDaysAgo)
        .select('id')
      
      if (deleteError) {
        console.error('Failed to delete old location points:', deleteError)
        throw deleteError
      }
      
      // Aggregate daily stats for the deleted data before removing
      const { error: aggregateError } = await supabaseClient.rpc('cleanup_old_location_data')
      
      if (aggregateError) {
        console.error('Failed to aggregate location data:', aggregateError)
        // Don't throw here as the main cleanup was successful
      }
      
      // Clean up old access logs (older than 1 year)
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      
      const { data: deletedLogs, error: logsError } = await supabaseClient
        .from('location_access_logs')
        .delete()
        .lt('timestamp', oneYearAgo)
        .select('id')
      
      if (logsError) {
        console.error('Failed to delete old access logs:', logsError)
        // Don't throw here as location cleanup was successful
      }
      
      const result = {
        success: true,
        deleted_location_points: deletedPoints?.length || 0,
        deleted_access_logs: deletedLogs?.length || 0,
        cleanup_date: thirtyDaysAgo,
        message: `Cleanup completed: ${deletedPoints?.length || 0} location points and ${deletedLogs?.length || 0} access logs deleted`
      }
      
      console.log('Cleanup completed:', result)
      
      return new Response(
        JSON.stringify(result),
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
    console.error('Cleanup function error:', error)
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