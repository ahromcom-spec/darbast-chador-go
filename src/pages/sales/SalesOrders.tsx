import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Search, MapPin, Phone, User, Calendar, CheckCircle, Clock, Edit, Ruler, FileText, Banknote, Wrench, ArrowLeftRight, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatPersianDateTimeFull, formatPersianDate } from '@/lib/dateUtils';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { ManagerOrderTransfer } from '@/components/orders/ManagerOrderTransfer';
import { ManagerAddStaffCollaborator } from '@/components/orders/ManagerAddStaffCollaborator';
import { sendOrderSms } from '@/lib/orderSms';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  execution_start_date: string | null;
  execution_end_date: string | null;
  customer_completion_date: string | null;
  executive_completion_date: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  location_lat?: number | null;
  location_lng?: number | null;
  notes?: string | null;
  payment_amount?: number | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
  customer_id?: string;
  executed_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  subcategory_id?: string | null;
  execution_stage?: string | null;
  execution_stage_updated_at?: string | null;
  rejection_reason?: string | null;
  transferred_from_user_id?: string | null;
  transferred_from_phone?: string | null;
}

export default function SalesOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completingOrder, setCompletingOrder] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
  const { toast } = useToast();

  // Auto-open order from URL param
  const urlOrderId = searchParams.get('orderId');

  useEffect(() => {
    fetchOrders();
  }, []);

  // Auto-open order details when orderId is in URL and orders are loaded
  useEffect(() => {
    if (urlOrderId && orders.length > 0 && !loading) {
      const order = orders.find(o => o.id === urlOrderId);
      if (order) {
        setSelectedOrder(order);
        setShowDetailsDialog(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [urlOrderId, orders, loading]);

  useEffect(() => {
    let filtered = orders;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by search term
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
      // Fetch all orders (not just completed)
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          address,
          detailed_address,
          execution_start_date,
          execution_end_date,
          customer_completion_date,
          executive_completion_date,
          created_at,
          customer_id,
          hierarchy_project_id,
          notes,
          payment_amount,
          payment_method,
          transaction_reference,
          executed_by,
          approved_by,
          approved_at,
          subcategory_id,
          location_lat,
          location_lng,
          execution_stage,
          execution_stage_updated_at,
          rejection_reason,
          transferred_from_user_id,
          transferred_from_phone
        `)
        .order('code', { ascending: false });

      if (error) throw error;

      // Enrich each order with customer profile safely
      const ordersWithCustomer = await Promise.all(
        (data || []).map(async (order: any) => {
          let customerName = 'نامشخص';
          let customerPhone = '';

          if (order.customer_id) {
            const { data: customerData } = await supabase
              .from('customers')
              .select('user_id')
              .eq('id', order.customer_id)
              .maybeSingle();

            const userId = customerData?.user_id;
            if (userId) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, phone_number')
                .eq('user_id', userId)
                .maybeSingle();

              customerName = profileData?.full_name || 'نامشخص';
              customerPhone = profileData?.phone_number || '';
            }
          }

          // Fetch location data - use order's direct lat/lng or from hierarchy
          let projectLat = order.location_lat;
          let projectLng = order.location_lng;

          if (!projectLat && !projectLng && order.hierarchy_project_id) {
            const { data: hierarchyData } = await supabase
              .from('projects_hierarchy')
              .select(`
                locations (
                  lat,
                  lng
                )
              `)
              .eq('id', order.hierarchy_project_id)
              .maybeSingle();

            if (hierarchyData?.locations) {
              projectLat = hierarchyData.locations.lat;
              projectLng = hierarchyData.locations.lng;
            }
          }

          return {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            execution_start_date: order.execution_start_date,
            execution_end_date: order.execution_end_date,
            customer_completion_date: order.customer_completion_date,
            executive_completion_date: order.executive_completion_date,
            created_at: order.created_at,
            customer_name: customerName,
            customer_phone: customerPhone,
            location_lat: projectLat,
            location_lng: projectLng,
            notes: order.notes,
            payment_amount: order.payment_amount,
            payment_method: order.payment_method,
            transaction_reference: order.transaction_reference,
            customer_id: order.customer_id,
            executed_by: order.executed_by,
            approved_by: order.approved_by,
            approved_at: order.approved_at,
            subcategory_id: order.subcategory_id,
            execution_stage: order.execution_stage,
            execution_stage_updated_at: order.execution_stage_updated_at,
            rejection_reason: order.rejection_reason,
            transferred_from_user_id: order.transferred_from_user_id,
            transferred_from_phone: order.transferred_from_phone,
          } as Order;
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

      // ارسال پیامک به مشتری (در پس‌زمینه)
      if (selectedOrder.customer_phone) {
        sendOrderSms(selectedOrder.customer_phone, selectedOrder.code, 'paid').catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      toast({
        title: 'موفق',
        description: 'پرداخت ثبت شد'
      });

      setSelectedOrder(null);
      setPaymentAmount('');
      setPaymentMethod('');
      setTransactionRef('');
      setShowPaymentDialog(false);
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

  // Handler for marking order as completed by sales manager
  const handleMarkComplete = async () => {
    if (!selectedOrder) return;

    setCompletingOrder(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          financial_confirmed_by: auth.user?.id,
          financial_confirmed_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'سفارش با موفقیت به اتمام رسید'
      });

      setShowCompleteDialog(false);
      setShowDetailsDialog(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در تایید اتمام سفارش'
      });
    } finally {
      setCompletingOrder(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: 'در انتظار تایید', className: 'bg-orange-500/10 text-orange-600' },
      approved: { label: 'تایید شده', className: 'bg-yellow-500/10 text-yellow-600' },
      in_progress: { label: 'در حال اجرا', className: 'bg-blue-500/10 text-blue-600' },
      completed: { label: 'آماده تسویه', className: 'bg-purple-500/10 text-purple-600' },
      paid: { label: 'پرداخت شده', className: 'bg-green-500/10 text-green-600' },
      rejected: { label: 'رد شده', className: 'bg-red-500/10 text-red-600' },
      cancelled: { label: 'لغو شده', className: 'bg-gray-500/10 text-gray-600' },
      closed: { label: 'بسته شده', className: 'bg-gray-500/10 text-gray-600' }
    };

    const { label, className } = statusMap[status] || { label: status, className: '' };
    return <Badge className={className}>{label}</Badge>;
  };

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    orders.forEach(order => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="همه سفارشات"
        description={`${orders.length} سفارش • ${filteredOrders.length} نمایش داده شده`}
      />

      {/* Filters and Search */}
      {orders.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو بر اساس کد سفارش، نام مشتری، شماره تلفن یا آدرس..."
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
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
              >
                در انتظار تایید ({statusCounts['pending'] || 0})
              </Button>
              <Button
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('approved')}
              >
                تایید شده ({statusCounts['approved'] || 0})
              </Button>
              <Button
                variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('in_progress')}
              >
                در حال اجرا ({statusCounts['in_progress'] || 0})
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                آماده تسویه ({statusCounts['completed'] || 0})
              </Button>
              <Button
                variant={statusFilter === 'paid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('paid')}
              >
                پرداخت شده ({statusCounts['paid'] || 0})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              سفارشی یافت نشد
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card 
              key={order.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedOrder(order);
                setShowDetailsDialog(true);
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <User className="h-3 w-3" />
                      مشتری: {order.customer_name}
                      {order.customer_phone && (
                        <>
                          <span>•</span>
                          <Phone className="h-3 w-3" />
                          {order.customer_phone}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <Label className="text-sm text-muted-foreground">آدرس</Label>
                    <p className="text-sm">{order.address}</p>
                  </div>
                </div>

                {order.payment_amount && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">مبلغ پرداخت</Label>
                      <p className="text-sm font-medium">
                        {order.payment_amount.toLocaleString('fa-IR')} تومان
                      </p>
                    </div>
                    {order.payment_method && (
                      <div>
                        <Label className="text-sm text-muted-foreground">روش پرداخت</Label>
                        <p className="text-sm">{order.payment_method}</p>
                      </div>
                    )}
                  </div>
                )}

                {order.status === 'completed' && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(order);
                      setShowPaymentDialog(true);
                    }}
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

      {/* Order Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>جزئیات سفارش {selectedOrder?.code}</span>
              {selectedOrder && getStatusBadge(selectedOrder.status)}
            </DialogTitle>
            <DialogDescription>
              مشتری: {selectedOrder?.customer_name} • {selectedOrder?.customer_phone}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <EditableOrderDetails order={selectedOrder} onUpdate={fetchOrders} />
              
              {/* Additional execution-specific info */}
              {selectedOrder.execution_start_date && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">تاریخ شروع اجرا</Label>
                    <p className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      {formatPersianDateTimeFull(selectedOrder.execution_start_date)}
                    </p>
                  </div>
                </>
              )}

              {/* Completion Confirmations */}
              {(selectedOrder.customer_completion_date || selectedOrder.executive_completion_date) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">تاییدات اتمام کار</Label>
                    {selectedOrder.customer_completion_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>تایید مشتری: {formatPersianDate(selectedOrder.customer_completion_date, { showDayOfWeek: true })}</span>
                      </div>
                    )}
                    {selectedOrder.executive_completion_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>تایید مدیر اجرایی: {formatPersianDate(selectedOrder.executive_completion_date, { showDayOfWeek: true })}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <Separator />
              <div className="flex gap-2 flex-wrap">
                {/* دکمه تایید اتمام سفارش برای سفارشاتی که پرداخت شده ولی هنوز بسته نشده‌اند */}
                {selectedOrder.status === 'paid' && (
                  <Button
                    onClick={() => setShowCompleteDialog(true)}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    تایید اتمام سفارش
                  </Button>
                )}
                {selectedOrder.status === 'completed' && (
                  <Button
                    onClick={() => {
                      setShowDetailsDialog(false);
                      setShowPaymentDialog(true);
                    }}
                    className="gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    ثبت پرداخت
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setTransferDialogOpen(true)}
                  className="gap-2"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  انتقال سفارش
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCollaboratorDialogOpen(true)}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  افزودن همکار
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت پرداخت برای سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              انصراف
            </Button>
            <Button onClick={handleRecordPayment} className="gap-2">
              <DollarSign className="h-4 w-4" />
              ثبت پرداخت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      {selectedOrder && (
        <ManagerOrderTransfer
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onTransferComplete={fetchOrders}
        />
      )}

      {/* Collaborator Dialog */}
      {selectedOrder && (
        <ManagerAddStaffCollaborator
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={collaboratorDialogOpen}
          onOpenChange={setCollaboratorDialogOpen}
          onCollaboratorAdded={fetchOrders}
        />
      )}

      {/* Complete Order Confirmation Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تایید اتمام سفارش</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را به عنوان "تکمیل شده" ثبت کنید؟
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              با تایید این گزینه، سفارش به مرحله نهایی (بسته شده) منتقل می‌شود.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCompleteDialog(false)}
              disabled={completingOrder}
            >
              انصراف
            </Button>
            <Button 
              onClick={handleMarkComplete} 
              className="gap-2 bg-green-600 hover:bg-green-700"
              disabled={completingOrder}
            >
              {completingOrder ? (
                <>در حال ثبت...</>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  تایید اتمام
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
