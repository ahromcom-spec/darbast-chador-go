import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package } from 'lucide-react';
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
      <PageHeader title="پروفایل کاربری" />

      <div className="space-y-6">
        {/* Profile Header */}
        <ProfileHeader user={user} fullName={fullName} />

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">اطلاعات کاربری</TabsTrigger>
            <TabsTrigger value="orders">سفارشات من</TabsTrigger>
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
          <TabsContent value="orders">
            {orders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="سفارشی یافت نشد"
                description="شما هنوز هیچ سفارشی ثبت نکرده‌اید"
              />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاریخ ثبت</TableHead>
                      <TableHead>نوع خدمات</TableHead>
                      <TableHead>ابعاد (متر)</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>آدرس</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          {new Date(order.created_at).toLocaleDateString('fa-IR')}
                        </TableCell>
                        <TableCell>{getTypeLabel(order.sub_type)}</TableCell>
                        <TableCell dir="ltr">
                          {order.length} × {order.width} × {order.height}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {order.location_address || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Staff Request Dialog */}
      <StaffRequestDialog
        open={staffDialogOpen}
        onOpenChange={setStaffDialogOpen}
      />
    </MainLayout>
  );
}
