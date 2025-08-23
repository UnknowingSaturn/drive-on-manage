import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, AlertCircle, Shield, User, Users, Truck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserInviteModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const UserInviteModal = ({ trigger, onSuccess }: UserInviteModalProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'driver',
    phone: '',
    parcelRate: '',
    coverRate: ''
  });

  // Invite user mutation using appropriate functions
  const inviteUserMutation = useMutation({
    mutationFn: async (data: typeof userData) => {
      if (!profile?.company_id) throw new Error('No company ID');

      if (data.role === 'driver') {
        // Use comprehensive driver creation
        const { data: result, error } = await supabase.functions.invoke('comprehensive-create-driver', {
          body: {
            email: data.email.trim(),
            firstName: data.first_name.trim(),
            lastName: data.last_name.trim(),
            phone: data.phone?.trim() || null,
            companyId: profile.company_id,
            parcelRate: parseFloat(data.parcelRate) || 0.75,
            coverRate: parseFloat(data.coverRate) || 1.0
          }
        });

        if (error) throw error;

        // Send credentials email
        await supabase.functions.invoke('send-driver-credentials', {
          body: {
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
            tempPassword: result.tempPassword,
            companyId: profile.company_id
          }
        });

        return result;
      } else {
        // Use invite-user function for admin/supervisor
        const { data: result, error } = await supabase.functions.invoke('invite-user', {
          body: {
            email: data.email.trim(),
            role: data.role,
            companyId: profile.company_id,
            firstName: data.first_name.trim(),
            lastName: data.last_name.trim()
          }
        });

        if (error) throw error;
        return result;
      }
    },
    onSuccess: (data) => {
      toast({
        title: `${userData.role === 'driver' ? 'Driver' : 'Team member'} invited successfully`,
        description: `${userData.first_name} ${userData.last_name} has been added and will receive login credentials via email.`,
      });
      setIsOpen(false);
      setUserData({
        first_name: '',
        last_name: '',
        email: '',
        role: 'driver',
        phone: '',
        parcelRate: '',
        coverRate: ''
      });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error inviting user",
        description: error.message || 'Failed to invite user',
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await inviteUserMutation.mutateAsync(userData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'supervisor':
        return <Users className="h-4 w-4" />;
      case 'driver':
        return <Truck className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Full access to all features including finance, settings, and user management';
      case 'supervisor':
        return 'Access to dashboard, driver management, van management, round management, schedule view, and EOD reports only';
      case 'driver':
        return 'Access to driver features including start/end of day, earnings, expenses, and profile management';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Add a new team member or driver to your company. They will receive login credentials via email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Email Setup Required:</strong> To send login credentials, verify your domain at{' '}
              <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">
                resend.com/domains
              </a>{' '}
              and update your email configuration.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={userData.role} 
              onValueChange={(value) => setUserData({ ...userData, role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Driver
                  </div>
                </SelectItem>
                <SelectItem value="supervisor">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Supervisor
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Admin
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center gap-2 mb-1">
                {getRoleIcon(userData.role)}
                <strong>{userData.role.charAt(0).toUpperCase() + userData.role.slice(1)} Role:</strong>
              </div>
              {getRoleDescription(userData.role)}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first-name">First Name</Label>
              <Input
                id="first-name"
                value={userData.first_name}
                onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last Name</Label>
              <Input
                id="last-name"
                value={userData.last_name}
                onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={userData.email}
              onChange={(e) => setUserData({ ...userData, email: e.target.value })}
              required
            />
          </div>

          {userData.role === 'driver' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={userData.phone}
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parcel-rate">Parcel Rate (£)</Label>
                  <Input
                    id="parcel-rate"
                    type="number"
                    step="0.01"
                    value={userData.parcelRate}
                    onChange={(e) => setUserData({ ...userData, parcelRate: e.target.value })}
                    placeholder="0.75"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cover-rate">Cover Rate (£)</Label>
                  <Input
                    id="cover-rate"
                    type="number"
                    step="0.01"
                    value={userData.coverRate}
                    onChange={(e) => setUserData({ ...userData, coverRate: e.target.value })}
                    placeholder="1.00"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : `Add ${userData.role === 'driver' ? 'Driver' : 'Team Member'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserInviteModal;