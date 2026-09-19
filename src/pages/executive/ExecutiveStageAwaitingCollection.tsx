import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PackageOpen, Eye, Search, MapPin, Phone, User, Calendar, RefreshCw, ArrowLeftRight, Users, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { ManagerOrderTransfer } from '@/components/orders/ManagerOrderTransfer';
import { ManagerAddStaffCollaborator } from '@/components/orders/ManagerAddStaffCollaborator';
import { sendPushNotification, sendNotificationRpc } from '@/lib/notifications';
import { buildOrderSmsAddress, sendOrderSms } from '@/lib/orderSms';
import { useOrderArchive } from '@/hooks/useOrderArchive';
import { OrderArchiveControls, OrderCardArchiveButton } from '@/components/orders/OrderArchiveControls';
import { CollectionRequestDialog } from '@/components/orders/CollectionRequestDialog';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  execution_start_date: string | null;
  execution_end_date: string | null;
  execution_stage: string | null;
  notes: any;
  collection_request?: {
    requested_date: string | null;
    confirmed_date: string | null;
    status: string;
  } | null;
}

const stageLabels: Record<string, string> = {
  approved: 'در انتظار اجرا',
  pending_execution: 'در انتظار اجرا',
  in_progress: 'در حال اجرا',
  awaiting_payment: 'در انتظار پرداخت',
  awaiting_collection: 'در انتظار جمع‌آوری',
  closed: 'تکمیل سفارش'
};

