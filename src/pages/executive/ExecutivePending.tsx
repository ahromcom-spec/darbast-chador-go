import { useState, useEffect } from 'react';
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
}

export default function ExecutivePending() {
  const { user } = useAuth();
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
          customer_id
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

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
                setActionType('details');
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
                setActionType('approve');
              }}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              تایید و تعیین زمان‌بندی
            </Button>
          </div>
        </CardContent>
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
              <div className="space-y-2">
                <Label>تاریخ شروع اجرا</Label>
                <PersianDatePicker
                  value={executionStartDate}
                  onChange={setExecutionStartDate}
                  placeholder="انتخاب تاریخ شروع"
                />
              </div>

              <div className="space-y-2">
                <Label>تاریخ پایان اجرا</Label>
                <PersianDatePicker
                  value={executionEndDate}
                  onChange={setExecutionEndDate}
                  placeholder="انتخاب تاریخ پایان"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">نام مشتری</Label>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">شماره تماس</Label>
                  <p className="font-medium" dir="ltr">{selectedOrder.customer_phone}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">آدرس</Label>
                <p className="font-medium">{selectedOrder.address}</p>
              </div>
              {selectedOrder.detailed_address && (
                <div>
                  <Label className="text-xs text-muted-foreground">آدرس تفصیلی</Label>
                  <p className="font-medium">{selectedOrder.detailed_address}</p>
                </div>
              )}
              {selectedOrder.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">جزئیات درخواست</Label>
                  <pre className="text-sm bg-muted p-3 rounded-lg mt-2 whitespace-pre-wrap">
                    {JSON.stringify(selectedOrder.notes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
