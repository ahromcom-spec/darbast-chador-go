import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ManagerActivitySummary } from '@/components/profile/ManagerActivitySummary';
import { ApprovalHistory } from '@/components/profile/ApprovalHistory';

export default function SalesDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['sales-stats'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('projects_v3')
        .select('status, payment_amount')
        .in('status', ['completed', 'paid', 'closed']);

      if (error) throw error;

      // Count pending approvals for sales manager (general or specialized)
      const { data: pendingApprovals, error: approvalsError } = await supabase
        .from('order_approvals')
        .select('order_id')
        .in('approver_role', ['sales_manager', 'sales_manager_scaffold_execution_with_materials'])
        .is('approved_at', null);

      if (approvalsError) throw approvalsError;

      const completed = orders?.filter(o => o.status === 'completed').length || 0;
      const paid = orders?.filter(o => o.status === 'paid').length || 0;
      const closed = orders?.filter(o => o.status === 'closed').length || 0;
      const totalRevenue = orders
        ?.filter(o => o.payment_amount)
        .reduce((sum, o) => sum + (o.payment_amount || 0), 0) || 0;

      return {
        awaitingApproval: pendingApprovals?.length || 0,
        completedOrders: completed,
        paidOrders: paid,
        closedOrders: closed,
        totalRevenue
      };
    }
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="داشبورد مدیریت فروش"
        description="مدیریت تسویه و پرداخت سفارشات"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2 cursor-pointer"
          onClick={() => navigate('/sales/pending-orders')}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">آماده تسویه</CardTitle>
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.completedOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">سفارشات آماده ثبت پرداخت</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">پرداخت شده</CardTitle>
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.paidOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">سفارشات با پرداخت ثبت شده</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">درآمد کل</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.totalRevenue || 0).toLocaleString('fa-IR')}
            </div>
            <p className="text-xs text-muted-foreground mt-2">تومان - کل درآمد ثبت شده</p>
          </CardContent>
        </Card>
      </div>

      {/* Manager Activity Summary */}
      {user && <ManagerActivitySummary userId={user.id} />}

      <Card>
        <CardHeader>
          <CardTitle>دسترسی سریع</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => navigate('/sales/pending-orders')}
          >
            <AlertCircle className="h-4 w-4" />
            سفارشات در انتظار تایید
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => navigate('/sales/orders')}
          >
            <DollarSign className="h-4 w-4" />
            مدیریت تسویه سفارشات
          </Button>
        </CardContent>
      </Card>

      {/* Approval History */}
      {user && <ApprovalHistory userId={user.id} />}
    </div>
  );
}
