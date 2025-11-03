import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Calendar, Package, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ExecutiveOrdersSummary() {
  const { data: recentOrders, isLoading } = useQuery({
    queryKey: ['executive-recent-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          created_at,
          execution_start_date,
          customer_id
        `)
        .in('status', ['approved', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Fetch customer info separately
      const ordersWithCustomer = await Promise.all(
        (data || []).map(async (order) => {
          const { data: customerData } = await supabase
            .from('customers')
            .select('user_id')
            .eq('id', order.customer_id)
            .single();

          if (customerData) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', customerData.user_id)
              .single();

            return {
              ...order,
              customer_name: profileData?.full_name || 'نامشخص'
            };
          }

          return {
            ...order,
            customer_name: 'نامشخص'
          };
        })
      );

      return ordersWithCustomer;
    }
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          آخرین سفارشات برای اجرا
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!recentOrders || recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            سفارشی برای نمایش وجود ندارد
          </p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{order.code}</span>
                    <Badge
                      variant="secondary"
                      className={
                        order.status === 'approved'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      }
                    >
                      {order.status === 'approved' ? 'آماده اجرا' : 'در حال اجرا'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.customer_name}
                  </p>
                  {order.execution_start_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(order.execution_start_date).toLocaleDateString('fa-IR')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString('fa-IR', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
