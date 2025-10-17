import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MessageSquare, Briefcase, FolderKanban } from 'lucide-react';
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
import { useContractorRole } from '@/hooks/useContractorRole';

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

export default function UserProfile() {
  usePageTitle('پروفایل کاربری');
  const { user } = useAuth();
  const { isContractor } = useContractorRole();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [projectOrders, setProjectOrders] = useState<ProjectOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);

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
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setFullName(data?.full_name || '');
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

    if (!customerError && customer) {
      const { data: projects, error: projectsError } = await supabase
        .from('projects_v3')
        .select('id, created_at, code, status, address, notes')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Error fetching projects_v3:', projectsError);
        setProjectOrders([]);
      } else {
        const normalized = (projects || []).map((p: any) => {
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
        setProjectOrders(normalized);
      }
    } else {
      setProjectOrders([]);
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
          title="پروفایل کاربری" 
          description="مدیریت اطلاعات شخصی و سفارشات"
          showBackButton={true}
        />

        {/* Profile Header */}
        <ProfileHeader user={user} fullName={fullName} />

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-2 bg-muted/50 p-1">
            <TabsTrigger 
              value="info" 
              className="text-sm sm:text-base py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              اطلاعات کاربری
            </TabsTrigger>
            <TabsTrigger 
              value="orders" 
              className="text-sm sm:text-base py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              سفارشات من
            </TabsTrigger>
            <TabsTrigger 
              value="actions" 
              className="text-sm sm:text-base py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all"
            >
              دسترسی سریع
            </TabsTrigger>
          </TabsList>

          {/* Profile Info Tab */}
          <TabsContent value="info" className="space-y-4">
            <ProfileForm
              userId={user.id}
              initialFullName={fullName}
              onUpdate={handleProfileUpdate}
            />

            {/* Staff Registration */}
            <div className="flex justify-center pt-4">
              <StaffRegistrationButton onClick={() => setStaffDialogOpen(true)} />
            </div>
          </TabsContent>

{/* Orders Tab */}
<TabsContent value="orders" className="mt-4">
  {orders.length === 0 && projectOrders.length === 0 ? (
    <EmptyState
      icon={Package}
      title="سفارشی یافت نشد"
      description="شما هنوز هیچ سفارشی ثبت نکرده‌اید"
    />
  ) : (
    <div className="space-y-6">
      {projectOrders.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">سفارشات ثبت شده</h3>
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">تاریخ ثبت</TableHead>
                    <TableHead className="whitespace-nowrap">کد پروژه</TableHead>
                    <TableHead className="whitespace-nowrap">وضعیت</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">آدرس</TableHead>
                    <TableHead className="whitespace-nowrap">قیمت تخمینی</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(po.created_at).toLocaleDateString('fa-IR')}
                      </TableCell>
                      <TableCell dir="ltr" className="whitespace-nowrap text-sm">
                        {po.code}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={po.status || 'draft'} />
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {po.address || '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {po.estimated_price ? `${po.estimated_price.toLocaleString('fa-IR')} تومان` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">درخواست‌های قدیمی</h3>
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">تاریخ ثبت</TableHead>
                    <TableHead className="whitespace-nowrap">نوع خدمات</TableHead>
                    <TableHead className="whitespace-nowrap">ابعاد (متر)</TableHead>
                    <TableHead className="whitespace-nowrap">وضعیت</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">آدرس</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(order.created_at).toLocaleDateString('fa-IR')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {getTypeLabel(order.sub_type)}
                      </TableCell>
                      <TableCell dir="ltr" className="whitespace-nowrap text-sm">
                        {order.length} × {order.width} × {order.height}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {order.location_address || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
</TabsContent>

          {/* Quick Actions Tab */}
          <TabsContent value="actions" className="space-y-6 mt-4">
            {/* Project Management Section */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <FolderKanban className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span>مدیریت پروژه‌ها</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => window.location.href = '/user/projects'}
                  className="p-4 rounded-lg border-2 border-primary/20 hover:border-primary/40 bg-card hover:bg-accent/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">پروژه‌های من</div>
                      <div className="text-xs text-muted-foreground">مشاهده و مدیریت پروژه‌ها</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => window.location.href = '/user/create-project'}
                  className="p-4 rounded-lg border-2 border-primary/20 hover:border-primary/40 bg-card hover:bg-accent/5 transition-all text-right group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">پروژه جدید</div>
                      <div className="text-xs text-muted-foreground">ایجاد پروژه با آدرس و خدمات</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Support Ticket Section */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
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
