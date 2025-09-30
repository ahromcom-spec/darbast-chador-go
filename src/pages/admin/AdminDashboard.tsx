import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Users, Clock, CheckCircle } from 'lucide-react';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // دریافت آمار سفارشات
        const { data: orders } = await supabase
          .from('service_requests')
          .select('status');

        const totalOrders = orders?.length || 0;
        const pendingOrders = orders?.filter((o) => o.status === 'pending').length || 0;
        const completedOrders = orders?.filter((o) => o.status === 'completed').length || 0;

        // دریافت تعداد کاربران
        const { data: users } = await supabase
          .from('profiles')
          .select('id');

        setStats({
          totalOrders,
          pendingOrders,
          completedOrders,
          totalUsers: users?.length || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'کل سفارشات',
      value: stats.totalOrders,
      icon: Package,
      description: 'تعداد کل سفارشات ثبت شده',
      color: 'text-blue-600',
    },
    {
      title: 'سفارشات در انتظار',
      value: stats.pendingOrders,
      icon: Clock,
      description: 'سفارشات در حال بررسی',
      color: 'text-yellow-600',
    },
    {
      title: 'سفارشات تکمیل شده',
      value: stats.completedOrders,
      icon: CheckCircle,
      description: 'سفارشات انجام شده',
      color: 'text-green-600',
    },
    {
      title: 'کاربران',
      value: stats.totalUsers,
      icon: Users,
      description: 'تعداد کاربران ثبت‌نام شده',
      color: 'text-purple-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">داشبورد مدیریت</h1>
        <p className="text-muted-foreground mt-2">خلاصه وضعیت سیستم</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
