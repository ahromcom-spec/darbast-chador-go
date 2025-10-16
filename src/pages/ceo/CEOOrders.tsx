import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { AlertCircle, Check, X, Eye, Edit2 } from 'lucide-react';
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
  district_id: string | null;
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    address: '',
    detailed_address: '',
    notes: '',
    province_id: '',
    district_id: '',
    subcategory_id: ''
  });
  
  // برای لیست‌ها
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      const [provincesRes, subcategoriesRes] = await Promise.all([
        supabase.from('provinces').select('*').eq('is_active', true),
        supabase.from('subcategories').select('*').eq('is_active', true)
      ]);

      if (provincesRes.data) setProvinces(provincesRes.data);
      if (subcategoriesRes.data) setSubcategories(subcategoriesRes.data);
    } catch (error: any) {
      console.error('Error loading metadata:', error);
    }
  };

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

  const handleEditOrder = async (order: Order) => {
    setSelectedOrder(order);
    setEditForm({
      address: order.address,
      detailed_address: order.detailed_address || '',
      notes: typeof order.notes === 'string' ? order.notes : JSON.stringify(order.notes, null, 2),
      province_id: order.province_id,
      district_id: order.district_id || '',
      subcategory_id: order.subcategory_id
    });

    // بارگذاری districts برای province انتخاب شده
    if (order.province_id) {
      const { data } = await supabase
        .from('districts')
        .select('*')
        .eq('province_id', order.province_id);
      if (data) setDistricts(data);
    }

    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;

    try {
      let parsedNotes = editForm.notes;
      try {
        parsedNotes = JSON.parse(editForm.notes);
      } catch {
        // If not valid JSON, keep as string
      }

      const { error } = await supabase
        .from('projects_v3')
        .update({
          address: editForm.address,
          detailed_address: editForm.detailed_address,
          notes: parsedNotes,
          province_id: editForm.province_id,
          district_id: editForm.district_id || null,
          subcategory_id: editForm.subcategory_id
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: 'تغییرات ذخیره شد',
        description: 'اطلاعات سفارش بروزرسانی شد.',
      });

      setEditDialogOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error: any) {
      toast(toastError(error, 'خطا در ذخیره تغییرات'));
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

                  <div className="flex gap-2 flex-wrap">
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
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEditOrder(order)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      ویرایش
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ویرایش سفارش</DialogTitle>
            <DialogDescription>
              اطلاعات سفارش را ویرایش کنید و سپس تایید یا رد کنید
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-province">استان</Label>
                  <Select
                    value={editForm.province_id}
                    onValueChange={async (value) => {
                      setEditForm({ ...editForm, province_id: value, district_id: '' });
                      const { data } = await supabase
                        .from('districts')
                        .select('*')
                        .eq('province_id', value);
                      if (data) setDistricts(data);
                    }}
                  >
                    <SelectTrigger id="edit-province">
                      <SelectValue placeholder="استان را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-district">شهرستان (اختیاری)</Label>
                  <Select
                    value={editForm.district_id}
                    onValueChange={(value) => setEditForm({ ...editForm, district_id: value })}
                    disabled={!editForm.province_id}
                  >
                    <SelectTrigger id="edit-district">
                      <SelectValue placeholder="شهرستان را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-subcategory">نوع خدمات</Label>
                <Select
                  value={editForm.subcategory_id}
                  onValueChange={(value) => setEditForm({ ...editForm, subcategory_id: value })}
                >
                  <SelectTrigger id="edit-subcategory">
                    <SelectValue placeholder="نوع خدمات را انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-address">آدرس</Label>
                <Textarea
                  id="edit-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-detailed">آدرس دقیق (اختیاری)</Label>
                <Textarea
                  id="edit-detailed"
                  value={editForm.detailed_address}
                  onChange={(e) => setEditForm({ ...editForm, detailed_address: e.target.value })}
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-notes">یادداشت‌ها (JSON یا متن)</Label>
                <Textarea
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={8}
                  className="mt-1 font-mono text-xs"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  می‌توانید JSON معتبر یا متن ساده وارد کنید
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedOrder(null);
              }}
            >
              انصراف
            </Button>
            <Button onClick={handleSaveEdit}>
              ذخیره تغییرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
