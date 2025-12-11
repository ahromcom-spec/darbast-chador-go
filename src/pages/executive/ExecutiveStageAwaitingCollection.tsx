import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PackageOpen, Eye, Search, MapPin, Phone, User, Calendar, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProgressMediaUploader } from '@/components/executive/ProgressMediaUploader';
import { ExecutiveStageTimeline } from '@/components/executive/ExecutiveStageTimeline';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/common/StatusBadge';

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
  execution_stage: string | null;
  notes: any;
}

const stageLabels: Record<string, string> = {
  approved: 'در انتظار اجرا',
  in_progress: 'در حال اجرا',
  awaiting_payment: 'در انتظار پرداخت',
  awaiting_collection: 'در انتظار جمع‌آوری',
  closed: 'تکمیل سفارش'
};

export default function ExecutiveStageAwaitingCollection() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

          return {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            created_at: order.created_at,
            execution_start_date: order.execution_start_date,
            execution_end_date: order.execution_end_date,
            execution_stage: order.execution_stage,
            notes: order.notes,
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
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  user_id: customerData.user_id,
                  title: message.title,
                  body: message.body,
                  link: '/user/my-orders',
                  type: 'info'
                }
              });
            } catch (e) {
              console.log('Push notification skipped');
            }
          }
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
          status: 'completed',
          execution_stage: 'in_collection',
          execution_stage_updated_at: new Date().toISOString(),
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
            await supabase.rpc('send_notification', {
              _user_id: customerData.user_id,
              _title: notificationTitle,
              _body: notificationBody,
              _link: '/user/my-orders',
              _type: 'success'
            });
            
            // ارسال Push Notification به گوشی کاربر
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: customerData.user_id,
                title: notificationTitle,
                body: notificationBody,
                link: '/user/my-orders',
                type: 'success'
              }
            });
          } catch (e) {
            console.error('Error sending notification:', e);
          }
        }
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

              <Separator className="my-4" />
              
              <div>
                <Label className="text-sm font-medium mb-2 block">مراحل اجرایی</Label>
                <ExecutiveStageTimeline
                  projectId={selectedOrder.id}
                  currentStage={selectedOrder.execution_stage}
                  onStageChange={() => {
                    fetchOrders();
                    setDetailsOpen(false);
                  }}
                />
              </div>

              <Separator className="my-4" />

              <ProgressMediaUploader
                projectId={selectedOrder.id}
                stage="awaiting_collection"
                stageName="در انتظار جمع‌آوری"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
