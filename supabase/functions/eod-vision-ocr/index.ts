import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VisionResponse {
  successful_deliveries?: number;
  successful_collections?: number;
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
      .from('eod-screenshots')
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
    console.log('Downloading image from:', publicUrlData.publicUrl);
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
    console.log('Calling Google Vision API for text detection');
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
    console.log('Vision API response received');

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
    console.log('Extracted text length:', extractedText.length);

    // Parse the extracted text for deliveries and collections
    const parsedData = parseExtractedText(extractedText);
    console.log('Parsed data:', parsedData);

    // Update the EOD report with parsed data
    const { error: updateError } = await supabaseClient
      .from('end_of_day_reports')
      .update({
        successful_deliveries: parsedData.successful_deliveries || 0,
        successful_collections: parsedData.successful_collections || 0,
        processing_status: 'completed',
        vision_api_response: visionData
      })
      .eq('id', reportId);

    if (updateError) {
      console.error('Failed to update EOD report:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update report' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('EOD report updated successfully');
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData,
        extractedText: extractedText.substring(0, 500) // First 500 chars for debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
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
    .from('end_of_day_reports')
    .update({
      processing_status: status,
      vision_api_response: visionResponse
    })
    .eq('id', reportId);
}

function parseExtractedText(text: string): VisionResponse {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let successful_deliveries = 0;
  let successful_collections = 0;

  console.log('Parsing text lines:', lines.length);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Look for deliveries patterns
    if (line.includes('successful') && line.includes('deliver')) {
      const nextLine = lines[i + 1] || '';
      const numberMatch = nextLine.match(/(\d+)/);
      if (numberMatch) {
        successful_deliveries = parseInt(numberMatch[1]);
        console.log('Found deliveries:', successful_deliveries);
      }
    }
    
    // Look for collections patterns
    if (line.includes('successful') && line.includes('collect')) {
      const nextLine = lines[i + 1] || '';
      const numberMatch = nextLine.match(/(\d+)/);
      if (numberMatch) {
        successful_collections = parseInt(numberMatch[1]);
        console.log('Found collections:', successful_collections);
      }
    }
    
    // Alternative patterns - look for numbers directly on same line
    const deliveriesMatch = line.match(/successful\s*deliver[ies]*[\s:]*(\d+)/);
    if (deliveriesMatch) {
      successful_deliveries = parseInt(deliveriesMatch[1]);
      console.log('Found deliveries (same line):', successful_deliveries);
    }
    
    const collectionsMatch = line.match(/successful\s*collect[ions]*[\s:]*(\d+)/);
    if (collectionsMatch) {
      successful_collections = parseInt(collectionsMatch[1]);
      console.log('Found collections (same line):', successful_collections);
    }
  }

  return {
    successful_deliveries,
    successful_collections
  };
}