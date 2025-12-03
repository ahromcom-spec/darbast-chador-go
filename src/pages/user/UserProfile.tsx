import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MessageSquare, Briefcase, FolderKanban, ClipboardList, Receipt } from 'lucide-react';
import { MyOrdersList } from '@/components/profile/MyOrdersList';
import { CustomerInvoice } from '@/components/profile/CustomerInvoice';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layouts/MainLayout';
import { usePageTitle } from '@/hooks/usePageTitle';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { StaffRegistrationButton } from '@/components/staff/StaffRegistrationButton';
import { StaffRequestDialog } from '@/components/staff/StaffRequestDialog';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { TicketForm } from '@/components/profile/TicketForm';
import { ContractorForm } from '@/components/profile/ContractorForm';
import { NewContractorForm } from '@/components/profile/NewContractorForm';
import { Suspense } from 'react';
import { useContractorRole } from '@/hooks/useContractorRole';
import { useCEORole } from '@/hooks/useCEORole';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useGeneralManagerRole } from '@/hooks/useGeneralManagerRole';
import { useSalesManagerRole } from '@/hooks/useSalesManagerRole';
import { useFinanceManagerRole } from '@/hooks/useFinanceManagerRole';
import { useExecutiveManagerRole } from '@/hooks/useExecutiveManagerRole';
import { CEOManagementSection } from '@/components/profile/CEOManagementSection';
import { ManagerActivitySummary } from '@/components/profile/ManagerActivitySummary';
import { ApprovalHistory } from '@/components/profile/ApprovalHistory';
import { RecentActivityFeed } from '@/components/profile/RecentActivityFeed';

interface UserOrder {
  id: string;
  created_at: string;
  service_type: string;
  sub_type: string;
  length: number;
  width: number;
  height: number;
  status: string;
  location_address: string | null;
  location_distance: number | null;
}

interface ProjectOrder {
  id: string;
  created_at: string;
  code: string;
  status: string | null;
  address: string | null;
  estimated_price?: number | null;
}

interface ScaffoldingRequest {
  id: string;
  created_at: string;
  address: string | null;
  status: string;
  details: any | null;
}

export default function UserProfile() {
  usePageTitle('پروفایل کاربری');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isContractor } = useContractorRole();
  const { isCEO } = useCEORole();
  const { isAdmin } = useAdminRole();
  const { isGeneralManager } = useGeneralManagerRole();
  const { isSalesManager } = useSalesManagerRole();
  const { isFinanceManager } = useFinanceManagerRole();
  const { isExecutiveManager } = useExecutiveManagerRole();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [projectOrders, setProjectOrders] = useState<ProjectOrder[]>([]);
  const [scaffoldingRequests, setScaffoldingRequests] = useState<ScaffoldingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);

  const isManager = isCEO || isAdmin || isGeneralManager || isSalesManager || isFinanceManager || isExecutiveManager;

  // Compute roles for display in ProfileHeader
  const roles: string[] = [];
  if (isAdmin) roles.push('مدیر سیستم');
  if (isCEO) roles.push('مدیر عامل');
  if (isGeneralManager) roles.push('مدیر ارشد');
  if (isExecutiveManager) roles.push('مدیر اجرایی');
  if (isSalesManager) roles.push('مدیر فروش');
  if (isFinanceManager) roles.push('مدیر مالی');
  if (isContractor) roles.push('پیمانکار');

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchOrders();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setFullName(data?.full_name || '');
      setPhoneNumber(data?.phone_number || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

const fetchOrders = async () => {
  if (!user) return;

  try {
    // Legacy orders (if any)
    const { data: legacyOrders, error: legacyError } = await supabase
      .from('service_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (legacyError) {
      console.error('Error fetching legacy orders:', legacyError);
    } else {
      setOrders(legacyOrders || []);
    }

    // New projects-based orders (projects_v3)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let normalizedProjects: ProjectOrder[] = [];
    
    if (!customerError && customer) {
      const { data: projects, error: projectsError } = await supabase
        .from('projects_v3')
        .select('id, created_at, code, status, address, notes')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Error fetching projects_v3:', projectsError);
      } else {
        normalizedProjects = (projects || []).map((p: any) => {
          let estimated_price: number | null = null;
          try {
            const n = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
            estimated_price = n?.estimated_price ?? null;
          } catch {}
          return {
            id: p.id,
            created_at: p.created_at,
            code: p.code,
            status: p.status ?? null,
            address: p.address ?? null,
            estimated_price,
          } as ProjectOrder;
        });
      }
    }

    // New simple scaffolding requests (form reset)
    const { data: sreqs, error: sreqsError } = await supabase
      .from('scaffolding_requests')
      .select('id, created_at, address, status, details')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (sreqsError) {
      console.error('Error fetching scaffolding_requests:', sreqsError);
      setScaffoldingRequests([]);
    } else {
      setScaffoldingRequests(sreqs || []);
      
      // ترکیب scaffolding requests با project orders
      const scaffoldingAsOrders: ProjectOrder[] = (sreqs || []).map(req => {
        let estimatedPrice = null;
        try {
          const details = typeof req.details === 'string' ? JSON.parse(req.details) : req.details;
          estimatedPrice = details?.estimated_price || null;
        } catch {}
        
        return {
          id: req.id,
          created_at: req.created_at,
          code: `REQ-${req.id.slice(0, 8).toUpperCase()}`,
          status: req.status,
          address: req.address,
          estimated_price: estimatedPrice,
          notes: req.details ? JSON.stringify(req.details) : null,
        };
      });
      
      // ترکیب همه سفارشات
      const allOrders = [...normalizedProjects, ...scaffoldingAsOrders].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setProjectOrders(allOrders);
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    toast.error('خطا در دریافت سفارشات');
  } finally {
    setLoading(false);
  }
};

  const handleProfileUpdate = (newName: string) => {
    setFullName(newName);
  };

  const getTypeLabel = (type: string) => {
    return type === 'with-materials' ? 'به همراه اجناس' : 'بدون اجناس';
  };

  // Safely format dates to avoid runtime errors on invalid/empty values
  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    const t = new Date(d);
    return isNaN(t.getTime()) ? '-' : t.toLocaleDateString('fa-IR');
  };

  if (loading || !user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="در حال بارگذاری..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PageHeader 
          title={fullName || "پروفایل کاربری"} 
          description="مدیریت اطلاعات شخصی و سفارشات"
          showBackButton={true}
        />

        {/* Profile Header */}
        <ProfileHeader user={user} fullName={fullName} roles={roles} />

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto gap-2 bg-muted/50 p-1">
            <TabsTrigger 
              value="info" 
              className="text-sm sm:text-base py-3 font-semibold text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              اطلاعات کاربری
            </TabsTrigger>
            <TabsTrigger 
              value="projects" 
              className="text-sm sm:text-base py-3 font-semibold text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              پروژه‌های من
            </TabsTrigger>
            <TabsTrigger 
              value="orders" 
              className="text-sm sm:text-base py-3 font-semibold text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              سفارشات من
            </TabsTrigger>
            <TabsTrigger 
              value="invoice" 
              className="text-sm sm:text-base py-3 font-semibold text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              <Receipt className="h-4 w-4 ml-1 hidden sm:inline" />
              صورتحساب
            </TabsTrigger>
            <TabsTrigger 
              value="actions" 
              className="text-sm sm:text-base py-3 font-semibold text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              دسترسی سریع
            </TabsTrigger>
          </TabsList>

          {/* Profile Info Tab */}
          <TabsContent value="info" className="space-y-4">
            {/* CEO Management Section */}
            {isCEO && (
              <CEOManagementSection userId={user.id} userEmail={user.email || ''} />
            )}

            {/* Manager Activity Summary */}
            {isManager && (
              <ManagerActivitySummary userId={user.id} />
            )}

            <ProfileForm
              userId={user.id}
              initialFullName={fullName}
              phoneNumber={phoneNumber}
              onUpdate={handleProfileUpdate}
            />

            {/* Manager Activity Details */}
            {isManager && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ApprovalHistory userId={user.id} />
                </div>
                <div>
                  <RecentActivityFeed userId={user.id} limit={8} />
                </div>
              </div>
            )}

            {/* Staff Registration */}
            <div className="flex justify-center pt-4">
              <StaffRegistrationButton onClick={() => setStaffDialogOpen(true)} />
            </div>
          </TabsContent>

