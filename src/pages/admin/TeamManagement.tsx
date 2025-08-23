import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Truck } from 'lucide-react';
import DriversSection from '@/components/DriversSection';
import StaffSection from '@/components/StaffSection';

const TeamManagement = () => {
  const { user, profile } = useAuth();

  if (!user || !profile) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <p>Please log in to access team management.</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  // Allow admin and supervisor access
  const hasAccess = profile.user_type === 'admin' || profile.user_type === 'supervisor';
  
  if (!hasAccess) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <p>Access denied. Admin or supervisor privileges required.</p>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Team Management</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your drivers and staff members
                </p>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Tabs defaultValue="drivers" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="drivers" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Drivers
                </TabsTrigger>
                <TabsTrigger value="staff" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Staff
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="drivers">
                <DriversSection />
              </TabsContent>
              
              <TabsContent value="staff">
                <StaffSection />
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default TeamManagement;