import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import { PageLoadProgress } from "@/components/common/PageLoadProgress";
import Header from "./components/Header";
import Home from "./pages/Home";
import { Loader2 } from "lucide-react";

// Lazy load all pages for better performance
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const UsersList = lazy(() => import("@/pages/admin/UsersList"));
const UserProfileView = lazy(() => import("@/pages/admin/UserProfileView"));
const StaffRequests = lazy(() => import("@/pages/admin/StaffRequests").then(m => ({ default: m.StaffRequests })));
const WhitelistManagement = lazy(() => import("@/pages/admin/WhitelistManagement").then(m => ({ default: m.WhitelistManagement })));
const GeneralManagerDashboard = lazy(() => import("@/pages/admin/GeneralManagerDashboard").then(m => ({ default: m.GeneralManagerDashboard })));
const ContractorManagement = lazy(() => import("@/pages/admin/ContractorManagement"));
const StaffManagement = lazy(() => import("@/pages/admin/StaffManagement"));
const CEOLayout = lazy(() => import("@/pages/ceo/CEOLayout").then(m => ({ default: m.CEOLayout })));
const CEODashboard = lazy(() => import("@/pages/ceo/CEODashboard").then(m => ({ default: m.CEODashboard })));
const PhoneWhitelistManagement = lazy(() => import("@/pages/ceo/PhoneWhitelistManagement").then(m => ({ default: m.PhoneWhitelistManagement })));
const ContractorVerifications = lazy(() => import("@/pages/ceo/ContractorVerifications").then(m => ({ default: m.ContractorVerifications })));
const StaffVerifications = lazy(() => import("@/pages/ceo/StaffVerifications").then(m => ({ default: m.StaffVerifications })));
const UserProfile = lazy(() => import("@/pages/user/UserProfile"));
const ProjectsDashboard = lazy(() => import("@/pages/user/ProjectsDashboard"));
const ProjectDetail = lazy(() => import("@/pages/user/ProjectDetail"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ScaffoldingForm = lazy(() => import("./pages/scaffolding/ScaffoldingForm"));
const NewServiceRequestForm = lazy(() => import("./pages/scaffolding/NewServiceRequestForm"));
const TicketList = lazy(() => import("./pages/tickets/TicketList"));
const NewTicket = lazy(() => import("./pages/tickets/NewTicket"));
const TicketDetail = lazy(() => import("./pages/tickets/TicketDetail"));
const ContractorRegister = lazy(() => import("./pages/contractor/ContractorRegister"));
const ContractorDashboard = lazy(() => import("./pages/contractor/ContractorDashboard"));
const StaffRoleRequest = lazy(() => import("./pages/staff/StaffRoleRequest"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
});

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PageLoadProgress />
            <OfflineIndicator />
            <div className="min-h-screen bg-background">
              <Header />
              <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/register" element={<Register />} />
              <Route path="/" element={<Home />} />
              <Route path="/scaffolding/form" element={
                <ProtectedRoute>
                  <ScaffoldingForm />
                </ProtectedRoute>
              } />
              <Route path="/service/request" element={
                <ProtectedRoute>
                  <NewServiceRequestForm />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute>
                  <ProjectsDashboard />
                </ProtectedRoute>
              } />
              <Route path="/projects/:id" element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              } />
              <Route path="/tickets" element={<TicketList />} />
              <Route path="/tickets/new" element={<NewTicket />} />
              <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/contractor/register" element={<ContractorRegister />} />
          <Route path="/staff/request-role" element={<StaffRoleRequest />} />
              <Route path="/contractor/dashboard" element={
                <ProtectedRoute>
                  <ContractorDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }>
                <Route index element={<AdminDashboard />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="users" element={<UsersList />} />
                <Route path="users/:userId" element={<UserProfileView />} />
                <Route path="contractors" element={<ContractorManagement />} />
                <Route path="staff" element={<StaffManagement />} />
                <Route path="staff-requests" element={<StaffRequests />} />
                <Route path="whitelist" element={<WhitelistManagement />} />
              </Route>
              <Route path="/ceo" element={<CEOLayout />}>
                <Route index element={<CEODashboard />} />
                <Route path="whitelist" element={<PhoneWhitelistManagement />} />
                <Route path="contractor-verifications" element={<ContractorVerifications />} />
                <Route path="staff-verifications" element={<StaffVerifications />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
