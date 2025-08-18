import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Edit, Trash2, Shield, User, Users, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const TeamManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMember, setNewMember] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'supervisor'
  });

  // Fetch team members
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      // First get user_companies
      const { data: userCompanies, error: userCompaniesError } = await supabase
        .from('user_companies')
        .select('id, user_id, role')
        .eq('company_id', profile.company_id)
        .neq('user_id', profile.user_id); // Exclude current user

      if (userCompaniesError) throw userCompaniesError;
      if (!userCompanies || userCompanies.length === 0) return [];

      // Then get profiles for those users
      const userIds = userCompanies.map(uc => uc.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, is_active, created_at')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      return userCompanies.map(uc => {
        const profile = profiles?.find(p => p.user_id === uc.user_id);
        return {
          id: uc.id,
          user_id: uc.user_id,
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          email: profile?.email || '',
          role: uc.role,
          is_active: profile?.is_active || false,
          created_at: profile?.created_at || ''
        };
      }) as TeamMember[];
    },
    enabled: !!profile?.company_id
  });

  // Add team member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (memberData: typeof newMember) => {
      if (!profile?.company_id) throw new Error('No company ID');

      // First create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: memberData.email,
        password: Math.random().toString(36).slice(-8) + 'A1!', // Generate temp password
        options: {
          data: {
            first_name: memberData.first_name,
            last_name: memberData.last_name,
            user_type: memberData.role
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      // Add to user_companies
      const { error: companyError } = await supabase
        .from('user_companies')
        .insert({
          user_id: authData.user.id,
          company_id: profile.company_id,
          role: memberData.role
        });

      if (companyError) throw companyError;

      // Send credentials email
      const { error: emailError } = await supabase.functions.invoke('resend-driver-credentials', {
        body: { email: memberData.email }
      });

      if (emailError) {
        
        // Don't throw here as the user was still created successfully
      }

      return authData.user;
    },
    onSuccess: () => {
      toast({
        title: "Team member added",
        description: "The team member has been added and will receive login credentials via email.",
      });
      setIsAddModalOpen(false);
      setNewMember({
        first_name: '',
        last_name: '',
        email: '',
        role: 'supervisor'
      });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding team member",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Remove team member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Remove from user_companies
      const { error } = await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', profile?.company_id);

      if (error) throw error;

      // Deactivate the profile
      await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('user_id', userId);
    },
    onSuccess: () => {
      toast({
        title: "Team member removed",
        description: "The team member has been removed from your company.",
      });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing team member",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addMemberMutation.mutateAsync(newMember);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default" className="flex items-center gap-1"><Shield className="h-3 w-3" />Admin</Badge>;
      case 'supervisor':
        return <Badge variant="secondary" className="flex items-center gap-1"><Users className="h-3 w-3" />Supervisor</Badge>;
      default:
        return <Badge variant="outline" className="flex items-center gap-1"><User className="h-3 w-3" />Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage your company's staff members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="logistics-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your company's admin and supervisor staff
            </CardDescription>
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add a new admin or supervisor to your team. They will receive login credentials via email.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      value={newMember.first_name}
                      onChange={(e) => setNewMember({ ...newMember, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      value={newMember.last_name}
                      onChange={(e) => setNewMember({ ...newMember, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newMember.role} 
                    onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Supervisor Role:</strong> Can access dashboard, driver management, van management, round management, schedule view, and EOD reports only.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Member'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {teamMembers && teamMembers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.first_name} {member.last_name}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{getRoleBadge(member.role)}</TableCell>
                  <TableCell>
                    <Badge variant={member.is_active ? "default" : "secondary"}>
                      {member.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMemberMutation.mutate(member.user_id)}
                      disabled={removeMemberMutation.isPending}
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No team members yet</p>
            <p className="text-sm text-muted-foreground">Add supervisors or admins to help manage your operations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamManagement;