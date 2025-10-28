import React, { lazy, Suspense, useEffect } from "react";
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
// import { PageLoadProgress } from "@/components/common/PageLoadProgress";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { PWAInstallBanner } from "@/components/common/PWAInstallBanner";
import { NotificationBanner } from "@/components/common/NotificationBanner";

import Header from "./components/Header";
import Home from "./pages/Home";

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
const CEODashboardEnhanced = lazy(() => import("@/pages/ceo/CEODashboardEnhanced"));
const PhoneWhitelistManagement = lazy(() => import("@/pages/ceo/PhoneWhitelistManagement").then(m => ({ default: m.PhoneWhitelistManagement })));
const ContractorVerifications = lazy(() => import("@/pages/ceo/ContractorVerifications").then(m => ({ default: m.ContractorVerifications })));
const StaffVerifications = lazy(() => import("@/pages/ceo/StaffVerifications").then(m => ({ default: m.StaffVerifications })));
const CEOOrders = lazy(() => import("@/pages/ceo/CEOOrders").then(m => ({ default: m.CEOOrders })));
const UserProfile = lazy(() => import("@/pages/user/UserProfile"));
const ProjectDetail = lazy(() => import("@/pages/user/ProjectDetail"));
const OrderDetail = lazy(() => import("@/pages/user/OrderDetail"));
const ProjectManagement = lazy(() => import("@/pages/user/ProjectManagement"));
const CreateProject = lazy(() => import("@/pages/user/CreateProject"));
const AddServiceToProject = lazy(() => import("@/pages/user/AddServiceToProject"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ScaffoldingForm = lazy(() => import("./pages/scaffolding/ScaffoldingForm"));
const NewServiceRequestForm = lazy(() => import("./pages/scaffolding/NewServiceRequestForm"));
const ComprehensiveScaffoldingForm = lazy(() => import("./pages/scaffolding/ComprehensiveScaffoldingForm"));
const TicketList = lazy(() => import("./pages/tickets/TicketList"));
const NewTicket = lazy(() => import("./pages/tickets/NewTicket"));
const TicketDetail = lazy(() => import("./pages/tickets/TicketDetail"));
const ContractorRegister = lazy(() => import("./pages/contractor/ContractorRegister"));
const ContractorDashboard = lazy(() => import("./pages/contractor/ContractorDashboard"));
const StaffRoleRequest = lazy(() => import("./pages/staff/StaffRoleRequest"));
const ExecutiveLayout = lazy(() => import("./pages/executive/ExecutiveLayout").then(m => ({ default: m.ExecutiveLayout })));
const ExecutiveDashboard = lazy(() => import("./pages/executive/ExecutiveDashboard"));
const ExecutiveOrders = lazy(() => import("./pages/executive/ExecutiveOrders"));
const ExecutiveCustomers = lazy(() => import("./pages/executive/ExecutiveCustomers"));
const ExecutivePendingOrders = lazy(() => import("./pages/executive/ExecutivePendingOrders"));
const SalesOrders = lazy(() => import("./pages/sales/SalesOrders"));
const SalesPendingOrders = lazy(() => import("./pages/sales/SalesPendingOrders"));
const SalesDashboard = lazy(() => import("./pages/sales/SalesDashboard"));
const FinanceOrders = lazy(() => import("./pages/finance/FinanceOrders"));
const ReputationDashboard = lazy(() => import("./pages/ratings/ReputationDashboard"));
const RatingTestPage = lazy(() => import("./pages/ratings/RatingTestPage"));
const NotificationSettings = lazy(() => import("./pages/settings/NotificationSettings"));
const InstallApp = lazy(() => import("./pages/settings/InstallApp"));
const SelectLocation = lazy(() => import("./pages/user/SelectLocation"));
const MyOrders = lazy(() => import("./pages/user/MyOrders"));
const MyProjectsHierarchy = lazy(() => import("./pages/user/MyProjectsHierarchy"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 دقیقه
      gcTime: 1000 * 60 * 30, // 30 دقیقه (افزایش cache time)
      retry: 1, // کاهش تلاش مجدد
      refetchOnWindowFocus: false, // غیرفعال کردن refetch خودکار
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Loading component
const PageLoader = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
    <LoadingSpinner size="lg" text="در حال بارگذاری..." />
  </div>
);

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              {/* <PageLoadProgress /> */}
              <OfflineIndicator />
              <NotificationBanner />
              <PWAInstallBanner />
              
              <Suspense fallback={<PageLoader />}>
                <div className="min-h-screen bg-background">
                  <Header />
                <Routes>
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/register" element={<Register />} />
              <Route path="/" element={<Home />} />
              <Route path="/scaffolding/form" element={
                <ProtectedRoute>
                  <ScaffoldingForm />
                </ProtectedRoute>
              } />
              <Route path="/scaffolding/form/:projectId" element={
                <ProtectedRoute>
                  <ScaffoldingForm />
                </ProtectedRoute>
              } />
              <Route path="/service/request" element={
                <ProtectedRoute>
                  <NewServiceRequestForm />
                </ProtectedRoute>
              } />
              <Route path="/service/scaffolding-order/:projectId" element={
                <ProtectedRoute>
                  <ComprehensiveScaffoldingForm />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } />
              <Route path="/user/projects" element={
                <ProtectedRoute>
                  <MyProjectsHierarchy />
                </ProtectedRoute>
              } />
              <Route path="/user/create-project" element={
                <ProtectedRoute>
                  <CreateProject />
                </ProtectedRoute>
              } />
              <Route path="/user/add-service/:projectId" element={
                <ProtectedRoute>
                  <AddServiceToProject />
                </ProtectedRoute>
              } />
              <Route path="/projects/:id" element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              } />
              <Route path="/user/my-orders" element={
                <ProtectedRoute>
                  <MyOrders />
                </ProtectedRoute>
              } />
              <Route path="/user/orders" element={
                <ProtectedRoute>
                  <MyOrders />
                </ProtectedRoute>
              } />
              <Route path="/orders/:id" element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } />
              <Route path="/select-location" element={
                <ProtectedRoute>
                  <SelectLocation />
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
                <Route index element={<CEODashboardEnhanced />} />
                <Route path="dashboard-old" element={<CEODashboard />} />
                <Route path="whitelist" element={<PhoneWhitelistManagement />} />
                <Route path="contractor-verifications" element={<ContractorVerifications />} />
                <Route path="staff-verifications" element={<StaffVerifications />} />
                <Route path="orders" element={<CEOOrders />} />
              </Route>
              <Route path="/executive" element={
                <ProtectedRoute>
                  <ExecutiveLayout />
                </ProtectedRoute>
              }>
                <Route index element={<ExecutiveDashboard />} />
                <Route path="orders" element={<ExecutiveOrders />} />
                <Route path="pending-orders" element={<ExecutivePendingOrders />} />
                <Route path="customers" element={<ExecutiveCustomers />} />
              </Route>
              <Route path="/sales" element={
                <ProtectedRoute>
                  <SalesDashboard />
                </ProtectedRoute>
              } />
              <Route path="/sales/orders" element={
                <ProtectedRoute>
                  <SalesOrders />
                </ProtectedRoute>
              } />
              <Route path="/sales/pending-orders" element={
                <ProtectedRoute>
                  <SalesPendingOrders />
                </ProtectedRoute>
              } />
              <Route path="/finance/orders" element={
                <ProtectedRoute>
                  <FinanceOrders />
                </ProtectedRoute>
              } />
              
              {/* Settings Routes */}
              <Route path="/settings/notifications" element={
                <ProtectedRoute>
                  <NotificationSettings />
                </ProtectedRoute>
              } />
              <Route path="/settings/install" element={<InstallApp />} />
              
              {/* Reputation & Ratings */}
              <Route path="/reputation" element={
                <ProtectedRoute>
                  <ReputationDashboard />
                </ProtectedRoute>
              } />
              <Route path="/reputation/:userId" element={
                <ProtectedRoute>
                  <ReputationDashboard />
                </ProtectedRoute>
              } />
              <Route path="/ratings/test" element={
                <ProtectedRoute>
                  <RatingTestPage />
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
