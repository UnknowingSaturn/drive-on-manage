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

// Helper function using regex for field extraction
const extractField = (text: string, label: string): number => {
  const regex = new RegExp(`${label}\\s*[:\\-]?\\s*(\\d+)`, "i");
  const match = text.match(regex);
  return match ? parseInt(match[1], 10) : 0;
};

function parseParcelCounts(text: string): VisionResponse {
  const data: VisionResponse = {
    raw_text: text
  };

  // Convert to lowercase for easier matching
  const lowerText = text.toLowerCase();

  // Extract round number (looking for patterns like "Round 123", "R123", "Round A1", etc.)
  const roundPatterns = [
    /round[\s:]*([a-z0-9-]+)/i,
    /\br[\s]*([0-9a-z-]+)/i,
    /route[\s:]*([a-z0-9-]+)/i,
    /rnd[\s:]*([a-z0-9-]+)/i
  ];
  
  for (const pattern of roundPatterns) {
    const roundMatch = text.match(pattern);
    if (roundMatch && roundMatch[1]) {
      data.extracted_round_number = roundMatch[1].toUpperCase();
      break;
    }
  }

  // Extract parcel counts using improved regex patterns
  data.heavy_parcels = extractField(lowerText, 'heavy') || 
                      extractField(lowerText, 'hvy') || 
                      extractField(lowerText, 'h');
                      
  data.standard = extractField(lowerText, 'standard') || 
                 extractField(lowerText, 'std') || 
                 extractField(lowerText, 'reg');
                 
  data.hanging_garments = extractField(lowerText, 'hanging') || 
                         extractField(lowerText, 'hanger') || 
                         extractField(lowerText, 'hang') || 
                         extractField(lowerText, 'garment');
                         
  data.packets = extractField(lowerText, 'packet') || 
                extractField(lowerText, 'pkt') || 
                extractField(lowerText, 'pckt');
                
  data.small_packets = extractField(lowerText, 'small packet') || 
                      extractField(lowerText, 'small') || 
                      extractField(lowerText, 'sm');
                      
  data.postables = extractField(lowerText, 'postable') || 
                  extractField(lowerText, 'post') || 
                  extractField(lowerText, 'postables');

  // Try to extract numbers from structured table-like data as fallback
  const lines = text.split('\n');
  for (const line of lines) {
    const numbers = line.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const lineWords = line.toLowerCase().split(/\s+/);
      
      // Look for context words and assign numbers accordingly
      if (lineWords.some(word => ['heavy', 'hvy'].includes(word)) && !data.heavy_parcels) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num) data.heavy_parcels = parseInt(num);
      }
      
      if (lineWords.some(word => ['standard', 'std'].includes(word)) && !data.standard) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num) data.standard = parseInt(num);
      }
      
      if (lineWords.some(word => ['hanging', 'hanger', 'hang'].includes(word)) && !data.hanging_garments) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num) data.hanging_garments = parseInt(num);
      }
      
      if (lineWords.some(word => ['packet', 'pkt'].includes(word)) && !data.packets) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num) data.packets = parseInt(num);
      }
      
      if (lineWords.some(word => ['small'].includes(word)) && !data.small_packets) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num) data.small_packets = parseInt(num);
      }
      
      if (lineWords.some(word => ['postable', 'post'].includes(word)) && !data.postables) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num) data.postables = parseInt(num);
      }
    }
  }

  return data;
}