import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CheckCircle, Eye } from 'lucide-react';
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
import { formatPersianDate } from '@/lib/dateUtils';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { parseOrderNotes } from '@/components/orders/OrderDetailsView';

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
  customer_id?: string;
  executed_by?: string | null;
  approved_by?: string | null;
}

export default function GeneralManagerPendingOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
        setDetailsOpen(true);
        // Remove orderId from URL to prevent re-opening on refresh
        setSearchParams({}, { replace: true });
      }
    }
  }, [urlOrderId, orders, loading]);

  const fetchOrders = async () => {
    try {
      // فقط سفارشاتی که نیاز به تایید general manager دارند
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
          customer_id,
          subcategory_id,
          executed_by,
          approved_by,
          customers!inner(
            user_id,
            profiles!inner(full_name, phone_number)
          )
        `)
        .eq('status', 'pending')
        .eq('subcategory_id', '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d')
        .order('code', { ascending: false });

      if (error) throw error;

      // فیلتر کردن سفارشاتی که هنوز نیاز به تایید general manager دارند
      const filtered = await Promise.all(
        (data || []).map(async (order: any) => {
          const { data: approval } = await supabase
            .from('order_approvals')
            .select('approved_at')
            .eq('order_id', order.id)
            .eq('approver_role', 'general_manager_scaffold_execution_with_materials')
            .single();
          
          return approval && !approval.approved_at ? {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            created_at: order.created_at,
            notes: order.notes,
            customer_id: order.customer_id,
            executed_by: order.executed_by,
            approved_by: order.approved_by,
            customer_name: order.customers?.profiles?.full_name || 'نامشخص',
            customer_phone: order.customers?.profiles?.phone_number || ''
          } : null;
        })
      );

      setOrders(filtered.filter(o => o !== null) as Order[]);
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
      // Check which subcategory to determine the approval role
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('subcategory_id')
        .eq('id', selectedOrder.id)
        .single();

      // Determine the approval role based on subcategory
      const isExecutionWithMaterials = orderData?.subcategory_id === '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d';
      const approverRole = isExecutionWithMaterials 
        ? 'general_manager_scaffold_execution_with_materials' 
        : 'ceo';

      // Record general manager approval
      const { error } = await supabase
        .from('order_approvals')
        .update({
          approver_user_id: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('order_id', selectedOrder.id)
        .eq('approver_role', approverRole);

      if (error) throw error;

      toast({
        title: '✓ تایید شما ثبت شد',
        description: `تایید شما برای سفارش ${selectedOrder.code} ثبت شد.`
      });

      setActionType(null);
      setSelectedOrder(null);
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
        description="سفارشاتی که نیاز به تایید مدیرعامل دارند"
        showBackButton={true}
        backTo="/admin/general-manager"
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

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <EditableOrderDetails order={selectedOrder} onUpdate={fetchOrders} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
