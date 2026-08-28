import { lazy, Suspense, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { NotificationAutoPrompt } from "@/components/common/NotificationAutoPrompt";
import { NajvaSubscriber } from "@/components/common/NajvaSubscriber";
// import { PageLoadProgress } from "@/components/common/PageLoadProgress";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { GlobalKeyboardShortcuts } from "@/components/common/GlobalKeyboardShortcuts";
import { IncomingCallProvider } from "@/contexts/IncomingCallContext";
import GlobalIncomingCallPopup from "@/components/calls/GlobalIncomingCallPopup";
import { ZoomProvider } from "@/contexts/ZoomContext";


import { AssistantAvatarGate } from '@/components/assistant/AssistantAvatarGate';
import { useSiteAnalytics } from '@/hooks/useSiteAnalytics';
import { useGlobalTableArrowNavigation } from '@/hooks/useTableArrowNavigation';

import Header from "./components/Header";
import Home from "./pages/Home";
import GlobeMap from "@/pages/GlobeMap";
// Lazy load all pages for better performance
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminExport = lazy(() => import("@/pages/admin/AdminExport"));
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
const ContractorsModule = lazy(() => import("@/pages/ceo/ContractorsModule"));
const ContractorOrderDispatch = lazy(() => import("@/pages/ceo/ContractorOrderDispatch"));
const SmsManagementModule = lazy(() => import("@/pages/ceo/SmsManagementModule"));
const OrderTransfersModule = lazy(() => import("@/pages/ceo/OrderTransfersModule"));
const RatingsModule = lazy(() => import("@/pages/ceo/RatingsModule"));
const SiteNotificationsModule = lazy(() => import("@/pages/ceo/SiteNotificationsModule"));

const StaffVerifications = lazy(() => import("@/pages/ceo/StaffVerifications").then(m => ({ default: m.StaffVerifications })));
const CEOOrders = lazy(() => import("@/pages/ceo/CEOOrders").then(m => ({ default: m.CEOOrders })));
const CEOCustomers = lazy(() => import("@/pages/ceo/CEOCustomers").then(m => ({ default: m.CEOCustomers })));
const DeepArchivedOrders = lazy(() => import("@/pages/ceo/DeepArchivedOrders"));
const PaymentHistory = lazy(() => import("@/pages/ceo/PaymentHistory"));
const DailyReportModule = lazy(() => import("@/pages/ceo/DailyReportModule"));
const HRManagementModule = lazy(() => import("@/pages/ceo/HRManagementModule"));
const PersonnelAccountingModule = lazy(() => import("@/pages/ceo/PersonnelAccountingModule"));
const SiteRegistrationModule = lazy(() => import("@/pages/ceo/SiteRegistrationModule"));
const AccountingModule = lazy(() => import("@/pages/ceo/AccountingModule"));
const AllCompanyOrdersModule = lazy(() => import("@/pages/ceo/AllCompanyOrdersModule"));
const CustomerComprehensiveInvoice = lazy(() => import("@/pages/ceo/CustomerComprehensiveInvoice"));
const MyInvoiceModule = lazy(() => import("@/pages/user/MyInvoiceModule"));
const SiteAnalyticsModule = lazy(() => import("@/pages/ceo/SiteAnalyticsModule"));
const MediaApprovalModule = lazy(() => import("@/pages/ceo/MediaApprovalModule"));
const BankCardsModule = lazy(() => import("@/pages/ceo/BankCardsModule"));
const ScaffoldingPricingModule = lazy(() => import("@/pages/ceo/ScaffoldingPricingModule"));
const ScaffoldingNoMaterialsPricingModule = lazy(() => import("@/pages/ceo/ScaffoldingNoMaterialsPricingModule"));
const ServicePricingHub = lazy(() => import("@/pages/ceo/ServicePricingHub"));
const ServicePricingEditor = lazy(() => import("@/pages/ceo/ServicePricingEditor"));
const UserCooperationRankModule = lazy(() => import("@/pages/ceo/UserCooperationRankModule"));
const ActivityLogsModule = lazy(() => import("@/pages/ceo/ActivityLogsModule"));
const DynamicServicesModule = lazy(() => import("@/pages/ceo/DynamicServicesModule"));
const ServiceGeoAvailabilityModule = lazy(() => import("@/pages/ceo/ServiceGeoAvailabilityModule"));
const UserProfile = lazy(() => import("@/pages/user/UserProfile"));
const ProjectDetail = lazy(() => import("@/pages/user/ProjectDetail"));
const OrderDetail = lazy(() => import("@/pages/user/OrderDetail"));
const ProjectManagement = lazy(() => import("@/pages/user/ProjectManagement"));
const CreateProject = lazy(() => import("@/pages/user/CreateProject"));
const AddServiceToProject = lazy(() => import("@/pages/user/AddServiceToProject"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ScaffoldingForm = lazy(() => import("./pages/scaffolding/ScaffoldingForm"));
const ScaffoldingRentalForm = lazy(() => import("./pages/scaffolding/ScaffoldingRentalForm"));
const NewServiceRequestForm = lazy(() => import("./pages/scaffolding/NewServiceRequestForm"));
const ComprehensiveScaffoldingForm = lazy(() => import("./pages/scaffolding/ComprehensiveScaffoldingForm"));
const ScaffoldingFacadeForm = lazy(() => import("./pages/scaffolding/ScaffoldingFacadeForm"));
const CarpetCleaningForm = lazy(() => import("./pages/carpet-cleaning/CarpetCleaningForm"));
const CustomServiceForm = lazy(() => import("./pages/custom/CustomServiceForm"));

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
const ExecutiveStageCollected = lazy(() => import("./pages/executive/ExecutiveStageCollected"));
const ArchivedOrders = lazy(() => import("./pages/executive/ArchivedOrders"));
const ExecutiveCollectionRequests = lazy(() => import("./pages/executive/ExecutiveCollectionRequests"));
const ExpertPricingQueue = lazy(() => import("./pages/executive/ExpertPricingQueue"));
const ExecutiveStatements = lazy(() => import("./pages/executive/ExecutiveStatements"));
const SalesLayout = lazy(() => import("./pages/sales/SalesLayout"));
const SalesOrders = lazy(() => import("./pages/sales/SalesOrders"));
const SalesPendingOrders = lazy(() => import("./pages/sales/SalesPendingOrders"));
const SalesCompletedOrders = lazy(() => import("./pages/sales/SalesCompletedOrders"));
const SalesDashboard = lazy(() => import("./pages/sales/SalesDashboard"));
const SalesCustomers = lazy(() => import("./pages/sales/SalesCustomers"));
const FinanceOrders = lazy(() => import("./pages/finance/FinanceOrders"));
const FinanceLayout = lazy(() => import("./pages/finance/FinanceLayout"));
const FinanceDashboard = lazy(() => import("./pages/finance/FinanceDashboard"));
const FinanceAwaitingPayment = lazy(() => import("./pages/finance/FinanceAwaitingPayment"));
const FinancePaidOrders = lazy(() => import("./pages/finance/FinancePaidOrders"));
const FinanceClosedOrders = lazy(() => import("./pages/finance/FinanceClosedOrders"));
const FinanceAllOrders = lazy(() => import("./pages/finance/FinanceAllOrders"));
const ReputationDashboard = lazy(() => import("./pages/ratings/ReputationDashboard"));
const RatingTestPage = lazy(() => import("./pages/ratings/RatingTestPage"));
const TopRatedUsers = lazy(() => import("./pages/ratings/TopRatedUsers"));
const NotificationSettings = lazy(() => import("./pages/settings/NotificationSettings"));
const InstallApp = lazy(() => import("./pages/settings/InstallApp"));
const BackupSettings = lazy(() => import("./pages/settings/BackupSettings"));
const CEOBackupModule = lazy(() => import("./pages/ceo/CEOBackupModule"));
const SelectLocation = lazy(() => import("./pages/user/SelectLocation"));
const NewLocation = lazy(() => import("./pages/user/NewLocation"));
const ServiceSelection = lazy(() => import("./pages/user/ServiceSelection"));
const MyProjectsHierarchy = lazy(() => import("./pages/user/MyProjectsHierarchy"));
const ZarinpalCallback = lazy(() => import("./pages/payment/ZarinpalCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TestOrderCreator = lazy(() => import("@/pages/admin/TestOrderCreator"));
const OrderTransferManagement = lazy(() => import("@/pages/admin/OrderTransferManagement"));
const MapTest = lazy(() => import("@/pages/test/MapTest"));
const TunnelPage = lazy(() => import("@/pages/tunnel/TunnelPage"));
const VPSMigrationGuide = lazy(() => import("@/pages/admin/VPSMigrationGuide"));
// GlobeMap is imported eagerly (see above) to avoid first-load chunk errors on some mobile browsers.

// Redirect component for old orders pages
import { Navigate } from 'react-router-dom';
const RedirectToProfileOrders = () => <Navigate to="/profile?tab=orders" replace />;


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

// Loading component with hero background - portaled to <body> to escape
// any CSS `zoom` applied to #app-root by ZoomProvider (which would otherwise
// shrink the fixed-positioned overlay).
const PageLoader = () => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] w-screen h-screen overflow-hidden"
      style={{ height: '100dvh', zoom: 1 } as React.CSSProperties}
    >
      {/* Hero Background Image - covers entire screen on all devices */}

      {/* Loading Content */}
      <div className="relative z-10 flex w-full h-full items-center justify-center">
        <LoadingSpinner size="lg" text="در حال بارگذاری..." />
      </div>
    </div>,
    document.body
  );
};

// Analytics tracker wrapper component
const AnalyticsTracker = ({ children }: { children: ReactNode }) => {
  useSiteAnalytics();
  return <>{children}</>;
};


const App = () => {
  useGlobalTableArrowNavigation();
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ZoomProvider>
              
              <IncomingCallProvider>
                {/* <PageLoadProgress /> */}
                <AdminImpersonationBanner />
                <NotificationAutoPrompt />
                <NajvaSubscriber />
                <GlobalKeyboardShortcuts />
              <GlobalIncomingCallPopup />
              
              <Suspense fallback={<PageLoader />}>
                <AnalyticsTracker>
                <div className="flex-1 flex flex-col bg-background">
                  <Header />
                  <Routes>
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/register" element={<Register />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/" element={<Home />} />
              <Route path="/admin-export" element={
                <ProtectedRoute>
                  <AdminExport />
                </ProtectedRoute>
              } />
              <Route path="/globe" element={<GlobeMap />} />

              <Route path="/scaffolding/form" element={<ScaffoldingForm />} />
              <Route path="/scaffolding/rental-form" element={<ScaffoldingRentalForm />} />
              <Route path="/custom-service/form" element={
                <ProtectedRoute>
                  <CustomServiceForm />
                </ProtectedRoute>
              } />


              {/* سازگاری با مسیرهای قدیمی/کوتاه */}
              <Route path="/rental-form" element={
                <ProtectedRoute>
                  <ScaffoldingRentalForm />
                </ProtectedRoute>
              } />
              <Route path="/scaffolding/facade" element={
                <ProtectedRoute>
                  <ScaffoldingFacadeForm />
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
              <Route path="/carpet-cleaning/form" element={
                <ProtectedRoute>
                  <CarpetCleaningForm />
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
              {/* Redirect old orders pages to profile orders tab */}
              <Route path="/user/my-orders" element={
                <ProtectedRoute>
                  <RedirectToProfileOrders />
                </ProtectedRoute>
              } />
              <Route path="/user/orders" element={
                <ProtectedRoute>
                  <RedirectToProfileOrders />
                </ProtectedRoute>
              } />
              <Route path="/user/orders/:id" element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } />
              {/* Redirect for backward compatibility with old /orders/:id links */}
              <Route path="/orders/:id" element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              } />
              <Route path="/user/new-location" element={<NewLocation />} />
              <Route path="/user/select-service" element={<ServiceSelection />} />
              <Route path="/select-location" element={<SelectLocation />} />

              <Route path="/tickets" element={<TicketList />} />
              <Route path="/tickets/new" element={<NewTicket />} />
              <Route path="/tickets/:id" element={<TicketDetail />} />
              <Route path="/form-not-available" element={
                <ProtectedRoute>
                  <FormNotAvailable />
                </ProtectedRoute>
              } />
              {/* مسیر تونل برای ورود نمایندگی مدیرعامل */}
              <Route path="/tunnel" element={
                <ProtectedRoute>
                  <TunnelPage />
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
                <Route path="order-transfers" element={<OrderTransferManagement />} />
                <Route path="vps-guide" element={<VPSMigrationGuide />} />
              </Route>
              <Route path="/ceo" element={<CEOLayout />}>
                <Route index element={<CEODashboardEnhanced />} />
                <Route path="dashboard-old" element={<CEODashboard />} />
                <Route path="whitelist" element={<PhoneWhitelistManagement />} />
                <Route path="contractor-verifications" element={<ContractorsModule />} />
                <Route path="contractors-management" element={<ContractorsModule />} />
                <Route path="contractor-dispatch" element={<ContractorOrderDispatch />} />
                <Route path="staff-verifications" element={<StaffVerifications />} />
                <Route path="orders" element={<ExecutiveOrders />} />
                <Route path="customers" element={<CEOCustomers />} />
                <Route path="test-order" element={<TestOrderCreator />} />
                <Route path="pending-orders" element={<ExecutivePendingOrders />} />
                <Route path="ready" element={<ExecutiveReady />} />
                <Route path="in-progress" element={<ExecutiveInProgress />} />
                <Route path="stage-awaiting-payment" element={<ExecutiveStageAwaitingPayment />} />
                <Route path="stage-awaiting-collection" element={<ExecutiveStageAwaitingCollection />} />
                <Route path="completed" element={<ExecutiveCompleted />} />
                <Route path="archived" element={<ArchivedOrders />} />
                <Route path="deep-archived" element={<DeepArchivedOrders />} />
                <Route path="payments" element={<PaymentHistory />} />
                <Route path="backup" element={<CEOBackupModule />} />
              </Route>

              {/* مسیر مستقل برای ماژول انتقال و همکاری سفارش */}
              <Route path="/order-transfers-module" element={
                <ProtectedRoute>
                  <OrderTransfersModule />
                </ProtectedRoute>
              } />

              {/* مسیر مستقل برای ماژول مدیریت امتیازدهی */}
              <Route path="/ratings-module" element={
                <ProtectedRoute>
                  <RatingsModule />
                </ProtectedRoute>
              } />

              {/* مسیر مستقل برای ماژول گزارشات و اعلانات سایت */}
              <Route path="/site-notifications" element={
                <ProtectedRoute>
                  <SiteNotificationsModule />
                </ProtectedRoute>
              } />



              {/* مسیر مستقل برای ماژول مدیریت پیامک‌ها */}
              <Route path="/sms-management" element={
                <ProtectedRoute>
                  <SmsManagementModule />
                </ProtectedRoute>
              } />

              {/* مسیر جداگانه برای ماژول گزارش روزانه - بدون ناوبری CEO */}
              <Route path="/daily-report" element={
                <ProtectedRoute>
                  <DailyReportModule />
                </ProtectedRoute>
              } />
              {/* مسیر جداگانه برای ماژول مدیریت منابع انسانی */}
              <Route path="/hr-management" element={
                <ProtectedRoute>
                  <HRManagementModule />
                </ProtectedRoute>
              } />
              {/* مسیر جداگانه برای ماژول حسابکتاب و کارکرد پرسنل */}
              <Route path="/personnel-accounting" element={
                <ProtectedRoute>
                  <PersonnelAccountingModule />
                </ProtectedRoute>
              } />
              {/* مسیر جداگانه برای ماژول ثبت‌نام در سایت اهرم */}
              <Route path="/site-registration" element={
                <ProtectedRoute>
                  <SiteRegistrationModule />
                </ProtectedRoute>
              } />
              {/* مسیر جداگانه برای ماژول حسابداری جامع */}
              <Route path="/comprehensive-accounting" element={
                <ProtectedRoute>
                  <AccountingModule />
                </ProtectedRoute>
              } />
              {/* مسیر جداگانه برای ماژول کل سفارشات شرکت اهرم */}
              <Route path="/all-company-orders" element={
                <ProtectedRoute>
                  <AllCompanyOrdersModule />
                </ProtectedRoute>
              } />
              {/* مسیر جداگانه برای ماژول صورتحساب جامع مشتریان */}
              <Route path="/customer-comprehensive-invoice" element={
                <ProtectedRoute>
                  <CustomerComprehensiveInvoice />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول صورتحساب شخصی مشتری */}
              <Route path="/my-invoice" element={
                <ProtectedRoute>
                  <MyInvoiceModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول آمار بازدید سایت اهرم */}
              <Route path="/site-analytics" element={
                <ProtectedRoute>
                  <SiteAnalyticsModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول مدیریت رسانه‌های سایت */}
              <Route path="/media-approval" element={
                <ProtectedRoute>
                  <MediaApprovalModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول ثبت کارت حساب بانکی */}
              <Route path="/bank-cards" element={
                <ProtectedRoute>
                  <BankCardsModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول قیمت‌گذاری داربست */}
              <Route path="/scaffolding-pricing" element={
                <ProtectedRoute>
                  <ScaffoldingPricingModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول قیمت‌گذاری خدمات اجرای داربست بدون اجناس */}
              <Route path="/scaffolding-no-materials-pricing" element={
                <ProtectedRoute>
                  <ScaffoldingNoMaterialsPricingModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول‌های قیمت‌گذاری خدمات (به‌ازای هر زیرشاخه) */}
              <Route path="/service-pricing" element={
                <ProtectedRoute>
                  <ServicePricingHub />
                </ProtectedRoute>
              } />
              <Route path="/service-pricing/:subcategoryId" element={
                <ProtectedRoute>
                  <ServicePricingEditor />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول رتبه همکاری کاربران */}
              <Route path="/user-cooperation-rank" element={
                <ProtectedRoute>
                  <UserCooperationRankModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول لاگ فعالیت‌ها و ایمیل‌های خودکار */}
              <Route path="/activity-logs" element={
                <ProtectedRoute>
                  <ActivityLogsModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول مدیریت خدمات داینامیک */}
              <Route path="/ceo/dynamic-services" element={
                <ProtectedRoute>
                  <DynamicServicesModule />
                </ProtectedRoute>
              } />
              {/* مسیر ماژول مدیریت خدمات طبق شهرها */}
              <Route path="/ceo/service-geo-availability" element={
                <ProtectedRoute>
                  <ServiceGeoAvailabilityModule />
                </ProtectedRoute>
              } />
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
                <Route path="stage-collected" element={<ExecutiveStageCollected />} />
                <Route path="completed" element={<ExecutiveCompleted />} />
                <Route path="all-orders" element={<ExecutiveOrders />} />
                <Route path="orders" element={<ExecutiveOrders />} />
                <Route path="pending-orders" element={<ExecutivePendingOrders />} />
                <Route path="customers" element={<ExecutiveCustomers />} />
                <Route path="archived" element={<ArchivedOrders />} />
                <Route path="collection-requests" element={<ExecutiveCollectionRequests />} />
                <Route path="order-transfers" element={<OrderTransferManagement />} />
                <Route path="expert-pricing" element={<ExpertPricingQueue />} />
                <Route path="statements" element={<ExecutiveStatements />} />
              </Route>
              <Route path="/sales" element={
                <ProtectedRoute>
                  <SalesLayout />
                </ProtectedRoute>
              }>
                <Route index element={<SalesDashboard />} />
                <Route path="pending-orders" element={<SalesPendingOrders />} />
                <Route path="ready" element={<ExecutiveReady />} />
                <Route path="in-progress" element={<ExecutiveInProgress />} />
                <Route path="stage-awaiting-payment" element={<ExecutiveStageAwaitingPayment />} />
                <Route path="stage-awaiting-collection" element={<ExecutiveStageAwaitingCollection />} />
                <Route path="completed" element={<ExecutiveCompleted />} />
                <Route path="orders" element={<SalesOrders />} />
                <Route path="customers" element={<SalesCustomers />} />
                <Route path="order-transfers" element={<OrderTransferManagement />} />
              </Route>
              {/* Finance/Accounting Dashboard Routes */}
              <Route path="/finance" element={
                <ProtectedRoute>
                  <FinanceLayout />
                </ProtectedRoute>
              }>
                <Route index element={<FinanceDashboard />} />
                <Route path="awaiting-payment" element={<FinanceAwaitingPayment />} />
                <Route path="paid" element={<FinancePaidOrders />} />
                <Route path="closed" element={<FinanceClosedOrders />} />
                <Route path="all-orders" element={<FinanceAllOrders />} />
                <Route path="orders" element={<FinanceOrders />} />
              </Route>
              
              {/* Settings Routes */}
              <Route path="/settings/notifications" element={
                <ProtectedRoute>
                  <NotificationSettings />
                </ProtectedRoute>
              } />
              <Route path="/settings/install" element={<InstallApp />} />
              <Route path="/settings/install-app" element={<InstallApp />} />
              <Route path="/settings/backup" element={<BackupSettings />} />
              
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
              <AssistantAvatarGate />
              </AnalyticsTracker>
            </Suspense>
              </IncomingCallProvider>
            </ZoomProvider>
          </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
