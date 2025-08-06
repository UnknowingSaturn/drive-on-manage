import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import DriverManagement from "./pages/admin/DriverManagement";
import CompanyManagement from "./pages/admin/CompanyManagement";
import VanManagement from "./pages/admin/VanManagement";
import RoundManagement from "./pages/admin/RoundManagement";
import ScheduleView from "./pages/admin/ScheduleView";
import EODReports from "./pages/admin/EODReports";
import DriverOnboarding from "./pages/DriverOnboarding";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<DriverOnboarding />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/companies" element={
              <ProtectedRoute>
                <CompanyManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/drivers" element={
              <ProtectedRoute>
                <DriverManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/vans" element={
              <ProtectedRoute>
                <VanManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/rounds" element={
              <ProtectedRoute>
                <RoundManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/schedule" element={
              <ProtectedRoute>
                <ScheduleView />
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute>
                <EODReports />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
