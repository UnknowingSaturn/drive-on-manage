import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck, Users, Shield, AlertCircle } from 'lucide-react';
import { validateForm, sanitizeInput, emailSchema, nameSchema, passwordSchema, rateLimiter } from '@/lib/security';
import { z } from 'zod';

// Validation schemas
const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: nameSchema,
  lastName: nameSchema,
  userType: z.enum(['admin', 'driver'])
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInErrors, setSignInErrors] = useState<Record<string, string>>({});
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});
  const [rateLimitError, setRateLimitError] = useState('');

  // Sign In form state
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  // Sign Up form state
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    userType: 'driver' as 'admin' | 'driver'
  });

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInErrors({});
    setRateLimitError('');

    // Rate limiting check
    const clientId = window.navigator.userAgent + window.location.hostname;
    if (!rateLimiter.isAllowed(clientId, 5, 300000)) { // 5 attempts per 5 minutes
      setRateLimitError('Too many login attempts. Please wait 5 minutes before trying again.');
      return;
    }

    // Input validation
    const sanitizedData = {
      email: sanitizeInput(signInData.email),
      password: signInData.password // Don't sanitize passwords
    };

    const validation = validateForm(sanitizedData, signInSchema);
    if (!validation.success) {
      setSignInErrors(validation.errors || {});
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(sanitizedData.email, sanitizedData.password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpErrors({});
    setRateLimitError('');

    // Rate limiting check
    const clientId = window.navigator.userAgent + window.location.hostname;
    if (!rateLimiter.isAllowed(`signup_${clientId}`, 3, 600000)) { // 3 attempts per 10 minutes
      setRateLimitError('Too many signup attempts. Please wait 10 minutes before trying again.');
      return;
    }

    // Input validation and sanitization
    const sanitizedData = {
      email: sanitizeInput(signUpData.email),
      password: signUpData.password, // Don't sanitize passwords
      confirmPassword: signUpData.confirmPassword,
      firstName: sanitizeInput(signUpData.firstName),
      lastName: sanitizeInput(signUpData.lastName),
      userType: signUpData.userType
    };

    const validation = validateForm(sanitizedData, signUpSchema);
    if (!validation.success) {
      setSignUpErrors(validation.errors || {});
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(sanitizedData.email, sanitizedData.password, {
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        user_type: sanitizedData.userType
      });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Truck className="h-10 w-10 text-primary mr-2" />
            <h1 className="text-3xl font-bold text-foreground">LogiFlow</h1>
          </div>
          <p className="text-muted-foreground">Streamline your logistics operations</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                {rateLimitError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{rateLimitError}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      className={signInErrors.email ? "border-destructive" : ""}
                      aria-describedby={signInErrors.email ? "signin-email-error" : undefined}
                      required
                    />
                    {signInErrors.email && (
                      <p id="signin-email-error" className="text-sm text-destructive">
                        {signInErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      className={signInErrors.password ? "border-destructive" : ""}
                      aria-describedby={signInErrors.password ? "signin-password-error" : undefined}
                      required
                    />
                    {signInErrors.password && (
                      <p id="signin-password-error" className="text-sm text-destructive">
                        {signInErrors.password}
                      </p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting || !!rateLimitError}
                    aria-label="Sign in to your account"
                  >
                    {isSubmitting ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                {rateLimitError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{rateLimitError}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname">First Name</Label>
                      <Input
                        id="signup-firstname"
                        placeholder="John"
                        value={signUpData.firstName}
                        onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                        className={signUpErrors.firstName ? "border-destructive" : ""}
                        aria-describedby={signUpErrors.firstName ? "signup-firstname-error" : undefined}
                        required
                      />
                      {signUpErrors.firstName && (
                        <p id="signup-firstname-error" className="text-sm text-destructive">
                          {signUpErrors.firstName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname">Last Name</Label>
                      <Input
                        id="signup-lastname"
                        placeholder="Doe"
                        value={signUpData.lastName}
                        onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                        className={signUpErrors.lastName ? "border-destructive" : ""}
                        aria-describedby={signUpErrors.lastName ? "signup-lastname-error" : undefined}
                        required
                      />
                      {signUpErrors.lastName && (
                        <p id="signup-lastname-error" className="text-sm text-destructive">
                          {signUpErrors.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      className={signUpErrors.email ? "border-destructive" : ""}
                      aria-describedby={signUpErrors.email ? "signup-email-error" : undefined}
                      required
                    />
                    {signUpErrors.email && (
                      <p id="signup-email-error" className="text-sm text-destructive">
                        {signUpErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="user-type">Account Type</Label>
                    <Select
                      value={signUpData.userType}
                      onValueChange={(value: 'admin' | 'driver') => 
                        setSignUpData({ ...signUpData, userType: value })
                      }
                    >
                      <SelectTrigger aria-label="Select account type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="driver">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2" />
                            Driver
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            Admin
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      className={signUpErrors.password ? "border-destructive" : ""}
                      aria-describedby={signUpErrors.password ? "signup-password-error" : "signup-password-help"}
                      required
                    />
                    <p id="signup-password-help" className="text-xs text-muted-foreground">
                      Password must be at least 8 characters long
                    </p>
                    {signUpErrors.password && (
                      <p id="signup-password-error" className="text-sm text-destructive">
                        {signUpErrors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      className={signUpErrors.confirmPassword ? "border-destructive" : ""}
                      aria-describedby={signUpErrors.confirmPassword ? "signup-confirm-password-error" : undefined}
                      required
                    />
                    {signUpErrors.confirmPassword && (
                      <p id="signup-confirm-password-error" className="text-sm text-destructive">
                        {signUpErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting || !!rateLimitError}
                    aria-label="Create new account"
                  >
                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;