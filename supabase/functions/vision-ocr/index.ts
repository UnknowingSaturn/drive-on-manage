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
      return new Response(JSON.stringify({ error: 'Missing screenshotPath or reportId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!apiKey) {
      throw new Error('Google Vision API key not configured');
    }

    console.log('Processing OCR for report:', reportId, 'with screenshot:', screenshotPath);

    // Download the file from Supabase Storage into a buffer
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('sod-screenshots')
      .download(screenshotPath);

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download screenshot: ${downloadError?.message || 'File not found'}`);
    }

    console.log('File downloaded successfully, size:', fileData.size);

    // Convert file to base64 for Vision API
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Resize image if too large (max width 1200px for cost optimization)
    let base64Image = btoa(String.fromCharCode(...uint8Array));
    
    console.log('Converted to base64, calling Vision API...');

    // Call Google Vision API
    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1
              }
            ]
          }
        ]
      })
    });

    const visionData = await visionResponse.json();
    console.log('Vision API response received');

    if (!visionData.responses || !visionData.responses[0]) {
      throw new Error('No response from Vision API');
    }

    const textAnnotations = visionData.responses[0].textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      console.log('No text detected in image');
      
      // Update report with no data found
      const { error: updateError } = await supabase
        .from('start_of_day_reports')
        .update({
          processing_status: 'completed',
          vision_api_response: visionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) {
        console.error('Error updating report with no data:', updateError);
      }

      return new Response(JSON.stringify({ 
        extracted_data: {},
        raw_text: '',
        processing_status: 'completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fullText = textAnnotations[0].description;
    console.log('Extracted text:', fullText.substring(0, 200) + '...');

    // Parse the extracted text to find parcel counts
    const extractedData = parseParcelCounts(fullText);
    console.log('Parsed data:', extractedData);

    // Update the report with extracted data - wrap in try/catch for DB errors
    try {
      const { error: updateError } = await supabase
        .from('start_of_day_reports')
        .update({
          extracted_round_number: extractedData.extracted_round_number,
          heavy_parcels: extractedData.heavy_parcels || 0,
          standard: extractedData.standard || 0,
          hanging_garments: extractedData.hanging_garments || 0,
          packets: extractedData.packets || 0,
          small_packets: extractedData.small_packets || 0,
          postables: extractedData.postables || 0,
          vision_api_response: visionData,
          processing_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) {
        console.error('Database update error:', updateError);
        
        // If DB insert fails, try to delete the uploaded screenshot file to avoid clutter
        try {
          await supabase.storage
            .from('sod-screenshots')
            .remove([screenshotPath]);
          console.log('Cleaned up uploaded file after DB error');
        } catch (cleanupError) {
          console.error('Failed to cleanup file after DB error:', cleanupError);
        }
        
        throw updateError;
      }

      console.log('Report updated successfully with extracted data');

      return new Response(JSON.stringify({
        extracted_data: extractedData,
        raw_text: fullText,
        processing_status: 'completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Database update failed: ${dbError.message}`);
    }

  } catch (error) {
    console.error('Error in vision-ocr function:', error);
    
    // Try to update the report status to failed and extract request data
    try {
      const requestBody = await req.json().catch(() => ({}));
      const { reportId, screenshotPath } = requestBody;
      
      if (reportId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Update report status to failed
        await supabase
          .from('start_of_day_reports')
          .update({
            processing_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId);

        // Clean up uploaded file on error to avoid clutter
        if (screenshotPath) {
          try {
            await supabase.storage
              .from('sod-screenshots')
              .remove([screenshotPath]);
            console.log('Cleaned up uploaded file after processing error');
          } catch (cleanupError) {
            console.error('Failed to cleanup file after error:', cleanupError);
          }
        }
      }
    } catch (updateError) {
      console.error('Error updating failed status:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: 'OCR processing failed', 
      details: error.message,
      processing_status: 'failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Enhanced parsing function based on your Google Apps Script
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
  const result: VisionResponse = {
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

  // Process each line first
  for (let line of lines) {
    const lowerLine = line.toLowerCase();

    // Extract Round Number
    if (lowerLine.includes("round") || lowerLine.includes("rnd")) {
      const matches = line.match(/(?:round|rnd)(?:\s*number)?[:\s]+(\w+)/i);
      if (matches && matches[1]) {
        result.extracted_round_number = matches[1].trim().toUpperCase();
      } else {
        // Try for just a number/code after "round"
        const numMatch = line.match(/(?:round|rnd)[:\s]+(\w+)/i);
        if (numMatch && numMatch[1]) {
          result.extracted_round_number = numMatch[1].trim().toUpperCase();
        }
      }
    }

    // Extract Heavy Parcels
    if (lowerLine.includes("heavy")) {
      const matches = line.match(/heavy[:\s]+(\d+)/i);
      if (matches && matches[1]) {
        result.heavy_parcels = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Standard Parcels
    if (lowerLine.includes("standard")) {
      const matches = line.match(/standard[:\s]+(\d+)/i);
      if (matches && matches[1]) {
        result.standard = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Hanging Garments
    if (lowerLine.includes("hanging") && lowerLine.includes("garment")) {
      const matches = line.match(/hanging\s+garments?[:\s]+(\d+)/i);
      if (matches && matches[1]) {
        result.hanging_garments = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Packets (but not small packets)
    if (lowerLine.includes("packet") && !lowerLine.includes("small packet")) {
      const matches = line.match(/packets?[:\s]+(\d+)/i);
      if (matches && matches[1]) {
        result.packets = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Small Packets
    if (lowerLine.includes("small") && lowerLine.includes("packet")) {
      const matches = line.match(/small\s+packets?[:\s]+(\d+)/i);
      if (matches && matches[1]) {
        result.small_packets = parseInt(matches[1].trim(), 10);
      }
    }

    // Extract Postables
    if (lowerLine.includes("postable")) {
      const matches = line.match(/postables?[:\s]+(\d+)/i);
      if (matches && matches[1]) {
        result.postables = parseInt(matches[1].trim(), 10);
      }
    }
  }

  // If we couldn't find values through line-by-line analysis, try whole text search
  if (!result.extracted_round_number) {
    const roundMatch = lowerText.match(/(?:round|rnd)(?:\s*number)?[:\s]+(\w+)/i);
    if (roundMatch && roundMatch[1]) {
      result.extracted_round_number = roundMatch[1].trim().toUpperCase();
    }
  }

  if (!result.heavy_parcels) {
    const heavyMatch = lowerText.match(/heavy[:\s]+(\d+)/i);
    if (heavyMatch && heavyMatch[1]) {
      result.heavy_parcels = parseInt(heavyMatch[1].trim(), 10);
    }
  }

  if (!result.standard) {
    const standardMatch = lowerText.match(/standard[:\s]+(\d+)/i);
    if (standardMatch && standardMatch[1]) {
      result.standard = parseInt(standardMatch[1].trim(), 10);
    }
  }

  if (!result.hanging_garments) {
    const hangingMatch = lowerText.match(/hanging\s+garments?[:\s]+(\d+)/i);
    if (hangingMatch && hangingMatch[1]) {
      result.hanging_garments = parseInt(hangingMatch[1].trim(), 10);
    }
  }

  if (!result.packets) {
    const packetsMatch = lowerText.match(/(?<!small\s+)packets?[:\s]+(\d+)/i);
    if (packetsMatch && packetsMatch[1]) {
      result.packets = parseInt(packetsMatch[1].trim(), 10);
    }
  }

  if (!result.small_packets) {
    const smallPacketsMatch = lowerText.match(/small\s+packets?[:\s]+(\d+)/i);
    if (smallPacketsMatch && smallPacketsMatch[1]) {
      result.small_packets = parseInt(smallPacketsMatch[1].trim(), 10);
    }
  }

  if (!result.postables) {
    const postablesMatch = lowerText.match(/postables?[:\s]+(\d+)/i);
    if (postablesMatch && postablesMatch[1]) {
      result.postables = parseInt(postablesMatch[1].trim(), 10);
    }
  }

  console.log('Parsed data:', result);
  return result;
}

// Wrapper function for backward compatibility
function parseParcelCounts(text: string): VisionResponse {
  return parseExtractedText(text);
}