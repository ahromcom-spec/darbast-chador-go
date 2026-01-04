import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Eye, Search, MapPin, Phone, User, Calendar, Clock, RefreshCw, ArrowLeftRight, Users, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { sendNotificationSchema } from '@/lib/rpcValidation';
import { sendPushNotification, sendNotificationRpc } from '@/lib/notifications';
import { ManagerOrderTransfer } from '@/components/orders/ManagerOrderTransfer';
import { ManagerAddStaffCollaborator } from '@/components/orders/ManagerAddStaffCollaborator';
import { useOrderArchive } from '@/hooks/useOrderArchive';
import { OrderArchiveControls, OrderCardArchiveButton } from '@/components/orders/OrderArchiveControls';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  execution_start_date: string | null;
  execution_end_date: string | null;
  execution_confirmed_at: string | null;
  execution_stage: string | null;
  rental_start_date: string | null;
  notes: any;
}

const stageLabels: Record<string, string> = {
  approved: 'در انتظار اجرا',
  pending_execution: 'در انتظار اجرا',
  in_progress: 'در حال اجرا',
  awaiting_payment: 'در انتظار پرداخت',
  awaiting_collection: 'در انتظار جمع‌آوری',
  closed: 'تکمیل سفارش'
};

export default function ExecutiveInProgress() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Archive functionality
  const archive = useOrderArchive(() => fetchOrders());

  // Auto-open order from URL param
  const urlOrderId = searchParams.get('orderId');
  
  // Check if this is the "scaffold execution with materials" module
  const activeModuleKey = searchParams.get('moduleKey') || '';
  // Also check moduleName for custom copies of the module
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, '', '');
  
  // ماژول مدیریت اجرایی - بدون دسترسی به قیمت
  const isExecutiveModule = moduleName.includes('مدیریت اجرایی');

  useEffect(() => {
    fetchOrders();
  }, []);

  // Auto-open order details when orderId is in URL and orders are loaded
  useEffect(() => {
    if (urlOrderId && orders.length > 0 && !loading) {
      const order = orders.find(o => o.id === urlOrderId);
      if (order) {
        setSelectedOrder(order);
        setDetailsOpen(true);
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
          execution_start_date,
          execution_end_date,
          execution_confirmed_at,
          execution_stage,
          rental_start_date,
          notes,
          customer_id
        `)
        .eq('status', 'in_progress')
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

      setOrders(ordersWithCustomer as Order[]);
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

  const handleStageUpdate = async (orderId: string, newStage: string, orderCode: string) => {
    setUpdatingStage(true);
    try {
      // دریافت اطلاعات مشتری برای ارسال اعلان
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      // تنظیم status بر اساس مرحله جدید
      const updateData: any = { 
        execution_stage: newStage as 'awaiting_payment' | 'order_executed' | 'awaiting_collection' | 'in_collection',
        execution_stage_updated_at: new Date().toISOString(),
        status: 'completed' // همه مراحل اجرایی در status=completed هستند
      };

      const { error } = await supabase
        .from('projects_v3')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // ارسال اعلان به مشتری
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', orderData.customer_id)
          .single();

        if (customerData?.user_id) {
          const stageMessages: Record<string, { title: string; body: string }> = {
            awaiting_payment: { title: '💰 در انتظار پرداخت', body: `سفارش ${orderCode} منتظر پرداخت شماست.` },
            order_executed: { title: '✅ سفارش اجرا شد', body: `سفارش ${orderCode} با موفقیت اجرا شد.` },
            awaiting_collection: { title: '📦 در انتظار جمع‌آوری', body: `سفارش ${orderCode} آماده جمع‌آوری است.` },
            in_collection: { title: '🚚 در حال جمع‌آوری', body: `جمع‌آوری سفارش ${orderCode} آغاز شد.` }
          };
          const message = stageMessages[newStage];
          if (message) {
            try {
              // ارسال اعلان درون‌برنامه‌ای با بررسی impersonation
              await sendNotificationRpc(customerData.user_id, message.title, message.body, '/profile?tab=orders', 'info');
              
              // ارسال Push Notification به گوشی کاربر
              await sendPushNotification({
                user_id: customerData.user_id,
                title: message.title,
                body: message.body,
                link: '/profile?tab=orders',
                type: 'info'
              });
            } catch (e) {
              console.error('Error sending notification:', e);
            }
          }
        }
      }

      toast({
        title: '✓ مرحله به‌روزرسانی شد',
        description: `سفارش ${orderCode} به "${stageLabels[newStage]}" منتقل شد.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در به‌روزرسانی مرحله'
      });
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleCompleteExecution = async (orderId: string, orderCode: string) => {
    try {
      // دریافت اطلاعات مشتری
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      if (!orderData) throw new Error('سفارش یافت نشد');

      // دریافت user_id مشتری
      const { data: customerData } = await supabase
        .from('customers')
        .select('user_id')
        .eq('id', orderData.customer_id)
        .single();

      // به‌روزرسانی وضعیت سفارش - تغییر به completed و تنظیم execution_stage به awaiting_payment
      // این مرحله باعث نمایش سفارش در هر دو پوشه "در انتظار پرداخت" و "در انتظار جمع‌آوری" می‌شود
      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          status: 'completed',
          execution_stage: 'awaiting_payment',
          execution_stage_updated_at: new Date().toISOString(),
          executive_completion_date: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // ارسال اعلان به مشتری
      if (customerData?.user_id) {
        const notificationTitle = '💰 سفارش در انتظار پرداخت و جمع‌آوری';
        const notificationBody = `سفارش با کد ${orderCode} اجرا شد و منتظر پرداخت و جمع‌آوری است. لطفاً برای پرداخت اقدام کنید.`;
        
        // ارسال اعلان درون‌برنامه‌ای با بررسی impersonation
        await sendNotificationRpc(customerData.user_id, notificationTitle, notificationBody, '/profile?tab=orders', 'success');
        
        // ارسال Push Notification به گوشی کاربر
        try {
          await sendPushNotification({
            user_id: customerData.user_id,
            title: notificationTitle,
            body: notificationBody,
            link: '/profile?tab=orders',
            type: 'success'
          });
        } catch (pushError) {
          console.log('Push notification skipped');
        }
      }

      toast({
        title: '✓ اجرا تکمیل شد',
        description: `سفارش ${orderCode} به مرحله در انتظار پرداخت و جمع‌آوری منتقل شد.`
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات در حال اجرا"
        description={`${orders.length} سفارش در حال اجرا`}
      />

      {orders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Selection Bar */}
      <OrderArchiveControls
        showBulkBar={true}
        selectedCount={archive.selectedOrderIds.size}
        totalCount={filteredOrders.length}
        onToggleSelectAll={() => archive.toggleSelectAll(filteredOrders.map(o => o.id))}
        onBulkArchive={() => archive.setBulkArchiveDialogOpen(true)}
        archiveDialogOpen={archive.archiveDialogOpen}
        onArchiveDialogChange={archive.setArchiveDialogOpen}
        orderToArchive={archive.orderToArchive}
        onConfirmArchive={archive.handleArchiveOrder}
        bulkArchiveDialogOpen={archive.bulkArchiveDialogOpen}
        onBulkArchiveDialogChange={archive.setBulkArchiveDialogOpen}
        onConfirmBulkArchive={archive.handleBulkArchive}
        archiving={archive.archiving}
      />

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارش در حال اجرا وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-all border-l-4 border-l-green-500">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <OrderCardArchiveButton
                    orderId={order.id}
                    isSelected={archive.selectedOrderIds.has(order.id)}
                    onToggleSelection={() => archive.toggleOrderSelection(order.id)}
                    onArchive={() => archive.openArchiveDialog({ id: order.id, code: order.code })}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                      <StatusBadge status="in_progress" />
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
                        <span>{order.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                
                <div className="grid grid-cols-2 gap-3">
                  {order.execution_confirmed_at && (
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-green-600" />
                        <div>
                          <div className="text-xs text-muted-foreground">شروع اجرا</div>
                          <div className="font-medium">
                            {new Date(order.execution_confirmed_at).toLocaleDateString('fa-IR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {order.execution_end_date && (
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="text-xs text-muted-foreground">پایان برنامه‌ریزی شده</div>
                          <div className="font-medium">
                            {new Date(order.execution_end_date).toLocaleDateString('fa-IR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {order.execution_stage && (
                  <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <RefreshCw className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">مرحله فعلی:</span>
                        <span className="text-purple-700 dark:text-purple-300 font-medium">
                          {stageLabels[order.execution_stage] || order.execution_stage}
                        </span>
                      </div>
                      <Select
                        value={order.execution_stage}
                        onValueChange={(value) => handleStageUpdate(order.id, value, order.code)}
                        disabled={updatingStage}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="awaiting_payment">در انتظار پرداخت</SelectItem>
                          <SelectItem value="order_executed">سفارش اجرا شده</SelectItem>
                          <SelectItem value="awaiting_collection">در انتظار جمع‌آوری</SelectItem>
                          <SelectItem value="in_collection">در حال جمع‌آوری</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

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
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setTransferDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    انتقال
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setCollaboratorDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    افزودن پرسنل
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={() => handleCompleteExecution(order.id, order.code)}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    اجرا شد
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <EditableOrderDetails 
              order={{
                id: selectedOrder.id,
                code: selectedOrder.code,
                customer_name: selectedOrder.customer_name,
                customer_phone: selectedOrder.customer_phone,
                address: selectedOrder.address,
                detailed_address: selectedOrder.detailed_address,
                created_at: selectedOrder.created_at,
                notes: selectedOrder.notes,
                execution_start_date: selectedOrder.execution_start_date,
                execution_end_date: selectedOrder.execution_end_date,
                execution_stage: selectedOrder.execution_stage
              }}
              onUpdate={fetchOrders}
              hidePrice={isExecutiveModule}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedOrder && (
        <ManagerOrderTransfer
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onTransferComplete={fetchOrders}
        />
      )}

      {selectedOrder && (
        <ManagerAddStaffCollaborator
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={collaboratorDialogOpen}
          onOpenChange={setCollaboratorDialogOpen}
          onCollaboratorAdded={fetchOrders}
        />
      )}
    </div>
  );
}

