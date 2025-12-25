import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Eye, Search, MapPin, Phone, User } from 'lucide-react';
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
import { sendNotificationSchema } from '@/lib/rpcValidation';

// Helper to parse order notes safely - handles double-stringified JSON
const parseOrderNotes = (notes: any): any => {
  if (!notes) return null;
  try {
    let parsed = notes;
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (e) {
    console.error('Error parsing notes:', e);
    return null;
  }
};

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
}

export default function ExecutivePending() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'details' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [executionStartDate, setExecutionStartDate] = useState('');
  const [executionEndDate, setExecutionEndDate] = useState('');
  const [executionStage, setExecutionStage] = useState<string>('');
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
        setActionType('details');
        setSearchParams({}, { replace: true });
      }
    }
  }, [urlOrderId, orders, loading]);

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
          customer_id
        `)
        .eq('status', 'pending')
        .order('code', { ascending: false });

      if (error) throw error;

      const ordersWithCustomer = await Promise.all(
        (data || []).map(async (order: any) => {
          const { data: approvalData } = await supabase
            .from('order_approvals')
            .select('approver_role, approved_at')
            .eq('order_id', order.id)
            .in('approver_role', ['scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials'])
            .is('approved_at', null)
            .maybeSingle();

          if (!approvalData) return null;

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
            customer_name: customerName,
            customer_phone: customerPhone
          };
        })
      );

      setOrders(ordersWithCustomer.filter(Boolean) as Order[]);
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

  const handleApprove = async () => {
    if (!selectedOrder || !user) return;

    if (!executionStartDate || !executionEndDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً زمان شروع و پایان اجرا را مشخص کنید'
      });
      return;
    }

    if (!executionStage) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً مرحله اجرا را انتخاب کنید'
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

      // بررسی اینکه آیا همه تاییدهای لازم انجام شده است
      const { data: allApprovals } = await supabase
        .from('order_approvals')
        .select('approved_at')
        .eq('order_id', selectedOrder.id);

      const allApproved = allApprovals?.every(approval => approval.approved_at !== null);

      // به‌روزرسانی اطلاعات سفارش و در صورت تکمیل تاییدها، تغییر وضعیت به approved
      const { error: updateError } = await supabase
        .from('projects_v3')
        .update({
          execution_start_date: executionStartDate,
          execution_end_date: executionEndDate,
          executed_by: user.id,
          execution_stage: executionStage as 'awaiting_payment' | 'order_executed' | 'awaiting_collection' | 'in_collection',
          execution_stage_updated_at: new Date().toISOString(),
          ...(allApproved && { 
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString()
          })
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      // ارسال اعلان به مشتری در صورت تکمیل تاییدها
      if (allApproved) {
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
            const validated = sendNotificationSchema.parse({
              _user_id: customerData.user_id,
              _title: '✅ سفارش شما تایید شد',
              _body: `سفارش شما با کد ${selectedOrder.code} توسط تیم مدیریت تایید شد و آماده اجرا است.`,
              _link: '/profile?tab=orders',
              _type: 'success'
            });
            await supabase.rpc('send_notification', validated as { _user_id: string; _title: string; _body: string; _link?: string; _type?: string });
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
      setExecutionStage('');
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

  const ApprovalProgressSection = ({ orderId }: { orderId: string }) => {
    const { approvals, loading } = useOrderApprovals(orderId);
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">روند تاییدات</h3>
        <ApprovalProgress approvals={approvals} loading={loading} />
      </div>
    );
  };

  const OrderCardWithApprovals = ({ order }: { order: Order }) => {
    const { approvals, loading: approvalsLoading } = useOrderApprovals(order.id);
    
    return (
      <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                  در انتظار تایید
                </Badge>
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

              {/* نمایش روند تاییدات */}
              <div className="pt-3 border-t">
                {approvalsLoading ? (
                  <div className="text-xs text-muted-foreground">در حال بارگذاری تاییدات...</div>
                ) : (
                  <ApprovalProgress approvals={approvals} loading={approvalsLoading} />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedOrder(order);
                  setActionType('details');
                }}
                variant="outline"
              >
                <Eye className="h-4 w-4 ml-2" />
                مشاهده جزئیات
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedOrder(order);
                  setActionType('approve');
                  // Pre-fill execution dates from customer's requested dates
                  const notes = parseOrderNotes(order.notes);
                  const customerRequestedDate = notes?.installationDateTime || notes?.installation_date || notes?.requested_date || '';
                  const customerDueDate = notes?.dueDateTime || notes?.due_date || '';
                  setExecutionStartDate(customerRequestedDate);
                  setExecutionEndDate(customerDueDate);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 ml-2" />
                تایید سفارش
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات در انتظار تایید"
        description={`${orders.length} سفارش در انتظار تایید و تعیین زمان‌بندی اجرا`}
      />

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
              {/* نمایش تاریخ درخواستی مشتری */}
              {(() => {
                const orderNotes = parseOrderNotes(selectedOrder.notes);
                const customerRequestedDate = orderNotes?.installationDateTime || orderNotes?.installation_date || orderNotes?.requested_date;
                if (customerRequestedDate) {
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">تاریخ درخواستی مشتری</Label>
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          {formatPersianDate(customerRequestedDate)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-2">
                <Label>تاریخ شروع اجرا</Label>
                <PersianDatePicker
                  value={executionStartDate}
                  onChange={setExecutionStartDate}
                  placeholder="انتخاب تاریخ شروع"
                  timeMode="ampm"
                />
              </div>

              <div className="space-y-2">
                <Label>تاریخ پایان اجرا (تخمینی)</Label>
                <PersianDatePicker
                  value={executionEndDate}
                  onChange={setExecutionEndDate}
                  placeholder="انتخاب تاریخ پایان"
                  timeMode="none"
                />
              </div>

              <div className="space-y-2">
                <Label>مرحله اجرا</Label>
                <Select value={executionStage} onValueChange={setExecutionStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب مرحله اجرا" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awaiting_payment">در انتظار پرداخت</SelectItem>
                    <SelectItem value="order_executed">سفارش اجرا شده</SelectItem>
                    <SelectItem value="awaiting_collection">سفارش در انتظار جمع‌آوری</SelectItem>
                    <SelectItem value="in_collection">سفارش در حال جمع‌آوری</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setSelectedOrder(null);
                setExecutionStartDate('');
                setExecutionEndDate('');
                setExecutionStage('');
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 ml-2" />
              تایید و ثبت زمان‌بندی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        open={actionType === 'details'}
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setSelectedOrder(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right">جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription className="text-right">
              تمام اطلاعات فرم سفارش مشتری برای بررسی و تصمیم‌گیری
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6 text-right py-4">
              {/* مشخصات مشتری */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  مشخصات مشتری
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">نام مشتری</Label>
                    <p className="font-medium mt-1">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">شماره تماس</Label>
                    <p className="font-medium mt-1 flex items-center gap-2" dir="ltr">
                      <Phone className="w-4 h-4" />
                      {selectedOrder.customer_phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* آدرس */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  آدرس پروژه
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                  <div>
                    <Label className="text-muted-foreground">آدرس</Label>
                    <p className="mt-1">{selectedOrder.address}</p>
                  </div>
                  {selectedOrder.detailed_address && (
                    <div>
                      <Label className="text-muted-foreground">جزئیات آدرس</Label>
                      <p className="mt-1">{selectedOrder.detailed_address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* مشخصات سفارش */}
              {selectedOrder.notes && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">مشخصات کامل سفارش داربست</h3>
                  <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                    {selectedOrder.notes.service_type && (
                      <div>
                        <Label className="text-muted-foreground">نوع خدمات</Label>
                        <p className="mt-1 font-medium">{selectedOrder.notes.service_type}</p>
                      </div>
                    )}
                    
                    {(() => {
                      const n = selectedOrder.notes || {};
                      const type = n.scaffold_type || n.service_type || n.scaffoldType || '';
                      if (!type) return null;
                      return (
                        <div>
                          <Label className="text-muted-foreground">نوع داربست</Label>
                          <p className="mt-1 font-medium">
                            {type === 'facade' ? 'داربست نما' :
                             type === 'formwork' ? 'قالب بتن' :
                             type?.includes('ceiling') ? 'سقف کاذب' : String(type)}
                          </p>
                        </div>
                      );
                    })()}
                    
                    <Separator />
                    
                    {/* ابعاد داربست */}
                    {selectedOrder.notes.dimensions && selectedOrder.notes.dimensions.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-muted-foreground font-semibold">ابعاد داربست</Label>
                        {selectedOrder.notes.dimensions.map((dim: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-4 gap-3 bg-background p-3 rounded border">
                            <div>
                              <Label className="text-xs text-muted-foreground">طول</Label>
                              <p className="font-medium">{dim.length || '-'} متر</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">عرض</Label>
                              <p className="font-medium">{dim.width || '-'} متر</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">ارتفاع</Label>
                              <p className="font-medium">{dim.height || '-'} متر</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">مساحت</Label>
                              <p className="font-medium">
                                {dim.length && dim.height 
                                  ? (parseFloat(dim.length) * parseFloat(dim.height)).toFixed(2)
                                  : '-'} م²
                              </p>
                            </div>
                            {dim.useTwoMeterTemplate && (
                              <div className="col-span-4">
                                <Badge variant="secondary" className="text-xs">
                                  استفاده از قالب 2 متری
                                </Badge>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* مساحت کل */}
                    {(() => {
                      const n = selectedOrder.notes || {};
                      const total = n.total_area ?? n.totalArea;
                      if (!total) return null;
                      return (
                        <div className="bg-primary/10 p-3 rounded-md">
                          <Label className="text-muted-foreground">مساحت کل</Label>
                          <p className="mt-1 font-bold text-lg">{total} متر مربع</p>
                        </div>
                      );
                    })()}

                    <Separator />

                    {/* شرایط خدمات */}
                    {(() => {
                      const n = selectedOrder.notes || {};
                      const sc = n.service_conditions || n.serviceConditions || n.conditions || {};
                      const distance = sc.distance_range || sc.distanceRange;
                      const platformH = sc.platform_height ?? sc.platformHeight;
                      const scaffoldFromPlatform = sc.scaffold_height_from_platform ?? sc.scaffoldHeightFromPlatform;
                      const vehicleDist = sc.vehicle_distance ?? sc.vehicleDistance;
                      const totalMonths = sc.total_months ?? sc.totalMonths;
                      const currentMonth = sc.current_month ?? sc.currentMonth;
                      
                      if (!Object.keys(sc).length) return null;
                      
                      return (
                        <div className="space-y-3">
                          <Label className="text-muted-foreground font-semibold">شرایط خدمات</Label>
                          <div className="grid grid-cols-2 gap-3">
                            {totalMonths && (
                              <div className="bg-background p-3 rounded border">
                                <Label className="text-xs text-muted-foreground">مجموع ماه‌های خدمات</Label>
                                <p className="font-medium">{totalMonths} ماه</p>
                              </div>
                            )}
                            {currentMonth && (
                              <div className="bg-background p-3 rounded border">
                                <Label className="text-xs text-muted-foreground">ماه جاری</Label>
                                <p className="font-medium">ماه {currentMonth}</p>
                              </div>
                            )}
                            {distance && (
                              <div className="bg-background p-3 rounded border">
                                <Label className="text-xs text-muted-foreground">فاصله از انبار</Label>
                                <p className="font-medium">{distance} کیلومتر</p>
                              </div>
                            )}
                            {platformH != null && (
                              <div className="bg-background p-3 rounded border">
                                <Label className="text-xs text-muted-foreground">ارتفاع سکو</Label>
                                <p className="font-medium">{platformH} متر</p>
                              </div>
                            )}
                            {scaffoldFromPlatform != null && (
                              <div className="bg-background p-3 rounded border">
                                <Label className="text-xs text-muted-foreground">ارتفاع داربست از سکو</Label>
                                <p className="font-medium">{scaffoldFromPlatform} متر</p>
                              </div>
                            )}
                            {vehicleDist != null && (
                              <div className="bg-background p-3 rounded border">
                                <Label className="text-xs text-muted-foreground">فاصله وسیله نقلیه</Label>
                                <p className="font-medium">{vehicleDist} متر</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <Separator />

                    {/* اقلام اضافی */}
                    {selectedOrder.notes.additionalItems && selectedOrder.notes.additionalItems.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-muted-foreground font-semibold">اقلام اضافی درخواستی</Label>
                        <div className="space-y-2">
                          {selectedOrder.notes.additionalItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between bg-background p-3 rounded border">
                              <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                )}
                              </div>
                              <div className="text-left mr-4">
                                <p className="font-medium">{item.quantity} عدد</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* تجهیزات ایمنی */}
                    {(selectedOrder.notes.safetyEquipment || 
                      selectedOrder.notes.needsStairs !== undefined || 
                      selectedOrder.notes.needsHandrails !== undefined) && (
                      <div className="space-y-3">
                        <Label className="text-muted-foreground font-semibold">تجهیزات ایمنی و جانبی</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedOrder.notes.needsStairs !== undefined && (
                            <div className="bg-background p-3 rounded border">
                              <Label className="text-xs text-muted-foreground">نیاز به پله</Label>
                              <p className="font-medium">
                                {selectedOrder.notes.needsStairs ? '✓ بله' : '✗ خیر'}
                              </p>
                            </div>
                          )}
                          {selectedOrder.notes.needsHandrails !== undefined && (
                            <div className="bg-background p-3 rounded border">
                              <Label className="text-xs text-muted-foreground">نیاز به نرده</Label>
                              <p className="font-medium">
                                {selectedOrder.notes.needsHandrails ? '✓ بله' : '✗ خیر'}
                              </p>
                            </div>
                          )}
                          {selectedOrder.notes.safetyEquipment && selectedOrder.notes.safetyEquipment.length > 0 && (
                            <div className="col-span-2 bg-background p-3 rounded border">
                              <Label className="text-xs text-muted-foreground">تجهیزات ایمنی</Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {selectedOrder.notes.safetyEquipment.map((equipment: string, idx: number) => (
                                  <Badge key={idx} variant="outline">
                                    {equipment}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* سایر تجهیزات */}
                    {selectedOrder.notes.otherEquipment && selectedOrder.notes.otherEquipment.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-muted-foreground font-semibold">سایر تجهیزات</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedOrder.notes.otherEquipment.map((equipment: string, idx: number) => (
                            <Badge key={idx} variant="secondary">
                              {equipment}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* توضیحات اضافی */}
                    {selectedOrder.notes.additional_notes && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label className="text-muted-foreground font-semibold">توضیحات اضافی مشتری</Label>
                          <div className="bg-background p-3 rounded border">
                            <p className="whitespace-pre-wrap">{selectedOrder.notes.additional_notes}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* تصاویر و فایل‌ها */}
                    {selectedOrder.notes.mediaFiles && selectedOrder.notes.mediaFiles.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <Label className="text-muted-foreground font-semibold">تصاویر و فایل‌های پیوست</Label>
                          <div className="grid grid-cols-3 gap-3">
                            {selectedOrder.notes.mediaFiles.map((file: any, idx: number) => (
                              <div key={idx} className="relative group">
                                {file.type?.startsWith('image/') ? (
                                  <img 
                                    src={file.url} 
                                    alt={`تصویر ${idx + 1}`}
                                    className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => window.open(file.url, '_blank')}
                                  />
                                ) : (
                                  <div className="w-full h-32 flex items-center justify-center bg-background rounded border">
                                    <a 
                                      href={file.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline text-center p-2"
                                    >
                                      مشاهده فایل
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* روند تاییدات */}
              <ApprovalProgressSection orderId={selectedOrder.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
