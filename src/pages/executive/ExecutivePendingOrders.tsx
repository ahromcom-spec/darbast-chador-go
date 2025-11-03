import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  subcategory_id?: string;
}

export default function ExecutivePendingOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

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
          customer_id,
          customers!inner(
            user_id,
            profiles!inner(full_name, phone_number)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter only orders that have pending approval for executive manager
      const filteredOrders = await Promise.all(
        (data || []).map(async (order: any) => {
          // Check if this order has a pending approval for executive manager
          const { data: approvalData } = await supabase
            .from('order_approvals')
            .select('approver_role, approved_at')
            .eq('order_id', order.id)
            .in('approver_role', ['scaffold_executive_manager', 'executive_manager_scaffold_execution_with_materials'])
            .is('approved_at', null)
            .maybeSingle();

          if (!approvalData) return null;

          return {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            created_at: order.created_at,
            notes: order.notes,
            subcategory_id: order.subcategory_id,
            customer_name: (order as any).customers?.profiles?.full_name || 'نامشخص',
            customer_phone: (order as any).customers?.profiles?.phone_number || ''
          };
        })
      );

      setOrders(filteredOrders.filter(Boolean) as Order[]);
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
        ? 'executive_manager_scaffold_execution_with_materials' 
        : 'scaffold_executive_manager';

      // Record executive manager approval
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
        description="سفارشاتی که نیاز به تایید مدیر اجرایی دارند"
        showBackButton={true}
        backTo="/executive"
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
