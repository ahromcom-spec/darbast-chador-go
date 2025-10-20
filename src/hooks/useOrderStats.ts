import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderStats {
  total: number;
  pending: number;
  approved: number;
  in_progress: number;
  completed: number;
  paid: number;
  closed: number;
  rejected: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface OrderTrend {
  date: string;
  count: number;
  revenue: number;
}

export const useOrderStats = () => {
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    approved: 0,
    in_progress: 0,
    completed: 0,
    paid: 0,
    closed: 0,
    rejected: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
  });
  const [trends, setTrends] = useState<OrderTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch all orders
      const { data: orders, error } = await supabase
        .from('projects_v3')
        .select('status, payment_amount, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const statsData: OrderStats = {
        total: orders?.length || 0,
        pending: orders?.filter(o => o.status === 'pending').length || 0,
        approved: orders?.filter(o => o.status === 'approved').length || 0,
        in_progress: orders?.filter(o => o.status === 'in_progress').length || 0,
        completed: orders?.filter(o => o.status === 'completed').length || 0,
        paid: orders?.filter(o => o.status === 'paid').length || 0,
        closed: orders?.filter(o => o.status === 'closed').length || 0,
        rejected: orders?.filter(o => o.status === 'rejected').length || 0,
        totalRevenue: orders?.reduce((sum, o) => sum + (o.payment_amount || 0), 0) || 0,
        averageOrderValue: 0,
      };

      if (statsData.total > 0) {
        statsData.averageOrderValue = statsData.totalRevenue / statsData.total;
      }

      setStats(statsData);

      // Calculate trends (last 7 days)
      const trendsData: { [key: string]: { count: number; revenue: number } } = {};
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      last7Days.forEach(date => {
        trendsData[date] = { count: 0, revenue: 0 };
      });

      orders?.forEach(order => {
        const date = order.created_at.split('T')[0];
        if (trendsData[date]) {
          trendsData[date].count++;
          trendsData[date].revenue += order.payment_amount || 0;
        }
      });

      const trendsArray = Object.entries(trendsData).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }),
        count: data.count,
        revenue: data.revenue,
      }));

      setTrends(trendsArray);
    } catch (error) {
      console.error('Error fetching order stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, trends, loading, refetch: fetchStats };
};
