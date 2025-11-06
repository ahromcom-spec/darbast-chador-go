import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, MapPin, Calendar, FileText } from 'lucide-react';
import { ApprovalProgress } from '@/components/orders/ApprovalProgress';
import { OrderWorkflowStatus } from '@/components/orders/OrderWorkflowStatus';
import { useOrderApprovals } from '@/hooks/useOrderApprovals';
import { useAuth } from '@/contexts/AuthContext';
import { formatPersianDate } from '@/lib/dateUtils';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  created_at: string;
  notes: any;
  hierarchy_project_id: string | null;
  subcategories?: { name: string };
  provinces?: { name: string };
  districts?: { name: string };
  hierarchy_project?: {
    location?: {
      title: string | null;
      address_line: string;
    };
  };
}

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customerData) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          address,
          created_at,
          notes,
          hierarchy_project_id,
          subcategories(name),
          provinces(name),
          districts(name),
          hierarchy_project:projects_hierarchy!hierarchy_project_id(
            location:locations(title, address_line)
          )
        `)
        .eq('customer_id', customerData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return <OrderWorkflowStatus status={status} />;
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const { approvals, loading: approvalsLoading } = useOrderApprovals(order.id);

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {formatPersianDate(order.created_at, { showDayOfWeek: true })}
              </CardDescription>
            </div>
            {getStatusBadge(order.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                {order.hierarchy_project?.location?.title && (
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {order.hierarchy_project.location.title}
                  </p>
                )}
                <p className="text-sm">{order.address}</p>
              </div>
            </div>
            
            {order.subcategories && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{order.subcategories.name}</p>
              </div>
            )}
          </div>

          {order.status === 'pending' && (
            <ApprovalProgress approvals={approvals} loading={approvalsLoading} />
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedOrder(order);
              setDetailsOpen(true);
            }}
            className="w-full"
          >
            مشاهده جزئیات
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <PageHeader
        title="سفارشات من"
        description="مشاهده تمام سفارشات شما و وضعیت آن‌ها"
      />

      {orders.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">هیچ سفارشی یافت نشد</h3>
            <p className="text-muted-foreground">
              هنوز سفارشی ثبت نکرده‌اید
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-3">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1">وضعیت</p>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">آدرس</p>
                {selectedOrder.hierarchy_project?.location?.title && (
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {selectedOrder.hierarchy_project.location.title}
                  </p>
                )}
                <p className="text-sm">{selectedOrder.address}</p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">تاریخ ثبت</p>
                <p className="text-sm">{formatPersianDate(selectedOrder.created_at, { showDayOfWeek: true })}</p>
              </div>
              {selectedOrder.subcategories && (
                <div>
                  <p className="text-sm font-semibold mb-1">نوع خدمت</p>
                  <p className="text-sm">{selectedOrder.subcategories.name}</p>
                </div>
              )}
              {selectedOrder.notes && (
                <div>
                  <p className="text-sm font-semibold mb-1">جزئیات سفارش</p>
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
