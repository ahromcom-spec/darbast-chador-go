import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MessageSquare, Briefcase } from 'lucide-react';
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

export default function UserProfile() {
  usePageTitle('پروفایل کاربری');
  const { user } = useAuth();
  const { isContractor } = useContractorRole();
  const [orders, setOrders] = useState<UserOrder[]>([]);
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
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
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
        <PageHeader title="پروفایل کاربری" />

        {/* Profile Header */}
        <ProfileHeader user={user} fullName={fullName} />

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
            <TabsTrigger value="info" className="text-sm sm:text-base py-2">
              اطلاعات کاربری
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-sm sm:text-base py-2">
              سفارشات من
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-sm sm:text-base py-2">
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
            {orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="سفارشی یافت نشد"
                description="شما هنوز هیچ سفارشی ثبت نکرده‌اید"
              />
            ) : (
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
            )}
          </TabsContent>

          {/* Quick Actions Tab */}
          <TabsContent value="actions" className="space-y-6 mt-4">
            {/* Support Ticket Section */}
            <div className="space-y-4">
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
