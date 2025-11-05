import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, X, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
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

export default function SalesPendingOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      // تلاش اول: استفاده از RPC (اگر وجود داشته باشد)
      const { data: rpcData, error: ordersError } = await supabase
        .rpc('get_sales_pending_orders');

      // اگر RPC خطا داد یا داده‌ای برنگشت، از کوئری مستقیم با اتکا به RLS استفاده می‌کنیم
      let baseOrders = rpcData || [];
      if (ordersError || !baseOrders || baseOrders.length === 0) {
        const { data: selectData, error: selectError } = await supabase
          .from('projects_v3')
          .select('id, code, status, address, detailed_address, created_at, notes')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (selectError) throw selectError;
        baseOrders = selectData || [];
      }

      // دریافت اطلاعات مشتری برای هر سفارش
      const ordersWithCustomerInfo = await Promise.all(
        (baseOrders || []).map(async (order: any) => {
          // دریافت customer_id از جدول projects_v3
          const { data: projectData } = await supabase
            .from('projects_v3')
            .select('customer_id')
            .eq('id', order.id)
            .single();

          if (projectData?.customer_id) {
            // دریافت user_id از جدول customers
            const { data: customerData } = await supabase
              .from('customers')
              .select('user_id')
              .eq('id', projectData.customer_id)
              .single();

            if (customerData?.user_id) {
              // دریافت اطلاعات مشتری از profiles
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, phone_number')
                .eq('user_id', customerData.user_id)
                .single();

              return {
                ...order,
                customer_name: profileData?.full_name || 'نامشخص',
                customer_phone: profileData?.phone_number || ''
              };
            }
          }

          return {
            ...order,
            customer_name: 'نامشخص',
            customer_phone: ''
          };
        })
      );

      setOrders(ordersWithCustomerInfo);
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

    try {
      // استفاده از RPC امن برای تایید (بررسی نقش در سمت سرور)
      const { error } = await supabase
        .rpc('approve_order_as_sales_manager', {
          _order_id: selectedOrder.id
        });

      if (error) throw error;

      toast({
        title: '✓ تایید شما ثبت شد',
        description: `تایید شما برای سفارش ${selectedOrder.code} ثبت شد.`
      });

      setActionType(null);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      console.error('Error approving order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: error.message || 'تایید سفارش با خطا مواجه شد'
      });
    }
  };

  const handleReject = async () => {
    if (!selectedOrder || !user || !rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفا دلیل رد سفارش را وارد کنید'
      });
      return;
    }

    try {
      const { error } = await supabase
        .rpc('reject_order_as_sales_manager', {
          _order_id: selectedOrder.id,
          _rejection_reason: rejectionReason
        });

      if (error) throw error;

      toast({
        title: 'سفارش رد شد',
        description: `سفارش ${selectedOrder.code} با موفقیت رد شد.`
      });

      setActionType(null);
      setSelectedOrder(null);
      setRejectionReason('');
      fetchOrders();
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: error.message || 'رد سفارش با خطا مواجه شد'
      });
    }
  };

  const OrderCardWithApprovals = ({ order }: { order: Order }) => {
    const { approvals, loading: approvalsLoading } = useOrderApprovals(order.id);

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
              <CardDescription className="mt-1">
                مشتری: {order.customer_name} • {order.customer_phone}
              </CardDescription>
            </div>
            <Badge variant="secondary">در انتظار تایید</Badge>
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

          <ApprovalProgress approvals={approvals} loading={approvalsLoading} />

          <div className="flex gap-2 flex-wrap pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedOrder(order);
                setDetailsOpen(true);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              جزئیات
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedOrder(order);
                setActionType('approve');
              }}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              تایید
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedOrder(order);
                setActionType('reject');
              }}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              رد
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="سفارشات در انتظار تایید شما"
        description="سفارشاتی که نیاز به تایید مدیر فروش دارند"
        showBackButton={true}
        backTo="/sales"
      />

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی در انتظار تایید شما وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
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
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تایید سفارش</DialogTitle>
            <DialogDescription>
              آیا از تایید سفارش {selectedOrder?.code} اطمینان دارید؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              انصراف
            </Button>
            <Button onClick={handleApprove}>
              تایید نهایی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={actionType === 'reject'}
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setSelectedOrder(null);
            setRejectionReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رد سفارش</DialogTitle>
            <DialogDescription>
              لطفا دلیل رد سفارش {selectedOrder?.code} را وارد کنید:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="دلیل رد سفارش را بنویسید..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setActionType(null);
              setRejectionReason('');
            }}>
              انصراف
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              رد سفارش
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
            <div className="space-y-4">
              <div>
                <Label className="font-semibold">مشتری</Label>
                <p className="text-sm">{selectedOrder.customer_name} • {selectedOrder.customer_phone}</p>
              </div>
              <div>
                <Label className="font-semibold">آدرس</Label>
                <p className="text-sm">{selectedOrder.address}</p>
                {selectedOrder.detailed_address && (
                  <p className="text-sm text-muted-foreground">{selectedOrder.detailed_address}</p>
                )}
              </div>
              <div>
                <Label className="font-semibold">تاریخ ثبت</Label>
                <p className="text-sm">{new Date(selectedOrder.created_at).toLocaleDateString('fa-IR')}</p>
              </div>
              {selectedOrder.notes && (
                <div>
                  <Label className="font-semibold">جزئیات سفارش</Label>
                  <pre className="text-xs bg-secondary p-3 rounded mt-1 overflow-auto max-h-60">
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
