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

  // Admin users don't need onboarding
  if (profile?.user_type === 'admin') {
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

    // No driver profile exists or requires onboarding
    if (!driverProfile || driverProfile.requires_onboarding || driverProfile.status === 'pending_onboarding') {
      console.log('DriverOnboardingGate - Redirecting to onboarding: missing profile or requires onboarding');
      return <Navigate to="/driver/onboarding" replace />;
    }

    // First login check
    if (!driverProfile.first_login_completed) {
      console.log('DriverOnboardingGate - Redirecting to onboarding: first login not completed');
      return <Navigate to="/driver/onboarding" replace />;
    }

    // Check if all required onboarding fields are completed (insurance is optional)
    const isOnboardingComplete = !!(
      driverProfile.driving_license_number &&
      driverProfile.license_expiry &&
      driverProfile.driving_license_document &&
      driverProfile.right_to_work_document &&
      // insurance_document is optional
      !driverProfile.requires_onboarding &&
      driverProfile.status !== 'pending_onboarding'
    );

    console.log('DriverOnboardingGate - Onboarding completion check:', {
      driving_license_number: !!driverProfile.driving_license_number,
      license_expiry: !!driverProfile.license_expiry,
      driving_license_document: !!driverProfile.driving_license_document,
      right_to_work_document: !!driverProfile.right_to_work_document,
      requires_onboarding: driverProfile.requires_onboarding,
      status: driverProfile.status,
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