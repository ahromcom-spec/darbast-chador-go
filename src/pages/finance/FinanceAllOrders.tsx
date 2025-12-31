import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, Eye, Search, User, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { MultiPaymentDialog } from '@/components/orders/MultiPaymentDialog';
import { Badge } from '@/components/ui/badge';

interface Order {
  id: string;
  code: string;
  status: string;
  execution_stage: string | null;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  payment_amount: number | null;
  total_paid: number | null;
  notes: any;
}

export default function FinanceAllOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (statusFilter !== 'all') {
      if (statusFilter === 'awaiting_payment') {
        filtered = filtered.filter(o => o.execution_stage === 'awaiting_payment');
      } else {
        filtered = filtered.filter(o => o.status === statusFilter);
      }
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.code.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_phone.includes(term) ||
        order.address.toLowerCase().includes(term)
      );
    }

    setFilteredOrders(filtered);
  }, [searchTerm, statusFilter, orders]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          execution_stage,
          address,
          detailed_address,
          created_at,
          payment_amount,
          total_paid,
          notes,
          customer_id
        `)
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

  const getFinanceStatusBadge = (order: Order) => {
    if (order.status === 'closed') {
      return <Badge className="bg-gray-500">بسته شده</Badge>;
    }
    if (order.status === 'paid') {
      return <Badge className="bg-green-500">پرداخت شده</Badge>;
    }
    if (order.execution_stage === 'awaiting_payment') {
      return <Badge className="bg-orange-500">در انتظار پرداخت</Badge>;
    }
    return <StatusBadge status={order.status as any} />;
  };

  if (loading) return <LoadingSpinner />;

  const awaitingCount = orders.filter(o => o.execution_stage === 'awaiting_payment').length;
  const paidCount = orders.filter(o => o.status === 'paid').length;
  const closedCount = orders.filter(o => o.status === 'closed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="همه سفارشات (نمای مالی)"
        description={`${orders.length} سفارش`}
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant={statusFilter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              همه ({orders.length})
            </Button>
            <Button 
              variant={statusFilter === 'awaiting_payment' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('awaiting_payment')}
              className="text-orange-600"
            >
              در انتظار پرداخت ({awaitingCount})
            </Button>
            <Button 
              variant={statusFilter === 'paid' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('paid')}
              className="text-green-600"
            >
              پرداخت شده ({paidCount})
            </Button>
            <Button 
              variant={statusFilter === 'closed' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setStatusFilter('closed')}
            >
              بسته شده ({closedCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی یافت نشد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => {
            const totalAmount = order.payment_amount || 0;
            const totalPaid = order.total_paid || 0;
            const remaining = Math.max(0, totalAmount - totalPaid);

            return (
              <Card key={order.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                        {getFinanceStatusBadge(order)}
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
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Banknote className="h-5 w-5" />
                      <span className="font-bold">اطلاعات مالی</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <Label className="text-xs text-muted-foreground">مبلغ کل</Label>
                        <p className="font-bold">{totalAmount.toLocaleString('fa-IR')}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">پرداخت شده</Label>
                        <p className="font-bold text-green-600">{totalPaid.toLocaleString('fa-IR')}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">مانده</Label>
                        <p className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {remaining.toLocaleString('fa-IR')}
                        </p>
                      </div>
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

                    {order.execution_stage === 'awaiting_payment' && (
                      <Button 
                        size="sm"
                        onClick={() => { 
                          setSelectedOrder(order); 
                          setPaymentDialogOpen(true); 
                        }}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <Banknote className="h-4 w-4" />
                        ثبت پرداخت
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
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

      {/* Payment Dialog */}
      {selectedOrder && (
        <MultiPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          customerId={selectedOrder.customer_id}
          customerName={selectedOrder.customer_name}
          totalPrice={selectedOrder.payment_amount || 0}
          onPaymentSuccess={fetchOrders}
        />
      )}
    </div>
  );
}
