import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Package, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  TrendingUp,
  MessageCircle,
  FileText,
  CheckCircle2,
  Clock,
  Truck,
  BarChart3,
  Settings,
  UserCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Get company drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['company-drivers', profile?.user_companies],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];
      const companyIds = profile.user_companies.map(uc => uc.company_id);
      const { data } = await supabase
        .rpc('get_drivers_with_profiles', { company_ids: companyIds });
      return data || [];
    },
    enabled: !!profile?.user_companies?.length
  });

  // Get recent EOD reports
  const { data: recentEODs = [] } = useQuery({
    queryKey: ['recent-eods', profile?.user_companies],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];
      const companyIds = profile.user_companies.map(uc => uc.company_id);
      const { data } = await supabase
        .from('end_of_day_reports')
        .select(`
          *,
          driver_profiles!inner(first_name, last_name, user_id)
        `)
        .in('driver_id', drivers.map(d => d.id))
        .gte('submitted_at', subDays(today, 7).toISOString())
        .order('submitted_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!drivers.length
  });

  // Get incident reports
  const { data: incidents = [] } = useQuery({
    queryKey: ['recent-incidents', profile?.user_companies],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];
      const companyIds = profile.user_companies.map(uc => uc.company_id);
      const { data } = await supabase
        .from('incident_reports')
        .select('*')
        .in('company_id', companyIds)
        .gte('created_at', subDays(today, 30).toISOString())
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.user_companies?.length
  });

  // Get company vans
  const { data: vans = [] } = useQuery({
    queryKey: ['company-vans', profile?.user_companies],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];
      const companyIds = profile.user_companies.map(uc => uc.company_id);
      const { data } = await supabase
        .from('vans')
        .select('*')
        .in('company_id', companyIds)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!profile?.user_companies?.length
  });

  // Get operating costs for this month
  const { data: monthlyOperatingCosts = [] } = useQuery({
    queryKey: ['monthly-operating-costs', profile?.user_companies, monthStart.toISOString()],
    queryFn: async () => {
      if (!profile?.user_companies?.length) return [];
      const companyIds = profile.user_companies.map(uc => uc.company_id);
      const { data } = await supabase
        .from('operating_costs')
        .select('*')
        .in('company_id', companyIds)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0]);
      return data || [];
    },
    enabled: !!profile?.user_companies?.length
  });

  // Calculate stats
  const stats = {
    totalDrivers: drivers.length,
    activeDrivers: drivers.filter(d => d.first_login_completed).length,
    pendingOnboarding: drivers.filter(d => !d.first_login_completed).length,
    completedEODs: recentEODs.length,
    totalIncidents: incidents.length,
    criticalIncidents: incidents.filter(i => i.status === 'reported').length,
    totalVans: vans.length,
    monthlyOperatingCosts: monthlyOperatingCosts.reduce((sum, cost) => sum + Number(cost.amount), 0)
  };

  const deliveriesThisWeek = recentEODs.reduce((sum, eod) => sum + (eod.successful_deliveries || 0), 0);
  const successRate = recentEODs.length > 0 ? 
    (recentEODs.filter(eod => eod.successful_deliveries > 0).length / recentEODs.length * 100) : 0;

  return (
    <div className="saas-main">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="saas-title">Admin Dashboard</h1>
        <p className="saas-subtitle">
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="saas-card-compact">
          <div className="saas-metric">
            <div className="saas-metric-value text-primary">{stats.totalDrivers}</div>
            <div className="saas-metric-label">Total Drivers</div>
          </div>
        </Card>
        <Card className="saas-card-compact">
          <div className="saas-metric">
            <div className="saas-metric-value text-success">{stats.activeDrivers}</div>
            <div className="saas-metric-label">Active Drivers</div>
          </div>
        </Card>
        <Card className="saas-card-compact">
          <div className="saas-metric">
            <div className="saas-metric-value text-info">{deliveriesThisWeek}</div>
            <div className="saas-metric-label">Deliveries (7 days)</div>
          </div>
        </Card>
        <Card className="saas-card-compact">
          <div className="saas-metric">
            <div className="saas-metric-value text-warning">{stats.totalIncidents}</div>
            <div className="saas-metric-label">Incidents (30 days)</div>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Operations */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Driver Performance */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <TrendingUp className="h-5 w-5 text-primary mr-2" />
                Driver Performance
              </CardTitle>
              <CardDescription className="saas-subtitle">Last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-success">{deliveriesThisWeek}</div>
                  <div className="text-sm text-muted-foreground">Total Deliveries</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{successRate.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-info">{stats.completedEODs}</div>
                  <div className="text-sm text-muted-foreground">EOD Reports</div>
                </div>
              </div>
              <div className="mt-4">
                <Button 
                  onClick={() => navigate('/admin/driver-engagement')}
                  variant="outline" 
                  size="sm"
                  className="w-full"
                >
                  View Detailed Analytics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <Clock className="h-5 w-5 text-primary mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="space-y-3">
                {recentEODs.slice(0, 5).map((eod: any) => (
                  <div key={eod.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {eod.driver_profiles?.first_name} {eod.driver_profiles?.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {eod.successful_deliveries} deliveries completed
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(eod.submitted_at), 'HH:mm')}
                    </div>
                  </div>
                ))}
                {recentEODs.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No recent activity
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fleet Overview */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <Truck className="h-5 w-5 text-primary mr-2" />
                Fleet Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalVans}</div>
                  <div className="text-sm text-muted-foreground">Active Vans</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{drivers.filter(d => d.assigned_van_id).length}</div>
                  <div className="text-sm text-muted-foreground">Assigned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.totalVans - drivers.filter(d => d.assigned_van_id).length}</div>
                  <div className="text-sm text-muted-foreground">Available</div>
                </div>
              </div>
              <div className="mt-4">
                <Button 
                  onClick={() => navigate('/admin/van-management')}
                  variant="outline" 
                  size="sm"
                  className="w-full"
                >
                  Manage Fleet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Management & Quick Actions */}
        <div className="space-y-6">
          
          {/* Pending Tasks */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <UserCheck className="h-5 w-5 text-primary mr-2" />
                Pending Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Driver Onboarding</span>
                  <Badge variant={stats.pendingOnboarding > 0 ? "destructive" : "default"}>
                    {stats.pendingOnboarding}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Critical Incidents</span>
                  <Badge variant={stats.criticalIncidents > 0 ? "destructive" : "default"}>
                    {stats.criticalIncidents}
                  </Badge>
                </div>
                <div className="pt-2">
                  <Button 
                    onClick={() => navigate('/admin/drivers')}
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    Manage Drivers
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Finance Overview */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <DollarSign className="h-5 w-5 text-primary mr-2" />
                Finance Overview
              </CardTitle>
              <CardDescription className="saas-subtitle">This month</CardDescription>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Operating Costs</span>
                  <span className="font-bold">£{stats.monthlyOperatingCosts.toFixed(2)}</span>
                </div>
                <div className="pt-2">
                  <Button 
                    onClick={() => navigate('/admin/finance')}
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Finance
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Management */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center">
                <Calendar className="h-5 w-5 text-primary mr-2" />
                Schedule & Routes
              </CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/admin/schedule-view')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  View Schedule
                </Button>
                <Button 
                  onClick={() => navigate('/admin/round-management')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Manage Rounds
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="saas-card">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading">Management Tools</CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/admin/companies')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Company Settings
                </Button>
                <Button 
                  onClick={() => navigate('/admin/eod-reports')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  EOD Reports
                </Button>
                <Button 
                  onClick={() => navigate('/admin/driver-engagement')}
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Driver Chat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Alerts */}
          {(stats.criticalIncidents > 0 || stats.pendingOnboarding > 3) && (
            <Card className="saas-card border-destructive/50">
              <CardHeader className="saas-card-header">
                <CardTitle className="saas-heading flex items-center text-destructive">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent className="saas-card-content">
                <div className="space-y-2">
                  {stats.criticalIncidents > 0 && (
                    <div className="text-sm">
                      {stats.criticalIncidents} critical incident(s) need review
                    </div>
                  )}
                  {stats.pendingOnboarding > 3 && (
                    <div className="text-sm">
                      {stats.pendingOnboarding} drivers pending onboarding
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;