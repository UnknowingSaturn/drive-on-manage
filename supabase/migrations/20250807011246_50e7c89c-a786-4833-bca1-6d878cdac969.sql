-- CRITICAL SECURITY FIX: Enable RLS on driver_profiles table
-- This is a critical vulnerability - RLS policies exist but RLS is not enabled
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

-- Add audit trail for invitation actions
CREATE TABLE IF NOT EXISTS invitation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID,
  action TEXT NOT NULL,
  performed_by UUID NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE invitation_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policy for audit log - only admins can view
CREATE POLICY "Admins can view audit logs in their company" 
ON invitation_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.user_type = 'admin'
  )
);

-- Create rate limiting table for invitation sending
CREATE TABLE IF NOT EXISTS invitation_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  invitations_sent INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on rate limits
ALTER TABLE invitation_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policy for rate limits - users can only see their own
CREATE POLICY "Users can view their own rate limits" 
ON invitation_rate_limits 
FOR SELECT 
USING (user_id = auth.uid());

-- Trigger to update rate limits updated_at
CREATE TRIGGER update_invitation_rate_limits_updated_at
BEFORE UPDATE ON invitation_rate_limits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();