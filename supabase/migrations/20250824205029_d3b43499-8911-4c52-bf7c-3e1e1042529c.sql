-- Remove all location tracking and shift management tables
DROP TABLE IF EXISTS public.location_points CASCADE;
DROP TABLE IF EXISTS public.location_access_logs CASCADE;
DROP TABLE IF EXISTS public.location_stats_daily CASCADE;
DROP TABLE IF EXISTS public.driver_shifts CASCADE;
DROP TABLE IF EXISTS public.driver_achievements CASCADE;

-- Remove related database functions
DROP FUNCTION IF EXISTS public.cleanup_old_location_data() CASCADE;