{/* Projects Tab */}
<TabsContent value="projects" className="mt-4">
  <div className="space-y-6">
    {/* Project Management Section */}
    <div className="space-y-4 p-4 rounded-lg border-2 border-primary/20 bg-card" data-tour="my-projects">
      <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
        <FolderKanban className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
        <span>مدیریت پروژه‌ها</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/user/projects')}
          className="p-4 rounded-lg border-2 border-primary/20 hover:border-primary/40 bg-background hover:bg-accent/5 transition-all text-right group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">پروژه‌های من</div>
              <div className="text-xs text-muted-foreground">مشاهده و مدیریت پروژه‌ها</div>
            </div>
          </div>
        </button>
        <button
          onClick={() => navigate('/')}
          className="p-4 rounded-lg border-2 border-primary/20 hover:border-primary/40 bg-background hover:bg-accent/5 transition-all text-right group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">پروژه جدید</div>
              <div className="text-xs text-muted-foreground">ایجاد پروژه با آدرس و خدمات</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</TabsContent>

{/* Orders Tab */}
<TabsContent value="orders" className="mt-4">
  <MyOrdersList userId={user.id} />
</TabsContent>

{/* Invoice Tab */}
<TabsContent value="invoice" className="mt-4">
  <CustomerInvoice />
</TabsContent>

          {/* Quick Actions Tab */}
          <TabsContent value="actions" className="space-y-6 mt-4">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" text="در حال بارگذاری..." />
              </div>
            }>
              {/* Support Ticket Section */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span>ثبت تیکت پشتیبانی</span>
                </h3>
                <TicketForm userId={user.id} />
              </div>

              {/* Contractor Registration Section */}
              {!isContractor && (
                <div className="space-y-4 pt-6 border-t">
                  <NewContractorForm 
                    userId={user.id} 
                    userEmail={user.email || ''} 
                  />
                </div>
              )}
            </Suspense>
          </TabsContent>
        </Tabs>

        {/* Staff Request Dialog */}
        <StaffRequestDialog
          open={staffDialogOpen}
          onOpenChange={setStaffDialogOpen}
        />
      </div>
    </MainLayout>
  );
}
