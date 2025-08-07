import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Download, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const ProfitLoss = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Profit & Loss</h2>
          <p className="text-muted-foreground">Financial performance overview</p>
        </div>
        <Button disabled variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Migration Required Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Database migration required:</strong> The P&L reporting system requires the database migration to be applied first. 
          Please run the migration I created earlier to enable this feature.
        </AlertDescription>
      </Alert>

      {/* Key Metrics Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">£--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">£--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">£--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--%</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Costs Trend</CardTitle>
            <CardDescription>Monthly comparison chart (coming soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chart will appear after migration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Distribution pie chart (coming soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center border border-dashed rounded-lg">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chart will appear after migration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Statement Preview</CardTitle>
          <CardDescription>
            Sample P&L format that will be generated after migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">REVENUE</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Total Revenue</TableCell>
                <TableCell className="font-semibold text-muted-foreground">£--</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">COST OF GOODS SOLD</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Driver Payments</TableCell>
                <TableCell className="text-muted-foreground">£--</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">GROSS PROFIT</TableCell>
                <TableCell className="font-semibold text-muted-foreground">£--</TableCell>
              </TableRow>
              
              <TableRow>
                <TableCell className="font-medium">OPERATING EXPENSES</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Fuel</TableCell>
                <TableCell className="text-muted-foreground">£--</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Insurance</TableCell>
                <TableCell className="text-muted-foreground">£--</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Maintenance</TableCell>
                <TableCell className="text-muted-foreground">£--</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Admin Wages</TableCell>
                <TableCell className="text-muted-foreground">£--</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 font-medium">Total Operating Expenses</TableCell>
                <TableCell className="font-semibold text-muted-foreground">£--</TableCell>
              </TableRow>
              
              <TableRow className="border-t-2">
                <TableCell className="font-bold">NET PROFIT</TableCell>
                <TableCell className="font-bold text-lg text-muted-foreground">£--</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Features Preview */}
      <Card>
        <CardHeader>
          <CardTitle>P&L Features</CardTitle>
          <CardDescription>
            What you'll get once the migration is applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Dynamic P&L Dashboard</h4>
              <p className="text-sm text-muted-foreground">
                Real-time profit and loss calculations based on revenue and costs.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Visual Charts</h4>
              <p className="text-sm text-muted-foreground">
                Interactive bar charts and pie charts for trend analysis.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Period Filtering</h4>
              <p className="text-sm text-muted-foreground">
                Filter by month or year with easy navigation controls.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Export Reports</h4>
              <p className="text-sm text-muted-foreground">
                Export P&L statements to CSV or PDF for accounting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};