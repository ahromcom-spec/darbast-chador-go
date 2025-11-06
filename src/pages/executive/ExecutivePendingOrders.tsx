import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, X, Eye, Search, MapPin, Phone, User } from 'lucide-react';
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
  subcategory_id?: string;
  province_id?: string;
  district_id?: string;
}

export default function ExecutivePendingOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [executionStartDate, setExecutionStartDate] = useState('');
  const [executionEndDate, setExecutionEndDate] = useState('');
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
          subcategory_id,
          province_id,
          district_id,
          customer_id
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

          // Fetch customer details
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
            subcategory_id: order.subcategory_id,
            province_id: order.province_id,
            district_id: order.district_id,
            customer_name: customerName,
            customer_phone: customerPhone
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

    // Validate dates
    if (!executionStartDate || !executionEndDate) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً زمان شروع و پایان اجرا را مشخص کنید'
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
      // Find the pending approval row for executive manager for this order
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

      // Record executive manager approval on the pending row
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

      // Update execution dates in the order
      const { error: updateError } = await supabase
        .from('projects_v3')
        .update({
          execution_start_date: executionStartDate,
          execution_end_date: executionEndDate,
          executed_by: user.id
        })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      toast({
        title: '✓ تایید شما ثبت شد',
        description: `تایید شما برای سفارش ${selectedOrder.code} با زمان‌بندی اجرا ثبت شد.`
      });

      setActionType(null);
      setSelectedOrder(null);
      setExecutionStartDate('');
      setExecutionEndDate('');
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
    
    const getServiceInfo = () => {
      try {
        const notes = order.notes;
        if (notes?.total_area) {
          return `مساحت کل: ${notes.total_area} متر مربع`;
        }
        if (notes?.dimensions?.length > 0) {
          return `تعداد ابعاد: ${notes.dimensions.length}`;
        }
        return 'داربست با اجناس';
      } catch {
        return 'داربست با اجناس';
      }
    };

    return (
      <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
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
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">نوع خدمات</div>
            <div className="text-sm font-medium">{getServiceInfo()}</div>
          </div>

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
                setDetailsOpen(true);
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
              تایید سفارش
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
        description={`${orders.length} سفارش نیاز به تایید مدیر اجرایی`}
        showBackButton={true}
        backTo="/executive"
      />

      {/* Search Bar */}
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
                <Label className="text-xs text-muted-foreground">شماره تماس مشتری</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                  <span dir="ltr" className="font-medium">{selectedOrder.customer_phone}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  لطفاً با مشتری تماس بگیرید و زمان‌بندی را هماهنگ کنید
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">تاریخ شروع اجرا</Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={executionStartDate}
                  onChange={(e) => setExecutionStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">تاریخ پایان اجرا (تخمینی)</Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={executionEndDate}
                  onChange={(e) => setExecutionEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setActionType(null);
                setExecutionStartDate('');
                setExecutionEndDate('');
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleApprove} disabled={!executionStartDate || !executionEndDate}>
              تایید و ثبت زمان‌بندی
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
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">نام مشتری</Label>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {selectedOrder.customer_name}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">شماره تماس</Label>
                  <p className="text-sm font-medium flex items-center gap-2" dir="ltr">
                    <Phone className="h-4 w-4 text-primary" />
                    {selectedOrder.customer_phone}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">آدرس</Label>
                <p className="text-sm flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{selectedOrder.address}</span>
                </p>
                {selectedOrder.detailed_address && (
                  <p className="text-sm text-muted-foreground mr-6">{selectedOrder.detailed_address}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">تاریخ ثبت سفارش</Label>
                <p className="text-sm">{new Date(selectedOrder.created_at).toLocaleDateString('fa-IR', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>

              {selectedOrder.notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">جزئیات فنی سفارش</Label>
                    <div className="bg-muted p-4 rounded-lg">
                      {selectedOrder.notes.total_area && (
                        <div className="mb-2">
                          <span className="font-semibold">مساحت کل:</span> {selectedOrder.notes.total_area} متر مربع
                        </div>
                      )}
                      {selectedOrder.notes.dimensions && selectedOrder.notes.dimensions.length > 0 && (
                        <div>
                          <span className="font-semibold">ابعاد:</span>
                          <ul className="mt-2 space-y-1 mr-4">
                            {selectedOrder.notes.dimensions.map((dim: any, idx: number) => (
                              <li key={idx} className="text-sm">
                                طول: {dim.length}م × ارتفاع: {dim.height}م = {dim.area} متر مربع
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
