-- Update total_parcels calculation in end_of_day_reports to be sum of deliveries and collections
-- Create a trigger to automatically calculate total_parcels
CREATE OR REPLACE FUNCTION public.calculate_eod_total_parcels()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_parcels = COALESCE(NEW.successful_deliveries, 0) + COALESCE(NEW.successful_collections, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger for insert and update
DROP TRIGGER IF EXISTS trigger_calculate_eod_total_parcels ON public.end_of_day_reports;
CREATE TRIGGER trigger_calculate_eod_total_parcels
  BEFORE INSERT OR UPDATE ON public.end_of_day_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_eod_total_parcels();

-- Update existing records to calculate total_parcels correctly
UPDATE public.end_of_day_reports 
SET total_parcels = COALESCE(successful_deliveries, 0) + COALESCE(successful_collections, 0);