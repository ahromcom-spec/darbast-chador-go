import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, Eye, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPersianDate } from '@/lib/dateUtils';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  notes: any;
  payment_amount: number | null;
  payment_method: string | null;
  transaction_reference: string | null;
}

export default function SalesCompletedOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
          detailed_address,
          created_at,
          notes,
          payment_amount,
          payment_method,
          transaction_reference,
          customer_id,
          subcategory_id,
          customers!inner(
            user_id,
            profiles!inner(full_name, phone_number)
          )
        `)
        .eq('status', 'completed')
        .eq('subcategory_id', '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d')
        .order('code', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((order: any) => ({
        id: order.id,
        code: order.code,
        status: order.status,
        address: order.address,
        detailed_address: order.detailed_address,
        created_at: order.created_at,
        notes: order.notes,
        payment_amount: order.payment_amount,
        payment_method: order.payment_method,
        transaction_reference: order.transaction_reference,
        customer_name: order.customers?.profiles?.full_name || 'نامشخص',
        customer_phone: order.customers?.profiles?.phone_number || ''
      }));

      setOrders(mapped);
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

  const handleConfirmPayment = async () => {
    if (!selectedOrder || !user) return;
    
    if (!paymentAmount || !paymentMethod) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفا مبلغ و روش پرداخت را وارد کنید'
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
          transaction_reference: transactionRef,
          payment_confirmed_by: user.id,
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: '✓ پرداخت تایید شد',
        description: `پرداخت سفارش ${selectedOrder.code} ثبت شد.`
      });

      setPaymentDialogOpen(false);
      setSelectedOrder(null);
      setPaymentAmount('');
      setPaymentMethod('');
      setTransactionRef('');
      fetchOrders();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'تایید پرداخت با خطا مواجه شد'
      });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="سفارشات در انتظار پرداخت"
        description="سفارشات تکمیل شده که منتظر دریافت پول هستند"
        showBackButton={true}
        backTo="/sales"
      />

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی در انتظار پرداخت وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                    <CardDescription className="mt-1">
                      مشتری: {order.customer_name} • {order.customer_phone}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-green-600">در انتظار پرداخت</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">آدرس</Label>
                  <p className="text-sm mt-1">{order.address}</p>
                  {order.detailed_address && (
                    <p className="text-sm text-muted-foreground mt-1">{order.detailed_address}</p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setDetailsOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    جزئیات
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setPaymentDialogOpen(true);
                    }}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <DollarSign className="h-4 w-4" />
                    ثبت پرداخت
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت پرداخت سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>
              اطلاعات پرداخت را وارد کنید
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">مبلغ (ریال) *</Label>
              <Input
                id="amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="مثال: 50000000"
              />
            </div>
            <div>
              <Label htmlFor="method">روش پرداخت *</Label>
              <Input
                id="method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="مثال: نقد، کارت به کارت، چک"
              />
            </div>
            <div>
              <Label htmlFor="reference">شماره پیگیری / مرجع</Label>
              <Input
                id="reference"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="اختیاری"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleConfirmPayment}>
              ثبت پرداخت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <Label className="font-semibold">مشتری</Label>
                <p className="text-sm">{selectedOrder.customer_name} • {selectedOrder.customer_phone}</p>
              </div>
              <div>
                <Label className="font-semibold">آدرس</Label>
                <p className="text-sm">{selectedOrder.address}</p>
                {selectedOrder.detailed_address && (
                  <p className="text-sm text-muted-foreground">{selectedOrder.detailed_address}</p>
                )}
              </div>
              <div>
                <Label className="font-semibold">تاریخ ثبت</Label>
                <p className="text-sm">{formatPersianDate(selectedOrder.created_at, { showDayOfWeek: true })}</p>
              </div>
              {selectedOrder.notes && (
                <div>
                  <Label className="font-semibold">جزئیات سفارش</Label>
                  <pre className="text-xs bg-secondary p-3 rounded mt-1 overflow-auto max-h-60">
                    {JSON.stringify(selectedOrder.notes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
