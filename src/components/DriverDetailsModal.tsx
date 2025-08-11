import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, FileText, User, Phone, Car, Shield, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DriverDetailsModalProps {
  driver: any;
  isOpen: boolean;
  onClose: () => void;
}

export const DriverDetailsModal: React.FC<DriverDetailsModalProps> = ({ driver, isOpen, onClose }) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownloadDocument = async (documentPath: string, documentName: string) => {
    try {
      setDownloading(documentPath);
      
      const { data, error } = await supabase.storage
        .from('driver-documents')
        .download(documentPath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Document downloaded",
        description: "The document has been downloaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Failed to download document.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const getDocumentStatus = (documentPath: string | null) => {
    if (!documentPath) {
      return { status: 'missing', color: 'destructive' as const, icon: AlertCircle };
    }
    return { status: 'uploaded', color: 'default' as const, icon: CheckCircle2 };
  };

  if (!driver) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>{driver.name} - Driver Details</span>
          </DialogTitle>
          <DialogDescription>
            Complete driver information and onboarding status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Onboarding Status</span>
                </span>
                <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                  {driver.status === 'active' ? 'Active' : 'Pending First Login'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="font-medium">Account Created:</span> {' '}
                    {format(new Date(driver.created_at), 'PPp')}
                  </span>
                </div>
                
                {driver.onboardingCompletedAt && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      <span className="font-medium">Onboarding Completed:</span> {' '}
                      {format(new Date(driver.onboardingCompletedAt), 'PPp')}
                    </span>
                  </div>
                )}
              </div>
              
              {!driver.first_login_completed && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Driver has not completed first login and onboarding</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Personal Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p className="text-sm">{driver.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{driver.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm">{driver.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge variant={driver.isActive ? 'default' : 'secondary'} className="mt-1">
                    {driver.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* License Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Car className="h-5 w-5" />
                <span>Driving License</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">License Number</label>
                  <p className="text-sm">{driver.driving_license_number || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                  <p className="text-sm">
                    {driver.license_expiry ? format(new Date(driver.license_expiry), 'PP') : 'Not provided'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Required Documents</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Driving License Document */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Driving License</p>
                    <p className="text-xs text-muted-foreground">Uploaded license document</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={getDocumentStatus(driver.driving_license_document).color}
                    className="text-xs"
                  >
                    {getDocumentStatus(driver.driving_license_document).status === 'uploaded' ? 'Uploaded' : 'Missing'}
                  </Badge>
                  {driver.driving_license_document && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(driver.driving_license_document, 'driving_license.pdf')}
                      disabled={downloading === driver.driving_license_document}
                    >
                      {downloading === driver.driving_license_document ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Right to Work Document */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Right to Work</p>
                    <p className="text-xs text-muted-foreground">Work authorization document</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={getDocumentStatus(driver.right_to_work_document).color}
                    className="text-xs"
                  >
                    {getDocumentStatus(driver.right_to_work_document).status === 'uploaded' ? 'Uploaded' : 'Missing'}
                  </Badge>
                  {driver.right_to_work_document && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(driver.right_to_work_document, 'right_to_work.pdf')}
                      disabled={downloading === driver.right_to_work_document}
                    >
                      {downloading === driver.right_to_work_document ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Insurance Document */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Insurance Certificate</p>
                    <p className="text-xs text-muted-foreground">Driving insurance document</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={getDocumentStatus(driver.insurance_document).color}
                    className="text-xs"
                  >
                    {getDocumentStatus(driver.insurance_document).status === 'uploaded' ? 'Uploaded' : 'Missing'}
                  </Badge>
                  {driver.insurance_document && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocument(driver.insurance_document, 'insurance.pdf')}
                      disabled={downloading === driver.insurance_document}
                    >
                      {downloading === driver.insurance_document ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          {(driver.emergency_contact_name || driver.emergency_contact_phone) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5" />
                  <span>Emergency Contact</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                    <p className="text-sm">{driver.emergency_contact_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                    <p className="text-sm">{driver.emergency_contact_phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Relationship</label>
                    <p className="text-sm">{driver.emergency_contact_relation || 'Not provided'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vehicle Notes */}
          {driver.vehicle_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Car className="h-5 w-5" />
                  <span>Vehicle & Route Notes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{driver.vehicle_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};