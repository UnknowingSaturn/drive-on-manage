-- Update auth config to enable email confirmation
UPDATE auth.config 
SET 
  enable_signup = true,
  enable_email_confirmations = true
WHERE id = 1;