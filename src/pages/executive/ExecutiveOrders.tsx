import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, Clock, Search, MapPin, Phone, User, AlertCircle, Edit, Ruler, FileText, Banknote, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { formatPersianDateTimeFull, formatPersianDate } from '@/lib/dateUtils';
import { setOrderScheduleSchema } from '@/lib/rpcValidation';
import { OrderDetailsView, parseOrderNotes, OrderMediaGallery } from '@/components/orders/OrderDetailsView';

const scaffoldingTypeLabels: Record<string, string> = {
  facade: 'داربست سطحی نما',
  formwork: 'داربست حجمی کفراژ',
  ceiling: 'داربست زیربتن سقف',
  column: 'داربست ستونی',
  pipe_length: 'داربست به طول لوله مصرفی'
};

const ceilingSubtypeLabels: Record<string, string> = {
  yonolit: 'تیرچه یونولیت',
  ceramic: 'تیرچه سفال',
  slab: 'دال و وافل'
};

// Component to display order technical details (using shared component with extra fields)
const OrderDetailsContent = ({ order, getStatusBadge }: { order: Order; getStatusBadge: (status: string) => JSX.Element }) => {
  return (
    <div className="space-y-4">
      {/* Use shared component for basic details */}
      <OrderDetailsView order={order} showMedia={true} />
      
      {/* Additional execution-specific info */}
      {order.execution_start_date && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">تاریخ شروع اجرا</Label>
            <p className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              {formatPersianDateTimeFull(order.execution_start_date)}
            </p>
          </div>
        </>
      )}

      {/* Completion Confirmations */}
      {(order.customer_completion_date || order.executive_completion_date) && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">تاییدات اتمام کار</Label>
            {order.customer_completion_date && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>تایید مشتری: {formatPersianDate(order.customer_completion_date, { showDayOfWeek: true })}</span>
              </div>
            )}
            {order.executive_completion_date && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>تایید مدیر اجرایی: {formatPersianDate(order.executive_completion_date, { showDayOfWeek: true })}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

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
  project_lat?: number | null;
  project_lng?: number | null;
  notes?: string | null;
  payment_amount?: number | null;
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
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditScheduleDialog, setShowEditScheduleDialog] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
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
      // 1) Read raw orders without deep nested joins (FKs may be missing)
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
          payment_amount
        `)
        .in('status', ['approved', 'in_progress', 'completed', 'paid'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2) Enrich each order with customer profile safely
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

          // Fetch location data
          let projectLat = null;
          let projectLng = null;

          if (order.hierarchy_project_id) {
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
            project_lat: projectLat,
            project_lng: projectLng,
            notes: order.notes,
            payment_amount: order.payment_amount,
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
      // Validate RPC parameters
      const validated = setOrderScheduleSchema.parse({
        _order_id: selectedOrder.id,
        _execution_start_date: new Date(executionDate).toISOString()
      });

      // Use the new RPC function for scheduling
      const { error } = await supabase.rpc('set_order_schedule', validated as { _order_id: string; _execution_start_date: string });

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'زمان اجرا ثبت و سفارش زمان‌بندی شد'
      });

      setSelectedOrder(null);
      setExecutionDate('');
      setShowExecutionDialog(false);
      fetchOrders();
    } catch (error: any) {
      console.error('Error setting execution date:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: error.message || 'ثبت زمان اجرا با خطا مواجه شد'
      });
    }
  };

  const handleStartExecution = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'in_progress',
          execution_confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'سفارش به مرحله در حال اجرا منتقل شد'
      });

      fetchOrders();
    } catch (error) {
      console.error('Error starting execution:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'شروع اجرا با خطا مواجه شد'
      });
    }
  };

  const handleCompleteExecution = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'completed',
          executive_completion_date: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'خدمات شما اجرا شده و در انتظار پرداخت می‌باشد'
      });

      fetchOrders();
    } catch (error) {
      console.error('Error completing execution:', error);
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

  const handleUpdateSchedule = async () => {
    if (!selectedOrder || !editStartDate || !editEndDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً هر دو تاریخ شروع و پایان را مشخص کنید'
      });
      return;
    }

    if (new Date(editEndDate) <= new Date(editStartDate)) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'زمان پایان باید بعد از زمان شروع باشد'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          execution_start_date: editStartDate,
          execution_end_date: editEndDate
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'زمان‌بندی اجرا با موفقیت به‌روزرسانی شد'
      });

      setSelectedOrder(null);
      setEditStartDate('');
      setEditEndDate('');
      setShowEditScheduleDialog(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'به‌روزرسانی زمان‌بندی با خطا مواجه شد'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      approved: { label: 'آماده اجرا', className: 'bg-yellow-500/10 text-yellow-600' },
      in_progress: { label: 'در حال اجرا', className: 'bg-blue-500/10 text-blue-600' },
      completed: { label: 'اجرا شده - در انتظار پرداخت', className: 'bg-purple-500/10 text-purple-600' },
      paid: { label: 'پرداخت شده - در انتظار فک', className: 'bg-green-500/10 text-green-600' }
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
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                اجرا شده ({orders.filter(o => o.status === 'completed').length})
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
              order.status === 'completed' ? 'border-l-4 border-l-purple-500' :
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
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="space-y-0.5">
                          <div className="line-clamp-1">{order.address}</div>
                          {order.project_lat && order.project_lng && (
                            <div className="text-xs opacity-70">
                              موقعیت: {order.project_lat.toFixed(6)}, {order.project_lng.toFixed(6)}
                            </div>
                          )}
                        </div>
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
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">زمان شروع اجرا</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setEditStartDate(order.execution_start_date || '');
                          setEditEndDate(order.execution_end_date || '');
                          setShowEditScheduleDialog(true);
                        }}
                        className="h-6 px-2 gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        ویرایش
                      </Button>
                    </div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      {formatPersianDateTimeFull(order.execution_start_date)}
                    </p>
                    {order.execution_end_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        تا: {formatPersianDateTimeFull(order.execution_end_date)}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap pt-2">
                  {order.status === 'approved' && (
                    <Button
                      onClick={() => handleStartExecution(order.id)}
                      size="sm"
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      شروع اجرا
                    </Button>
                  )}

                  {order.status === 'in_progress' && (
                    <Button
                      onClick={() => handleCompleteExecution(order.id)}
                      size="sm"
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      اتمام اجرا
                    </Button>
                  )}

                  {order.status === 'completed' && (
                    <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg w-full">
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        ✓ خدمات اجرا شده و در انتظار پرداخت می‌باشد
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        سفارش به بخش فروش ارجاع داده شده است
                      </p>
                    </div>
                  )}

                   <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDetailsDialog(true);
                      }}
                      className="gap-2"
                    >
                      <AlertCircle className="h-4 w-4" />
                      جزئیات کامل
                    </Button>

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
              <div className="mt-2">
                <PersianDatePicker
                  value={completionDate}
                  onChange={setCompletionDate}
                  placeholder="انتخاب تاریخ اتمام"
                  timeMode="none"
                />
              </div>
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

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>اطلاعات جامع سفارش</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <OrderDetailsContent order={selectedOrder} getStatusBadge={getStatusBadge} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={showEditScheduleDialog} onOpenChange={setShowEditScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ویرایش زمان‌بندی اجرا</DialogTitle>
            <DialogDescription>
              زمان‌بندی اجرای سفارش {selectedOrder?.code} را ویرایش کنید
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">شماره تماس مشتری</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                  <span dir="ltr" className="font-medium">{selectedOrder.customer_phone}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  در صورت نیاز با مشتری تماس بگیرید و تغییرات را هماهنگ کنید
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-start-date">تاریخ شروع اجرا</Label>
                <PersianDatePicker
                  value={editStartDate}
                  onChange={setEditStartDate}
                  placeholder="انتخاب تاریخ شروع"
                  timeMode="ampm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-end-date">تاریخ پایان اجرا (تخمینی)</Label>
                <PersianDatePicker
                  value={editEndDate}
                  onChange={setEditEndDate}
                  placeholder="انتخاب تاریخ پایان"
                  timeMode="none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditScheduleDialog(false);
                setEditStartDate('');
                setEditEndDate('');
              }}
            >
              انصراف
            </Button>
            <Button 
              onClick={handleUpdateSchedule} 
              disabled={!editStartDate || !editEndDate}
            >
              ذخیره تغییرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
