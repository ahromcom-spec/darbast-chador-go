import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Eye, Search, User, Banknote, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { formatPersianDate } from '@/lib/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  payment_amount: number | null;
  total_paid: number | null;
  payment_confirmed_at: string | null;
  notes: any;
}

export default function FinancePaidOrders() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeDate, setCloseDate] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOrders(orders);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = orders.filter(order => 
        order.code.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_phone.includes(term) ||
        order.address.toLowerCase().includes(term)
      );
      setFilteredOrders(filtered);
    }
  }, [searchTerm, orders]);

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
          payment_amount,
          total_paid,
          payment_confirmed_at,
          notes,
          customer_id
        `)
        .eq('status', 'paid')
        .or('is_archived.is.null,is_archived.eq.false')
        .order('code', { ascending: false });

      if (error) throw error;

      const ordersWithCustomer = await Promise.all(
        (data || []).map(async (order: any) => {
          const { data: customerData } = await supabase
            .from('customers')
            .select('user_id')
            .eq('id', order.customer_id)
            .maybeSingle();

          let customerName = 'نامشخص';
          let customerPhone = '';

          if (customerData?.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('user_id', customerData.user_id)
              .maybeSingle();

            customerName = profileData?.full_name || 'نامشخص';
            customerPhone = profileData?.phone_number || '';
          }

          return {
            ...order,
            customer_name: customerName,
            customer_phone: customerPhone
          };
        })
      );

      setOrders(ordersWithCustomer);
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

  const handleCloseOrder = async () => {
    if (!selectedOrder || !user || !closeDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً تاریخ اتمام را مشخص کنید'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'closed',
          closed_at: closeDate,
          financial_confirmed_by: user.id,
          financial_confirmed_at: new Date().toISOString(),
          notes: {
            ...selectedOrder.notes,
            finance_close_notes: closeNotes
          }
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: '✓ سفارش بسته شد',
        description: `سفارش ${selectedOrder.code} با موفقیت بسته شد.`
      });

      setCloseDialogOpen(false);
      setSelectedOrder(null);
      setCloseDate('');
      setCloseNotes('');
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات پرداخت شده"
        description={`${orders.length} سفارش پرداخت شده`}
      />

      {orders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارش پرداخت شده‌ای وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-all border-l-4 border-l-green-500">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                      <StatusBadge status="approved" />
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{order.customer_name}</span>
                      <span dir="ltr">{order.customer_phone}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                
                {/* Financial Summary */}
                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Banknote className="h-5 w-5 text-green-600" />
                    <span className="font-bold text-green-800 dark:text-green-200">پرداخت شده</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <Label className="text-xs text-muted-foreground">مبلغ کل</Label>
                      <p className="font-bold text-lg text-green-600">
                        {(order.payment_amount || 0).toLocaleString('fa-IR')} تومان
                      </p>
                    </div>
                    {order.payment_confirmed_at && (
                      <div>
                        <Label className="text-xs text-muted-foreground">تاریخ پرداخت</Label>
                        <p className="font-medium">{formatPersianDate(order.payment_confirmed_at)}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { 
                      setSelectedOrder(order); 
                      setDetailsOpen(true); 
                    }} 
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    جزئیات
                  </Button>

                  <Button 
                    size="sm"
                    onClick={() => { 
                      setSelectedOrder(order); 
                      setCloseDialogOpen(true); 
                    }}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    اتمام و بستن سفارش
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات مالی سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <EditableOrderDetails 
              order={{
                id: selectedOrder.id,
                code: selectedOrder.code,
                customer_name: selectedOrder.customer_name,
                customer_phone: selectedOrder.customer_phone,
                customer_id: selectedOrder.customer_id,
                address: selectedOrder.address,
                detailed_address: selectedOrder.detailed_address,
                created_at: selectedOrder.created_at,
                notes: selectedOrder.notes,
                payment_amount: selectedOrder.payment_amount,
                total_paid: selectedOrder.total_paid
              }}
              onUpdate={fetchOrders}
              hideDetails={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Close Order Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>بستن سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>
              با بستن سفارش، پرونده مالی آن بسته خواهد شد
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">مبلغ پرداختی:</span>
                  <span className="font-bold text-green-600">
                    {(selectedOrder.payment_amount || 0).toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-date">تاریخ اتمام *</Label>
                <PersianDatePicker
                  value={closeDate}
                  onChange={setCloseDate}
                  placeholder="انتخاب تاریخ اتمام"
                  timeMode="none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-notes">یادداشت (اختیاری)</Label>
                <Textarea
                  id="close-notes"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="توضیحات تکمیلی..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCloseDialogOpen(false);
                setCloseDate('');
                setCloseNotes('');
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleCloseOrder} disabled={!closeDate}>
              بستن سفارش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
