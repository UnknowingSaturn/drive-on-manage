import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, Users, MapPin, Calendar, Bell } from 'lucide-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

const Dashboard = () => {
  const { user, profile } = useAuth();

  const isAdmin = profile?.user_type === 'admin';
  const isDriver = profile?.user_type === 'driver';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    {isAdmin ? 'Admin Dashboard' : 'Driver Dashboard'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Welcome back, {profile?.first_name || user?.email}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-6">
        {isAdmin && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Admin Dashboard</h2>
              <p className="text-muted-foreground">
                Manage your logistics operations from here
              </p>
            </div>

            {/* Admin Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    +2 from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Vans</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">
                    All vehicles operational
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Rounds</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">
                    18 completed, 6 in progress
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-muted-foreground">
                    Require your attention
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Driver Management</CardTitle>
                  <CardDescription>
                    Add, edit, and manage your driver workforce
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => window.location.href = '/admin/drivers'}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Drivers
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Management</CardTitle>
                  <CardDescription>
                    Track and maintain your fleet of vehicles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => window.location.href = '/admin/vans'}>
                    <Truck className="h-4 w-4 mr-2" />
                    Manage Vehicles
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Schedule & Rounds</CardTitle>
                  <CardDescription>
                    Plan and assign delivery rounds
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => window.location.href = '/admin/schedule'}>
                    <Calendar className="h-4 w-4 mr-2" />
                    View Schedule
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {isDriver && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Driver Dashboard</h2>
              <p className="text-muted-foreground">
                Your daily logistics operations
              </p>
            </div>

            {/* Driver Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Start of Day</CardTitle>
                  <CardDescription>
                    Log your parcel count and vehicle check
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Calendar className="h-4 w-4 mr-2" />
                    Start My Day
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>End of Day</CardTitle>
                  <CardDescription>
                    Complete your day and log deliveries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <MapPin className="h-4 w-4 mr-2" />
                    End My Day
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Check</CardTitle>
                  <CardDescription>
                    Perform and log your vehicle inspection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Truck className="h-4 w-4 mr-2" />
                    Vehicle Check
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Incident Report</CardTitle>
                  <CardDescription>
                    Report any incidents or issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    <Bell className="h-4 w-4 mr-2" />
                    Report Incident
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Today's Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Summary</CardTitle>
                <CardDescription>
                  Overview of your current shift
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">24</div>
                    <p className="text-sm text-muted-foreground">Parcels Assigned</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">18</div>
                    <p className="text-sm text-muted-foreground">Delivered</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">£120</div>
                    <p className="text-sm text-muted-foreground">Estimated Pay</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!profile && (
          <Card>
            <CardHeader>
              <CardTitle>Setting up your profile...</CardTitle>
              <CardDescription>
                Please wait while we configure your account
              </CardDescription>
            </CardHeader>
          </Card>
        )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;