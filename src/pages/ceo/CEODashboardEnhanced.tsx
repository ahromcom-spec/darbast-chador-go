import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { 
  ClipboardCheck, 
  Users, 
  UserCheck, 
  Shield, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package
} from 'lucide-react';

interface DashboardStats {
  pendingOrders: number;
  approvedOrders: number;
  completedOrders: number;
  rejectedOrders: number;
  totalCustomers: number;
  pendingApprovals: number;
}

export default function CEODashboardEnhanced() {
  const [stats, setStats] = useState<DashboardStats>({
    pendingOrders: 0,
    approvedOrders: 0,
    completedOrders: 0,
    rejectedOrders: 0,
    totalCustomers: 0,
    pendingApprovals: 0
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch order statistics
      const { data: orders, error: ordersError } = await supabase
        .from('projects_v3')
        .select('status');

      if (ordersError) throw ordersError;

      // Fetch customers count
      const { count: customersCount, error: customersError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      if (customersError) throw customersError;

      // Fetch pending CEO approvals
      const { data: approvals, error: approvalsError } = await supabase
        .from('order_approvals')
        .select('order_id')
        .eq('approver_role', 'ceo')
        .is('approved_at', null);

      if (approvalsError) throw approvalsError;

      // Calculate statistics
      const pending = orders?.filter(o => o.status === 'pending').length || 0;
      const approved = orders?.filter(o => o.status === 'approved').length || 0;
      const completed = orders?.filter(o => o.status === 'completed' || o.status === 'paid' || o.status === 'closed').length || 0;
      const rejected = orders?.filter(o => o.status === 'rejected').length || 0;

      setStats({
        pendingOrders: pending,
        approvedOrders: approved,
        completedOrders: completed,
        rejectedOrders: rejected,
        totalCustomers: customersCount || 0,
        pendingApprovals: approvals?.length || 0
      });
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'بارگذاری آمار داشبورد با خطا مواجه شد'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">داشبورد مدیرعامل</h1>
        <p className="text-muted-foreground mt-2">
          مدیریت کلی سفارشات و نظارت بر عملکرد سیستم
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/ceo/orders')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              در انتظار تایید شما
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">
              سفارش نیاز به تایید نهایی دارد
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              سفارشات تایید شده
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedOrders}</div>
            <p className="text-xs text-muted-foreground">
              در مرحله اجرا
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              سفارشات تکمیل شده
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedOrders}</div>
            <p className="text-xs text-muted-foreground">
              سفارش انجام شده
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              کل مشتریان
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              مشتری ثبت نام شده
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              سفارشات در انتظار
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              در مرحله بررسی و تایید
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              سفارشات رد شده
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejectedOrders}</div>
            <p className="text-xs text-muted-foreground">
              سفارش رد شده
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">سفارشات</TabsTrigger>
          <TabsTrigger value="management">مدیریت</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">سفارشات در انتظار تایید</CardTitle>
                <CardDescription>
                  سفارشاتی که نیاز به تایید نهایی شما دارند
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/ceo/orders')}
                  className="w-full"
                  variant={stats.pendingApprovals > 0 ? 'default' : 'outline'}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  مشاهده سفارشات ({stats.pendingApprovals})
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">گزارش عملکرد</CardTitle>
                <CardDescription>
                  آمار کلی سفارشات و عملکرد سیستم
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">نرخ تایید:</span>
                    <span className="font-medium">
                      {stats.pendingOrders + stats.approvedOrders + stats.completedOrders > 0
                        ? Math.round(((stats.approvedOrders + stats.completedOrders) / (stats.pendingOrders + stats.approvedOrders + stats.completedOrders + stats.rejectedOrders)) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">نرخ تکمیل:</span>
                    <span className="font-medium">
                      {stats.approvedOrders + stats.completedOrders > 0
                        ? Math.round((stats.completedOrders / (stats.approvedOrders + stats.completedOrders)) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="management" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  تایید پرسنل
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/ceo/staff-verifications')}
                  variant="outline"
                  className="w-full"
                >
                  مشاهده درخواست‌ها
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  تایید پیمانکاران
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/ceo/contractor-verifications')}
                  variant="outline"
                  className="w-full"
                >
                  مشاهده درخواست‌ها
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  مدیریت دسترسی
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate('/ceo/whitelist')}
                  variant="outline"
                  className="w-full"
                >
                  مدیریت لیست سفید
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Workflow Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">راهنمای گردش کار</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
                <span className="text-blue-700 dark:text-blue-300 font-bold">1</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">ثبت سفارش توسط مشتری</p>
                <p className="text-muted-foreground">مشتری فرم سفارش را پر کرده و ارسال می‌کند</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-2">
                <span className="text-purple-700 dark:text-purple-300 font-bold">2</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">بررسی و تایید مدیر فروش</p>
                <p className="text-muted-foreground">مدیر فروش سفارش را بررسی و تایید می‌کند</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-2">
                <span className="text-green-700 dark:text-green-300 font-bold">3</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">بررسی و تایید مدیر اجرایی</p>
                <p className="text-muted-foreground">مدیر اجرایی سفارش را از نظر فنی بررسی می‌کند</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-2">
                <span className="text-yellow-700 dark:text-yellow-300 font-bold">4</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">تایید نهایی مدیرعامل (شما)</p>
                <p className="text-muted-foreground">تایید نهایی و ارسال به مرحله اجرا</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-teal-100 dark:bg-teal-900/30 rounded-full p-2">
                <span className="text-teal-700 dark:text-teal-300 font-bold">5</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">اجرای سفارش</p>
                <p className="text-muted-foreground">مدیر اجرایی پروژه را اجرا و تکمیل می‌کند</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
