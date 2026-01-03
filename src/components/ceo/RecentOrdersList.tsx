import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface RecentOrder {
  id: string;
  code: string;
  customer_name: string;
  status: string;
  created_at: string;
}

export const RecentOrdersList = () => {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  const fetchRecentOrders = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_orders_with_customer_info')
        .order('code', { ascending: false })
        .limit(10);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching recent orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>آخرین سفارشات</CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/ceo/orders')}
        >
          مشاهده همه
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              سفارشی یافت نشد
            </p>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{order.code}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.customer_name || 'مشتری نامشخص'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('fa-IR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/ceo/orders/${order.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
