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
import { AlertCircle, Check, X, Eye, Edit2, Image, Film } from 'lucide-react';
import { z } from 'zod';
import { useOrderApprovals } from '@/hooks/useOrderApprovals';
import { ApprovalProgress } from '@/components/orders/ApprovalProgress';

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
  payment_amount?: number | null;
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
  const [orderMedia, setOrderMedia] = useState<Record<string, any[]>>({});

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
      if (import.meta.env.DEV) {
        console.error('Error loading metadata:', error);
      }
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // گام 1: یافتن نوع خدمت داربست (کد '10')
      const { data: serviceType } = await supabase
        .from('service_types_v3')
        .select('id')
        .eq('code', '10')
        .maybeSingle();

      if (!serviceType) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // گام 2: یافتن زیرشاخه «با اجناس» (کد '10') برای همان نوع خدمت
      const { data: subcategory } = await supabase
        .from('subcategories')
        .select('id')
        .eq('service_type_id', serviceType.id)
        .eq('code', '10')
        .maybeSingle();

      if (!subcategory) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // دریافت سفارشات pending
      const { data, error } = await supabase
        .from('projects_v3')
        .select(`
          id, code, customer_id, province_id, district_id, subcategory_id,
          address, detailed_address, notes, status, created_at
        `)
        .eq('status', 'pending')
        .eq('subcategory_id', subcategory.id)
        .order('code', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // فیلتر کردن سفارشاتی که هنوز نیاز به تایید CEO دارند
      const filtered = await Promise.all(
        data.map(async (order: any) => {
          // بررسی approval
          const { data: approval } = await supabase
            .from('order_approvals')
            .select('approved_at')
            .eq('order_id', order.id)
            .eq('approver_role', 'ceo')
            .maybeSingle();
          
          if (!approval || approval.approved_at) {
            return null;
          }

          // دریافت اطلاعات مشتری
          const { data: customer } = await supabase
            .from('customers')
            .select('user_id')
            .eq('id', order.customer_id)
            .maybeSingle();

          let customer_name = 'نامشخص';
          let customer_phone = '';

          if (customer?.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('user_id', customer.user_id)
              .maybeSingle();

            if (profile) {
              customer_name = profile.full_name || 'نامشخص';
              customer_phone = profile.phone_number || '';
            }
          }
          
          return {
            ...order,
            customer_name,
            customer_phone
          };
        })
      );

      const validOrders = filtered.filter(o => o !== null) as Order[];
      setOrders(validOrders);

      // دریافت فایل‌های مدیا برای هر سفارش
      const mediaPromises = validOrders.map(async (order) => {
        const { data: media } = await supabase
          .from('project_media')
          .select('*')
          .eq('project_id', order.id)
          .order('created_at', { ascending: false });
        
        return { orderId: order.id, media: media || [] };
      });

      const mediaResults = await Promise.all(mediaPromises);
      const mediaMap = mediaResults.reduce((acc, { orderId, media }) => {
        acc[orderId] = media;
        return acc;
      }, {} as Record<string, any[]>);

      setOrderMedia(mediaMap);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast(toastError(error, 'خطا در بارگذاری سفارشات'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (order: Order) => {
    try {
      // Check if all previous approvals are done
      const { data: approvals, error: fetchError } = await supabase
        .from('order_approvals')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      // Find CEO approval
      const ceoApproval = approvals?.find(a => a.approver_role === 'ceo');
      if (!ceoApproval) {
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: 'رکورد تایید مدیرعامل یافت نشد'
        });
        return;
      }

      // Record CEO approval
      const { error: approvalError } = await supabase
        .from('order_approvals')
        .update({
          approver_user_id: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('order_id', order.id)
        .eq('approver_role', 'ceo');

      if (approvalError) throw approvalError;

      // Check if this was the last approval needed
      const allApproved = approvals?.every(a => 
        a.approver_role === 'ceo' || a.approved_at !== null
      );

      // If all approvals are done, update order status to approved
      if (allApproved) {
        const { error: updateError } = await supabase
          .from('projects_v3')
          .update({
            status: 'approved',
            approved_by: user?.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateError) throw updateError;

        toast({
          title: '✓ سفارش تایید نهایی شد',
          description: `سفارش ${order.code} توسط شما تایید و به مرحله اجرا ارسال شد.`,
        });
      } else {
        toast({
          title: '✓ تایید شما ثبت شد',
          description: `تایید شما برای سفارش ${order.code} ثبت شد.`,
        });
      }

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
      // Validate with Zod
      const { orderEditSchema } = await import('@/lib/validations');
      const validatedData = orderEditSchema.parse({
        address: editForm.address,
        detailed_address: editForm.detailed_address,
        notes: editForm.notes,
        province_id: editForm.province_id,
        district_id: editForm.district_id || null,
        subcategory_id: editForm.subcategory_id
      });

      let parsedNotes = validatedData.notes;
      try {
        if (parsedNotes) {
          parsedNotes = JSON.parse(parsedNotes);
        }
      } catch {
        // If not valid JSON, keep as string
      }

      const { error } = await supabase
        .from('projects_v3')
        .update({
          address: validatedData.address,
          detailed_address: validatedData.detailed_address,
          notes: parsedNotes,
          province_id: validatedData.province_id,
          district_id: validatedData.district_id,
          subcategory_id: validatedData.subcategory_id
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
      if (error.name === 'ZodError') {
        toast({
          title: 'خطای اعتبارسنجی',
          description: error.errors[0]?.message || 'داده‌های ورودی نامعتبر است',
          variant: 'destructive'
        });
      } else {
        toast(toastError(error, 'خطا در ذخیره تغییرات'));
      }
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

  // Helper function to get public URL for media
  const getMediaUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('order-media')
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Helper function to parse order notes safely
  const parseOrderNotes = (notes: any) => {
    try {
      if (!notes) return null;
      return typeof notes === 'string' ? JSON.parse(notes) : notes;
    } catch {
      return null;
    }
  };

  // Component for order card with approvals
  const OrderCardWithApprovals = ({ 
    order, 
    details, 
    onViewDetails, 
    onEdit, 
    onApprove, 
    onReject,
    getServiceTypeName 
  }: any) => {
    const { approvals, loading: approvalsLoading } = useOrderApprovals(order.id);
    const media = orderMedia[order.id] || [];
    
    // Check if this is an expert pricing request and if price has been set
    const orderNotes = parseOrderNotes(order.notes);
    const isExpertPricingRequest = orderNotes?.is_expert_pricing_request === true;
    const priceSetByManager = orderNotes?.price_set_by_manager === true;
    const hasPaymentAmount = order.payment_amount && order.payment_amount > 0;
    const customerPriceConfirmed = orderNotes?.customer_price_confirmed === true;
    
    // For expert pricing requests, approval is disabled until price is set AND customer confirms price
    const canApprove = !isExpertPricingRequest || (priceSetByManager && hasPaymentAmount && customerPriceConfirmed);
    return (
      <Card className="hover:shadow-lg transition-shadow">
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
            {order.detailed_address && (
              <p className="text-sm">
                <strong>آدرس تکمیلی:</strong> {order.detailed_address}
              </p>
            )}
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

          {/* عکس‌ها و ویدیوها */}
          {media.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">فایل‌های ضمیمه ({media.length}):</p>
              <div className="grid grid-cols-3 gap-2">
                {media.slice(0, 6).map((file: any) => (
                  <div key={file.id} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                    {file.file_type === 'image' ? (
                      <img 
                        src={getMediaUrl(file.file_path)} 
                        alt="تصویر سفارش"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Film className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {media.length > 6 && (
                <p className="text-xs text-muted-foreground">
                  و {media.length - 6} فایل دیگر...
                </p>
              )}
            </div>
          )}

          {/* Approval Progress */}
          <ApprovalProgress approvals={approvals} loading={approvalsLoading} />

          {/* Expert pricing status indicator */}
          {isExpertPricingRequest && !priceSetByManager && !hasPaymentAmount && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">ابتدا قیمت را برای این سفارش تعیین کنید</span>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                از طریق "جزئیات" قیمت را وارد و ذخیره کنید.
              </p>
            </div>
          )}

          {isExpertPricingRequest && priceSetByManager && hasPaymentAmount && !customerPriceConfirmed && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">قیمت تعیین شده: {Number(order.payment_amount).toLocaleString('fa-IR')} تومان</span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                در انتظار تایید قیمت توسط مشتری. پس از تایید مشتری می‌توانید سفارش را تایید کنید.
              </p>
            </div>
          )}

          {isExpertPricingRequest && canApprove && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                <Check className="h-4 w-4" />
                <span className="font-medium">قیمت تعیین شده: {Number(order.payment_amount).toLocaleString('fa-IR')} تومان - مشتری تایید کرده</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                قیمت سفارش تعیین شده و مشتری تایید کرده است. می‌توانید سفارش را تایید کنید.
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewDetails}
            >
              <Eye className="h-4 w-4 mr-2" />
              جزئیات
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onEdit}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              ویرایش
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              disabled={!canApprove}
              className={canApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}
              title={!canApprove ? 'ابتدا باید قیمت سفارش تعیین شود و مشتری تایید کند' : 'تایید سفارش'}
            >
              <Check className="h-4 w-4 mr-2" />
              تایید
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onReject}
            >
              <X className="h-4 w-4 mr-2" />
              رد
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

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
              <OrderCardWithApprovals 
                key={order.id} 
                order={order} 
                details={details}
                onViewDetails={() => {
                  setSelectedOrder(order);
                  setDetailsOpen(true);
                }}
                onEdit={() => handleEditOrder(order)}
                onApprove={() => {
                  setSelectedOrder(order);
                  setActionType('approve');
                }}
                onReject={() => {
                  setSelectedOrder(order);
                  setActionType('reject');
                }}
                getServiceTypeName={getServiceTypeName}
              />
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>مشتری</Label>
                  <p className="text-sm font-medium">{selectedOrder.customer_name || 'نامشخص'}</p>
                </div>
                <div>
                  <Label>تلفن</Label>
                  <p className="text-sm font-medium">{selectedOrder.customer_phone || 'ندارد'}</p>
                </div>
              </div>
              
              <div>
                <Label>آدرس</Label>
                <p className="text-sm bg-secondary/30 p-3 rounded-lg">{selectedOrder.address}</p>
              </div>

              {selectedOrder.detailed_address && (
                <div>
                  <Label>آدرس تکمیلی</Label>
                  <p className="text-sm bg-secondary/30 p-3 rounded-lg">{selectedOrder.detailed_address}</p>
                </div>
              )}

              {/* عکس‌ها و ویدیوها */}
              {orderMedia[selectedOrder.id]?.length > 0 && (
                <div>
                  <Label className="mb-3 block">فایل‌های ضمیمه ({orderMedia[selectedOrder.id].length})</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {orderMedia[selectedOrder.id].map((file: any) => (
                      <div key={file.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
                        {file.file_type === 'image' ? (
                          <img 
                            src={getMediaUrl(file.file_path)} 
                            alt="تصویر سفارش"
                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => window.open(getMediaUrl(file.file_path), '_blank')}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                            <Film className="h-10 w-10 text-muted-foreground mb-2" />
                            <a 
                              href={getMediaUrl(file.file_path)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              مشاهده ویدیو
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
                        {details.conditions && Object.keys(details.conditions).length > 0 && (
                          <div>
                            <strong className="text-sm">شرایط خدمات:</strong>
                            <div className="mt-2 space-y-1">
                              {Object.entries(details.conditions).map(([key, value]: [string, any]) => (
                                <p key={key} className="text-sm text-muted-foreground">
                                  • <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </p>
                              ))}
                            </div>
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
