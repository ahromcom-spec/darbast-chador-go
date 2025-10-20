import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';

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
}

export default function ExecutiveOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [executionDate, setExecutionDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
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
          execution_start_date,
          execution_end_date,
          customer_completion_date,
          executive_completion_date,
          created_at,
          customer_id,
          customers!inner(user_id),
          profiles:customers(profiles!inner(full_name, phone_number))
        `)
        .in('status', ['approved', 'in_progress', 'paid'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders = data?.map((order: any) => ({
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

  const handleSetExecutionDate = async () => {
    if (!selectedOrder || !executionDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفا تاریخ اجرا را وارد کنید'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          execution_start_date: new Date(executionDate).toISOString(),
          executed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'زمان اجرا با موفقیت ثبت شد'
      });

      setSelectedOrder(null);
      setExecutionDate('');
      fetchOrders();
    } catch (error) {
      console.error('Error setting execution date:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'ثبت زمان اجرا با خطا مواجه شد'
      });
    }
  };

  const handleConfirmExecution = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'completed',
          execution_confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'اجرای سفارش با موفقیت تایید شد و به قسمت فروش ارسال شد'
      });

      fetchOrders();
    } catch (error) {
      console.error('Error confirming execution:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'تایید اجرا با خطا مواجه شد'
      });
    }
  };

  const handleSetExecutiveCompletion = async (orderId: string, completionDate: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          executive_completion_date: new Date(completionDate).toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'تاریخ اتمام شما ثبت شد'
      });

      fetchOrders();
    } catch (error) {
      console.error('Error setting completion date:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'ثبت تاریخ اتمام با خطا مواجه شد'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      approved: { label: 'تایید شده', className: 'bg-yellow-500/10 text-yellow-600' },
      in_progress: { label: 'در حال اجرا', className: 'bg-blue-500/10 text-blue-600' },
      paid: { label: 'پرداخت شده - در انتظار اتمام', className: 'bg-green-500/10 text-green-600' }
    };

    const { label, className } = statusMap[status] || { label: status, className: '' };
    return <Badge className={className}>{label}</Badge>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="مدیریت سفارشات اجرا"
        description="ثبت زمان شروع و تکمیل سفارشات"
        showBackButton={true}
        backTo="/executive"
      />

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی برای اجرا وجود ندارد</p>
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
                  {getStatusBadge(order.status)}
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

                {order.execution_start_date && (
                  <div>
                    <Label className="text-sm text-muted-foreground">زمان اجرا</Label>
                    <p className="text-sm mt-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(order.execution_start_date).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap pt-2">
                  {order.status === 'approved' && (
                    <Button
                      onClick={() => setSelectedOrder(order)}
                      size="sm"
                      className="gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      ثبت زمان اجرا
                    </Button>
                  )}

                  {order.status === 'in_progress' && (
                    <Button
                      onClick={() => handleConfirmExecution(order.id)}
                      size="sm"
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      تایید اجرا
                    </Button>
                  )}

                  {order.status === 'paid' && !order.executive_completion_date && (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowCompletionDialog(true);
                      }}
                      size="sm"
                      className="gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      تایید اتمام
                    </Button>
                  )}

                  {order.status === 'paid' && (
                    <div className="w-full mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-blue-900 dark:text-blue-100">
                          وضعیت تایید اتمام
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          {order.customer_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>مشتری: {order.customer_completion_date ? '✓' : 'منتظر'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {order.executive_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>شما: {order.executive_completion_date ? '✓' : 'منتظر'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedOrder && !showCompletionDialog && (
        <Card className="border-2 border-primary shadow-lg">
          <CardHeader>
            <CardTitle>ثبت زمان اجرا برای سفارش {selectedOrder.code}</CardTitle>
            <CardDescription>مشتری: {selectedOrder.customer_name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="execution-date">تاریخ شروع اجرا</Label>
              <Input
                id="execution-date"
                type="date"
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSetExecutionDate} className="gap-2">
                <Clock className="h-4 w-4" />
                ثبت زمان اجرا
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedOrder(null);
                  setExecutionDate('');
                }}
              >
                انصراف
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedOrder && showCompletionDialog && (
        <Card className="border-2 border-purple-500 shadow-lg">
          <CardHeader>
            <CardTitle>تایید اتمام پروژه - سفارش {selectedOrder.code}</CardTitle>
            <CardDescription>مشتری: {selectedOrder.customer_name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              با ثبت تاریخ اتمام، تایید می‌کنید که پروژه به درستی انجام شده است.
            </p>
            <div>
              <Label htmlFor="completion-date">تاریخ اتمام پروژه</Label>
              <Input
                id="completion-date"
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="mt-2"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={() => {
                  if (completionDate) {
                    handleSetExecutiveCompletion(selectedOrder.id, completionDate);
                    setShowCompletionDialog(false);
                    setSelectedOrder(null);
                    setCompletionDate('');
                  }
                }} 
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <CheckCircle className="h-4 w-4" />
                تایید اتمام
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCompletionDialog(false);
                  setSelectedOrder(null);
                  setCompletionDate('');
                }}
              >
                انصراف
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
