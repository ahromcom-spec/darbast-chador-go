import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Eye, DollarSign, FileText, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { formatPersianDate, formatPersianDateTime } from '@/lib/dateUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  transaction_reference: string | null;
  created_at: string;
  payment_confirmed_at: string | null;
  closed_at: string | null;
  customer_name: string;
  customer_phone: string;
  notes: any;
}

export default function FinanceOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [closeDate, setCloseDate] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
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
          payment_amount,
          payment_method,
          transaction_reference,
          created_at,
          payment_confirmed_at,
          closed_at,
          notes,
          customer_id,
          customers!inner(
            user_id,
            profiles!inner(full_name, phone_number)
          )
        `)
        .in('status', ['paid', 'closed'])
        .eq('subcategory_id', '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((order: any) => ({
        id: order.id,
        code: order.code,
        status: order.status,
        address: order.address,
        detailed_address: order.detailed_address,
        payment_amount: order.payment_amount,
        payment_method: order.payment_method,
        transaction_reference: order.transaction_reference,
        created_at: order.created_at,
        payment_confirmed_at: order.payment_confirmed_at,
        closed_at: order.closed_at,
        notes: order.notes,
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

  const handleCloseOrder = async () => {
    if (!selectedOrder || !user) return;

    if (!closeDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً تاریخ فک و اتمام را مشخص کنید'
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
        description: `سفارش ${selectedOrder.code} با موفقیت فک و بسته شد.`
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

  const getStatusBadge = (status: string) => {
    if (status === 'paid') {
      return <Badge className="bg-green-600">پرداخت شده</Badge>;
    }
    return <Badge variant="secondary">بسته شده</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  const paidOrders = orders.filter(o => o.status === 'paid');
  const closedOrders = orders.filter(o => o.status === 'closed');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="مدیریت مالی - فک و اتمام سفارشات"
        description="بررسی سفارشات پرداخت شده و بستن آنها"
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              در انتظار فک
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{paidOrders.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              فک شده
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{closedOrders.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              مجموع مبالغ پرداختی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {paidOrders.reduce((sum, o) => sum + (o.payment_amount || 0), 0).toLocaleString('fa-IR')} ریال
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Paid Orders Section */}
      {paidOrders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold">سفارشات در انتظار فک ({paidOrders.length})</h2>
          </div>
          
          <div className="grid gap-4">
            {paidOrders.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-green-600">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                        {getStatusBadge(order.status)}
                      </div>
                      <CardDescription>
                        مشتری: {order.customer_name} • {order.customer_phone}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">آدرس</Label>
                      <p className="text-sm">{order.address}</p>
                      {order.detailed_address && (
                        <p className="text-xs text-muted-foreground mt-1">{order.detailed_address}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">مبلغ پرداختی</Label>
                        <p className="text-lg font-bold text-green-600">
                          {order.payment_amount?.toLocaleString('fa-IR')} ریال
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">روش پرداخت</Label>
                        <p className="text-sm">{order.payment_method}</p>
                      </div>
                      {order.transaction_reference && (
                        <div>
                          <Label className="text-xs text-muted-foreground">شماره پیگیری</Label>
                          <p className="text-sm font-mono">{order.transaction_reference}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {order.payment_confirmed_at && (
                    <div className="text-xs text-muted-foreground">
                      تاریخ پرداخت: {formatPersianDateTime(order.payment_confirmed_at)}
                    </div>
                  )}

                  <Separator />

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
                      جزئیات کامل
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
                      فک و بستن سفارش
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Closed Orders Section */}
      {closedOrders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h2 className="text-xl font-semibold">سفارشات فک شده ({closedOrders.length})</h2>
          </div>
          
          <div className="grid gap-4">
            {closedOrders.map((order) => (
              <Card key={order.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                        {getStatusBadge(order.status)}
                      </div>
                      <CardDescription>
                        مشتری: {order.customer_name}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">مبلغ</Label>
                      <p className="font-semibold">{order.payment_amount?.toLocaleString('fa-IR')} ریال</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">تاریخ بسته شدن</Label>
                      <p>{order.closed_at ? formatPersianDate(order.closed_at, { showDayOfWeek: true }) : '-'}</p>
                    </div>
                  </div>
                  
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
                    مشاهده جزئیات
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {paidOrders.length === 0 && closedOrders.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p>سفارشی برای مدیریت مالی وجود ندارد</p>
          </CardContent>
        </Card>
      )}

      {/* Close Order Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>فک و بستن سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>
              اطلاعات فک و اتمام سفارش را وارد کنید
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">مبلغ پرداختی:</span>
                  <span className="font-bold text-green-600">
                    {selectedOrder.payment_amount?.toLocaleString('fa-IR')} ریال
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">روش پرداخت:</span>
                  <span className="font-medium">{selectedOrder.payment_method}</span>
                </div>
                {selectedOrder.transaction_reference && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">شماره پیگیری:</span>
                    <span className="font-mono text-xs">{selectedOrder.transaction_reference}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-date">تاریخ فک و اتمام *</Label>
                <PersianDatePicker
                  value={closeDate}
                  onChange={setCloseDate}
                  placeholder="انتخاب تاریخ فک"
                  timeMode="none"
                />
                <p className="text-xs text-muted-foreground">
                  تاریخی که داربست فک شده و کار به پایان رسیده است
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-notes">یادداشت (اختیاری)</Label>
                <Textarea
                  id="close-notes"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="توضیحات تکمیلی در مورد فک و اتمام پروژه..."
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
              ثبت و بستن سفارش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">نام مشتری</Label>
                  <p className="text-sm font-medium">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">شماره تماس</Label>
                  <p className="text-sm font-medium" dir="ltr">{selectedOrder.customer_phone}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs text-muted-foreground">آدرس</Label>
                <p className="text-sm">{selectedOrder.address}</p>
                {selectedOrder.detailed_address && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedOrder.detailed_address}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">اطلاعات مالی</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">مبلغ پرداختی</Label>
                    <p className="text-lg font-bold text-green-600">
                      {selectedOrder.payment_amount?.toLocaleString('fa-IR')} ریال
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">روش پرداخت</Label>
                    <p className="text-sm">{selectedOrder.payment_method}</p>
                  </div>
                </div>
                {selectedOrder.transaction_reference && (
                  <div>
                    <Label className="text-xs text-muted-foreground">شماره پیگیری</Label>
                    <p className="text-sm font-mono">{selectedOrder.transaction_reference}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold">تاریخ‌ها</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">ثبت سفارش:</span>
                    <span>{formatPersianDate(selectedOrder.created_at, { showDayOfWeek: true })}</span>
                  </div>
                  {selectedOrder.payment_confirmed_at && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">تایید پرداخت:</span>
                      <span>{formatPersianDateTime(selectedOrder.payment_confirmed_at)}</span>
                    </div>
                  )}
                  {selectedOrder.closed_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      <span className="text-muted-foreground">بسته شدن:</span>
                      <span>{formatPersianDate(selectedOrder.closed_at, { showDayOfWeek: true })}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.notes?.finance_close_notes && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">یادداشت مالی</Label>
                    <p className="text-sm mt-1">{selectedOrder.notes.finance_close_notes}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
