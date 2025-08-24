import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import DriverOnboardingGate from "@/components/DriverOnboardingGate";
import AdminRoute from "@/components/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import NotAuthorized from "./pages/NotAuthorized";
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeamManagement from "./pages/admin/TeamManagement";
import CompanyManagement from "./pages/admin/CompanyManagement";
import VanManagement from "./pages/admin/VanManagement";
import RoundManagement from "./pages/admin/RoundManagement";
import ScheduleView from "./pages/admin/ScheduleView";
import EODReports from "./pages/admin/EODReports";
import Finance from "./pages/admin/Finance";
import DriverEngagement from "./pages/admin/DriverEngagement";
import AdminSettings from "./pages/admin/Settings";
import ResetPasswordNew from "./pages/ResetPasswordNew";

// Driver pages
import StartOfDay from "./pages/driver/StartOfDay";
import StartOfDayEnhanced from "./pages/driver/StartOfDayEnhanced";
import StartOfDayReports from "./pages/admin/StartOfDayReports";

import VehicleCheck from "./pages/driver/VehicleCheck";
import IncidentReport from "./pages/driver/IncidentReport";
import NewsChat from "./pages/driver/NewsChat";
import Profile from "./pages/driver/Profile";
import EarningsTracker from "./pages/driver/EarningsTracker";
import RouteFeedback from "./pages/driver/RouteFeedback";
import ExpenseTracker from "./pages/driver/ExpenseTracker";
import DriverOnboarding from "./pages/driver/Onboarding";
import EndOfDay from "./pages/driver/EndOfDay";


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
            <Route path="/reset-password" element={<ResetPasswordNew />} />
            <Route path="/not-authorized" element={<NotAuthorized />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <Dashboard />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/admin/dashboard" element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/companies" element={
              <ProtectedRoute>
                <AdminRoute>
                  <CompanyManagement />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/drivers" element={
              <ProtectedRoute>
                <AdminRoute>
                  <TeamManagement />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/vans" element={
              <ProtectedRoute>
                <AdminRoute>
                  <VanManagement />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/rounds" element={
              <ProtectedRoute>
                <AdminRoute>
                  <RoundManagement />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/schedule" element={
              <ProtectedRoute>
                <AdminRoute>
                  <ScheduleView />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/eod-reports" element={
              <ProtectedRoute>
                <AdminRoute>
                  <EODReports />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute>
                <AdminRoute>
                  <EODReports />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/finance" element={
              <ProtectedRoute>
                <AdminRoute>
                  <Finance />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/engagement" element={
              <ProtectedRoute>
                <AdminRoute>
                  <DriverEngagement />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminSettings />
                </AdminRoute>
              </ProtectedRoute>
            } />
            
            {/* Driver Routes */}
            {/* Onboarding route - no onboarding gate */}
            <Route path="/driver/onboarding" element={
              <ProtectedRoute>
                <DriverOnboarding />
              </ProtectedRoute>
            } />
            
            {/* Protected driver routes with onboarding gate */}
            <Route path="/driver/profile" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <Profile />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/driver/start-of-day" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <StartOfDayEnhanced />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/admin/start-of-day-reports" element={
              <ProtectedRoute>
                <AdminRoute>
                  <StartOfDayReports />
                </AdminRoute>
              </ProtectedRoute>
            } />
            <Route path="/driver/end-of-day" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <EndOfDay />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/driver/vehicle-check" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <VehicleCheck />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/driver/incident-report" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <IncidentReport />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/driver/news-chat" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <NewsChat />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/driver/earnings" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <EarningsTracker />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/driver/feedback" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <RouteFeedback />
                </DriverOnboardingGate>
              </ProtectedRoute>
            } />
            <Route path="/driver/expenses" element={
              <ProtectedRoute>
                <DriverOnboardingGate>
                  <ExpenseTracker />
                </DriverOnboardingGate>
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
