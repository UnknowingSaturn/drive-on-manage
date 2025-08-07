-- Update auth config to disable email confirmation for development
UPDATE auth.config 
SET 
  enable_signup = true,
  enable_email_confirmations = false
WHERE id = 1;