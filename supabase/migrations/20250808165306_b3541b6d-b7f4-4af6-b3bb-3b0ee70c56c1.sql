-- Fix database function security settings
ALTER FUNCTION public.calculate_driver_invoice_data(uuid, date, date) 
SET search_path = public;

ALTER FUNCTION public.generate_invoice_number() 
SET search_path = public;

ALTER FUNCTION public.create_company_test(text, text, text, text) 
SET search_path = public;

ALTER FUNCTION public.calculate_driver_pay(uuid, integer, numeric) 
SET search_path = public;

ALTER FUNCTION public.calculate_driver_pay_with_rates(uuid, uuid, integer, integer, numeric) 
SET search_path = public;