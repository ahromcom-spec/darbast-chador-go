import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, X, Eye, Search, MapPin, Phone, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { formatPersianDate } from '@/lib/dateUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApprovalProgress } from '@/components/orders/ApprovalProgress';
import { useOrderApprovals } from '@/hooks/useOrderApprovals';
import { Separator } from '@/components/ui/separator';

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
  subcategory_id?: string;
  province_id?: string;
  district_id?: string;
}

export default function ExecutivePendingOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [executionStartDate, setExecutionStartDate] = useState('');
  const [executionEndDate, setExecutionEndDate] = useState('');
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
          notes,
          subcategory_id,
          province_id,
          district_id,
          customer_id
        `)
        .in('status', ['pending', 'approved', 'in_progress'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map orders and enrich with customer details (show pending, approved, and in_progress)
      const rows = await Promise.all(
        (data || []).map(async (order: any) => {
          // Fetch customer details
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
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            created_at: order.created_at,
            notes: order.notes,
            subcategory_id: order.subcategory_id,
            province_id: order.province_id,
            district_id: order.district_id,
            customer_name: customerName,
            customer_phone: customerPhone
          };
        })
      );

      setOrders(rows as Order[]);
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

  const handleStartExecution = async (orderId: string, orderCode: string) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          status: 'in_progress',
          executed_by: user?.id,
          execution_confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: '✓ اجرا آغاز شد',
        description: `سفارش ${orderCode} به مرحله در حال اجرا منتقل شد.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error starting execution:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در شروع اجرا'
      });
    }
  };

  const handleCompleteExecution = async (orderId: string, orderCode: string) => {
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
        title: '✓ اجرا تکمیل شد',
        description: `سفارش ${orderCode} به مرحله در انتظار پرداخت منتقل شد.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error completing execution:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در تکمیل اجرا'
      });
    }
  };

  const handleApprove = async () => {
    if (!selectedOrder || !user) return;

    // Validate dates
    if (!executionStartDate || !executionEndDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً زمان شروع و پایان اجرا را مشخص کنید'
      });
      return;
    }

    if (new Date(executionEndDate) <= new Date(executionStartDate)) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'زمان پایان باید بعد از زمان شروع باشد'
      });
      return;
    }

    try {
      // Find the pending approval row for executive manager for this order
      const { data: pendingApproval, error: fetchApprovalError } = await supabase
        .from('order_approvals')
        .select('approver_role')
        .eq('order_id', selectedOrder.id)
        .in('approver_role', ['scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials'])
        .is('approved_at', null)
        .maybeSingle();

      if (fetchApprovalError || !pendingApproval) {
        throw new Error('هیچ تایید در انتظار برای مدیر اجرایی یافت نشد');
      }

      // Record executive manager approval on the pending row
      const { error: approvalError } = await supabase
        .from('order_approvals')
        .update({
          approver_user_id: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('order_id', selectedOrder.id)
        .eq('approver_role', pendingApproval.approver_role)
        .is('approved_at', null);

      if (approvalError) throw approvalError;

      // Update execution dates in the order
      const { error: updateError } = await supabase
        .from('projects_v3')
        .update({
          execution_start_date: executionStartDate,
          execution_end_date: executionEndDate,
          executed_by: user.id
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      // بررسی اینکه آیا همه تاییدهای لازم انجام شده است
      const { data: allApprovals } = await supabase
        .from('order_approvals')
        .select('approved_at')
        .eq('order_id', selectedOrder.id);

      // اگر همه تاییدها انجام شده باشد، وضعیت سفارش را به approved تغییر می‌دهیم
      if (allApprovals && allApprovals.every(approval => approval.approved_at !== null)) {
        const { error: statusError } = await supabase
          .from('projects_v3')
          .update({
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', selectedOrder.id);

        if (statusError) console.error('Error updating order status:', statusError);

        // ارسال اعلان به مشتری
        const { data: orderData } = await supabase
          .from('projects_v3')
          .select('customer_id')
          .eq('id', selectedOrder.id)
          .single();

        if (orderData) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('user_id')
            .eq('id', orderData.customer_id)
            .single();

          if (customerData?.user_id) {
            await supabase.rpc('send_notification', {
              _user_id: customerData.user_id,
              _title: '✅ سفارش شما تایید شد',
              _body: `سفارش شما با کد ${selectedOrder.code} توسط تیم مدیریت تایید شد و آماده اجرا است.`,
              _link: '/user/my-orders',
              _type: 'success'
            });
          }
        }
      }

      toast({
        title: '✓ تایید شما ثبت شد',
        description: `تایید شما برای سفارش ${selectedOrder.code} با زمان‌بندی اجرا ثبت شد.`
      });

      setActionType(null);
      setSelectedOrder(null);
      setExecutionStartDate('');
      setExecutionEndDate('');
      fetchOrders();
    } catch (error) {
      console.error('Error approving order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'تایید سفارش با خطا مواجه شد'
      });
    }
  };

  const OrderCardWithApprovals = ({ order }: { order: Order }) => {
    const { approvals, loading: approvalsLoading } = useOrderApprovals(order.id);
    
    const getServiceInfo = () => {
      try {
        const n = order.notes || {};
        const totalArea = n.total_area ?? n.totalArea;
        if (totalArea) return `مساحت کل: ${totalArea} متر مربع`;
        if (n.dimensions?.length > 0) return `تعداد ابعاد: ${n.dimensions.length}`;
        const type = n.scaffold_type || n.service_type || n.scaffoldType || '';
        if (type === 'facade') return 'داربست نما';
        if (type === 'formwork') return 'قالب فلزی';
        if (type?.includes('ceiling')) return 'داربست سقف';
        return 'داربست با اجناس';
      } catch {
        return 'داربست با اجناس';
      }
    };

    return (
      <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                <Badge variant={
                  order.status === 'pending' ? 'secondary' : 
                  order.status === 'approved' ? 'default' : 
                  'outline'
                } className={
                  order.status === 'pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                  order.status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                }>
                  {order.status === 'pending' ? 'در انتظار تایید' : 
                   order.status === 'approved' ? 'آماده اجرا' : 
                   'در حال اجرا'}
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr" className="text-left">{order.customer_phone}</span>
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
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">نوع خدمات</div>
            <div className="text-sm font-medium">{getServiceInfo()}</div>
          </div>

          {order.detailed_address && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">آدرس تفصیلی:</span> {order.detailed_address}
            </div>
          )}

          <ApprovalProgress approvals={approvals} loading={approvalsLoading} />

          <div className="flex gap-2 flex-wrap pt-2">
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
            
            {order.status === 'pending' && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedOrder(order);
                  setActionType('approve');
                }}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                تایید سفارش
              </Button>
            )}
            
            {order.status === 'approved' && (
              <Button
                size="sm"
                onClick={() => handleStartExecution(order.id, order.code)}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="h-4 w-4" />
                شروع اجرا
              </Button>
            )}
            
            {order.status === 'in_progress' && (
              <Button
                size="sm"
                onClick={() => handleCompleteExecution(order.id, order.code)}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                اتمام اجرا
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="کارتابل مدیر اجرایی"
        description={`${orders.length} سفارش در انتظار تایید، در حال اجرا و آماده تحویل`}
        showBackButton={true}
        backTo="/executive"
      />

      {/* Search Bar */}
      {orders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو بر اساس کد سفارش، نام مشتری، شماره تلفن یا آدرس..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            {searchTerm && (
              <div className="mt-2 text-sm text-muted-foreground">
                {filteredOrders.length} سفارش یافت شد
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>{searchTerm ? 'سفارشی با این جستجو یافت نشد' : 'سفارشی در انتظار تایید شما وجود ندارد'}</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <OrderCardWithApprovals key={order.id} order={order} />
          ))
        )}
      </div>

      {/* Approval Dialog */}
      <Dialog
        open={actionType === 'approve'}
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setSelectedOrder(null);
            setExecutionStartDate('');
            setExecutionEndDate('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تایید سفارش و تعیین زمان‌بندی اجرا</DialogTitle>
            <DialogDescription>
              لطفاً زمان شروع و پایان اجرای سفارش {selectedOrder?.code} را مشخص کنید
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
                  لطفاً با مشتری تماس بگیرید و زمان‌بندی را هماهنگ کنید
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">تاریخ شروع اجرا</Label>
                <PersianDatePicker
                  value={executionStartDate}
                  onChange={setExecutionStartDate}
                  placeholder="انتخاب تاریخ شروع"
                  timeMode="ampm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">تاریخ پایان اجرا (تخمینی)</Label>
                <PersianDatePicker
                  value={executionEndDate}
                  onChange={setExecutionEndDate}
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
                setActionType(null);
                setExecutionStartDate('');
                setExecutionEndDate('');
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleApprove} disabled={!executionStartDate || !executionEndDate}>
              تایید و ثبت زمان‌بندی
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
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">نام مشتری</Label>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {selectedOrder.customer_name}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">شماره تماس</Label>
                  <p className="text-sm font-medium flex items-center gap-2" dir="ltr">
                    <Phone className="h-4 w-4 text-primary" />
                    {selectedOrder.customer_phone}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">آدرس</Label>
                <p className="text-sm flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{selectedOrder.address}</span>
                </p>
                {selectedOrder.detailed_address && (
                  <p className="text-sm text-muted-foreground mr-6">{selectedOrder.detailed_address}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">تاریخ ثبت سفارش</Label>
                <p className="text-sm">{formatPersianDate(selectedOrder.created_at, { 
                  showDayOfWeek: true,
                  showTime: true
                })}</p>
              </div>

              {selectedOrder.notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">جزئیات فنی سفارش</Label>
                    <div className="bg-muted p-4 rounded-lg space-y-3">
                      {/* نوع داربست */}
                      {(() => {
                        const n = selectedOrder.notes || {};
                        const type = n.scaffold_type || n.service_type || n.scaffoldType || '';
                        if (!type) return null;
                        return (
                          <div>
                            <span className="font-semibold">نوع داربست:</span>{' '}
                            <span className="text-sm">
                              {type === 'facade' ? 'داربست نما' :
                               type === 'formwork' ? 'قالب فلزی' :
                               type?.includes('ceiling') ? 'داربست سقف' : String(type)}
                            </span>
                          </div>
                        );
                      })()}
                      
                      {/* مساحت کل */}
                      {(() => {
                        const n = selectedOrder.notes || {};
                        const total = n.total_area ?? n.totalArea;
                        if (!total) return null;
                        return (
                          <div>
                            <span className="font-semibold">مساحت کل:</span> {total} متر مربع
                          </div>
                        );
                      })()}
                      
                      {/* ابعاد */}
                      {selectedOrder.notes.dimensions && selectedOrder.notes.dimensions.length > 0 && (
                        <div>
                          <span className="font-semibold">ابعاد:</span>
                          <ul className="mt-2 space-y-1 mr-4">
                            {selectedOrder.notes.dimensions.map((dim: any, idx: number) => (
                              <li key={idx} className="text-sm">
                                {dim.length && dim.height ? (
                                  <>طول: {dim.length}م × ارتفاع: {dim.height}م{dim.area && ` = ${dim.area} متر مربع`}</>
                                ) : (
                                  <>طول: {dim.length}م × عرض: {dim.width}م × ارتفاع: {dim.height}م</>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* شرایط خدمات */}
                      {selectedOrder.notes.service_conditions && (
                        <div className="space-y-2">
                          <span className="font-semibold">شرایط خدمات:</span>
                          <div className="mr-4 space-y-1 text-sm">
                            {selectedOrder.notes.service_conditions.total_months && (
                              <div>مدت خدمات: {selectedOrder.notes.service_conditions.total_months} ماه</div>
                            )}
                            {selectedOrder.notes.service_conditions.current_month && (
                              <div>ماه جاری: {selectedOrder.notes.service_conditions.current_month}</div>
                            )}
                            {selectedOrder.notes.service_conditions.distance_range && (
                              <div>
                                محدوده فاصله: {selectedOrder.notes.service_conditions.distance_range === '0-15' ? '0 تا 15 کیلومتر' :
                                               selectedOrder.notes.service_conditions.distance_range === '15-25' ? '15 تا 25 کیلومتر' :
                                               selectedOrder.notes.service_conditions.distance_range === '25-50' ? '25 تا 50 کیلومتر' :
                                               '50 تا 85 کیلومتر'}
                              </div>
                            )}
                            {selectedOrder.notes.service_conditions.platform_height && (
                              <div>ارتفاع کف بلوکی: {selectedOrder.notes.service_conditions.platform_height} متر</div>
                            )}
                            {selectedOrder.notes.service_conditions.scaffold_height_from_platform && (
                              <div>ارتفاع داربست از کف بلوکی: {selectedOrder.notes.service_conditions.scaffold_height_from_platform} متر</div>
                            )}
                            {selectedOrder.notes.service_conditions.vehicle_distance && (
                              <div>فاصله تا محل توقف خودرو: {selectedOrder.notes.service_conditions.vehicle_distance} متر</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* ضمیمه‌های اضافی */}
                      {selectedOrder.notes.additional_items && selectedOrder.notes.additional_items.length > 0 && (
                        <div>
                          <span className="font-semibold">ضمیمه‌های اضافی:</span>
                          <ul className="mt-2 space-y-1 mr-4 text-sm">
                            {selectedOrder.notes.additional_items.map((item: any, idx: number) => (
                              <li key={idx}>
                                {item.item_name || item.item_type} - تعداد: {item.quantity}
                                {item.price && ` - قیمت: ${item.price}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* موارد امنیتی */}
                      {selectedOrder.notes.safety_equipment && selectedOrder.notes.safety_equipment.length > 0 && (
                        <div>
                          <span className="font-semibold">تجهیزات ایمنی:</span>
                          <ul className="mt-2 space-y-1 mr-4 text-sm">
                            {selectedOrder.notes.safety_equipment.map((item: string, idx: number) => (
                              <li key={idx}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* دیگر موارد */}
                      {selectedOrder.notes.has_stairs !== undefined && (
                        <div>
                          <span className="font-semibold">نیاز به پله:</span> {selectedOrder.notes.has_stairs ? 'بله' : 'خیر'}
                        </div>
                      )}
                      {selectedOrder.notes.has_handrail !== undefined && (
                        <div>
                          <span className="font-semibold">نیاز به نرده:</span> {selectedOrder.notes.has_handrail ? 'بله' : 'خیر'}
                        </div>
                      )}
                    </div>
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
