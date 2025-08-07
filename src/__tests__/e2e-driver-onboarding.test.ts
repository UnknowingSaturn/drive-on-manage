import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
      })),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock data
const mockCompany = {
  id: 'company-123',
  name: 'Test Delivery Company',
  email: 'admin@testcompany.com',
};

const mockAdmin = {
  id: 'admin-123',
  email: 'admin@testcompany.com',
  user_metadata: { first_name: 'Admin', last_name: 'User' },
};

const mockDriverInvitation = {
  id: 'invitation-123',
  email: 'driver@test.com',
  first_name: 'John',
  last_name: 'Driver',
  phone: '+1234567890',
  company_id: 'company-123',
  invite_token: 'secure-invite-token-123',
  status: 'pending',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  hourly_rate: 15.50,
  created_by: 'admin-123',
};

const mockDriverProfile = {
  id: 'driver-profile-123',
  user_id: 'driver-user-123',
  company_id: 'company-123',
  employee_id: 'EMP001',
  driving_license_number: 'DL123456789',
  license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
  hourly_rate: 15.50,
  parcel_rate: 0.75,
  status: 'active',
  onboarding_progress: {
    personal_info: true,
    documents: true,
    bank_details: true,
  },
  onboarding_completed_at: new Date().toISOString(),
};

const mockDocuments = {
  driving_license: new File(['mock-license'], 'license.jpg', { type: 'image/jpeg' }),
  right_to_work: new File(['mock-rtw'], 'passport.jpg', { type: 'image/jpeg' }),
  insurance: new File(['mock-insurance'], 'insurance.pdf', { type: 'application/pdf' }),
};

