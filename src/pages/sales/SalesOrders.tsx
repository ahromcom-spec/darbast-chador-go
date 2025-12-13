import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';
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

export default function SalesOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
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
          created_at
        `)
        .eq('status', 'completed')
        .order('code', { ascending: false });

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

  const handleRecordPayment = async () => {
    if (!selectedOrder || !paymentAmount || !paymentMethod) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفا تمام فیلدها را پر کنید'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'paid',
          payment_amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          transaction_reference: transactionRef || null,
          payment_confirmed_by: (await supabase.auth.getUser()).data.user?.id,
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'پرداخت ثبت شد'
      });

      setSelectedOrder(null);
      setPaymentAmount('');
      setPaymentMethod('');
      setTransactionRef('');
      fetchOrders();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'ثبت پرداخت با خطا مواجه شد'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
      completed: { label: 'آماده تسویه', variant: 'default' },
      paid: { label: 'پرداخت شده', variant: 'secondary' }
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'default' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="مدیریت فروش و تسویه"
        description="ثبت پرداخت و تسویه مالی سفارشات"
      />

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              سفارشی برای تسویه وجود ندارد
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

                {order.payment_amount && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">مبلغ پرداخت</Label>
                      <p className="text-sm font-medium">
                        {order.payment_amount.toLocaleString('fa-IR')} تومان
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">روش پرداخت</Label>
                      <p className="text-sm">{order.payment_method}</p>
                    </div>
                  </div>
                )}

                {order.status === 'completed' && (
                  <Button
                    onClick={() => setSelectedOrder(order)}
                    size="sm"
                    className="gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    ثبت پرداخت
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedOrder && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>ثبت پرداخت برای سفارش {selectedOrder.code}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="payment-amount">مبلغ پرداخت (تومان)</Label>
              <Input
                id="payment-amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="مبلغ را وارد کنید"
              />
            </div>

            <div>
              <Label htmlFor="payment-method">روش پرداخت</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="روش پرداخت را انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدی</SelectItem>
                  <SelectItem value="card">کارت به کارت</SelectItem>
                  <SelectItem value="cheque">چک</SelectItem>
                  <SelectItem value="online">پرداخت آنلاین</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="transaction-ref">شماره پیگیری (اختیاری)</Label>
              <Input
                id="transaction-ref"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="شماره پیگیری تراکنش"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleRecordPayment} className="gap-2">
                <DollarSign className="h-4 w-4" />
                ثبت پرداخت
              </Button>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                انصراف
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
