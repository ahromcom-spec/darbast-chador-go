import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock, CheckCircle, TrendingUp, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { formatPersianDate } from '@/lib/dateUtils';

interface FinanceStats {
  awaitingPaymentCount: number;
  awaitingPaymentAmount: number;
  paidCount: number;
  paidAmount: number;
  closedCount: number;
  closedAmount: number;
  todayPaymentsCount: number;
  todayPaymentsAmount: number;
}

export default function FinanceDashboard() {
  const [stats, setStats] = useState<FinanceStats>({
    awaitingPaymentCount: 0,
    awaitingPaymentAmount: 0,
    paidCount: 0,
    paidAmount: 0,
    closedCount: 0,
    closedAmount: 0,
    todayPaymentsCount: 0,
    todayPaymentsAmount: 0
  });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
    fetchRecentPayments();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch orders awaiting payment
      const { data: awaitingData } = await supabase
        .from('projects_v3')
        .select('id, payment_amount')
        .eq('execution_stage', 'awaiting_payment')
        .or('is_archived.is.null,is_archived.eq.false');

      // Fetch paid orders
      const { data: paidData } = await supabase
        .from('projects_v3')
        .select('id, payment_amount')
        .eq('status', 'paid')
        .or('is_archived.is.null,is_archived.eq.false');

      // Fetch closed orders
      const { data: closedData } = await supabase
        .from('projects_v3')
        .select('id, payment_amount')
        .eq('status', 'closed')
        .or('is_archived.is.null,is_archived.eq.false');

      // Fetch today's payments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayPayments } = await supabase
        .from('order_payments')
        .select('amount')
        .gte('created_at', today.toISOString());

      setStats({
        awaitingPaymentCount: awaitingData?.length || 0,
        awaitingPaymentAmount: awaitingData?.reduce((sum, o) => sum + (o.payment_amount || 0), 0) || 0,
        paidCount: paidData?.length || 0,
        paidAmount: paidData?.reduce((sum, o) => sum + (o.payment_amount || 0), 0) || 0,
        closedCount: closedData?.length || 0,
        closedAmount: closedData?.reduce((sum, o) => sum + (o.payment_amount || 0), 0) || 0,
        todayPaymentsCount: todayPayments?.length || 0,
        todayPaymentsAmount: todayPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'دریافت آمار با خطا مواجه شد'
      });
    }
  };

  const fetchRecentPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('order_payments')
        .select(`
          id,
          amount,
          payment_method,
          created_at,
          order_id,
          projects_v3!inner(code, customer_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentPayments(data || []);
    } catch (error) {
      console.error('Error fetching recent payments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد حسابداری"
        description="مدیریت مالی و پرداخت‌های سفارشات"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              در انتظار پرداخت
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.awaitingPaymentCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.awaitingPaymentAmount.toLocaleString('fa-IR')} تومان
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              پرداخت شده
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.paidCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.paidAmount.toLocaleString('fa-IR')} تومان
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-gray-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              بسته شده
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.closedCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.closedAmount.toLocaleString('fa-IR')} تومان
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              پرداخت‌های امروز
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.todayPaymentsCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.todayPaymentsAmount.toLocaleString('fa-IR')} تومان
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            آخرین پرداخت‌ها
          </CardTitle>
          <CardDescription>
            ۵ پرداخت اخیر ثبت شده
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">پرداختی ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">سفارش {payment.projects_v3?.code}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPersianDate(payment.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {payment.payment_method && (
                      <Badge variant="outline">{payment.payment_method}</Badge>
                    )}
                    <span className="font-bold text-green-600">
                      {payment.amount.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
