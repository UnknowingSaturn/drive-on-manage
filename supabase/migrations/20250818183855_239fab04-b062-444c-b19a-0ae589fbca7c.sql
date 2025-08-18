-- Remove round timing fields from end_of_day_reports table
ALTER TABLE public.end_of_day_reports 
DROP COLUMN IF EXISTS round_start_time,
DROP COLUMN IF EXISTS round_end_time;

-- Add vision API processing fields to end_of_day_reports
ALTER TABLE public.end_of_day_reports 
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS vision_api_response jsonb DEFAULT NULL;