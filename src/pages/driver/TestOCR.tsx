import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/PageLayout';

const DriverTestOCR = () => {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [roundNumber, setRoundNumber] = useState('R001');

  // Get driver profile
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', profile.user_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    }
  };

  const processScreenshot = async () => {
    if (!file || !profile || !driverProfile) {
      toast.error('Please select a file and ensure you are logged in');
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
          driver_id: driverProfile.id,
          company_id: driverProfile.company_id,
          name: `${profile.first_name} ${profile.last_name}`,
          round_number: roundNumber,
          screenshot_url: filePath,
          processing_status: 'processing'
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Call Vision OCR function
      console.log('Calling vision-ocr function with:', { screenshotPath: filePath, reportId: reportData.id });
      
      const { data: ocrResult, error: ocrError } = await supabase.functions
        .invoke('vision-ocr', {
          body: {
            screenshotPath: filePath,
            reportId: reportData.id
          }
        });

      console.log('Vision OCR response:', { ocrResult, ocrError });

      if (ocrError) {
        console.error('OCR Error:', ocrError);
        throw new Error(`OCR Error: ${ocrError.message || JSON.stringify(ocrError)}`);
      }

      // Wait a moment for the database to be updated
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the updated report data
      const { data: updatedReport, error: fetchError } = await supabase
        .from('start_of_day_reports')
        .select('*')
        .eq('id', reportData.id)
        .single();

      if (fetchError) {
        console.error('Fetch Error:', fetchError);
        throw new Error(`Failed to fetch updated report: ${fetchError.message}`);
      }

      console.log('Updated report data:', updatedReport);

      setResult({
        ocrResult,
        reportData: updatedReport
      });

      toast.success('Screenshot processed successfully!');
    } catch (error: any) {
      console.error('OCR processing error:', error);
      
      // More detailed error handling
      if (error.message?.includes('JWT')) {
        toast.error('Authentication error. Please try logging out and back in.');
      } else if (error.message?.includes('storage')) {
        toast.error('File upload failed. Please try a smaller image.');
      } else if (error.message?.includes('vision-ocr')) {
        toast.error('OCR processing failed. Please check the image quality and try again.');
      } else {
        toast.error(`Processing failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PageLayout 
      title="Test OCR"
      description="Test the screenshot processing functionality"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Test Screenshot Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roundNumber">Round Number</Label>
              <Input
                id="roundNumber"
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
                placeholder="Enter round number"
                className="max-w-xs"
              />
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
                <div className="border rounded-lg p-4 flex justify-center bg-muted/20">
                  <img 
                    src={previewUrl} 
                    alt="Screenshot preview" 
                    className="max-h-64 object-contain rounded"
                  />
                </div>
              </div>
            )}

            <Button 
              onClick={processScreenshot} 
              disabled={!file || processing}
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
              <div className="space-y-6">
                {result.reportData && (
                  <div>
                    <Label className="text-base font-semibold">Extracted Data</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <div className="text-2xl font-bold text-primary">{result.reportData.heavy_parcels || 0}</div>
                        <div className="text-sm text-muted-foreground">Heavy Parcels</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <div className="text-2xl font-bold text-primary">{result.reportData.standard || 0}</div>
                        <div className="text-sm text-muted-foreground">Standard</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <div className="text-2xl font-bold text-primary">{result.reportData.hanging_garments || 0}</div>
                        <div className="text-sm text-muted-foreground">Hanging Garments</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <div className="text-2xl font-bold text-primary">{result.reportData.packets || 0}</div>
                        <div className="text-sm text-muted-foreground">Packets</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <div className="text-2xl font-bold text-primary">{result.reportData.small_packets || 0}</div>
                        <div className="text-sm text-muted-foreground">Small Packets</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <div className="text-2xl font-bold text-primary">{result.reportData.postables || 0}</div>
                        <div className="text-sm text-muted-foreground">Postables</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <Badge variant={result.reportData.processing_status === 'completed' ? 'default' : 'destructive'}>
                          {result.reportData.processing_status}
                        </Badge>
                        <div className="text-sm text-muted-foreground mt-1">Status</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg bg-background">
                        <div className="text-sm font-mono">{result.reportData.extracted_round_number || 'None'}</div>
                        <div className="text-sm text-muted-foreground">Detected Round</div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-base font-semibold">Raw OCR Response</Label>
                  <Textarea
                    value={JSON.stringify(result.ocrResult, null, 2)}
                    readOnly
                    rows={8}
                    className="font-mono text-sm mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

export default DriverTestOCR;