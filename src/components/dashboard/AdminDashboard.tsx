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
  UserCheck,
  Bell
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Company Overview */}
        <Card className="saas-card">
          <CardHeader className="saas-card-header">
            <CardTitle className="saas-heading flex items-center">
              <Users className="h-5 w-5 text-primary mr-2" />
              Company Overview
            </CardTitle>
            <CardDescription>Real-time company metrics</CardDescription>
          </CardHeader>
          <CardContent className="saas-card-content">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold text-primary">{stats.activeDrivers}</div>
                <div className="text-xs text-muted-foreground">Active Drivers</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold text-success">{stats.completedEODs}</div>
                <div className="text-xs text-muted-foreground">Rounds Completed</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold text-info">{stats.totalVans}</div>
                <div className="text-xs text-muted-foreground">Fleet Size</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold text-warning">{stats.totalIncidents}</div>
                <div className="text-xs text-muted-foreground">Incidents</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Performance */}
        <Card className="saas-card">
          <CardHeader className="saas-card-header">
            <CardTitle className="saas-heading flex items-center">
              <TrendingUp className="h-5 w-5 text-primary mr-2" />
              Driver Performance
            </CardTitle>
            <CardDescription>Last 7 days performance</CardDescription>
          </CardHeader>
          <CardContent className="saas-card-content">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Deliveries</span>
                <span className="font-bold text-success">{deliveriesThisWeek}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="font-bold text-primary">{successRate.toFixed(1)}%</span>
              </div>
              <Progress value={successRate} className="h-2" />
              <Button 
                onClick={() => navigate('/admin/driver-engagement')}
                variant="outline" 
                size="sm"
                className="w-full"
              >
                View Analytics
              </Button>
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
            <CardDescription>Monthly financial snapshot</CardDescription>
          </CardHeader>
          <CardContent className="saas-card-content">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Operating Costs</span>
                <span className="font-bold text-destructive">£{stats.monthlyOperatingCosts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Driver Earnings</span>
                <span className="font-bold text-success">£{(deliveriesThisWeek * 0.75).toFixed(2)}</span>
              </div>
              <Button 
                onClick={() => navigate('/admin/finance')}
                variant="outline" 
                size="sm"
                className="w-full"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View P&L
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Schedule & Round Assignment */}
        <Card className="saas-card">
          <CardHeader className="saas-card-header">
            <CardTitle className="saas-heading flex items-center">
              <Calendar className="h-5 w-5 text-primary mr-2" />
              Schedule & Routes
            </CardTitle>
            <CardDescription>Assignment management</CardDescription>
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
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground text-center">
                  {drivers.filter(d => d.assigned_van_id).length} of {stats.totalDrivers} drivers assigned
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Document Status */}
        <Card className="saas-card">
          <CardHeader className="saas-card-header">
            <CardTitle className="saas-heading flex items-center">
              <UserCheck className="h-5 w-5 text-primary mr-2" />
              Onboarding Status
            </CardTitle>
            <CardDescription>Driver document verification</CardDescription>
          </CardHeader>
          <CardContent className="saas-card-content">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Onboarding</span>
                <Badge variant={stats.pendingOnboarding > 0 ? "destructive" : "default"}>
                  {stats.pendingOnboarding}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Documents Missing</span>
                <Badge variant="secondary">
                  {drivers.filter(d => !d.driving_license_document || !d.insurance_document).length}
                </Badge>
              </div>
              <Button 
                onClick={() => navigate('/admin/drivers')}
                variant="outline" 
                size="sm"
                className="w-full"
              >
                Manage Drivers
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* News & Chat Manager */}
        <Card className="saas-card">
          <CardHeader className="saas-card-header">
            <CardTitle className="saas-heading flex items-center">
              <MessageCircle className="h-5 w-5 text-primary mr-2" />
              Communication Hub
            </CardTitle>
            <CardDescription>News and chat management</CardDescription>
          </CardHeader>
          <CardContent className="saas-card-content">
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/admin/driver-engagement')}
                variant="outline" 
                size="sm"
                className="w-full justify-start"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Driver Chat
              </Button>
              <Button 
                onClick={() => navigate('/admin/companies')}
                variant="outline" 
                size="sm"
                className="w-full justify-start"
              >
                <Bell className="h-4 w-4 mr-2" />
                Send Announcement
              </Button>
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground text-center">
                  Last message: {format(new Date(), 'MMM dd, HH:mm')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="saas-card md:col-span-2 lg:col-span-3">
          <CardHeader className="saas-card-header">
            <CardTitle className="saas-heading flex items-center">
              <Clock className="h-5 w-5 text-primary mr-2" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest end-of-day reports and driver activity</CardDescription>
          </CardHeader>
          <CardContent className="saas-card-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentEODs.slice(0, 6).map((eod: any) => (
                <div key={eod.id} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {eod.driver_profiles?.first_name} {eod.driver_profiles?.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {eod.successful_deliveries} deliveries • {format(new Date(eod.submitted_at), 'HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
              {recentEODs.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No recent activity
                </div>
              )}
            </div>
            <div className="mt-4">
              <Button 
                onClick={() => navigate('/admin/eod-reports')}
                variant="outline" 
                size="sm"
                className="w-full"
              >
                View All Reports
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Alerts */}
        {(stats.criticalIncidents > 0 || stats.pendingOnboarding > 3) && (
          <Card className="saas-card border-destructive/50 md:col-span-2 lg:col-span-3">
            <CardHeader className="saas-card-header">
              <CardTitle className="saas-heading flex items-center text-destructive">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent className="saas-card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.criticalIncidents > 0 && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <div className="font-medium text-destructive">Critical Incidents</div>
                    <div className="text-sm text-muted-foreground">
                      {stats.criticalIncidents} incident(s) require immediate attention
                    </div>
                  </div>
                )}
                {stats.pendingOnboarding > 3 && (
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <div className="font-medium text-warning">Onboarding Backlog</div>
                    <div className="text-sm text-muted-foreground">
                      {stats.pendingOnboarding} driver(s) pending onboarding completion
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;