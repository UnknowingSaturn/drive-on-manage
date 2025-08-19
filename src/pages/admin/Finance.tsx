import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { InvoiceManagement } from '@/components/finance/InvoiceManagement';
import { OperatingCosts } from '@/components/finance/OperatingCosts';
import { ProfitLoss } from '@/components/finance/ProfitLoss';
import { CompanyRevenue } from '@/components/finance/CompanyRevenue';

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
      <div className="min-h-screen flex w-full bg-background no-overflow">
        <AppSidebar />
        
        <SidebarInset className="flex-1 no-overflow">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="mobile-flex-responsive mobile-container py-3 md:py-4">
              <div className="flex items-center space-x-3">
                <SidebarTrigger className="mr-2 mobile-hidden" />
                <div>
                  <h1 className="mobile-heading text-foreground">Finance Management</h1>
                  <p className="text-responsive-sm text-muted-foreground">
                    Complete financial management system
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="mobile-container py-4 md:py-6">
            <Tabs defaultValue="invoicing" className="mobile-space-y">
              <TabsList className="mobile-grid-auto w-full">
                <TabsTrigger value="invoicing" className="mobile-button-sm">
                  <span className="mobile-hidden">Driver Invoicing</span>
                  <span className="mobile-only">Invoicing</span>
                </TabsTrigger>
                <TabsTrigger value="revenue" className="mobile-button-sm">
                  <span className="mobile-hidden">Company Revenue</span>
                  <span className="mobile-only">Revenue</span>
                </TabsTrigger>
                <TabsTrigger value="costs" className="mobile-button-sm">
                  <span className="mobile-hidden">Operating Costs</span>
                  <span className="mobile-only">Costs</span>
                </TabsTrigger>
                <TabsTrigger value="pl" className="mobile-button-sm">
                  <span className="mobile-hidden">Profit & Loss</span>
                  <span className="mobile-only">P&L</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="invoicing">
                <InvoiceManagement />
              </TabsContent>
              
              <TabsContent value="revenue">
                <CompanyRevenue />
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