import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SODVisionResponse {
  total_deliveries?: number;
  total_collections?: number;
  standard?: number;
  hanging_garments?: number;
  packets?: number;
  small_packets?: number;
  heavy_parcels?: number;
  postables?: number;
  round_number?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { screenshotPath, reportId } = await req.json();
    
    if (!screenshotPath || !reportId) {
      return new Response(
        JSON.stringify({ error: 'Missing screenshotPath or reportId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google Vision API key
    const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!visionApiKey) {
      console.error('Google Vision API key not found');
      await updateReportStatus(supabaseClient, reportId, 'error', null);
      return new Response(
        JSON.stringify({ error: 'Vision API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the public URL for the image
    const { data: publicUrlData } = supabaseClient.storage
      .from('sod-screenshots')
      .getPublicUrl(screenshotPath);

    if (!publicUrlData?.publicUrl) {
      console.error('Failed to get public URL for image');
      await updateReportStatus(supabaseClient, reportId, 'error', null);
      return new Response(
        JSON.stringify({ error: 'Failed to get image URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the image
    console.log('Downloading SOD image from:', publicUrlData.publicUrl);
    const imageResponse = await fetch(publicUrlData.publicUrl);
    if (!imageResponse.ok) {
      console.error('Failed to download image:', imageResponse.status);
      await updateReportStatus(supabaseClient, reportId, 'error', null);
      return new Response(
        JSON.stringify({ error: 'Failed to download image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    // Call Google Vision API
    console.log('Calling Google Vision API for SOD text detection');
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      console.error('Vision API request failed:', visionResponse.status);
      await updateReportStatus(supabaseClient, reportId, 'error', null);
      return new Response(
        JSON.stringify({ error: 'Vision API request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const visionData = await visionResponse.json();
    console.log('Vision API response received for SOD');

    if (visionData.responses?.[0]?.error) {
      console.error('Vision API error:', visionData.responses[0].error);
      await updateReportStatus(supabaseClient, reportId, 'error', visionData);
      return new Response(
        JSON.stringify({ error: 'Vision API processing error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract text from Vision API response
    const extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text || '';
    console.log('Extracted SOD text length:', extractedText.length);

    // Parse the extracted text for SOD data
    const parsedData = parseSODExtractedText(extractedText);
    console.log('Parsed SOD data:', parsedData);

    // Update the SOD report with parsed data
    const { error: updateError } = await supabaseClient
      .from('start_of_day_reports')
      .update({
        total_deliveries: parsedData.total_deliveries || 0,
        total_collections: parsedData.total_collections || 0,
        standard: parsedData.standard || 0,
        hanging_garments: parsedData.hanging_garments || 0,
        packets: parsedData.packets || 0,
        small_packets: parsedData.small_packets || 0,
        heavy_parcels: parsedData.heavy_parcels || 0,
        postables: parsedData.postables || 0,
        extracted_round_number: parsedData.round_number || null,
        processing_status: 'completed',
        vision_api_response: visionData
      })
      .eq('id', reportId);

    if (updateError) {
      console.error('Failed to update SOD report:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update report' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SOD report updated successfully');
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData,
        extractedText: extractedText.substring(0, 500) // First 500 chars for debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in SOD processing:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function updateReportStatus(
  supabaseClient: any,
  reportId: string,
  status: string,
  visionResponse: any
) {
  await supabaseClient
    .from('start_of_day_reports')
    .update({
      processing_status: status,
      vision_api_response: visionResponse
    })
    .eq('id', reportId);
}

function parseSODExtractedText(text: string): SODVisionResponse {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let total_deliveries = 0;
  let total_collections = 0;
  let standard = 0;
  let hanging_garments = 0;
  let packets = 0;
  let small_packets = 0;
  let heavy_parcels = 0;
  let postables = 0;
  let round_number = '';

  console.log('Parsing SOD text lines:', lines.length);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Look for round number patterns
    const roundMatch = line.match(/round[:\s]*([a-z0-9]+)/i) || line.match(/route[:\s]*([a-z0-9]+)/i);
    if (roundMatch) {
      round_number = roundMatch[1].toUpperCase();
      console.log('Found round number:', round_number);
    }
    
    // Look for delivery types and counts
    if (line.includes('standard')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        standard = parseInt(numberMatch[1]);
        console.log('Found standard:', standard);
      }
    }
    
    if (line.includes('hanging') || line.includes('garment')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        hanging_garments = parseInt(numberMatch[1]);
        console.log('Found hanging garments:', hanging_garments);
      }
    }
    
    if (line.includes('packet') && !line.includes('small')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        packets = parseInt(numberMatch[1]);
        console.log('Found packets:', packets);
      }
    }
    
    if (line.includes('small') && line.includes('packet')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        small_packets = parseInt(numberMatch[1]);
        console.log('Found small packets:', small_packets);
      }
    }
    
    if (line.includes('heavy')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        heavy_parcels = parseInt(numberMatch[1]);
        console.log('Found heavy parcels:', heavy_parcels);
      }
    }
    
    if (line.includes('postable')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        postables = parseInt(numberMatch[1]);
        console.log('Found postables:', postables);
      }
    }
    
    // Look for total deliveries and collections
    if (line.includes('total') && line.includes('deliver')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        total_deliveries = parseInt(numberMatch[1]);
        console.log('Found total deliveries:', total_deliveries);
      }
    }
    
    if (line.includes('total') && line.includes('collect')) {
      const numberMatch = line.match(/(\d+)/) || (lines[i + 1] || '').match(/(\d+)/);
      if (numberMatch) {
        total_collections = parseInt(numberMatch[1]);
        console.log('Found total collections:', total_collections);
      }
    }
  }

  // Calculate totals if not found directly
  if (total_deliveries === 0) {
    total_deliveries = standard + hanging_garments + packets + small_packets + heavy_parcels + postables;
  }

  return {
    total_deliveries,
    total_collections,
    standard,
    hanging_garments,
    packets,
    small_packets,
    heavy_parcels,
    postables,
    round_number
  };
}