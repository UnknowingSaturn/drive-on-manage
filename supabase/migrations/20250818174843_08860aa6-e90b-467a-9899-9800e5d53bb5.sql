-- Add new columns to start_of_day_reports table
ALTER TABLE start_of_day_reports 
ADD COLUMN manifest_date date,
ADD COLUMN total_collections integer DEFAULT 0,
ADD COLUMN total_deliveries integer DEFAULT 0;