export default function ExecutiveStageAwaitingCollection() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Archive functionality
  const archive = useOrderArchive(() => fetchOrders());

  // Check if this is the "scaffold execution with materials" module
  const activeModuleKey = searchParams.get('moduleKey') || '';
  // Also check moduleName for custom copies of the module
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, '', '');
  
  // ماژول مدیریت اجرایی - بدون دسترسی به قیمت
  const isExecutiveModule = moduleName.includes('مدیریت اجرایی');

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
      // نمایش سفارشات با مرحله awaiting_payment یا awaiting_collection در این پوشه
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
          execution_stage,
          notes,
          customer_id
        `)
        .in('execution_stage', ['awaiting_collection', 'awaiting_payment'])
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

          // دریافت درخواست جمع‌آوری مشتری
          const { data: collectionRequestData } = await supabase
            .from('collection_requests')
            .select('requested_date, confirmed_date, status')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            created_at: order.created_at,
            customer_id: order.customer_id,
            execution_start_date: order.execution_start_date,
            execution_end_date: order.execution_end_date,
            execution_stage: order.execution_stage,
            notes: order.notes,
            customer_name: customerName,
            customer_phone: customerPhone,
            collection_request: collectionRequestData || null
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
      // دریافت اطلاعات مشتری
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          execution_stage: newStage as 'awaiting_payment' | 'order_executed' | 'awaiting_collection' | 'in_collection',
          execution_stage_updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // ارسال Push Notification به مشتری
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
              await sendPushNotification({
                user_id: customerData.user_id,
                order_id: orderId,
                title: message.title,
                body: message.body,
                link: '/profile?tab=orders',
                type: 'info'
              });
            } catch (e) {
              console.log('Push notification skipped');
            }
          }
        }
      }

      // ارسال پیامک به مشتری (در پس‌زمینه)
      const selectedOrder = orders.find(o => o.id === orderId);
      if (selectedOrder?.customer_phone) {
        const smsStatusMap: Record<string, any> = {
          awaiting_payment: 'awaiting_payment',
          order_executed: 'executed',
          awaiting_collection: 'in_collection',
          in_collection: 'in_collection'
        };
        const smsStatus = smsStatusMap[newStage];
        if (smsStatus) {
          sendOrderSms(selectedOrder.customer_phone, orderCode, smsStatus, {
            orderId: selectedOrder.id,
            address: buildOrderSmsAddress(selectedOrder.address, selectedOrder.detailed_address),
          }).catch(err => {
            console.error('SMS notification error:', err);
          });
        }
      }

      toast({
        title: '✓ مرحله به‌روزرسانی شد',
        description: `مرحله سفارش ${orderCode} به "${stageLabels[newStage]}" تغییر یافت.`
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

  const handleCompleteCollection = async (orderId: string, orderCode: string) => {
    setUpdatingStage(true);
    try {
      // دریافت اطلاعات مشتری
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      // به‌روزرسانی وضعیت سفارش به تکمیل شده
      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString()
        })
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
          const notificationTitle = '🎉 سفارش تکمیل شد';
          const notificationBody = `سفارش ${orderCode} با موفقیت تکمیل و جمع‌آوری شد. از اعتماد شما سپاسگزاریم.`;
          
          try {
            // ارسال اعلان درون‌برنامه‌ای با بررسی impersonation
            await sendNotificationRpc(customerData.user_id, notificationTitle, notificationBody, '/profile?tab=orders', 'success');
            
            // ارسال Push Notification به گوشی کاربر
            await sendPushNotification({
              user_id: customerData.user_id,
              order_id: orderId,
              title: notificationTitle,
              body: notificationBody,
              link: '/profile?tab=orders',
              type: 'success'
            });
          } catch (e) {
            console.error('Error sending notification:', e);
          }
        }
      }

      // ارسال پیامک به مشتری (در پس‌زمینه)
      const selectedOrder = orders.find(o => o.id === orderId);
      if (selectedOrder?.customer_phone) {
        sendOrderSms(selectedOrder.customer_phone, orderCode, 'completed', {
          orderId: selectedOrder.id,
          address: buildOrderSmsAddress(selectedOrder.address, selectedOrder.detailed_address),
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      toast({
        title: '🎉 سفارش تکمیل شد',
        description: `سفارش ${orderCode} با موفقیت تکمیل و بسته شد.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error completing collection:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در تکمیل سفارش'
      });
    } finally {
      setUpdatingStage(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات در انتظار جمع‌آوری"
        description={`${orders.length} سفارش در این مرحله`}
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
              <PackageOpen className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی در این مرحله وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-all border-l-4 border-l-purple-500">
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
                      <StatusBadge status={order.status as any} />
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
                
                {order.execution_start_date && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">زمان‌بندی اجرا:</span>
                      <span>
                        {new Date(order.execution_start_date).toLocaleDateString('fa-IR')}
                        {order.execution_end_date && ' تا ' + new Date(order.execution_end_date).toLocaleDateString('fa-IR')}
                      </span>
                    </div>
                  </div>
                )}

                {/* نمایش وضعیت درخواست جمع‌آوری */}
                {order.collection_request ? (
                  <div className={`p-3 rounded-lg border ${
                    order.collection_request.status === 'approved' 
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : order.collection_request.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                      : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <PackageOpen className={`h-4 w-4 ${
                          order.collection_request.status === 'approved' 
                            ? 'text-green-600' 
                            : order.collection_request.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-orange-600'
                        }`} />
                        <span className={`font-medium ${
                          order.collection_request.status === 'approved' 
                            ? 'text-green-700 dark:text-green-300' 
                            : order.collection_request.status === 'rejected'
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-orange-700 dark:text-orange-300'
                        }`}>
                          {order.collection_request.status === 'approved' 
                            ? 'درخواست جمع‌آوری تایید شده' 
                            : order.collection_request.status === 'rejected'
                            ? 'درخواست جمع‌آوری رد شده'
                            : 'درخواست جمع‌آوری در انتظار تایید'}
                        </span>
                      </div>
                      {order.collection_request.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setCollectionDialogOpen(true);
                          }}
                          className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-100"
                        >
                          <Calendar className="h-3 w-3" />
                          بررسی درخواست
                        </Button>
                      )}
                    </div>
                    {order.collection_request.requested_date && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">تاریخ درخواستی: </span>
                        <span className="font-medium">
                          {new Date(order.collection_request.requested_date).toLocaleDateString('fa-IR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                    {order.collection_request.confirmed_date && (
                      <div className="mt-2 text-sm bg-green-100 dark:bg-green-900/30 p-2 rounded">
                        <span className="text-green-700 dark:text-green-300 font-medium">✓ تاریخ جمع‌آوری شده: </span>
                        <span className="font-bold text-green-800 dark:text-green-200">
                          {new Date(order.collection_request.confirmed_date).toLocaleDateString('fa-IR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border bg-muted/30 border-dashed">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <PackageOpen className="h-4 w-4" />
                        <span>درخواست جمع‌آوری ثبت نشده</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedOrder(order);
                          setCollectionDialogOpen(true);
                        }}
                        className="gap-1"
                      >
                        <Calendar className="h-3 w-3" />
                        ثبت درخواست
                      </Button>
                    </div>
                  </div>
                )}

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
                    onClick={() => handleCompleteCollection(order.id, order.code)}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <PackageOpen className="h-4 w-4" />
                    جمع‌آوری شد
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
                customer_id: selectedOrder.customer_id,
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

      {/* Staff Collaborator Dialog */}
      {selectedOrder && (
        <ManagerAddStaffCollaborator
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={collaboratorDialogOpen}
          onOpenChange={setCollaboratorDialogOpen}
          onCollaboratorAdded={fetchOrders}
        />
      )}

      {/* Collection Request Dialog - برای مدیریت درخواست جمع‌آوری */}
      {selectedOrder && (
        <CollectionRequestDialog
          open={collectionDialogOpen}
          onOpenChange={(open) => {
            setCollectionDialogOpen(open);
            if (!open) fetchOrders();
          }}
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          customerId={selectedOrder.customer_id}
          isManager={true}
        />
      )}
    </div>
  );
}
