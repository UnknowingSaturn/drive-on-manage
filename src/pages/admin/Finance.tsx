import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { InvoiceManagement } from '@/components/finance/InvoiceManagement';
import { OperatingCosts } from '@/components/finance/OperatingCosts';
import { ProfitLoss } from '@/components/finance/ProfitLoss';

const Finance = () => {
  const { profile } = useAuth();

  if (!profile || profile.user_type !== 'admin') {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <p>Access denied. Admin privileges required.</p>
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
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-foreground">Finance Management</h1>
                <p className="text-sm text-muted-foreground">
                  Complete financial management system
                </p>
              </div>
            </div>
          </header>

          <main className="p-6">
            <Tabs defaultValue="invoicing" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="invoicing">Driver Invoicing</TabsTrigger>
                <TabsTrigger value="costs">Operating Costs</TabsTrigger>
                <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
              </TabsList>
              
              <TabsContent value="invoicing">
                <InvoiceManagement />
              </TabsContent>
              
              <TabsContent value="costs">
                <OperatingCosts />
              </TabsContent>
              
              <TabsContent value="pl">
                <ProfitLoss />
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Finance;