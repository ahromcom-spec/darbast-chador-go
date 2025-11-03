import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Clock, Search, MapPin, Phone, User, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [executionDate, setExecutionDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

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
          customers!inner(
            user_id,
            profiles!inner(full_name, phone_number)
          )
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
        customer_name: order.customers?.profiles?.full_name || 'نامشخص',
        customer_phone: order.customers?.profiles?.phone_number || ''
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
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('projects_v3')
        .update({
          execution_start_date: new Date(executionDate).toISOString(),
          executed_by: userData.user?.id,
          status: 'in_progress'
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'زمان اجرا ثبت و وضعیت سفارش به "در حال اجرا" تغییر کرد'
      });

      setSelectedOrder(null);
      setExecutionDate('');
      setShowExecutionDialog(false);
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

  const handleSetExecutiveCompletion = async () => {
    if (!selectedOrder || !completionDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفا تاریخ اتمام را وارد کنید'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          executive_completion_date: new Date(completionDate).toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'تاریخ اتمام شما ثبت شد'
      });

      setSelectedOrder(null);
      setCompletionDate('');
      setShowCompletionDialog(false);
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
        description={`${orders.length} سفارش • ${filteredOrders.length} نمایش داده شده`}
        showBackButton={true}
        backTo="/executive"
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
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('approved')}
              >
                تایید شده ({orders.filter(o => o.status === 'approved').length})
              </Button>
              <Button
                variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('in_progress')}
              >
                در حال اجرا ({orders.filter(o => o.status === 'in_progress').length})
              </Button>
              <Button
                variant={statusFilter === 'paid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('paid')}
              >
                پرداخت شده ({orders.filter(o => o.status === 'paid').length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>{searchTerm || statusFilter !== 'all' ? 'سفارشی با این فیلترها یافت نشد' : 'سفارشی برای اجرا وجود ندارد'}</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className={`hover:shadow-lg transition-all duration-200 ${
              order.status === 'approved' ? 'border-l-4 border-l-yellow-500' :
              order.status === 'in_progress' ? 'border-l-4 border-l-blue-500' :
              'border-l-4 border-l-green-500'
            }`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{order.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span dir="ltr">{order.customer_phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{order.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                
                {order.detailed_address && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">آدرس تفصیلی:</span> {order.detailed_address}
                  </div>
                )}

                {order.execution_start_date && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">زمان شروع اجرا</div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      {new Date(order.execution_start_date).toLocaleDateString('fa-IR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap pt-2">
                  {order.status === 'approved' && (
                    <Button
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowExecutionDialog(true);
                      }}
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

      {/* Execution Date Dialog */}
      <Dialog open={showExecutionDialog} onOpenChange={setShowExecutionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت زمان اجرا برای سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>مشتری: {selectedOrder?.customer_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowExecutionDialog(false);
                setSelectedOrder(null);
                setExecutionDate('');
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleSetExecutionDate} className="gap-2">
              <Clock className="h-4 w-4" />
              ثبت زمان اجرا
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Date Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تایید اتمام پروژه - سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>مشتری: {selectedOrder?.customer_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
          </div>
          <DialogFooter>
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
            <Button 
              onClick={handleSetExecutiveCompletion}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <CheckCircle className="h-4 w-4" />
              تایید اتمام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
