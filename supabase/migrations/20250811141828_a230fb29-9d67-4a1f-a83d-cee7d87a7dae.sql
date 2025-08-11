-- Remove old invitation-related database functions that are no longer needed
DROP FUNCTION IF EXISTS public.generate_invite_token() CASCADE;
DROP FUNCTION IF EXISTS public.validate_invitation_token(text) CASCADE;