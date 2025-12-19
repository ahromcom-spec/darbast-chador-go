import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Users, ShoppingCart, Clock, CheckCircle, AlertCircle, Package, Calendar, TrendingUp, PlayCircle, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ManagerActivitySummary } from '@/components/profile/ManagerActivitySummary';
import { ApprovalHistory } from '@/components/profile/ApprovalHistory';
import { ExecutiveOrdersSummary } from '@/components/executive/ExecutiveOrdersSummary';
import ExecutiveGlobe from '@/components/executive/ExecutiveGlobe';
import goldenGlobe from '@/assets/golden-globe-rotating.png';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface MonthlyData {
  month: string;
  completed: number;
  avgDays: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  approved: 'hsl(var(--chart-1))',
  inProgress: 'hsl(var(--chart-2))',
  completed: 'hsl(var(--chart-3))',
  paid: 'hsl(var(--chart-4))',
};

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showGlobe, setShowGlobe] = useState(false);
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['executive-stats'],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('projects_v3')
        .select('*')
        .in('status', ['approved', 'in_progress', 'completed', 'paid']);

      if (error) throw error;

      // Count pending approvals for executive manager
      const { data: pendingApprovals, error: approvalsError } = await supabase
        .from('order_approvals')
        .select('order_id')
        .in('approver_role', ['scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials', 'rental_executive_manager'])
        .is('approved_at', null);

      if (approvalsError) throw approvalsError;

      const uniqueCustomers = new Set(orders?.map(o => o.customer_id) || []).size;
      const pending = orders?.filter(o => o.status === 'approved').length || 0;
      const inProgress = orders?.filter(o => o.status === 'in_progress').length || 0;
      const completed = orders?.filter(o => o.status === 'completed' || o.status === 'paid').length || 0;

      // Calculate completion time
      const completedWithDates = orders?.filter(
        o => (o.status === 'completed' || o.status === 'paid') && 
             o.execution_start_date && 
             o.execution_end_date
      ) || [];

      let totalCompletionDays = 0;
      completedWithDates.forEach(order => {
        const start = new Date(order.execution_start_date!);
        const end = new Date(order.execution_end_date!);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        totalCompletionDays += days;
      });

      const avgCompletionDays = completedWithDates.length > 0 
        ? Math.round(totalCompletionDays / completedWithDates.length) 
        : 0;

      // Status distribution
      const statusData: StatusData[] = [
        { name: 'آماده اجرا', value: pending, color: COLORS.approved },
        { name: 'در حال اجرا', value: inProgress, color: COLORS.inProgress },
        { name: 'تکمیل شده', value: completed, color: COLORS.completed },
      ].filter(item => item.value > 0);

      // Monthly completion data (last 6 months)
      const monthlyMap = new Map<string, { completed: number; totalDays: number; count: number }>();
      
      completedWithDates.forEach(order => {
        const endDate = new Date(order.execution_end_date!);
        const monthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
        
        const start = new Date(order.execution_start_date!);
        const days = Math.ceil((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { completed: 0, totalDays: 0, count: 0 });
        }
        
        const data = monthlyMap.get(monthKey)!;
        data.completed += 1;
        data.totalDays += days;
        data.count += 1;
      });

      const monthNames = [
        'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
      ];

      const monthlyData: MonthlyData[] = Array.from(monthlyMap.entries())
        .map(([key, value]) => {
          const [year, month] = key.split('-');
          return {
            month: monthNames[parseInt(month) - 1],
            completed: value.completed,
            avgDays: Math.round(value.totalDays / value.count),
          };
        })
        .slice(-6);

      return {
        totalCustomers: uniqueCustomers,
        totalOrders: orders?.length || 0,
        pendingExecution: pending,
        inProgress,
        completed,
        awaitingApproval: pendingApprovals?.length || 0,
        avgCompletionDays,
        totalCompletionDays,
        statusData,
        monthlyData,
      };
    }
  });

  if (isLoading) return <LoadingSpinner />;

  // نمایش کره زمین
  if (showGlobe) {
    return <ExecutiveGlobe onClose={() => setShowGlobe(false)} />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="داشبورد مدیریت اجرا"
        description="مدیریت خدمات اجرای داربست به همراه اجناس"
      />

      {/* بخش کره زمین */}
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div 
              className="relative cursor-pointer group"
              onClick={() => setShowGlobe(true)}
            >
              <img 
                src={goldenGlobe} 
                alt="کره زمین سفارشات" 
                className="w-32 h-32 md:w-40 md:h-40 animate-[wiggle_3s_ease-in-out_infinite] drop-shadow-xl group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-primary/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex-1 text-center md:text-right space-y-3">
              <h3 className="text-xl font-bold flex items-center justify-center md:justify-end gap-2">
                <Globe className="w-5 h-5 text-primary" />
                نقشه سفارشات روی کره زمین
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                مشاهده موقعیت تمام سفارشات خدمات اجرای داربست به همراه اجناس روی کره زمین سه‌بعدی.
                با کلیک روی هر سفارش می‌توانید مستقیماً به صفحه مدیریت آن بروید.
              </p>
              <Button 
                onClick={() => setShowGlobe(true)}
                className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              >
                <Globe className="w-4 h-4" />
                نمایش سفارشات روی کره
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <CardTitle className="text-sm font-medium text-muted-foreground">کل پروژه‌ها</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">تعداد کل سفارشات</p>
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
              <PlayCircle className="h-5 w-5 text-blue-600" />
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

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">میانگین زمان تکمیل</CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.avgCompletionDays || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">روز میانگین اجرا</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      {stats && stats.monthlyData && stats.monthlyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          {stats.statusData && stats.statusData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>توزیع وضعیت پروژه‌ها</CardTitle>
                <CardDescription>نمای کلی از وضعیت‌های مختلف سفارشات</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Monthly Completion Trend */}
          <Card>
            <CardHeader>
              <CardTitle>روند تکمیل ماهانه</CardTitle>
              <CardDescription>تعداد پروژه‌های تکمیل شده در ماه‌های اخیر</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill={COLORS.completed} name="تعداد تکمیل شده" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Average Completion Time Trend */}
      {stats && stats.monthlyData && stats.monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>روند میانگین زمان تکمیل</CardTitle>
            <CardDescription>میانگین روزهای صرف شده برای تکمیل پروژه‌ها در هر ماه</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgDays" 
                  stroke={COLORS.inProgress} 
                  name="میانگین روز تکمیل"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
