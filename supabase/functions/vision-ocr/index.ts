import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VisionResponse {
  extracted_round_number?: string;
  heavy_parcels?: number;
  standard?: number;
  hanging_garments?: number;
  packets?: number;
  small_packets?: number;
  postables?: number;
  raw_text?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { screenshotPath, reportId } = await req.json();
    
    if (!screenshotPath || !reportId) {
      console.error('Missing required parameters:', { screenshotPath, reportId });
      return new Response(JSON.stringify({ error: 'Missing screenshotPath or reportId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!apiKey) {
      console.error('Google Vision API key not configured');
      return new Response(JSON.stringify({ error: 'Google Vision API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Processing OCR for report:', reportId, 'with screenshot:', screenshotPath);

    // Create public URL for the image since bucket is now public
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/sod-screenshots/${screenshotPath}`;
    
    console.log('Using public image URL:', imageUrl);

    // Verify the image is accessible
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error('Image not accessible at URL:', imageUrl, 'Status:', imageResponse.status);
      await updateReportStatus(supabase, reportId, 'failed', { 
        error: 'Image not accessible',
        imageUrl,
        status: imageResponse.status 
      });
      return new Response(JSON.stringify({ error: 'Image not accessible' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call Google Vision API with image URL (more reliable than base64)
    const visionPayload = {
      requests: [{
        image: {
          source: {
            imageUri: imageUrl
          }
        },
        features: [{
          type: "TEXT_DETECTION",
          maxResults: 50
        }],
        imageContext: {
          languageHints: ["en"]
        }
      }]
    };

    console.log('Calling Google Vision API with public URL...');
    
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visionPayload)
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', visionResponse.status, errorText);
      await updateReportStatus(supabase, reportId, 'failed', { 
        error: `Vision API error: ${visionResponse.status}`,
        details: errorText 
      });
      return new Response(JSON.stringify({ error: 'Vision API failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const visionData = await visionResponse.json();
    console.log('Vision API response received');

    // Extract text from Vision response
    let extractedText = '';
    if (visionData.responses && 
        visionData.responses[0] && 
        visionData.responses[0].textAnnotations && 
        visionData.responses[0].textAnnotations[0]) {
      extractedText = visionData.responses[0].textAnnotations[0].description;
      console.log('Extracted text length:', extractedText.length);
    } else {
      console.log('No text detected in image');
      extractedText = '';
    }

    // Parse the extracted text
    const parsedData = parseExtractedText(extractedText);
    console.log('Parsed data:', parsedData);

    // Update the database with parsed data
    const { error: updateError } = await supabase
      .from('start_of_day_reports')
      .update({
        extracted_round_number: parsedData.extracted_round_number,
        heavy_parcels: parsedData.heavy_parcels,
        standard: parsedData.standard,
        hanging_garments: parsedData.hanging_garments,
        packets: parsedData.packets,
        small_packets: parsedData.small_packets,
        postables: parsedData.postables,
        vision_api_response: visionData,
        processing_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId);

    if (updateError) {
      console.error('Failed to update report:', updateError);
      await updateReportStatus(supabase, reportId, 'failed', { error: updateError.message });
      return new Response(JSON.stringify({ error: 'Failed to update report' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Successfully processed OCR for report:', reportId);

    return new Response(JSON.stringify({ 
      success: true, 
      parsedData,
      extractedText: extractedText.substring(0, 500) // First 500 chars for debugging
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Vision OCR error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function updateReportStatus(supabase: any, reportId: string, status: string, errorData?: any) {
  try {
    await supabase
      .from('start_of_day_reports')
      .update({
        processing_status: status,
        vision_api_response: errorData,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId);
  } catch (error) {
    console.error('Failed to update report status:', error);
  }
}

async function resizeImage(imageBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  // For now, return the original buffer
  // In a production environment, you might want to implement actual image resizing
  return imageBuffer;
}

/**
 * Parse specific data points from extracted text using Google Apps Script logic
 */
function parseExtractedText(text: string): VisionResponse {
  if (!text) {
    return {
      extracted_round_number: "",
      heavy_parcels: 0,
      standard: 0,
      hanging_garments: 0,
      packets: 0,
      small_packets: 0,
      postables: 0,
      raw_text: ""
    };
  }

  // Initialize results object
  const result = {
    extracted_round_number: "",
    heavy_parcels: 0,
    standard: 0,
    hanging_garments: 0,
    packets: 0,
    small_packets: 0,
    postables: 0,
    raw_text: text
  };

  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  const lines = text.split('\n');

  // Process each line
  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Extract Round Number - look for patterns like "Round: 123", "RND 123", etc.
    if (lowerLine.includes("round") || lowerLine.includes("rnd")) {
      const matches = line.match(/(?:round|rnd)(?:\s*number)?[:\s-]+(\w+)/i);
      if (matches && matches[1]) {
        result.extracted_round_number = matches[1].trim();
      } else {
        // Try for just a number/code after "round"
        const numMatch = line.match(/(?:round|rnd)[:\s-]+(\w+)/i);
        if (numMatch && numMatch[1]) {
          result.extracted_round_number = numMatch[1].trim();
        }
      }
    }

    // Extract Heavy Parcels
    if (lowerLine.includes("heavy")) {
      const matches = line.match(/heavy[:\s-]+(\d+)/i);
      if (matches && matches[1]) {
        result.heavy_parcels = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Standard Parcels
    if (lowerLine.includes("standard")) {
      const matches = line.match(/standard[:\s-]+(\d+)/i);
      if (matches && matches[1]) {
        result.standard = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Hanging Garments
    if (lowerLine.includes("hanging") && lowerLine.includes("garment")) {
      const matches = line.match(/hanging\s+garments?[:\s-]+(\d+)/i);
      if (matches && matches[1]) {
        result.hanging_garments = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Packets (but not small packets)
    if (lowerLine.includes("packet") && !lowerLine.includes("small")) {
      const matches = line.match(/packets?[:\s-]+(\d+)/i);
      if (matches && matches[1]) {
        result.packets = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Small Packets
    if (lowerLine.includes("small") && lowerLine.includes("packet")) {
      const matches = line.match(/small\s+packets?[:\s-]+(\d+)/i);
      if (matches && matches[1]) {
        result.small_packets = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Postables
    if (lowerLine.includes("postable")) {
      const matches = line.match(/postables?[:\s-]+(\d+)/i);
      if (matches && matches[1]) {
        result.postables = parseInt(matches[1].trim(), 10);
      }
    }
  }

  // If we couldn't find values through line-by-line analysis, try whole text search
  if (!result.extracted_round_number) {
    const roundMatch = lowerText.match(/(?:round|rnd)(?:\s*number)?[:\s-]+(\w+)/i);
    if (roundMatch && roundMatch[1]) {
      result.extracted_round_number = roundMatch[1].trim();
    }
  }

  if (result.heavy_parcels === 0) {
    const heavyMatch = lowerText.match(/heavy[:\s-]+(\d+)/i);
    if (heavyMatch && heavyMatch[1]) {
      result.heavy_parcels = parseInt(heavyMatch[1].trim(), 10);
    }
  }

  if (result.standard === 0) {
    const standardMatch = lowerText.match(/standard[:\s-]+(\d+)/i);
    if (standardMatch && standardMatch[1]) {
      result.standard = parseInt(standardMatch[1].trim(), 10);
    }
  }

  if (result.hanging_garments === 0) {
    const hangingMatch = lowerText.match(/hanging\s+garments?[:\s-]+(\d+)/i);
    if (hangingMatch && hangingMatch[1]) {
      result.hanging_garments = parseInt(hangingMatch[1].trim(), 10);
    }
  }

  if (result.packets === 0) {
    // Look for "packets" that aren't preceded by "small"
    const packetsLines = lines.filter(line => 
      line.toLowerCase().includes("packet") && 
      !line.toLowerCase().includes("small")
    );
    for (const line of packetsLines) {
      const matches = line.match(/packets?[:\s-]+(\d+)/i);
      if (matches && matches[1]) {
        result.packets = parseInt(matches[1].trim(), 10);
        break;
      }
    }
  }

  if (result.small_packets === 0) {
    const smallPacketsMatch = lowerText.match(/small\s+packets?[:\s-]+(\d+)/i);
    if (smallPacketsMatch && smallPacketsMatch[1]) {
      result.small_packets = parseInt(smallPacketsMatch[1].trim(), 10);
    }
  }

  if (result.postables === 0) {
    const postablesMatch = lowerText.match(/postables?[:\s-]+(\d+)/i);
    if (postablesMatch && postablesMatch[1]) {
      result.postables = parseInt(postablesMatch[1].trim(), 10);
    }
  }

  return result;
}