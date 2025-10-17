import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Users, ShoppingCart, Clock, CheckCircle } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';

export default function ExecutiveDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['executive-stats'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('projects_v3')
        .select('status, customer_id')
        .in('status', ['approved', 'in_progress', 'completed']);

      if (error) throw error;

      const uniqueCustomers = new Set(orders?.map(o => o.customer_id) || []).size;
      const pending = orders?.filter(o => o.status === 'approved').length || 0;
      const inProgress = orders?.filter(o => o.status === 'in_progress').length || 0;
      const completed = orders?.filter(o => o.status === 'completed').length || 0;

      return {
        totalCustomers: uniqueCustomers,
        pendingExecution: pending,
        inProgress,
        completed
      };
    }
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="داشبورد مدیریت اجرا"
        description="مدیریت خدمات اجرای داربست به همراه اجناس"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="مشتریان فعال"
          value={stats?.totalCustomers || 0}
          icon={Users}
          description="کل مشتریان با سفارش"
        />
        <StatCard
          title="در انتظار اجرا"
          value={stats?.pendingExecution || 0}
          icon={Clock}
          description="سفارشات آماده اجرا"
        />
        <StatCard
          title="در حال اجرا"
          value={stats?.inProgress || 0}
          icon={ShoppingCart}
          description="سفارشات در دست اجرا"
        />
        <StatCard
          title="تکمیل شده"
          value={stats?.completed || 0}
          icon={CheckCircle}
          description="سفارشات اجرا شده"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>راهنمای استفاده</CardTitle>
          <CardDescription>وظایف و امکانات این بخش</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">مدیریت سفارشات</h4>
              <p className="text-sm text-muted-foreground">
                مشاهده و مدیریت سفارشات در انتظار اجرا و ثبت زمان شروع
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">مشاهده مشتریان</h4>
              <p className="text-sm text-muted-foreground">
                دسترسی به لیست مشتریان و سفارشات آن‌ها
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">تایید اجرا</h4>
              <p className="text-sm text-muted-foreground">
                تایید اتمام اجرای سفارشات و ارسال به بخش فروش
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
