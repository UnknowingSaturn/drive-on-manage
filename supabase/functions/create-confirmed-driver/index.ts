import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    console.log('Request payload received:', JSON.stringify(requestBody, null, 2))
    
    const { email, password, userData } = requestBody

    if (!email || !password) {
      console.error('Missing required fields: email or password')
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: email and password are required',
          success: false 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log('Creating admin client...')
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('Attempting to create user with email:', email)
    
    // Check if user already exists first
    const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.getUserByEmail(email)
    
    if (existingUser && existingUser.user) {
      console.log('User already exists:', existingUser.user.id)
      
      // If user exists but is not confirmed, confirm them
      if (!existingUser.user.email_confirmed_at) {
        console.log('User exists but not confirmed, confirming...')
        const { data: confirmedUser, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.user.id,
          { email_confirm: true }
        )
        
        if (confirmError) {
          console.error('Error confirming existing user:', confirmError)
          throw confirmError
        }
        
        return new Response(
          JSON.stringify({ 
            user: confirmedUser.user, 
            success: true, 
            message: 'User confirmed successfully' 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
      
      // User exists and is confirmed
      return new Response(
        JSON.stringify({ 
          error: 'A user with this email address has already been registered',
          success: false,
          code: 'email_exists'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409, // Conflict status for existing resource
        }
      )
    }

    // Create new user with email already confirmed
    console.log('Creating new user...')
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // This bypasses email confirmation
      user_metadata: userData || {}
    })

    if (signUpError) {
      console.error('User creation error:', signUpError)
      throw signUpError
    }

    console.log('User created successfully:', user?.user?.id)

    return new Response(
      JSON.stringify({ 
        user: user.user, 
        success: true,
        message: 'User created successfully without email confirmation required'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in create-confirmed-driver:', error)
    
    let statusCode = 400
    let errorMessage = error.message || 'Unknown error occurred'
    let errorCode = 'unknown_error'
    
    // Handle specific error types
    if (error.message?.includes('already been registered')) {
      statusCode = 409
      errorCode = 'email_exists'
      errorMessage = 'A user with this email address has already been registered'
    } else if (error.message?.includes('invalid') || error.message?.includes('validation')) {
      statusCode = 400
      errorCode = 'validation_error'
    } else if (error.message?.includes('rate limit')) {
      statusCode = 429
      errorCode = 'rate_limit'
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      },
    )
  }
})