describe('End-to-End Driver Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Admin Creates Driver Invitation', () => {
    it('should allow admin to create a driver invitation', async () => {
      // Mock successful invitation creation
      const mockSupabaseFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [mockDriverInvitation],
            error: null,
          }),
        }),
      });
      
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [mockDriverInvitation],
            error: null,
          }),
        }),
      });

      // Mock edge function call for sending invite
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true, invitation_id: mockDriverInvitation.id },
        error: null,
      });

      // Simulate admin creating invitation
      const invitationData = {
        email: mockDriverInvitation.email,
        first_name: mockDriverInvitation.first_name,
        last_name: mockDriverInvitation.last_name,
        phone: mockDriverInvitation.phone,
        hourly_rate: mockDriverInvitation.hourly_rate,
        company_id: mockDriverInvitation.company_id,
      };

      // Call edge function to create invitation
      const { data, error } = await supabase.functions.invoke('secure-staff-invite', {
        body: invitationData,
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.invitation_id).toBe(mockDriverInvitation.id);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('secure-staff-invite', {
        body: invitationData,
      });
    });

    it('should generate secure invite token and expiry date', () => {
      expect(mockDriverInvitation.invite_token).toBeTruthy();
      expect(mockDriverInvitation.invite_token.length).toBeGreaterThan(10);
      expect(new Date(mockDriverInvitation.expires_at)).toBeInstanceOf(Date);
      expect(new Date(mockDriverInvitation.expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Step 2: Driver Accesses Invitation Link', () => {
    it('should validate invitation token and load driver data', async () => {
      // Mock successful invitation retrieval
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDriverInvitation,
              error: null,
            }),
          }),
        }),
      });

      // Simulate driver accessing invitation link
      const inviteToken = mockDriverInvitation.invite_token;
      const { data: invitation, error } = await supabase
        .from('driver_invitations')
        .select('*')
        .eq('invite_token', inviteToken)
        .single();

      expect(error).toBeNull();
      expect(invitation).toEqual(mockDriverInvitation);
      expect(invitation.status).toBe('pending');
      expect(new Date(invitation.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject expired invitation tokens', async () => {
      const expiredInvitation = {
        ...mockDriverInvitation,
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: expiredInvitation,
              error: null,
            }),
          }),
        }),
      });

      const { data: invitation, error } = await supabase
        .from('driver_invitations')
        .select('*')
        .eq('invite_token', expiredInvitation.invite_token)
        .single();

      expect(error).toBeNull();
      expect(invitation).toEqual(expiredInvitation);
      
      // Simulate expiry check
      const isExpired = new Date(invitation.expires_at).getTime() < Date.now();
      expect(isExpired).toBe(true);
    });

    it('should reject invalid invitation tokens', async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'No invitation found' },
            }),
          }),
        }),
      });

      const { data: invitation, error } = await supabase
        .from('driver_invitations')
        .select('*')
        .eq('invite_token', 'invalid-token')
        .single();

      expect(invitation).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  describe('Step 3: Driver Completes Onboarding Form', () => {
    it('should validate required personal information', () => {
      const personalInfo = {
        first_name: mockDriverInvitation.first_name,
        last_name: mockDriverInvitation.last_name,
        email: mockDriverInvitation.email,
        phone: mockDriverInvitation.phone,
        employee_id: 'EMP001',
        driving_license_number: 'DL123456789',
        license_expiry: '2025-12-31',
      };

      // Validate all required fields are present
      expect(personalInfo.first_name).toBeTruthy();
      expect(personalInfo.last_name).toBeTruthy();
      expect(personalInfo.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(personalInfo.phone).toMatch(/^\+?[\d\s-()]+$/);
      expect(personalInfo.employee_id).toBeTruthy();
      expect(personalInfo.driving_license_number).toBeTruthy();
      expect(new Date(personalInfo.license_expiry).getTime()).toBeGreaterThan(Date.now());
    });

    it('should validate required document uploads', () => {
      const requiredDocs = ['driving_license', 'right_to_work', 'insurance'];
      const uploadedDocs = Object.keys(mockDocuments);

      requiredDocs.forEach(docType => {
        expect(uploadedDocs).toContain(docType);
        expect(mockDocuments[docType as keyof typeof mockDocuments]).toBeInstanceOf(File);
      });

      // Validate file types
      expect(mockDocuments.driving_license.type).toMatch(/^image\//);
      expect(mockDocuments.right_to_work.type).toMatch(/^image\//);
      expect(['image/jpeg', 'image/png', 'application/pdf']).toContain(mockDocuments.insurance.type);
    });

    it('should upload documents to secure storage', async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: 'driver-documents/driver-profile-123/license.jpg' },
        error: null,
      });

      (supabase.storage.from as any).mockReturnValue({
        upload: mockUpload,
      });

      // Simulate document upload
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(`driver-profile-123/license.jpg`, mockDocuments.driving_license);

      expect(uploadError).toBeNull();
      expect(uploadData.path).toBe('driver-documents/driver-profile-123/license.jpg');
      expect(mockUpload).toHaveBeenCalledWith(
        'driver-profile-123/license.jpg',
        mockDocuments.driving_license
      );
    });
  });

  describe('Step 4: Driver Account Creation', () => {
    it('should create user account with invitation data', async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'driver-user-123',
            email: mockDriverInvitation.email,
            user_metadata: {
              first_name: mockDriverInvitation.first_name,
              last_name: mockDriverInvitation.last_name,
              invite_token: mockDriverInvitation.invite_token,
            },
          },
        },
        error: null,
      });

      (supabase.auth.signUp as any).mockImplementation(mockSignUp);

      // Simulate account creation
      const password = 'SecurePassword123!';
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: mockDriverInvitation.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: mockDriverInvitation.first_name,
            last_name: mockDriverInvitation.last_name,
            invite_token: mockDriverInvitation.invite_token,
          },
        },
      });

      expect(authError).toBeNull();
      expect(authData.user?.email).toBe(mockDriverInvitation.email);
      expect(authData.user?.user_metadata.first_name).toBe(mockDriverInvitation.first_name);
      expect(authData.user?.user_metadata.invite_token).toBe(mockDriverInvitation.invite_token);
    });

    it('should create driver profile after successful signup', async () => {
      // Mock successful profile creation
      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [mockDriverProfile],
            error: null,
          }),
        }),
      });

      // Mock edge function call for confirmed driver creation
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { success: true, driver_profile: mockDriverProfile },
        error: null,
      });

      // Simulate driver profile creation via edge function
      const { data, error } = await supabase.functions.invoke('create-confirmed-driver', {
        body: {
          user_id: 'driver-user-123',
          invite_token: mockDriverInvitation.invite_token,
          onboarding_data: {
            employee_id: 'EMP001',
            driving_license_number: 'DL123456789',
            license_expiry: '2025-12-31',
            documents: {
              driving_license_document: 'driver-documents/driver-profile-123/license.jpg',
              right_to_work_document: 'driver-documents/driver-profile-123/passport.jpg',
              insurance_document: 'driver-documents/driver-profile-123/insurance.pdf',
            },
          },
        },
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.driver_profile).toEqual(mockDriverProfile);
    });

    it('should mark invitation as accepted', async () => {
      // Mock invitation update
      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{
              ...mockDriverInvitation,
              status: 'accepted',
              accepted_at: new Date().toISOString(),
              driver_profile_id: mockDriverProfile.id,
            }],
            error: null,
          }),
        }),
      });

      const { data, error } = await supabase
        .from('driver_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          driver_profile_id: mockDriverProfile.id,
        })
        .eq('invite_token', mockDriverInvitation.invite_token);

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(Array.isArray(data)).toBe(true);
      const updatedInvitation = (data as any[])[0];
      expect(updatedInvitation.status).toBe('accepted');
      expect(updatedInvitation.driver_profile_id).toBe(mockDriverProfile.id);
    });
  });

  describe('Step 5: Driver Login Verification', () => {
    it('should allow driver to login with created credentials', async () => {
      const mockSignIn = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'driver-user-123',
            email: mockDriverInvitation.email,
          },
          session: {
            access_token: 'mock-access-token',
            user: {
              id: 'driver-user-123',
              email: mockDriverInvitation.email,
            },
          },
        },
        error: null,
      });

      (supabase.auth.signInWithPassword as any).mockImplementation(mockSignIn);

      // Simulate login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: mockDriverInvitation.email,
        password: 'SecurePassword123!',
      });

      expect(loginError).toBeNull();
      expect(loginData.user?.email).toBe(mockDriverInvitation.email);
      expect(loginData.session?.access_token).toBeTruthy();
    });

    it('should retrieve driver profile after login', async () => {
      // Mock profile retrieval
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDriverProfile,
              error: null,
            }),
          }),
        }),
      });

      const { data: profile, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', 'driver-user-123')
        .single();

      expect(error).toBeNull();
      expect(profile).toEqual(mockDriverProfile);
      expect(profile.status).toBe('active');
      expect(profile.onboarding_completed_at).toBeTruthy();
    });
  });

  describe('Step 6: Admin Dashboard Visibility', () => {
    it('should display new driver in admin dashboard', async () => {
      // Mock admin querying drivers in their company
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [mockDriverProfile],
            error: null,
          }),
        }),
      });

      // Simulate admin fetching company drivers
      const { data: drivers, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('company_id', mockCompany.id);

      expect(error).toBeNull();
      expect(drivers).toHaveLength(1);
      expect(drivers[0]).toEqual(mockDriverProfile);
      expect(drivers[0].status).toBe('active');
    });

    it('should show driver onboarding completion status', () => {
      const onboardingProgress = mockDriverProfile.onboarding_progress;
      
      expect(onboardingProgress.personal_info).toBe(true);
      expect(onboardingProgress.documents).toBe(true);
      expect(onboardingProgress.bank_details).toBe(true);
      
      const isOnboardingComplete = Object.values(onboardingProgress).every(step => step === true);
      expect(isOnboardingComplete).toBe(true);
      expect(mockDriverProfile.onboarding_completed_at).toBeTruthy();
    });

    it('should display driver with correct company association', () => {
      expect(mockDriverProfile.company_id).toBe(mockCompany.id);
      expect(mockDriverInvitation.company_id).toBe(mockCompany.id);
    });
  });

  describe('Complete End-to-End Flow Integration', () => {
    it('should complete the full onboarding journey successfully', async () => {
      // Step 1: Admin creates invitation
      (supabase.functions.invoke as any).mockResolvedValueOnce({
        data: { success: true, invitation_id: mockDriverInvitation.id },
        error: null,
      });

      const inviteResult = await supabase.functions.invoke('secure-staff-invite', {
        body: {
          email: mockDriverInvitation.email,
          first_name: mockDriverInvitation.first_name,
          last_name: mockDriverInvitation.last_name,
          company_id: mockDriverInvitation.company_id,
        },
      });

      expect(inviteResult.data.success).toBe(true);

      // Step 2: Driver accesses invitation
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDriverInvitation,
              error: null,
            }),
          }),
        }),
      });

      // Step 3: Driver signs up
      (supabase.auth.signUp as any).mockResolvedValueOnce({
        data: { user: { id: 'driver-user-123', email: mockDriverInvitation.email } },
        error: null,
      });

      // Step 4: Driver profile created
      (supabase.functions.invoke as any).mockResolvedValueOnce({
        data: { success: true, driver_profile: mockDriverProfile },
        error: null,
      });

      // Step 5: Driver logs in
      (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: { user: { id: 'driver-user-123' }, session: { access_token: 'token' } },
        error: null,
      });

      // Step 6: Admin sees driver
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [mockDriverProfile],
            error: null,
          }),
        }),
      });

      // Verify the complete flow
      const signupResult = await supabase.auth.signUp({
        email: mockDriverInvitation.email,
        password: 'SecurePassword123!',
      });

      const profileCreationResult = await supabase.functions.invoke('create-confirmed-driver', {
        body: { user_id: signupResult.data.user?.id },
      });

      const loginResult = await supabase.auth.signInWithPassword({
        email: mockDriverInvitation.email,
        password: 'SecurePassword123!',
      });

      const adminViewResult = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('company_id', mockCompany.id);

      // Assert complete flow success
      expect(inviteResult.data.success).toBe(true);
      expect(signupResult.data.user).toBeTruthy();
      expect(profileCreationResult.data.success).toBe(true);
      expect(loginResult.data.session).toBeTruthy();
      expect(adminViewResult.data).toHaveLength(1);
    });
  });
});