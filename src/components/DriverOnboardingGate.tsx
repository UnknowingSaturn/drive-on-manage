import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck } from 'lucide-react';

interface DriverOnboardingGateProps {
  children: React.ReactNode;
}

const DriverOnboardingGate: React.FC<DriverOnboardingGateProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  // Fetch driver profile to check onboarding status
  const { data: driverProfile, isLoading: driverLoading } = useQuery({
    queryKey: ['driver-profile-onboarding', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id && profile?.user_type === 'driver'
  });

  // Show loading screen while checking auth and driver status
  if (loading || driverLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Truck className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin and supervisor users don't need onboarding
  if (profile?.user_type === 'admin' || profile?.user_type === 'supervisor') {
    return <>{children}</>;
  }

  // Driver users - check onboarding status
  if (profile?.user_type === 'driver') {
    console.log('DriverOnboardingGate - Driver profile check:', {
      driverProfile,
      requiresOnboarding: driverProfile?.requires_onboarding,
      status: driverProfile?.status,
      firstLoginCompleted: driverProfile?.first_login_completed
    });

    // No driver profile exists - needs onboarding
    if (!driverProfile) {
      console.log('DriverOnboardingGate - Redirecting to onboarding: no profile found');
      return <Navigate to="/driver/onboarding" replace />;
    }

    // Check if onboarding is complete based on status and completion timestamp
    const isOnboardingComplete = 
      driverProfile.status === 'active' &&
      driverProfile.onboarding_completed_at &&
      !driverProfile.requires_onboarding &&
      driverProfile.first_login_completed;

    console.log('DriverOnboardingGate - Onboarding completion check:', {
      status: driverProfile.status,
      onboarding_completed_at: !!driverProfile.onboarding_completed_at,
      requires_onboarding: driverProfile.requires_onboarding,
      first_login_completed: driverProfile.first_login_completed,
      isOnboardingComplete
    });

    if (!isOnboardingComplete) {
      console.log('DriverOnboardingGate - Redirecting to onboarding: incomplete onboarding');
      return <Navigate to="/driver/onboarding" replace />;
    }

    console.log('DriverOnboardingGate - Onboarding complete, allowing access');
  }

  return <>{children}</>;
};

export default DriverOnboardingGate;