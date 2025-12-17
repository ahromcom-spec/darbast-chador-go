import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, X, Eye, Search, MapPin, Phone, User, Ruler, FileText, Banknote, Wrench, Image as ImageIcon, ChevronLeft, ChevronRight, ArrowLeftRight, Users } from 'lucide-react';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { formatPersianDate } from '@/lib/dateUtils';
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
import { sendNotificationSchema } from '@/lib/rpcValidation';
import { ManagerOrderTransfer } from '@/components/orders/ManagerOrderTransfer';
import { ManagerAddStaffCollaborator } from '@/components/orders/ManagerAddStaffCollaborator';
import { buildOrderSmsAddress, sendOrderSms } from '@/lib/orderSms';

// Helper to parse order notes safely - handles double-stringified JSON
const parseOrderNotes = (notes: any): any => {
  if (!notes) return null;
  try {
    let parsed = notes;
    // First parse if it's a string
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    // Handle double-stringified JSON
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch (e) {
    console.error('Error parsing notes:', e);
    return null;
  }
};

// Component to display order media with signed URLs
const OrderMediaGallery = ({ orderId }: { orderId: string }) => {
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const { data, error } = await supabase
          .from('project_media')
          .select('id, file_path, file_type')
          .eq('project_id', orderId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        setMedia(data || []);
      } catch (err) {
        console.error('Error fetching media:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [orderId]);

  // Fetch signed URLs for all media items
  useEffect(() => {
    const fetchUrls = async () => {
      const urls: Record<string, string> = {};
      for (const item of media) {
        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('order-media')
            .createSignedUrl(item.file_path, 3600);
          
          if (signedData?.signedUrl && !signedError) {
            urls[item.id] = signedData.signedUrl;
          } else {
            const { data } = supabase.storage.from('order-media').getPublicUrl(item.file_path);
            urls[item.id] = data.publicUrl;
          }
        } catch (err) {
          console.error('Error getting URL for', item.file_path, err);
          const { data } = supabase.storage.from('order-media').getPublicUrl(item.file_path);
          urls[item.id] = data.publicUrl;
        }
      }
      setMediaUrls(urls);
    };
    
    if (media.length > 0) {
      fetchUrls();
    }
  }, [media]);

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm p-4 bg-muted/50 rounded-lg">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        هنوز تصویری برای این سفارش ثبت نشده است
      </div>
    );
  }

  const getMediaUrl = (mediaItem: { id: string; file_path: string }) => {
    return mediaUrls[mediaItem.id] || '';
  };

  const currentMedia = media[currentIndex];
  const isVideo = currentMedia?.file_type?.includes('video');

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground flex items-center gap-2">
        <ImageIcon className="h-3 w-3" />
        تصاویر و فایل‌های سفارش ({media.length})
      </Label>
      <div className="relative bg-black/5 rounded-lg overflow-hidden min-h-[200px]">
        {mediaUrls[currentMedia?.id] ? (
          isVideo ? (
            <video
              src={getMediaUrl(currentMedia)}
              controls
              className="w-full max-h-80 object-contain"
            />
          ) : (
            <img
              src={getMediaUrl(currentMedia)}
              alt={`تصویر ${currentIndex + 1}`}
              className="w-full max-h-80 object-contain"
            />
          )
        ) : (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
        
        {media.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80"
              onClick={() => setCurrentIndex(i => (i + 1) % media.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80"
              onClick={() => setCurrentIndex(i => (i - 1 + media.length) % media.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-1 rounded text-xs">
              {currentIndex + 1} / {media.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
};


interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: any;
  subcategory_id?: string;
  province_id?: string;
  district_id?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  payment_amount?: number | null;
  customer_id?: string;
  executed_by?: string | null;
  approved_by?: string | null;
}

export default function ExecutivePendingOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'approve' | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [executionStartDate, setExecutionStartDate] = useState('');
  const [executionEndDate, setExecutionEndDate] = useState('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
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
          customer_name,
          customer_phone,
          location_lat,
          location_lng,
          payment_amount,
          customer_id,
          executed_by,
          approved_by
        `)
        .eq('status', 'pending')
        .order('code', { ascending: false });

      if (error) throw error;

      // Map orders with denormalized data
      const rows = (data || []).map((order: any) => {
        // Parse notes using robust parser that handles double-stringified JSON
        const notesObj = parseOrderNotes(order.notes) || {};

        return {
          id: order.id,
          code: order.code,
          status: order.status,
          address: order.address,
          detailed_address: order.detailed_address,
          created_at: order.created_at,
          notes: notesObj,
          subcategory_id: order.subcategory_id,
          province_id: order.province_id,
          district_id: order.district_id,
          customer_name: order.customer_name || 'نامشخص',
          customer_phone: order.customer_phone || '',
          location_lat: order.location_lat,
          location_lng: order.location_lng,
          payment_amount: order.payment_amount,
          customer_id: order.customer_id,
          executed_by: order.executed_by,
          approved_by: order.approved_by,
        };
      });

      setOrders(rows as Order[]);
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
      // Get customer info first
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          status: 'in_progress',
          executed_by: user?.id,
          execution_confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Send push notification to customer
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', orderData.customer_id)
          .single();

        if (customerData?.user_id) {
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: customerData.user_id,
                title: '🔧 اجرای سفارش شروع شد',
                body: `سفارش شما با کد ${orderCode} وارد مرحله اجرا شد.`,
                link: '/user/my-orders',
                type: 'info'
              }
            });
          } catch (pushError) {
            console.log('Push notification skipped');
          }
        }
      }

      toast({
        title: '✓ اجرا آغاز شد',
        description: `سفارش ${orderCode} به مرحله در حال اجرا منتقل شد.`
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

  const handleCompleteExecution = async (orderId: string, orderCode: string) => {
    try {
      // Get customer info first
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          status: 'completed',
          executive_completion_date: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Send push notification to customer
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', orderData.customer_id)
          .single();

        if (customerData?.user_id) {
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: customerData.user_id,
                title: '✅ اجرای سفارش تکمیل شد',
                body: `سفارش شما با کد ${orderCode} با موفقیت اجرا شد و در انتظار پرداخت است.`,
                link: '/user/my-orders',
                type: 'success'
              }
            });
          } catch (pushError) {
            console.log('Push notification skipped');
          }
        }
      }

      toast({
        title: '✓ اجرا تکمیل شد',
        description: `سفارش ${orderCode} به مرحله در انتظار پرداخت منتقل شد.`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error completing execution:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در تکمیل اجرا'
      });
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
      // Parse existing notes and update with new dates
      const existingNotes = parseOrderNotes(selectedOrder.notes) || {};
      const updatedNotes = {
        ...existingNotes,
        installationDateTime: executionStartDate,
        installation_date: executionStartDate,
        dueDateTime: executionEndDate,
        due_date: executionEndDate
      };

      // تغییر وضعیت سفارش به approved و ثبت تاریخ‌های اجرا + آپدیت notes
      const { error: updateError } = await supabase
        .from('projects_v3')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          executed_by: user.id,
          execution_start_date: executionStartDate,
          execution_end_date: executionEndDate,
          notes: updatedNotes
        })
        .eq('id', selectedOrder.id);

      if (updateError) {
        console.error('Error updating order:', updateError);
        throw updateError;
      }

      // تعیین نقش تاییدکننده بر اساس نوع خدمات
      let approverRole = 'scaffold_executive_manager';
      if (selectedOrder.subcategory_id) {
        const { data: subcat } = await supabase
          .from('subcategories')
          .select('code')
          .eq('id', selectedOrder.subcategory_id)
          .single();
        
        if (subcat?.code === '30') {
          approverRole = 'rental_executive_manager';
        } else if (subcat?.code === '10') {
          approverRole = 'executive_manager_scaffold_execution_with_materials';
        }
      }

      // ثبت تایید در جدول order_approvals (اختیاری - برای سوابق)
      await supabase
        .from('order_approvals')
        .upsert({
          order_id: selectedOrder.id,
          approver_role: approverRole,
          approver_user_id: user.id,
          approved_at: new Date().toISOString()
        }, { onConflict: 'order_id,approver_role' })
        .select();

      // ارسال اعلان به مشتری
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id')
        .eq('id', selectedOrder.id)
        .single();

      if (orderData) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', orderData.customer_id)
          .single();

        if (customerData?.user_id) {
          const notificationTitle = '✅ سفارش شما تایید شد';
          const notificationBody = `سفارش شما با کد ${selectedOrder.code} توسط تیم مدیریت تایید شد و آماده اجرا است.`;
          
          const validated = sendNotificationSchema.parse({
            _user_id: customerData.user_id,
            _title: notificationTitle,
            _body: notificationBody,
            _link: '/user/my-orders',
            _type: 'success'
          });
          await supabase.rpc('send_notification', validated as { _user_id: string; _title: string; _body: string; _link?: string; _type?: string });
          
          // ارسال Push Notification به گوشی کاربر
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: customerData.user_id,
                title: notificationTitle,
                body: notificationBody,
                url: '/user/my-orders'
              }
            });
          } catch (pushError) {
            console.log('Push notification skipped (user may not have enabled)');
          }
        }
      }

      // ارسال پیامک به مشتری (در پس‌زمینه)
      if (selectedOrder.customer_phone) {
        sendOrderSms(selectedOrder.customer_phone, selectedOrder.code, 'approved', {
          orderId: selectedOrder.id,
          address: buildOrderSmsAddress(selectedOrder.address, selectedOrder.detailed_address),
        }).catch(err => {
          console.error('SMS notification error:', err);
        });
      }

      toast({
        title: '✓ سفارش تایید شد',
        description: `سفارش ${selectedOrder.code} به مرحله در انتظار اجرا منتقل شد.`
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
    
    // Check if this is an expert pricing request and if price has been set
    const orderNotes = parseOrderNotes(order.notes);
    const isExpertPricingRequest = orderNotes?.is_expert_pricing_request === true;
    const priceSetByManager = orderNotes?.price_set_by_manager === true;
    const hasPaymentAmount = order.payment_amount && order.payment_amount > 0;
    
    // For expert pricing requests, approval is disabled until price is set
    const canApprove = !isExpertPricingRequest || (priceSetByManager && hasPaymentAmount);
    
    const getServiceInfo = () => {
      try {
        const n = order.notes || {};
        const totalArea = n.total_area ?? n.totalArea;
        if (totalArea) return `مساحت کل: ${totalArea} متر مربع`;
        if (n.dimensions?.length > 0) return `تعداد ابعاد: ${n.dimensions.length}`;
        const type = n.scaffold_type || n.service_type || n.scaffoldType || '';
        if (type === 'facade') return 'داربست نما';
        if (type === 'formwork') return 'قالب فلزی';
        if (type?.includes('ceiling')) return 'داربست سقف';
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
                <Badge variant={
                  order.status === 'pending' ? 'secondary' : 
                  order.status === 'approved' ? 'default' : 
                  'outline'
                } className={
                  order.status === 'pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                  order.status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                }>
                  {order.status === 'pending' ? 'در انتظار تایید' : 
                   order.status === 'approved' ? 'آماده اجرا' : 
                   'در حال اجرا'}
                </Badge>
                {isExpertPricingRequest && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    درخواست قیمت‌گذاری
                  </Badge>
                )}
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{order.customer_name || 'نام ثبت نشده'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr" className="text-left">
                    {order.customer_phone || 'شماره ثبت نشده'}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <div className="line-clamp-1">{order.address}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">نوع خدمات</div>
            <div className="text-sm font-medium">{getServiceInfo()}</div>
          </div>

          {order.detailed_address && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">آدرس تفصیلی:</span> {order.detailed_address}
            </div>
          )}

          {/* Expert pricing status indicator */}
          {isExpertPricingRequest && !canApprove && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 text-sm">
                <Banknote className="h-4 w-4" />
                <span className="font-medium">ابتدا قیمت را برای این سفارش تعیین کنید</span>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                از طریق "جزئیات کامل" قیمت را وارد و ذخیره کنید، سپس می‌توانید سفارش را تایید کنید.
              </p>
            </div>
          )}

          {isExpertPricingRequest && canApprove && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">قیمت تعیین شده: {Number(order.payment_amount).toLocaleString('fa-IR')} تومان</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                قیمت سفارش تعیین شده و می‌توانید سفارش را تایید کنید.
              </p>
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
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedOrder(order);
                setTransferDialogOpen(true);
              }}
              className="gap-2"
            >
              <ArrowLeftRight className="h-4 w-4" />
              انتقال
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedOrder(order);
                setCollaboratorDialogOpen(true);
              }}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              افزودن پرسنل
            </Button>
            
            <Button
              size="sm"
              onClick={() => {
                setSelectedOrder(order);
                setActionType('approve');
                // Pre-fill execution dates from customer's requested dates
                const notes = parseOrderNotes(order.notes);
                const customerRequestedDate = notes?.installationDateTime || notes?.installation_date || '';
                const customerDueDate = notes?.dueDateTime || notes?.due_date || '';
                setExecutionStartDate(customerRequestedDate);
                setExecutionEndDate(customerDueDate);
              }}
              className={`gap-2 ${canApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
              disabled={!canApprove}
              title={!canApprove ? 'ابتدا باید قیمت سفارش را تعیین کنید' : 'تایید سفارش'}
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
        title="در انتظار تایید مدیران"
        description={`${orders.length} سفارش در انتظار تایید مدیران`}
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
              {/* نمایش تاریخ درخواستی مشتری */}
              {(() => {
                const orderNotes = parseOrderNotes(selectedOrder.notes);
                const customerRequestedDate = orderNotes?.installationDateTime || orderNotes?.installation_date;
                if (customerRequestedDate) {
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">تاریخ درخواستی مشتری</Label>
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          {formatPersianDate(customerRequestedDate)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

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
                <PersianDatePicker
                  value={executionStartDate}
                  onChange={setExecutionStartDate}
                  placeholder="انتخاب تاریخ شروع"
                  timeMode="ampm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">تاریخ پایان اجرا (تخمینی)</Label>
                <PersianDatePicker
                  value={executionEndDate}
                  onChange={setExecutionEndDate}
                  placeholder="انتخاب تاریخ پایان"
                  timeMode="none"
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات کامل سفارش {selectedOrder?.code}</DialogTitle>
            <DialogDescription>
              مشاهده تمامی جزئیات سفارش مشتری
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <EditableOrderDetails order={selectedOrder} onUpdate={() => {
              fetchOrders();
            }} />
          )}
        </DialogContent>
      </Dialog>

      {selectedOrder && (
        <ManagerOrderTransfer
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          onTransferComplete={fetchOrders}
        />
      )}

      {selectedOrder && (
        <ManagerAddStaffCollaborator
          orderId={selectedOrder.id}
          orderCode={selectedOrder.code}
          open={collaboratorDialogOpen}
          onOpenChange={setCollaboratorDialogOpen}
          onCollaboratorAdded={fetchOrders}
        />
      )}
    </div>
  );
}

