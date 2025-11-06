import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlayCircle, Eye, Search, MapPin, Phone, User, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProgressMediaUploader } from '@/components/executive/ProgressMediaUploader';
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
  notes: any;
}

export default function ExecutiveReady() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
          notes,
          customer_id
        `)
        .eq('status', 'approved')
        .order('execution_start_date', { ascending: true, nullsFirst: false });

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

  const handleStartExecution = async (orderId: string, orderCode: string) => {
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

      // به‌روزرسانی وضعیت سفارش
      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          status: 'in_progress',
          executed_by: user?.id,
          execution_confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // ارسال اعلان به مشتری
      if (customerData?.user_id) {
        await supabase.rpc('send_notification', {
          _user_id: customerData.user_id,
          _title: '🚀 اجرای سفارش آغاز شد',
          _body: `سفارش شما با کد ${orderCode} در حال اجرا قرار گرفت و تیم اجرایی مشغول انجام کار هستند.`,
          _link: '/user/my-orders',
          _type: 'info'
        });
      }

      toast({
        title: '✓ اجرا آغاز شد',
        description: `سفارش ${orderCode} به مرحله در حال اجرا منتقل شد و به مشتری اطلاع داده شد.`
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات آماده اجرا"
        description={`${orders.length} سفارش آماده شروع اجرا`}
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
              <PlayCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارش آماده اجرا وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-all border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                      <StatusBadge status="approved" />
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
                        {' تا '}
                        {order.execution_end_date && new Date(order.execution_end_date).toLocaleDateString('fa-IR')}
                      </span>
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
                    onClick={() => handleStartExecution(order.id, order.code)}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <PlayCircle className="h-4 w-4" />
                    شروع اجرا
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

              {/* آپلود تصاویر - مرحله آماده اجرا */}
              <ProgressMediaUploader
                projectId={selectedOrder.id}
                stage="ready"
                stageName="آماده اجرا"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
