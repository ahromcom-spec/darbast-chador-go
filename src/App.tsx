import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import { AdminImpersonationBanner } from "@/components/common/AdminImpersonationBanner";
// import { PageLoadProgress } from "@/components/common/PageLoadProgress";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

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
const ScaffoldingRentalForm = lazy(() => import("./pages/scaffolding/ScaffoldingRentalForm"));
const NewServiceRequestForm = lazy(() => import("./pages/scaffolding/NewServiceRequestForm"));
const ComprehensiveScaffoldingForm = lazy(() => import("./pages/scaffolding/ComprehensiveScaffoldingForm"));
const TicketList = lazy(() => import("./pages/tickets/TicketList"));
const FormNotAvailable = lazy(() => import("./pages/user/FormNotAvailable"));
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
const ExecutivePending = lazy(() => import("./pages/executive/ExecutivePending"));
const ExecutiveReady = lazy(() => import("./pages/executive/ExecutiveReady"));
const ExecutiveInProgress = lazy(() => import("./pages/executive/ExecutiveInProgress"));
const ExecutiveCompleted = lazy(() => import("./pages/executive/ExecutiveCompleted"));
const ExecutiveStageAwaitingPayment = lazy(() => import("./pages/executive/ExecutiveStageAwaitingPayment"));
const ExecutiveStageOrderExecuted = lazy(() => import("./pages/executive/ExecutiveStageOrderExecuted"));
const ExecutiveStageAwaitingCollection = lazy(() => import("./pages/executive/ExecutiveStageAwaitingCollection"));
const ExecutiveStageInCollection = lazy(() => import("./pages/executive/ExecutiveStageInCollection"));
const SalesOrders = lazy(() => import("./pages/sales/SalesOrders"));
const SalesPendingOrders = lazy(() => import("./pages/sales/SalesPendingOrders"));
const SalesCompletedOrders = lazy(() => import("./pages/sales/SalesCompletedOrders"));
const SalesDashboard = lazy(() => import("./pages/sales/SalesDashboard"));
const FinanceOrders = lazy(() => import("./pages/finance/FinanceOrders"));
const ReputationDashboard = lazy(() => import("./pages/ratings/ReputationDashboard"));
const RatingTestPage = lazy(() => import("./pages/ratings/RatingTestPage"));
const TopRatedUsers = lazy(() => import("./pages/ratings/TopRatedUsers"));
const NotificationSettings = lazy(() => import("./pages/settings/NotificationSettings"));
const InstallApp = lazy(() => import("./pages/settings/InstallApp"));
const SelectLocation = lazy(() => import("./pages/user/SelectLocation"));
const NewLocation = lazy(() => import("./pages/user/NewLocation"));
const ServiceSelection = lazy(() => import("./pages/user/ServiceSelection"));
const MyOrders = lazy(() => import("./pages/user/MyOrders"));
const MyProjectsHierarchy = lazy(() => import("./pages/user/MyProjectsHierarchy"));
const ZarinpalCallback = lazy(() => import("./pages/payment/ZarinpalCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TestOrderCreator = lazy(() => import("@/pages/admin/TestOrderCreator"));
const MapTest = lazy(() => import("@/pages/test/MapTest"));


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

// Loading component with hero background
const PageLoader = () => (
  <div className="relative min-h-screen w-full overflow-hidden">
    {/* Hero Background Image */}
    <div 
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: 'url(/hero-background.webp)',
      }}
    >
      {/* Overlay gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
    </div>

    {/* Loading Content */}
    <div className="relative z-10 flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" text="در حال بارگذاری..." />
    </div>
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
            
              {/* <PageLoadProgress /> */}
              <AdminImpersonationBanner />
              <OfflineIndicator />
              
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
              <Route path="/scaffolding/rental-form" element={
                <ProtectedRoute>
                  <ScaffoldingRentalForm />
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
              <Route path="/user/orders/:id" element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } />
              <Route path="/user/new-location" element={
                <ProtectedRoute>
                  <NewLocation />
                </ProtectedRoute>
              } />
              <Route path="/user/select-service" element={
                <ProtectedRoute>
                  <ServiceSelection />
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
              <Route path="/form-not-available" element={
                <ProtectedRoute>
                  <FormNotAvailable />
                </ProtectedRoute>
              } />
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
                <Route path="test-order" element={<TestOrderCreator />} />
              </Route>
              <Route path="/ceo" element={<CEOLayout />}>
                <Route index element={<CEODashboardEnhanced />} />
                <Route path="dashboard-old" element={<CEODashboard />} />
                <Route path="whitelist" element={<PhoneWhitelistManagement />} />
                <Route path="contractor-verifications" element={<ContractorVerifications />} />
                <Route path="staff-verifications" element={<StaffVerifications />} />
                <Route path="orders" element={<CEOOrders />} />
                <Route path="test-order" element={<TestOrderCreator />} />
              </Route>
              <Route path="/executive" element={
                <ProtectedRoute>
                  <ExecutiveLayout />
                </ProtectedRoute>
              }>
                <Route index element={<ExecutiveDashboard />} />
                <Route path="pending" element={<ExecutivePending />} />
                <Route path="ready" element={<ExecutiveReady />} />
                <Route path="in-progress" element={<ExecutiveInProgress />} />
                <Route path="stage-awaiting-payment" element={<ExecutiveStageAwaitingPayment />} />
                <Route path="stage-order-executed" element={<ExecutiveStageOrderExecuted />} />
                <Route path="stage-awaiting-collection" element={<ExecutiveStageAwaitingCollection />} />
                <Route path="stage-in-collection" element={<ExecutiveStageInCollection />} />
                <Route path="completed" element={<ExecutiveCompleted />} />
                <Route path="all-orders" element={<ExecutiveOrders />} />
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
              <Route path="/sales/completed-orders" element={
                <ProtectedRoute>
                  <SalesCompletedOrders />
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
              <Route path="/ratings/top-users" element={
                <ProtectedRoute>
                  <TopRatedUsers />
                </ProtectedRoute>
              } />
              
              {/* Test route for map */}
              <Route path="/test/map" element={<MapTest />} />

              {/* ZarinPal payment callback */}
              <Route path="/payment/zarinpal-callback" element={<ZarinpalCallback />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </Suspense>
          
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
