import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, DollarSign, Plus, Calendar, Edit, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const COST_CATEGORIES = [
  'Fuel',
  'Insurance', 
  'Maintenance',
  'Admin Wages',
  'Miscellaneous'
];

export const OperatingCosts = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Operating Costs</h2>
          <p className="text-muted-foreground">Track and manage operational expenses</p>
        </div>
        <Button disabled>
          <Plus className="h-4 w-4 mr-2" />
          Add Cost
        </Button>
      </div>

      {/* Migration Required Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Database migration required:</strong> The operating costs system requires the database migration to be applied first. 
          Please run the migration I created earlier to enable this feature.
        </AlertDescription>
      </Alert>

      {/* Statistics Cards Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CardTitle className="text-sm font-medium">Number of Entries</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Daily Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">£--</div>
            <p className="text-xs text-muted-foreground">awaiting migration</p>
          </CardContent>
        </Card>
      </div>

      {/* Costs by Category Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Categories</CardTitle>
          <CardDescription>
            Expense categories that will be available after migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COST_CATEGORIES.map((category) => (
              <div key={category} className="p-4 border rounded-lg">
                <h4 className="font-medium">{category}</h4>
                <p className="text-2xl font-bold text-muted-foreground">£--</p>
                <p className="text-xs text-muted-foreground">awaiting migration</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feature Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Operating Costs Features</CardTitle>
          <CardDescription>
            What you'll get once the migration is applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Expense Tracking</h4>
                <p className="text-sm text-muted-foreground">
                  Track all operational expenses with date, category, description, and amount.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Category Management</h4>
                <p className="text-sm text-muted-foreground">
                  Organize costs by fuel, insurance, maintenance, admin wages, and miscellaneous.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Monthly Reporting</h4>
                <p className="text-sm text-muted-foreground">
                  View and filter costs by month with detailed breakdowns and statistics.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Edit & Delete</h4>
                <p className="text-sm text-muted-foreground">
                  Full CRUD operations to manage and correct expense entries.
                </p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">DD/MM/YYYY</TableCell>
                    <TableCell className="text-muted-foreground">Fuel</TableCell>
                    <TableCell className="text-muted-foreground">Sample expense entry</TableCell>
                    <TableCell className="text-muted-foreground">£--</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline" disabled>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" disabled>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};