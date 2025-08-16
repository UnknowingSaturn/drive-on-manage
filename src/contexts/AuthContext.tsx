import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  user_type: 'admin' | 'supervisor' | 'driver';
  is_active: boolean;
  // Legacy company_id for backward compatibility
  company_id?: string;
  // New multi-company structure
  user_companies?: Array<{
    company_id: string;
    role: string;
    companies: {
      id: string;
      name: string;
    };
  }>;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData: { first_name: string; last_name: string; user_type: 'admin' | 'supervisor' }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      // First fetch the basic profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      // Then fetch user companies separately
      const { data: userCompanies, error: companiesError } = await supabase
        .from('user_companies')
        .select(`
          company_id,
          role,
          companies (
            id,
            name
          )
        `)
        .eq('user_id', userId);

      if (companiesError) {
        console.error('Error fetching user companies:', companiesError);
        // Don't fail completely, just continue without company data
      }

      // Transform data to match Profile interface
      const profile: Profile = {
        id: profileData.id,
        user_id: profileData.user_id,
        email: profileData.email,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone: profileData.phone,
        user_type: profileData.user_type as 'admin' | 'supervisor' | 'driver',
        is_active: profileData.is_active,
        company_id: userCompanies?.length > 0 ? userCompanies[0].company_id : undefined,
        user_companies: userCompanies || []
      };
      
      return profile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer profile fetch to avoid potential recursion
          setTimeout(async () => {
            const profileData = await fetchProfile(session.user.id);
            setProfile(profileData);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Import security functions
      const { cleanupAuthState, rateLimiter, sanitizeInput } = await import('@/lib/security');
      
      // Rate limiting
      const rateLimitKey = `login_${sanitizeInput(email)}`;
      if (!rateLimiter.isAllowed(rateLimitKey, 5, 300000)) { // 5 attempts per 5 minutes
        throw new Error('Too many login attempts. Please try again later.');
      }
      
      // Clean up any existing auth state
      cleanupAuthState();
      
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizeInput(email),
        password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Sign In Failed",
          description: error.message,
        });
      } else {
        // Reset rate limit on successful login
        rateLimiter.reset(rateLimitKey);
      }

      return { error };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign In Error",
        description: error.message,
      });
      return { error };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    userData: { first_name: string; last_name: string; user_type: 'admin' | 'supervisor' }
  ) => {
    try {
      // Only allow admin signup
      if (!['admin', 'supervisor'].includes(userData.user_type)) {
        toast({
          title: "Sign Up Failed", 
          description: "Driver accounts are created by administrators. Only admin and supervisor accounts can be created here.",
          variant: "destructive"
        });
        return { error: 'Only admin and supervisor signup allowed' };
      }
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData
        }
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Sign Up Failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Sign Up Successful",
          description: "Please check your email to confirm your account.",
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign Up Error",
        description: error.message,
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Import cleanup function
      const { cleanupAuthState } = await import('@/lib/security');
      
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.warn('Global signout failed, proceeding with cleanup');
      }
      
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      
      // Force page reload for clean state
      window.location.href = '/auth';
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign Out Error",
        description: error.message,
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { cleanupAuthState, sanitizeInput } = await import('@/lib/security');
      
      // Clean up any existing auth state
      cleanupAuthState();
      
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(
        sanitizeInput(email),
        {
          redirectTo: redirectUrl,
        }
      );

      if (error) {
        toast({
          variant: "destructive",
          title: "Password Reset Failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Password Reset Email Sent",
          description: "Please check your email for the password reset link.",
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password Reset Error",
        description: error.message,
      });
      return { error };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Password Update Failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been successfully updated.",
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password Update Error",
        description: error.message,
      });
      return { error };
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};