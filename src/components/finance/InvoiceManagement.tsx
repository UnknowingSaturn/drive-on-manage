import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Download, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const InvoiceManagement = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Driver Invoicing</h2>
          <p className="text-muted-foreground">Generate and manage driver invoices</p>
        </div>
        <Button disabled>
          <Plus className="h-4 w-4 mr-2" />
          Generate Invoices
        </Button>
      </div>

      {/* Migration Required Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Database migration required:</strong> The invoice management system requires the database migration to be applied first. 
          Please run the migration I created earlier to enable this feature.
        </AlertDescription>
      </Alert>

      {/* Statistics Cards Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">£--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">£--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">£--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Management Features</CardTitle>
          <CardDescription>
            What you'll get once the migration is applied
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Automatic Invoice Generation</h4>
              <p className="text-sm text-muted-foreground">
                Generate monthly invoices for all drivers based on completed EOD reports and parcel rates.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Invoice Details</h4>
              <p className="text-sm text-muted-foreground">
                Includes driver name, total parcels, rates, billing period, and unique invoice numbers.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Status Tracking</h4>
              <p className="text-sm text-muted-foreground">
                Track invoice status from pending to sent to paid with timestamps.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Export & Download</h4>
              <p className="text-sm text-muted-foreground">
                Download individual invoices and export bulk data for accounting.
              </p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button disabled variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};