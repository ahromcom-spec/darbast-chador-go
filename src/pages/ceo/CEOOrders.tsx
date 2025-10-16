import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { toastError } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AlertCircle, Check, X, Eye } from 'lucide-react';
import { z } from 'zod';

// Define zod schema for order notes validation (security improvement)
const orderNotesSchema = z.object({
  service_type: z.string().default('unknown'),
  total_area: z.number().optional().default(0),
  estimated_price: z.number().optional().default(0),
  dimensions: z.array(z.object({
    length: z.number(),
    height: z.number(),
    area: z.number()
  })).optional().default([]),
  conditions: z.record(z.any()).optional().default({})
});

interface Order {
  id: string;
  code: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  province_id: string;
  subcategory_id: string;
  address: string;
  detailed_address: string | null;
  notes: any;
  status: string;
  created_at: string;
}

export const CEOOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Use optimized database function to avoid N+1 queries (security fix)
      const { data, error } = await supabase
        .rpc('get_orders_with_customer_info')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast(toastError(error, 'خطا در بارگذاری سفارشات'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (order: Order) => {
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'سفارش تایید شد',
        description: `سفارش ${order.code} با موفقیت تایید شد.`,
      });

      fetchOrders();
      setSelectedOrder(null);
      setActionType(null);
    } catch (error: any) {
      toast(toastError(error, 'خطا در تایید سفارش'));
    }
  };

  const handleReject = async (order: Order) => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'دلیل رد الزامی است',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'سفارش رد شد',
        description: `سفارش ${order.code} رد شد.`,
      });

      fetchOrders();
      setSelectedOrder(null);
      setActionType(null);
      setRejectionReason('');
    } catch (error: any) {
      toast(toastError(error, 'خطا در رد سفارش'));
    }
  };

  const getServiceTypeName = (notes: any) => {
    try {
      const rawData = typeof notes === 'string' ? JSON.parse(notes) : notes;
      const data = orderNotesSchema.parse(rawData);
      const types: Record<string, string> = {
        'facade': 'نماکاری',
        'formwork': 'قالب بندی',
        'ceiling-tiered': 'داربست زیربتن طبقاتی',
        'ceiling-slab': 'داربست زیربتن دال',
      };
      return types[data.service_type] || data.service_type;
    } catch {
      return 'نامشخص';
    }
  };

  const getOrderDetails = (notes: any) => {
    try {
      const rawData = typeof notes === 'string' ? JSON.parse(notes) : notes;
      const data = orderNotesSchema.parse(rawData);
      return {
        totalArea: data.total_area,
        estimatedPrice: data.estimated_price,
        dimensions: data.dimensions,
        conditions: data.conditions,
      };
    } catch {
      return null;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">سفارشات در انتظار تایید</h1>
        <p className="text-muted-foreground mt-2">
          مدیریت و تایید سفارشات ثبت شده توسط مشتریان
        </p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">
              سفارشی در انتظار تایید وجود ندارد
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => {
            const details = getOrderDetails(order.notes);
            return (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        کد سفارش: {order.code}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>مشتری: {order.customer_name || 'نامشخص'}</p>
                        <p>تلفن: {order.customer_phone || 'ندارد'}</p>
                        <p>نوع خدمات: {getServiceTypeName(order.notes)}</p>
                        <p>
                          تاریخ ثبت:{' '}
                          {new Date(order.created_at).toLocaleDateString('fa-IR')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">در انتظار</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-secondary/30 p-4 rounded-lg space-y-2">
                    <p className="text-sm">
                      <strong>آدرس:</strong> {order.address}
                    </p>
                    {details && (
                      <>
                        <p className="text-sm">
                          <strong>متراژ کل:</strong>{' '}
                          {details.totalArea.toFixed(2)} متر مربع
                        </p>
                        <p className="text-sm">
                          <strong>قیمت تخمینی:</strong>{' '}
                          {details.estimatedPrice.toLocaleString('fa-IR')} تومان
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
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
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setActionType('approve');
                      }}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      تایید
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedOrder(order);
                        setActionType('reject');
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      رد
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
            <Button
              onClick={() => selectedOrder && handleApprove(selectedOrder)}
            >
              تایید نهایی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
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
              لطفاً دلیل رد سفارش {selectedOrder?.code} را وارد کنید
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>دلیل رد</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="دلیل رد سفارش را بنویسید..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setRejectionReason('');
              }}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedOrder && handleReject(selectedOrder)}
            >
              رد نهایی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>مشتری</Label>
                  <p className="text-sm">{selectedOrder.customer_name || 'نامشخص'}</p>
                </div>
                <div>
                  <Label>تلفن</Label>
                  <p className="text-sm">{selectedOrder.customer_phone || 'ندارد'}</p>
                </div>
              </div>
              <div>
                <Label>آدرس</Label>
                <p className="text-sm">{selectedOrder.address}</p>
              </div>
              {selectedOrder.detailed_address && (
                <div>
                  <Label>جزئیات موقعیت</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.detailed_address}
                  </p>
                </div>
              )}
              {getOrderDetails(selectedOrder.notes) && (
                <div className="bg-secondary/30 p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold">جزئیات فنی</h3>
                  {(() => {
                    const details = getOrderDetails(selectedOrder.notes);
                    return details ? (
                      <>
                        <p className="text-sm">
                          <strong>نوع خدمات:</strong>{' '}
                          {getServiceTypeName(selectedOrder.notes)}
                        </p>
                        <p className="text-sm">
                          <strong>متراژ کل:</strong>{' '}
                          {details.totalArea.toFixed(2)} متر مربع
                        </p>
                        <p className="text-sm">
                          <strong>قیمت تخمینی:</strong>{' '}
                          {details.estimatedPrice.toLocaleString('fa-IR')} تومان
                        </p>
                        {details.dimensions && details.dimensions.length > 0 && (
                          <div>
                            <strong className="text-sm">ابعاد:</strong>
                            <ul className="mt-2 space-y-1">
                              {details.dimensions.map((dim: any, i: number) => (
                                <li key={i} className="text-sm text-muted-foreground">
                                  • {dim.length} × {dim.height} متر = {dim.area.toFixed(2)} م²
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsOpen(false)}>بستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
