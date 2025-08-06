import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, Package, Calculator, Camera, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const EndOfDay = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    deliveredCount: '',
    notes: ''
  });

  const today = new Date().toISOString().split('T')[0];

  // Get driver profile
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });

  // Get today's log
  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['today-log', driverProfile?.id, today],
    queryFn: async () => {
      if (!driverProfile?.id) return null;
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('log_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!driverProfile?.id
  });

  // Get round info for pay calculation
  const { data: roundInfo } = useQuery({
    queryKey: ['round-info', todayLog?.round_id],
    queryFn: async () => {
      if (!todayLog?.round_id) return null;
      const { data } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', todayLog.round_id)
        .maybeSingle();
      return data;
    },
    enabled: !!todayLog?.round_id
  });

  // Calculate estimated pay
  const calculatePay = () => {
    const deliveredCount = parseInt(formData.deliveredCount) || todayLog?.eod_delivered_count || 0;
    let totalPay = 0;

    // Base rate from round
    if (roundInfo?.base_rate) {
      totalPay += parseFloat(roundInfo.base_rate);
    }

    // Parcel rate
    const parcelRate = roundInfo?.parcel_rate || driverProfile?.parcel_rate;
    if (parcelRate && deliveredCount) {
      totalPay += parseFloat(parcelRate) * deliveredCount;
    }

    return totalPay.toFixed(2);
  };

  // End of day mutation
  const endDayMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!todayLog?.id) {
        throw new Error('No active log found for today');
      }

      const estimatedPay = calculatePay();

      const { error } = await supabase
        .from('daily_logs')
        .update({
          eod_delivered_count: parseInt(data.deliveredCount),
          eod_notes: data.notes,
          eod_timestamp: new Date().toISOString(),
          estimated_pay: parseFloat(estimatedPay),
          status: 'completed'
        })
        .eq('id', todayLog.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "End of day completed",
        description: "Your shift has been completed successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['today-log'] });
      navigate('/dashboard');
    },
    onError: (error) => {
      toast({
        title: "Error completing day",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.deliveredCount) {
      toast({
        title: "Missing information",
        description: "Please enter the number of deliveries completed",
        variant: "destructive",
      });
      return;
    }
    endDayMutation.mutate(formData);
  };

  const isAlreadyCompleted = todayLog?.eod_timestamp;
  const hasStarted = todayLog?.sod_timestamp;

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading...</p>
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
                <h1 className="text-xl font-semibold text-foreground">End of Day</h1>
                <p className="text-sm text-muted-foreground">Complete your delivery shift</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {!hasStarted && (
              <Card className="logistics-card border-warning/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-warning">
                    <Clock className="h-5 w-5 mr-2" />
                    Day Not Started
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    You haven't started your day yet. Please complete your start of day log first.
                  </p>
                  <Button onClick={() => navigate('/driver/start-of-day')}>
                    Start My Day
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Day Summary */}
            {hasStarted && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 text-primary mr-2" />
                    Today's Summary
                    {isAlreadyCompleted && (
                      <Badge variant="default" className="ml-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {new Date().toLocaleDateString('en-GB', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-2xl font-bold text-gradient">
                        {todayLog?.sod_parcel_count || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Parcels Assigned</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-2xl font-bold text-success">
                        {todayLog?.eod_delivered_count || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Delivered</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-2xl font-bold text-gradient">
                        {todayLog?.sod_parcel_count ? 
                          Math.round(((todayLog?.eod_delivered_count || 0) / todayLog.sod_parcel_count) * 100) : 0}%
                      </div>
                      <div className="text-sm text-muted-foreground">Completion Rate</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-card/50">
                      <div className="text-2xl font-bold text-gradient">
                        {todayLog?.sod_timestamp && todayLog?.eod_timestamp ? 
                          Math.round((new Date(todayLog.eod_timestamp).getTime() - new Date(todayLog.sod_timestamp).getTime()) / (1000 * 60 * 60 * 10)) / 100 :
                          todayLog?.sod_timestamp ? 
                          Math.round((new Date().getTime() - new Date(todayLog.sod_timestamp).getTime()) / (1000 * 60 * 60 * 10)) / 100 : 0
                        }h
                      </div>
                      <div className="text-sm text-muted-foreground">Hours Worked</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pay Estimate */}
            {hasStarted && (
              <Card className="logistics-card bg-gradient-dark">
                <CardHeader>
                  <CardTitle className="flex items-center text-gradient">
                    <Calculator className="h-5 w-5 text-primary mr-2" />
                    Pay Estimate
                  </CardTitle>
                  <CardDescription>
                    Estimated earnings for today's shift
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="text-4xl font-bold text-gradient mb-2">
                      £{isAlreadyCompleted ? todayLog?.estimated_pay || '0.00' : calculatePay()}
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">Estimated Total Pay</div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-lg font-semibold">
                          £{roundInfo?.base_rate || driverProfile?.hourly_rate || '0.00'}
                        </div>
                        <div className="text-sm text-muted-foreground">Base Rate</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-card/50">
                        <div className="text-lg font-semibold">
                          £{roundInfo?.parcel_rate || driverProfile?.parcel_rate || '0.00'}
                        </div>
                        <div className="text-sm text-muted-foreground">Per Parcel</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* End of Day Form */}
            {hasStarted && !isAlreadyCompleted && (
              <Card className="logistics-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                    Complete Your Day
                  </CardTitle>
                  <CardDescription>
                    Enter your final delivery count and any notes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="deliveredCount">
                        Deliveries Completed <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="deliveredCount"
                        type="number"
                        value={formData.deliveredCount}
                        onChange={(e) => setFormData(prev => ({ ...prev, deliveredCount: e.target.value }))}
                        placeholder="Enter number of successful deliveries"
                        max={todayLog?.sod_parcel_count}
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Maximum: {todayLog?.sod_parcel_count || 0} parcels
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="screenshot">Delivery Screenshot</Label>
                      <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                        <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload proof of delivery screenshot
                        </p>
                        <Button variant="outline" size="sm" type="button">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Screenshot
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="notes">End of Day Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Any issues, incidents, or notes about your delivery day..."
                        rows={3}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="logistics-button w-full"
                      disabled={endDayMutation.isPending}
                      size="lg"
                    >
                      {endDayMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Completing Day...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete My Day
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Completed Day Summary */}
            {isAlreadyCompleted && (
              <Card className="logistics-card border-success/50">
                <CardHeader>
                  <CardTitle className="flex items-center text-success">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Day Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Completed At</Label>
                        <p className="text-lg">
                          {new Date(todayLog.eod_timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Final Pay</Label>
                        <p className="text-lg font-semibold text-success">
                          £{todayLog.estimated_pay || '0.00'}
                        </p>
                      </div>
                    </div>
                    
                    {todayLog.eod_notes && (
                      <div className="p-4 bg-muted rounded-lg">
                        <Label className="text-sm font-medium">End of Day Notes:</Label>
                        <p className="text-sm mt-1">{todayLog.eod_notes}</p>
                      </div>
                    )}
                    
                    <div className="text-center pt-4">
                      <p className="text-muted-foreground">
                        Great job today! Your pay will be processed and available in your next payroll.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default EndOfDay;