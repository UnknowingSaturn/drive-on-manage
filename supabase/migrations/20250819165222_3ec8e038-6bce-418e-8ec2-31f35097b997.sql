-- Add manifest_date column to start_of_day_reports table
ALTER TABLE public.start_of_day_reports 
ADD COLUMN manifest_date date;