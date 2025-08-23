-- Add driver_name column to driver_invoices table
ALTER TABLE public.driver_invoices 
ADD COLUMN driver_name TEXT;