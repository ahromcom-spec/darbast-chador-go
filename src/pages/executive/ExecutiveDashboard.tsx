import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Users, ShoppingCart, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { ManagerActivitySummary } from '@/components/profile/ManagerActivitySummary';
import { ApprovalHistory } from '@/components/profile/ApprovalHistory';
import { ExecutiveOrdersSummary } from '@/components/executive/ExecutiveOrdersSummary';

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['executive-stats'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('projects_v3')
        .select('status, customer_id')
        .in('status', ['approved', 'in_progress', 'completed']);

      if (error) throw error;

      // Count pending approvals for executive manager
      const { data: pendingApprovals, error: approvalsError } = await supabase
        .from('order_approvals')
        .select('order_id')
        .in('approver_role', ['scaffold_executive_manager','executive_manager_scaffold_execution_with_materials'])
        .is('approved_at', null);

      if (approvalsError) throw approvalsError;

      const uniqueCustomers = new Set(orders?.map(o => o.customer_id) || []).size;
      const pending = orders?.filter(o => o.status === 'approved').length || 0;
      const inProgress = orders?.filter(o => o.status === 'in_progress').length || 0;
      const completed = orders?.filter(o => o.status === 'completed').length || 0;

      return {
        totalCustomers: uniqueCustomers,
        pendingExecution: pending,
        inProgress,
        completed,
        awaitingApproval: pendingApprovals?.length || 0
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
        <Card 
          className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2 cursor-pointer"
          onClick={() => navigate('/executive/pending-orders')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">در انتظار تایید</CardTitle>
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.awaitingApproval || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">سفارشات نیاز به تایید شما</p>
            <Button variant="link" className="p-0 h-auto text-xs mt-2">
              مشاهده و تایید →
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">مشتریان فعال</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">کل مشتریان با سفارش</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">در انتظار اجرا</CardTitle>
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.pendingExecution || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">سفارشات آماده اجرا</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">در حال اجرا</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.inProgress || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">سفارشات در دست اجرا</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">تکمیل شده</CardTitle>
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.completed || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">سفارشات اجرا شده</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Summary */}
      <ExecutiveOrdersSummary />

      {/* Manager Activity Summary */}
      {user && <ManagerActivitySummary userId={user.id} />}

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

      {/* Approval History */}
      {user && <ApprovalHistory userId={user.id} />}
    </div>
  );
}
