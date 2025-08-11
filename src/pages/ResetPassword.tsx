import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ResetPassword = () => {
  const { user, updatePassword, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  // Check for access token and error params from the URL
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const tokenType = searchParams.get('token_type');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    // If there's an error in the URL params, show it
    if (errorParam) {
      setError(errorDescription || 'An error occurred with the password reset link.');
      return;
    }

    // If we have tokens, set the session
    if (accessToken && refreshToken && tokenType) {
      const setSession = async () => {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
        } catch (err: any) {
          setError('Invalid or expired reset link. Please request a new password reset.');
        }
      };
      setSession();
    }
  }, [accessToken, refreshToken, tokenType, errorParam, errorDescription]);

  // If user is already authenticated (non-reset flow), redirect to dashboard
  if (user && !accessToken && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  // If no tokens and no user, show error
  if (!accessToken && !refreshToken && !user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-6">
        <div className="w-full max-w-96">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Truck className="h-10 w-10 text-primary mr-2" />
              <h1 className="text-3xl font-bold text-foreground">LogiFlow</h1>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 text-destructive mr-2" />
                Invalid Reset Link
              </CardTitle>
              <CardDescription>
                This password reset link is invalid or has expired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please request a new password reset from the login page.
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full mt-4" 
                onClick={() => window.location.href = '/auth'}
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await updatePassword(formData.password);
      
      if (error) {
        setError(error.message);
      } else {
        setIsComplete(true);
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Truck className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-6">
        <div className="w-full max-w-96">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Truck className="h-10 w-10 text-primary mr-2" />
              <h1 className="text-3xl font-bold text-foreground">LogiFlow</h1>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                Password Updated Successfully
              </CardTitle>
              <CardDescription>
                Your password has been updated. You will be redirected to the dashboard shortly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Redirecting to dashboard in a few seconds...
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full mt-4" 
                onClick={() => window.location.href = '/dashboard'}
              >
                Go to Dashboard Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-96">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Truck className="h-10 w-10 text-primary mr-2" />
            <h1 className="text-3xl font-bold text-foreground">LogiFlow</h1>
          </div>
          <p className="text-muted-foreground">Reset your password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set New Password</CardTitle>
            <CardDescription>
              Enter your new password below. Make sure it's secure and memorable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter your new password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="touch-target"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your new password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  className="touch-target"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full mobile-button" 
                disabled={isSubmitting || !formData.password || !formData.confirmPassword}
              >
                {isSubmitting ? 'Updating Password...' : 'Update Password'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/auth'}
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;