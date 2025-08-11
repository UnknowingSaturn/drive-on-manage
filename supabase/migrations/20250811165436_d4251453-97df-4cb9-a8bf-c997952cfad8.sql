-- Send driver credentials via email after creation
CREATE OR REPLACE FUNCTION send_driver_credentials_email(
  driver_email text,
  driver_name text,
  temp_password text,
  company_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_name_var text;
BEGIN
  -- Get company name
  SELECT name INTO company_name_var FROM companies WHERE id = company_id_param;
  
  -- Call the edge function to send credentials email
  PERFORM 
    net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-driver-credentials',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'email', driver_email,
        'name', driver_name,
        'temporaryPassword', temp_password,
        'companyId', company_id_param
      )
    );
END;
$$;