import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CheckCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  payment_amount: number | null;
  payment_method: string | null;
  transaction_reference: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
}

export default function FinanceOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          address,
          payment_amount,
          payment_method,
          transaction_reference,
          created_at,
          customer_id,
          customers!inner(user_id),
          profiles:customers(profiles!inner(full_name, phone_number))
        `)
        .in('status', ['paid', 'closed'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders = data?.map((order: any) => ({
        id: order.id,
        code: order.code,
        status: order.status,
        address: order.address,
        payment_amount: order.payment_amount,
        payment_method: order.payment_method,
        transaction_reference: order.transaction_reference,
        created_at: order.created_at,
        customer_name: order.profiles?.[0]?.profiles?.full_name || 'نامشخص',
        customer_phone: order.profiles?.[0]?.profiles?.phone_number || ''
      })) || [];

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'دریافت سفارشات با خطا مواجه شد'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'closed',
          financial_confirmed_by: (await supabase.auth.getUser()).data.user?.id,
          financial_confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'سفارش با موفقیت بسته شد'
      });

      fetchOrders();
    } catch (error) {
      console.error('Error closing order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'بستن سفارش با خطا مواجه شد'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
      paid: { label: 'پرداخت شده', variant: 'default' },
      closed: { label: 'بسته شده', variant: 'secondary' }
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'default' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="مدیریت مالی"
        description="بررسی و تایید تراکنش‌های مالی"
      />

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              تراکنشی برای بررسی وجود ندارد
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                    <CardDescription>
                      مشتری: {order.customer_name} • {order.customer_phone}
                    </CardDescription>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">آدرس</Label>
                  <p className="text-sm">{order.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">مبلغ پرداخت</Label>
                    <p className="text-lg font-semibold text-primary">
                      {order.payment_amount?.toLocaleString('fa-IR')} تومان
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">روش پرداخت</Label>
                    <p className="text-sm">{order.payment_method}</p>
                  </div>
                </div>

                {order.transaction_reference && (
                  <div>
                    <Label className="text-sm text-muted-foreground">شماره پیگیری</Label>
                    <p className="text-sm font-mono">{order.transaction_reference}</p>
                  </div>
                )}

                {order.status === 'paid' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleCloseOrder(order.id)}
                      size="sm"
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      تایید و بستن سفارش
                    </Button>
                  </div>
                )}

                {order.status === 'closed' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    سفارش با موفقیت بسته شد
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
