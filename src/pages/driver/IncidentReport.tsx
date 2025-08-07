import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Camera, Upload, Clock, MapPin, CheckCircle2, Phone } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeInput, sanitizeHtml } from '@/lib/security';

const IncidentReport = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    incidentType: '',
    location: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

  // Get driver's incident reports
  const { data: incidentReports, isLoading } = useQuery({
    queryKey: ['incident-reports', driverProfile?.id],
    queryFn: async () => {
      if (!driverProfile?.id) return [];
      const { data } = await supabase
        .from('incident_reports')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!driverProfile?.id
  });

  // Input validation with security checks
  const validateIncidentData = (data: typeof formData) => {
    const errors: Record<string, string> = {};
    
    if (!data.incidentType.trim()) {
      errors.incidentType = 'Incident type is required';
    }
    
    if (!data.description.trim()) {
      errors.description = 'Description is required';
    } else if (data.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    } else if (data.description.length > 1000) {
      errors.description = 'Description must be less than 1000 characters';
    }
    
    if (!data.location.trim()) {
      errors.location = 'Location is required';
    } else if (data.location.length > 255) {
      errors.location = 'Location must be less than 255 characters';
    }
    
    return errors;
  };

  // Submit incident report mutation with enhanced security
  const submitIncidentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!driverProfile?.id || !profile?.company_id) {
        throw new Error('Driver profile not found');
      }

      // Validate input data
      const validationErrors = validateIncidentData(data);
      if (Object.keys(validationErrors).length > 0) {
        setFormErrors(validationErrors);
        throw new Error('Please fix validation errors');
      }

      // Sanitize inputs to prevent XSS attacks
      const sanitizedData = {
        incidentType: sanitizeInput(data.incidentType),
        location: sanitizeInput(data.location),
        description: sanitizeHtml(data.description) // Allow basic formatting but sanitize
      };

      const incidentData = {
        driver_id: driverProfile.id,
        company_id: profile.company_id,
        incident_type: sanitizedData.incidentType,
        location: sanitizedData.location,
        description: sanitizedData.description,
        incident_date: new Date().toISOString(),
        status: 'reported'
      };

      const { error } = await supabase
        .from('incident_reports')
        .insert(incidentData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Incident reported successfully",
        description: "Your incident has been submitted and will be reviewed by management.",
      });
      queryClient.invalidateQueries({ queryKey: ['incident-reports'] });
      // Reset form
      setFormData({
        incidentType: '',
        location: '',
        description: ''
      });
      setFormErrors({});
    },
    onError: (error) => {
      toast({
        title: "Error submitting incident",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitIncidentMutation.mutate(formData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'secondary';
      case 'investigating': return 'secondary';
      case 'resolved': return 'default';
      case 'closed': return 'secondary';
      default: return 'secondary';
    }
  };

  const incidentTypes = [
    'Vehicle Accident',
    'Traffic Incident',
    'Vehicle Breakdown',
    'Theft/Security',
    'Customer Complaint',
    'Delivery Issue',
    'Health & Safety',
    'Property Damage',
    'Road Traffic Violation',
    'Other'
  ];

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
                <h1 className="text-xl font-semibold text-foreground">Incident Report</h1>
                <p className="text-sm text-muted-foreground">Report incidents and track their status</p>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Emergency Contact Info */}
            <Card className="logistics-card border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center text-destructive">
                  <Phone className="h-5 w-5 mr-2" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Emergency Services</Label>
                    <p className="text-lg font-bold text-destructive">999</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Company Emergency Line</Label>
                    <p className="text-lg font-bold">0800 123 4567</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  For serious incidents, call emergency services first, then report through this system.
                </p>
              </CardContent>
            </Card>

            {/* Incident Report Form */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-warning mr-2" />
                  Report New Incident
                </CardTitle>
                <CardDescription>
                  Provide details about the incident that occurred
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="incidentType">
                        Incident Type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.incidentType}
                        onValueChange={(value) => handleInputChange('incidentType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select incident type" />
                        </SelectTrigger>
                        <SelectContent>
                          {incidentTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formErrors.incidentType && (
                        <p className="text-sm text-destructive">{formErrors.incidentType}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location">
                        Location <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="Where did the incident occur?"
                        className={formErrors.location ? 'border-destructive' : ''}
                        maxLength={255}
                        required
                      />
                      {formErrors.location && (
                        <p className="text-sm text-destructive">{formErrors.location}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Provide a detailed description of what happened... (10-1000 characters)"
                      rows={4}
                      required
                      maxLength={1000}
                      className={formErrors.description ? 'border-destructive' : ''}
                    />
                    {formErrors.description && (
                      <p className="text-sm text-destructive">{formErrors.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formData.description.length}/1000 characters
                    </p>
                  </div>

                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <Label>Photos/Evidence</Label>
                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                      <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload photos of the incident, damage, or relevant evidence
                      </p>
                      <Button variant="outline" size="sm" type="button">
                        <Upload className="h-4 w-4 mr-2" />
                        Add Photos
                      </Button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full border-warning/30 text-warning hover:bg-warning/10"
                    variant="outline"
                    disabled={submitIncidentMutation.isPending}
                    size="lg"
                  >
                    {submitIncidentMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Submitting Report...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Submit Incident Report
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Previous Incidents */}
            <Card className="logistics-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 text-primary mr-2" />
                  Your Incident Reports
                </CardTitle>
                <CardDescription>
                  Track the status of your submitted incidents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {incidentReports.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                    <p className="text-muted-foreground">No incidents reported. Keep up the safe driving!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incidentReports.map((incident) => (
                      <div key={incident.id} className="p-4 border rounded-lg bg-card/50">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="h-4 w-4 text-warning" />
                              <span className="font-medium">{incident.incident_type}</span>
                              <Badge variant={getStatusColor(incident.status)}>
                                {incident.status}
                              </Badge>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              {incident.location}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(incident.incident_date).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {incident.description}
                        </p>
                        
                        {incident.admin_notes && (
                          <div className="mt-3 p-3 bg-muted rounded-lg">
                            <Label className="text-sm font-medium">Admin Response:</Label>
                            <p className="text-sm mt-1">{incident.admin_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default IncidentReport;