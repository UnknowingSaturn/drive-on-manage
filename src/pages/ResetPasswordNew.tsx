import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ResetPasswordNew = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isTokenChecked, setIsTokenChecked] = useState(false);

  // Parse URL fragments (not query params) to get tokens
  const parseUrlFragments = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      type: params.get('type'),
      token_type: params.get('token_type'),
      error: params.get('error'),
      error_description: params.get('error_description')
    };
  };

  // Handle the password reset token and set session
  useEffect(() => {
    const handleResetToken = async () => {
      const fragments = parseUrlFragments();
      console.log('Password reset URL fragments:', fragments);
      
      // Check for errors first
      if (fragments.error) {
        setError(fragments.error_description || 'Invalid or expired reset link');
        setIsTokenChecked(true);
        return;
      }

      // Check if this is a recovery type and we have the required tokens
      if (fragments.type !== 'recovery' || !fragments.access_token || !fragments.refresh_token) {
        console.log('Not a valid recovery link, redirecting to auth');
        navigate('/auth');
        return;
      }

      try {
        // Set the session with the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: fragments.access_token,
          refresh_token: fragments.refresh_token
        });

        if (error) {
          console.error('Session setting error:', error);
          setError('Invalid or expired reset link. Please request a new password reset.');
          setIsTokenChecked(true);
          return;
        }

        if (data.session) {
          console.log('Session set successfully for password reset');
          setIsValidToken(true);
        } else {
          setError('Failed to validate reset link. Please request a new password reset.');
        }
      } catch (err: any) {
        console.error('Error setting session:', err);
        setError('Invalid or expired reset link. Please request a new password reset.');
      } finally {
        setIsTokenChecked(true);
      }
    };

    handleResetToken();
  }, [navigate]);

  // Success countdown
  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (success && countdown === 0) {
      // Always redirect to auth/login page after successful password reset
      navigate('/auth');
    }
  }, [success, countdown, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.password) {
      setError('Please enter a new password');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const { error } = await updatePassword(formData.password);
      
      if (error) {
        setError(error.message || 'Failed to update password');
      } else {
        // Clear the URL fragments after successful password update
        window.history.replaceState({}, document.title, '/reset-password');
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking token
  if (!isTokenChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold">Verifying Reset Link</CardTitle>
            <CardDescription>
              Please wait while we verify your password reset request...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show error if token is invalid
  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-800">Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <p className="text-sm font-medium">Common reasons for invalid links:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Link has expired (1 hour limit)</li>
                <li>Link has already been used</li>
                <li>Email client modified the link</li>
                <li>Multiple reset requests were made</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Password reset links expire after 1 hour for security reasons.
            </p>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Request New Reset Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-800">Password Reset Complete!</CardTitle>
            <CardDescription>
              Your password has been successfully updated. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                For security reasons, you have been signed out and must log in again with your new password.
              </AlertDescription>
            </Alert>
            <div className="text-left space-y-2">
              <p className="text-sm font-medium">What happens next:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>You'll be redirected to the login page</li>
                <li>Use your email and new password to sign in</li>
                <li>All devices will require re-authentication</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Redirecting to login page in {countdown} seconds...
            </p>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Go to Login Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
            <CardDescription>
              Enter your new password below. Make sure it's strong and secure.
            </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your new password"
                  disabled={isSubmitting}
                  className="pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your new password"
                  disabled={isSubmitting}
                  className="pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>

            <div className="text-center pt-4">
              <Button 
                type="button"
                variant="link" 
                onClick={() => navigate('/auth')}
                disabled={isSubmitting}
                className="text-sm"
              >
                Back to Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordNew;