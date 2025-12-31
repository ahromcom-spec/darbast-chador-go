import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DollarSign, Eye, Search, MapPin, Phone, User, CheckCircle2, Calendar, ArrowRightLeft, Users, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProgressMediaUploader } from '@/components/executive/ProgressMediaUploader';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { ManagerOrderTransfer } from '@/components/orders/ManagerOrderTransfer';
import { ManagerAddStaffCollaborator } from '@/components/orders/ManagerAddStaffCollaborator';
import { useOrderArchive } from '@/hooks/useOrderArchive';
import { OrderArchiveControls, OrderCardArchiveButton } from '@/components/orders/OrderArchiveControls';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';

// Helper function to parse order notes (handles double-stringified JSON)
const parseOrderNotes = (notes: string | null | undefined): any => {
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
  } catch {
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
  executive_completion_date: string | null;
  notes: any;
  payment_amount: number | null;
  customer_id?: string;
  executed_by?: string | null;
  approved_by?: string | null;
}

export default function ExecutiveCompleted() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [collaboratorOpen, setCollaboratorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  // Archive functionality
  const archive = useOrderArchive(() => fetchOrders());

  // Auto-open order from URL param
  const urlOrderId = searchParams.get('orderId');
  
  // Check if this is the "scaffold execution with materials" module
  const activeModuleKey = searchParams.get('moduleKey') || '';
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, '', '');
  
  // ماژول مدیریت اجرایی - بدون دسترسی به قیمت
  const isExecutiveModule = moduleName.includes('مدیریت اجرایی');
  
  // Check if this is an accounting module - hide order details, only show financial info
  const isAccountingModule = activeModuleKey.includes('حسابداری') ||
                              activeModuleKey === 'comprehensive_accounting' ||
                              activeModuleKey.includes('accounting');

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
          executive_completion_date,
          notes,
          payment_amount,
          customer_id,
          executed_by,
          approved_by
        `)
        .eq('status', 'completed')
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
            notes: parseOrderNotes(order.notes),
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات تکمیل شده - در انتظار پرداخت"
        description={`${orders.length} سفارش در انتظار پرداخت از سوی مشتری`}
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
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی در انتظار پرداخت وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-all border-l-4 border-l-yellow-500">
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
                      <StatusBadge status="completed" />
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
                
                {order.executive_completion_date && (
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-xs text-muted-foreground">تاریخ اتمام اجرا</div>
                        <div className="font-medium">
                          {new Date(order.executive_completion_date).toLocaleDateString('fa-IR')}
                        </div>
                      </div>
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
                      setTransferOpen(true);
                    }}
                    className="gap-2"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    انتقال
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setCollaboratorOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    افزودن پرسنل
                  </Button>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-950 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-600" />
                    <span>در انتظار پرداخت توسط مشتری</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <EditableOrderDetails order={selectedOrder} onUpdate={fetchOrders} hidePrice={isExecutiveModule} hideDetails={isAccountingModule} />
              
              {/* Progress Media Uploader - hidden for accounting module */}
              {!isAccountingModule && (
                <>
                  <Separator />
                  <ProgressMediaUploader
                    projectId={selectedOrder.id}
                    stage="completed"
                    stageName="تکمیل شده"
                  />
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      {selectedOrder && (
        <ManagerOrderTransfer
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          onTransferComplete={fetchOrders}
        />
      )}

      {/* Collaborator Dialog */}
      {selectedOrder && (
        <ManagerAddStaffCollaborator
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={collaboratorOpen}
          onOpenChange={setCollaboratorOpen}
          onCollaboratorAdded={fetchOrders}
        />
      )}
    </div>
  );
}
