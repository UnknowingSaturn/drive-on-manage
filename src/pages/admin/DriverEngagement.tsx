import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Star, Trophy, Receipt, TrendingUp, Users, Calendar, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const DriverEngagement = () => {
  const { profile } = useAuth();

  // Fetch all drivers in company
  const { data: drivers } = useQuery({
    queryKey: ['company-drivers', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          user_id,
          profiles(first_name, last_name)
        `)
        .eq('company_id', profile.company_id);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Fetch earnings data
  const { data: earningsData } = useQuery({
    queryKey: ['all-driver-earnings', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('driver_earnings')
        .select(`
          *,
          driver_profiles(
            id,
            profiles(first_name, last_name)
          )
        `)
        .eq('company_id', profile.company_id)
        .gte('earning_date', monthStart)
        .lte('earning_date', monthEnd)
        .order('earning_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Fetch route feedback
  const { data: feedbackData } = useQuery({
    queryKey: ['route-feedback-admin', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('route_feedback')
        .select(`
          *,
          driver_profiles(
            id,
            profiles(first_name, last_name)
          ),
          rounds(round_number, description)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Fetch achievements
  // Achievements removed - using empty array
  const achievementsData: any[] = [];

  // Fetch expenses
  const { data: expensesData } = useQuery({
    queryKey: ['driver-expenses-admin', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      const { data, error } = await supabase
        .from('driver_expenses')
        .select(`
          *,
          driver_profiles(
            id,
            profiles(first_name, last_name)
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Calculate summary stats
  const totalEarnings = earningsData?.reduce((sum, e) => sum + Number(e.total_earnings), 0) || 0;
  const avgRouteRating = feedbackData?.length ? 
    feedbackData.reduce((sum, f) => sum + (f.route_difficulty + f.traffic_rating + f.depot_experience) / 3, 0) / feedbackData.length : 0;
  const totalAchievements = 0; // Achievements system removed
  const pendingExpenses = expensesData?.filter(e => e.is_approved === null).length || 0;

  const getDriverName = (driverProfile: any) => {
    const profile = driverProfile?.profiles;
    return profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown Driver';
  };

  const getStatusBadge = (isApproved: boolean | null) => {
    if (isApproved === null) return <Badge variant="secondary">Pending</Badge>;
    if (isApproved) return <Badge className="bg-green-600">Approved</Badge>;
    return <Badge variant="destructive">Rejected</Badge>;
  };

  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          }`}
        />
      ))}
    </div>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="flex items-center px-4 py-4">
              <SidebarTrigger className="mr-4" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Driver Engagement</h1>
                <p className="text-sm text-muted-foreground">Monitor driver performance, feedback, and engagement</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">£{totalEarnings.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Route Rating</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgRouteRating.toFixed(1)}/5</div>
                  <p className="text-xs text-muted-foreground">{feedbackData?.length || 0} reviews</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Achievements</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalAchievements}</div>
                  <p className="text-xs text-muted-foreground">Completed badges</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Expenses</CardTitle>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingExpenses}</div>
                  <p className="text-xs text-muted-foreground">Need approval</p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Views */}
            <Tabs defaultValue="earnings" className="space-y-4">
              <TabsList>
                <TabsTrigger value="earnings">Earnings</TabsTrigger>
                <TabsTrigger value="feedback">Route Feedback</TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
              </TabsList>

              <TabsContent value="earnings">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Driver Earnings</CardTitle>
                      <CardDescription>Monthly earnings breakdown by driver</CardDescription>
                    </div>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Base Pay</TableHead>
                          <TableHead>Parcel Pay</TableHead>
                          <TableHead>Bonuses</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {earningsData?.map((earning: any) => (
                          <TableRow key={earning.id}>
                            <TableCell>{getDriverName(earning.driver_profiles)}</TableCell>
                            <TableCell>{format(new Date(earning.earning_date), 'MMM dd, yyyy')}</TableCell>
                            <TableCell>£{Number(earning.base_pay || 0).toFixed(2)}</TableCell>
                            <TableCell>£{Number(earning.parcel_pay || 0).toFixed(2)}</TableCell>
                            <TableCell>£{Number(earning.bonus_pay || 0).toFixed(2)}</TableCell>
                            <TableCell className="font-medium">£{Number(earning.total_earnings).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="feedback">
                <Card>
                  <CardHeader>
                    <CardTitle>Route Feedback</CardTitle>
                    <CardDescription>Driver ratings and feedback on routes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Route Difficulty</TableHead>
                          <TableHead>Traffic</TableHead>
                          <TableHead>Depot Experience</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedbackData?.map((feedback: any) => (
                          <TableRow key={feedback.id}>
                            <TableCell>{getDriverName(feedback.driver_profiles)}</TableCell>
                            <TableCell>{format(new Date(feedback.feedback_date), 'MMM dd')}</TableCell>
                            <TableCell><StarRating rating={feedback.route_difficulty} /></TableCell>
                            <TableCell><StarRating rating={feedback.traffic_rating} /></TableCell>
                            <TableCell><StarRating rating={feedback.depot_experience} /></TableCell>
                            <TableCell className="max-w-xs truncate">{feedback.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="achievements">
                <Card>
                  <CardHeader>
                    <CardTitle>Driver Achievements</CardTitle>
                    <CardDescription>Badges and milestones earned by drivers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead>Achievement</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Earned Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {achievementsData?.map((achievement: any) => (
                          <TableRow key={achievement.id}>
                            <TableCell>{getDriverName(achievement.driver_profiles)}</TableCell>
                            <TableCell className="font-medium">{achievement.achievement_name}</TableCell>
                            <TableCell>{achievement.description}</TableCell>
                            <TableCell>
                              {achievement.is_completed ? (
                                <Badge className="bg-green-600">Completed</Badge>
                              ) : (
                                <span className="text-sm">{achievement.progress_value}/{achievement.target_value}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {achievement.is_completed 
                                ? format(new Date(achievement.earned_at), 'MMM dd, yyyy')
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expenses">
                <Card>
                  <CardHeader>
                    <CardTitle>Driver Expenses</CardTitle>
                    <CardDescription>Expense claims and approvals</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expensesData?.map((expense: any) => (
                          <TableRow key={expense.id}>
                            <TableCell>{getDriverName(expense.driver_profiles)}</TableCell>
                            <TableCell className="capitalize">{expense.expense_type}</TableCell>
                            <TableCell>£{Number(expense.amount).toFixed(2)}</TableCell>
                            <TableCell className="max-w-xs truncate">{expense.description || '-'}</TableCell>
                            <TableCell>{format(new Date(expense.expense_date), 'MMM dd')}</TableCell>
                            <TableCell>{getStatusBadge(expense.is_approved)}</TableCell>
                            <TableCell>
                              {expense.receipt_url ? (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                                    View
                                  </a>
                                </Button>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DriverEngagement;