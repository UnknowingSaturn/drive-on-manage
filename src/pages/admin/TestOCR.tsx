import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const TestOCR = () => {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [roundNumber, setRoundNumber] = useState('R001');
  const [driverName, setDriverName] = useState('Test Driver');
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Load available drivers when component mounts
  React.useEffect(() => {
    const loadDrivers = async () => {
      if (!profile?.user_companies?.[0]?.company_id) return;
      
      // For admin testing, create a mock driver entry
      const mockDrivers = [{
        id: 'a76bd5c0-3425-4ba7-a9cf-ce4cd032b81f', // Known driver ID from your company
        profiles: { first_name: 'Mark', last_name: 'Ikahu' }
      }];
      
      setAvailableDrivers(mockDrivers);
      setSelectedDriverId(mockDrivers[0].id);
    };
    
    loadDrivers();
  }, [profile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    }
  };

  const processScreenshot = async () => {
    if (!file || !profile || !selectedDriverId) {
      toast.error('Please select a file, driver, and ensure you are logged in');
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `test-${Date.now()}.${fileExt}`;
      const filePath = `${profile.user_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('sod-screenshots')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create a test SOD report entry
      const { data: reportData, error: reportError } = await supabase
        .from('start_of_day_reports')
        .insert({
          driver_id: selectedDriverId, // Use selected driver ID
          company_id: profile.user_companies[0].company_id,
          name: driverName,
          round_number: roundNumber,
          screenshot_url: filePath,
          processing_status: 'processing'
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Call Vision OCR function
      const { data: ocrResult, error: ocrError } = await supabase.functions
        .invoke('vision-ocr', {
          body: {
            screenshotPath: filePath,
            reportId: reportData.id
          }
        });

      if (ocrError) throw ocrError;

      // Get the updated report data
      const { data: updatedReport } = await supabase
        .from('start_of_day_reports')
        .select('*')
        .eq('id', reportData.id)
        .single();

      setResult({
        ocrResult,
        reportData: updatedReport
      });

      toast.success('Screenshot processed successfully!');
    } catch (error: any) {
      console.error('OCR processing error:', error);
      toast.error(`Processing failed: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test OCR Processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driver">Test Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a driver" />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.profiles.first_name} {driver.profiles.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="driverName">Display Name</Label>
              <Input
                id="driverName"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Enter display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roundNumber">Round Number</Label>
              <Input
                id="roundNumber"
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
                placeholder="Enter round number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshot">Upload Screenshot</Label>
            <div className="flex items-center space-x-4">
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
              />
              {file && (
                <Badge variant="outline">
                  {file.name}
                </Badge>
              )}
            </div>
          </div>

          {previewUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border rounded-lg p-4 flex justify-center">
                <img 
                  src={previewUrl} 
                  alt="Screenshot preview" 
                  className="max-h-64 object-contain"
                />
              </div>
            </div>
          )}

          <Button 
            onClick={processScreenshot} 
            disabled={!file || !selectedDriverId || processing}
            className="w-full"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Process Screenshot
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>OCR Response</Label>
                <Textarea
                  value={JSON.stringify(result.ocrResult, null, 2)}
                  readOnly
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              {result.reportData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-primary">{result.reportData.heavy_parcels || 0}</div>
                    <div className="text-sm text-muted-foreground">Heavy Parcels</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-primary">{result.reportData.standard || 0}</div>
                    <div className="text-sm text-muted-foreground">Standard</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-primary">{result.reportData.hanging_garments || 0}</div>
                    <div className="text-sm text-muted-foreground">Hanging Garments</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-primary">{result.reportData.packets || 0}</div>
                    <div className="text-sm text-muted-foreground">Packets</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-primary">{result.reportData.small_packets || 0}</div>
                    <div className="text-sm text-muted-foreground">Small Packets</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-2xl font-bold text-primary">{result.reportData.postables || 0}</div>
                    <div className="text-sm text-muted-foreground">Postables</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <Badge variant={result.reportData.processing_status === 'completed' ? 'default' : 'destructive'}>
                      {result.reportData.processing_status}
                    </Badge>
                    <div className="text-sm text-muted-foreground">Status</div>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <div className="text-sm font-mono">{result.reportData.extracted_round_number || 'None'}</div>
                    <div className="text-sm text-muted-foreground">Detected Round</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TestOCR;