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

    const { imageData, reportId } = await req.json();
    
    if (!imageData || !reportId) {
      return new Response(JSON.stringify({ error: 'Missing imageData or reportId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!apiKey) {
      throw new Error('Google Vision API key not configured');
    }

    console.log('Processing OCR for report:', reportId);

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
              content: imageData.replace(/^data:image\/[a-z]+;base64,/, '')
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
      return new Response(JSON.stringify({ 
        extracted_data: {},
        raw_text: '',
        processing_status: 'completed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fullText = textAnnotations[0].description;
    console.log('Extracted text:', fullText.substring(0, 100) + '...');

    // Parse the extracted text to find parcel counts
    const extractedData = parseParcelCounts(fullText);

    // Update the report with extracted data
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
      console.error('Error updating report:', updateError);
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

  } catch (error) {
    console.error('Error in vision-ocr function:', error);
    
    // Try to update the report status to failed
    try {
      const { reportId } = await req.json().catch(() => ({}));
      if (reportId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase
          .from('start_of_day_reports')
          .update({
            processing_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId);
      }
    } catch (updateError) {
      console.error('Error updating failed status:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: 'OCR processing failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function parseParcelCounts(text: string): VisionResponse {
  const data: VisionResponse = {
    raw_text: text
  };

  // Convert to lowercase for easier matching
  const lowerText = text.toLowerCase();

  // Extract round number (looking for patterns like "Round 123" or "R123")
  const roundMatch = text.match(/round[\s:]*([a-z0-9-]+)/i) || text.match(/\br[\s]*([0-9]+)/i);
  if (roundMatch) {
    data.extracted_round_number = roundMatch[1];
  }

  // Extract parcel counts using various patterns
  const patterns = [
    { key: 'heavy_parcels', patterns: ['heavy[\s:]*([0-9]+)', 'hvy[\s:]*([0-9]+)', 'h[\s:]*([0-9]+)'] },
    { key: 'standard', patterns: ['standard[\s:]*([0-9]+)', 'std[\s:]*([0-9]+)', 'standard[\s:]*([0-9]+)'] },
    { key: 'hanging_garments', patterns: ['hanging[\s:]*([0-9]+)', 'hanger[\s:]*([0-9]+)', 'hang[\s:]*([0-9]+)', 'garment[\s:]*([0-9]+)'] },
    { key: 'packets', patterns: ['packet[\s:]*([0-9]+)', 'pkt[\s:]*([0-9]+)', 'p[\s:]*([0-9]+)'] },
    { key: 'small_packets', patterns: ['small[\s]+packet[\s:]*([0-9]+)', 'small[\s:]*([0-9]+)', 'sm[\s:]*([0-9]+)'] },
    { key: 'postables', patterns: ['postable[\s:]*([0-9]+)', 'post[\s:]*([0-9]+)', 'postables[\s:]*([0-9]+)'] }
  ];

  for (const item of patterns) {
    for (const pattern of item.patterns) {
      const match = lowerText.match(new RegExp(pattern, 'i'));
      if (match && match[1]) {
        const value = parseInt(match[1], 10);
        if (!isNaN(value)) {
          (data as any)[item.key] = value;
          break;
        }
      }
    }
  }

  // Try to extract numbers from structured table-like data
  // Look for lines with numbers that might represent parcel counts
  const lines = text.split('\n');
  for (const line of lines) {
    const numbers = line.match(/\b\d+\b/g);
    if (numbers && numbers.length > 1) {
      // This might be a data row, try to map it to our fields
      const lineWords = line.toLowerCase().split(/\s+/);
      
      if (lineWords.some(word => ['heavy', 'hvy', 'h'].includes(word))) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num && !data.heavy_parcels) data.heavy_parcels = parseInt(num);
      }
      
      if (lineWords.some(word => ['standard', 'std'].includes(word))) {
        const num = numbers.find(n => parseInt(n) > 0);
        if (num && !data.standard) data.standard = parseInt(num);
      }
    }
  }

  return data;
}