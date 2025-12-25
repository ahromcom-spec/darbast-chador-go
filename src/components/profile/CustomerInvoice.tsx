import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Receipt, CreditCard, Wallet, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OrderInvoice {
  id: string;
  code: string;
  address: string;
  status: string;
  payment_amount: number | null;
  payment_confirmed_at: string | null;
  created_at: string;
  subcategory: { name: string } | null;
  province: { name: string } | null;

  // مجموع مبلغ پرداخت‌شده (نقدی/درگاه/سایر)
  paid_amount: number;
  // مبلغ علی‌الحساب (فقط وقتی سفارش کامل تسویه نشده باشد)
  advance_payment: number;
  remaining_amount: number;
  is_fully_paid: boolean;
}

interface InvoiceSummary {
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
  totalAdvance: number;
  totalRemaining: number;
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'در انتظار تایید',
    approved: 'تایید شده',
    in_progress: 'در حال اجرا',
    completed: 'تکمیل شده',
    paid: 'پرداخت شده',
    closed: 'بسته شده',
    rejected: 'رد شده',
  };
  return labels[status] || status;
};

const getPaymentStatusBadge = (order: OrderInvoice) => {
  const totalAmount = order.payment_amount || 0;
  const paidAmount = order.paid_amount || 0;

  if (order.is_fully_paid && totalAmount > 0) {
    return (
      <Badge className="bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-400 border border-green-500/50">
        ✅ پرداخت کامل
      </Badge>
    );
  }
  if (paidAmount > 0) {
    const percentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
    return (
      <Badge className="bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400 border border-yellow-500/50">
        ⏳ علی‌الحساب ({percentage}٪)
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-400 border border-red-500/50">
      ❌ پرداخت نشده
    </Badge>
  );
};

export const CustomerInvoice = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<InvoiceSummary>({
    totalOrders: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalAdvance: 0,
    totalRemaining: 0,
  });

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Get customer id
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!customer) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          address,
          status,
          payment_amount,
          payment_confirmed_at,
          created_at,
          notes,
          is_archived,
          total_paid,
          subcategories (name),
          provinces (name)
        `)
        .eq('customer_id', customer.id)
        // فقط سفارشات غیر بایگانی را نمایش بده
        .or('is_archived.is.null,is_archived.eq.false')
        // سفارشات رد شده هم از صورتحساب حذف شوند
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // دریافت پرداخت‌های نقدی از جدول order_payments
      const orderIds = (data || []).map(o => o.id);
      let paymentsMap: Record<string, number> = {};
      
      if (orderIds.length > 0) {
        const { data: payments } = await supabase
          .from('order_payments')
          .select('order_id, amount')
          .in('order_id', orderIds);
        
        if (payments) {
          payments.forEach(p => {
            paymentsMap[p.order_id] = (paymentsMap[p.order_id] || 0) + p.amount;
          });
        }
      }

      const processedOrders: OrderInvoice[] = (data || []).map(order => {
        const totalAmount = Number(order.payment_amount || 0);

        // مبالغ پرداختی از منابع مختلف
        const cashPaid = Number(paymentsMap[order.id] || 0);
        const totalPaidField = Number(order.total_paid || 0);

        let notesAdvance = 0;
        try {
          if (order.notes) {
            const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
            notesAdvance = Number(notesData?.advance_payment || 0);
          }
        } catch {
          notesAdvance = 0;
        }

        // پایه: بیشترین مقدار ثبت شده - بدون اتکا به payment_confirmed_at
        // چون payment_confirmed_at ممکن است به اشتباه ست شده باشد
        const paidAmount = Math.max(totalPaidField, cashPaid, notesAdvance);

        // جلوگیری از منفی/بیشتر از مبلغ کل
        const paidCapped = totalAmount > 0 ? Math.min(paidAmount, totalAmount) : Math.max(paidAmount, 0);
        const isFullyPaid = totalAmount > 0 && paidCapped >= totalAmount;
        const remaining = Math.max(totalAmount - paidCapped, 0);

        return {
          id: order.id,
          code: order.code,
          address: order.address,
          status: order.status || 'pending',
          payment_amount: order.payment_amount,
          payment_confirmed_at: order.payment_confirmed_at,
          created_at: order.created_at,
          subcategory: order.subcategories,
          province: order.provinces,
          paid_amount: paidCapped,
          advance_payment: isFullyPaid ? 0 : paidCapped,
          remaining_amount: remaining,
          is_fully_paid: isFullyPaid,
        };
      });

      setOrders(processedOrders);
      calculateSummary(processedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری صورتحساب',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (orderList: OrderInvoice[]) => {
    const summary = orderList.reduce(
      (acc, order) => ({
        totalOrders: acc.totalOrders + 1,
        totalAmount: acc.totalAmount + (order.payment_amount || 0),
        // مجموع واقعی پرداخت‌شده (کامل + علی‌الحساب)
        totalPaid: acc.totalPaid + (order.paid_amount || 0),
        // فقط علی‌الحساب
        totalAdvance: acc.totalAdvance + (order.advance_payment || 0),
        totalRemaining: acc.totalRemaining + (order.remaining_amount || 0),
      }),
      { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalAdvance: 0, totalRemaining: 0 }
    );
    setSummary(summary);
  };

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (paymentFilter === 'paid' && !order.is_fully_paid) return false;
    if (paymentFilter === 'advance' && !(order.advance_payment > 0 && !order.is_fully_paid)) return false;
    if (paymentFilter === 'unpaid' && (order.paid_amount > 0 || order.is_fully_paid)) return false;
    return true;
  });

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handlePayment = (orderId: string) => {
    navigate(`/user/orders/${orderId}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* خلاصه صورتحساب */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
          <CardContent className="p-4 text-center">
            <Receipt className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-xs text-muted-foreground">تعداد سفارشات</p>
            <p className="text-lg font-bold text-blue-600">{summary.totalOrders}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200">
          <CardContent className="p-4 text-center">
            <Wallet className="h-6 w-6 mx-auto mb-2 text-purple-600" />
            <p className="text-xs text-muted-foreground">مجموع کل</p>
            <p className="text-sm font-bold text-purple-600">{formatPrice(summary.totalAmount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-xs text-muted-foreground">پرداخت شده</p>
            <p className="text-sm font-bold text-green-600">{formatPrice(summary.totalPaid)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200">
          <CardContent className="p-4 text-center">
            <CreditCard className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
            <p className="text-xs text-muted-foreground">علی‌الحساب</p>
            <p className="text-sm font-bold text-yellow-600">{formatPrice(summary.totalAdvance)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200">
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600" />
            <p className="text-xs text-muted-foreground">مانده بدهی</p>
            <p className="text-sm font-bold text-red-600">{formatPrice(summary.totalRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* فیلترها */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="وضعیت سفارش" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="pending">در انتظار تایید</SelectItem>
                <SelectItem value="approved">تایید شده</SelectItem>
                <SelectItem value="in_progress">در حال اجرا</SelectItem>
                <SelectItem value="completed">تکمیل شده</SelectItem>
                <SelectItem value="paid">پرداخت شده</SelectItem>
                <SelectItem value="closed">بسته شده</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="وضعیت پرداخت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه پرداخت‌ها</SelectItem>
                <SelectItem value="paid">پرداخت کامل</SelectItem>
                <SelectItem value="advance">علی‌الحساب</SelectItem>
                <SelectItem value="unpaid">پرداخت نشده</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* لیست سفارشات */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              سفارشی یافت نشد
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map(order => (
            <Collapsible
              key={order.id}
              open={expandedOrders.has(order.id)}
              onOpenChange={() => toggleOrderExpand(order.id)}
            >
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-sm">کد: {order.code}</p>
                          <p className="text-xs text-muted-foreground">{order.subcategory?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getPaymentStatusBadge(order)}
                        <Badge variant="outline">{getStatusLabel(order.status)}</Badge>
                        {expandedOrders.has(order.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="p-4 pt-0 space-y-4">
                    <Separator />
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">آدرس:</p>
                        <p className="font-medium">{order.address}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">استان:</p>
                        <p className="font-medium">{order.province?.name}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* جزئیات مالی */}
                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                      {/* نوار وضعیت پرداخت */}
                      <div className={`text-center py-2 rounded-lg font-bold text-sm ${
                        order.is_fully_paid
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : order.paid_amount > 0
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {order.is_fully_paid
                          ? '✅ پرداخت کامل انجام شده'
                          : order.paid_amount > 0
                            ? `⏳ علی‌الحساب پرداخت شده (${Math.round((order.paid_amount / (order.payment_amount || 1)) * 100)}٪)`
                            : '❌ هنوز پرداختی انجام نشده'}
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">مبلغ کل سفارش:</span>
                        <span className="font-bold">{formatPrice(order.payment_amount || 0)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                        <span>پرداخت شده:</span>
                        <span className="font-medium">{formatPrice(order.paid_amount)}</span>
                      </div>



                      <Separator />

                      <div className="flex justify-between items-center text-red-600 dark:text-red-400 text-lg">
                        <span className="font-bold">مانده بدهی:</span>
                        <span className="font-bold">{formatPrice(order.remaining_amount)}</span>
                      </div>
                    </div>

                    {/* دکمه‌های عملیات */}
                    {order.remaining_amount > 0 && !order.is_fully_paid && (
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handlePayment(order.id)}
                          className="flex-1"
                        >
                          <CreditCard className="h-4 w-4 ml-2" />
                          پرداخت کامل
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handlePayment(order.id)}
                          className="flex-1"
                        >
                          <Wallet className="h-4 w-4 ml-2" />
                          پرداخت علی‌الحساب
                        </Button>
                      </div>
                    )}

                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/user/orders/${order.id}`)}
                      className="w-full"
                    >
                      مشاهده جزئیات سفارش
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
};
