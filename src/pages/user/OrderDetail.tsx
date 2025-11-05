import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layouts/MainLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import OrderChat from "@/components/orders/OrderChat";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import {
  ArrowRight,
  MapPin,
  Calendar,
  FileText,
  Edit,
  Building,
  Hash,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Play,
  Film
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";

interface Order {
  id: string;
  code: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'scheduled' | 'active' | 'pending_execution' | 'completed' | 'in_progress' | 'paid' | 'closed';
  created_at: string;
  updated_at: string;
  address: string;
  detailed_address?: string;
  notes?: string;
  rejection_reason?: string;
  approved_at?: string;
  approved_by?: string;
  execution_start_date?: string;
  execution_end_date?: string;
  payment_amount?: number;
  payment_method?: string;
  customer_completion_date?: string;
  executive_completion_date?: string;
  subcategory?: {
    name: string;
    code: string;
    service_type: {
      name: string;
      code: string;
    };
  };
  province?: {
    name: string;
    code: string;
  };
  district?: {
    name: string;
  };
}

interface Approval {
  approver_role: string;
  approved_at: string | null;
  approver_user_id: string | null;
}

interface MediaFile {
  id: string;
  file_path: string;
  file_type: 'image' | 'video';
  thumbnail_path?: string;
  created_at: string;
}

const orderNotesSchema = z.object({
  dimensions: z.array(z.object({
    length: z.union([z.string(), z.number()]),
    width: z.union([z.string(), z.number()]).optional(),
    height: z.union([z.string(), z.number()]),
    area: z.number().optional()
  })).optional(),
  totalArea: z.number().optional(),
  estimated_price: z.number().optional(),
  estimatedPrice: z.number().optional()
}).passthrough();

const getStatusInfo = (status: string) => {
  const statusMap: Record<string, { label: string; icon: any; color: string }> = {
    draft: { label: 'پیش‌نویس', icon: FileText, color: 'text-muted-foreground' },
    pending: { label: 'در انتظار تایید', icon: Clock, color: 'text-yellow-600' },
    pending_execution: { label: 'در انتظار اجرا', icon: Clock, color: 'text-blue-600' },
    approved: { label: 'تایید شده', icon: CheckCircle, color: 'text-green-600' },
    rejected: { label: 'رد شده', icon: XCircle, color: 'text-destructive' },
    in_progress: { label: 'در حال اجرا', icon: Play, color: 'text-blue-600' },
    completed: { label: 'اجرا شده - در انتظار پرداخت', icon: CheckCircle, color: 'text-orange-600' },
    paid: { label: 'پرداخت شده - در انتظار اتمام', icon: CheckCircle, color: 'text-purple-600' },
    closed: { label: 'به اتمام رسیده', icon: CheckCircle, color: 'text-gray-600' },
  };
  
  return statusMap[status] || { label: status, icon: FileText, color: 'text-muted-foreground' };
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsedNotes, setParsedNotes] = useState<any>(null);
  const [completionDate, setCompletionDate] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; poster?: string } | null>(null);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  // Realtime updates for order status and approvals
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_v3',
          filter: `id=eq.${id}`
        },
        (payload) => {
          console.log('Order updated:', payload);
          fetchOrderDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_approvals',
          filter: `order_id=eq.${id}`
        },
        (payload) => {
          console.log('Approval updated:', payload);
          fetchOrderDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // مدیریت منبع ویدیو و آزادسازی blob ها
  useEffect(() => {
    if (selectedVideo) {
      setVideoSrc(selectedVideo.url);
      setVideoLoading(false);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    } else {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setVideoSrc(null);
    }
  }, [selectedVideo]);

  // در صورت خطا در پخش مستقیم، به blob تبدیل کنیم تا مشکل Content-Disposition/CORS برطرف شود
  const fallbackToBlob = async () => {
    if (!selectedVideo || blobUrl) return;
    try {
      setVideoLoading(true);
      const res = await fetch(selectedVideo.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setVideoSrc(url);
    } catch (err) {
      toast({
        title: "خطا در پخش ویدیو",
        description: "در تبدیل ویدیو برای پخش مشکلی رخ داد.",
        variant: "destructive"
      });
    } finally {
      setVideoLoading(false);
    }
  };
  const fetchOrderDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      // Get customer ID
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customer) {
        toast({
          title: "خطا",
          description: "اطلاعات مشتری یافت نشد",
          variant: "destructive"
        });
        navigate("/orders");
        return;
      }

      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from("projects_v3")
        .select(`
          *,
          subcategory:subcategories(
            name,
            code,
            service_type:service_types_v3(name, code)
          ),
          province:provinces(name, code),
          district:districts(name)
        `)
        .eq("id", id)
        .eq("customer_id", customer.id)
        .maybeSingle();

      if (orderError) throw orderError;
      
      if (!orderData) {
        toast({
          title: "خطا",
          description: "سفارش یافت نشد",
          variant: "destructive"
        });
        navigate("/orders");
        return;
      }

      setOrder(orderData);

      // Parse notes if exists
      if (orderData.notes) {
        try {
          const notes = typeof orderData.notes === 'string' 
            ? JSON.parse(orderData.notes) 
            : orderData.notes;
          
          const validated = orderNotesSchema.parse(notes);
          setParsedNotes(validated);
        } catch (e) {
          console.error('Error parsing notes:', e);
          setParsedNotes(null);
        }
      }

      // Fetch media files
      const { data: mediaData } = await supabase
        .from('project_media')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (mediaData) {
        setMediaFiles(mediaData as MediaFile[]);
      }

      // Fetch order approvals
      const { data: approvalsData } = await supabase
        .from('order_approvals')
        .select('approver_role, approved_at, approver_user_id')
        .eq('order_id', id)
        .order('created_at', { ascending: true });

      if (approvalsData) {
        setApprovals(approvalsData as Approval[]);
      }

    } catch (error: any) {
      toast({
        title: "خطا در بارگذاری سفارش",
        description: error.message,
        variant: "destructive"
      });
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  // Security: Draft and pending orders are editable until approved by manager
  const canEdit = order?.status === 'draft' || order?.status === 'pending';

  const handleSetCompletionDate = async () => {
    if (!order || !completionDate) {
      toast({
        title: 'خطا',
        description: 'لطفا تاریخ اتمام را وارد کنید',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          customer_completion_date: new Date(completionDate).toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: '✓ موفق',
        description: 'تاریخ اتمام شما ثبت شد'
      });

      fetchOrderDetails();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: 'ثبت تاریخ اتمام با خطا مواجه شد',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="در حال بارگذاری..." />
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return null;
  }

  const statusInfo = getStatusInfo(order.status);
  const StatusIcon = statusInfo.icon;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/orders")}
          className="mb-6 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به لیست سفارشات
        </Button>

        <div className="space-y-6">
          {/* Order Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                    <Badge variant={order.status === 'approved' ? 'secondary' : 'default'}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl mb-2">سفارش: {order.code}</CardTitle>
                  {order.subcategory && (
                    <p className="text-muted-foreground">
                      {order.subcategory.service_type.name} - {order.subcategory.name}
                    </p>
                  )}
                </div>
                
                {canEdit && (
                  <Button
                    onClick={() => navigate(`/scaffolding/form?edit=${order.id}`)}
                  >
                    <Edit className="h-4 w-4 ml-2" />
                    ویرایش سفارش
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">کد سفارش:</span>
                  <span className="font-mono text-lg font-bold">{order.code}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">نوع خدمات:</span>
                  <span>{order.subcategory?.service_type?.name || '-'}</span>
                </div>
              </div>

              <Separator />
              
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-1">آدرس</p>
                  <p>{order.address}</p>
                  {order.province && (
                    <p className="text-sm text-muted-foreground mt-1">
                      استان {order.province.name}
                      {order.district && ` - شهر ${order.district.name}`}
                    </p>
                  )}
                </div>
              </div>
              
              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    ثبت شده: {new Date(order.created_at).toLocaleDateString("fa-IR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>

                {order.approved_at && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      تایید شده: {new Date(order.approved_at).toLocaleDateString("fa-IR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <OrderTimeline
            orderStatus={order.status}
            createdAt={order.created_at}
            approvedAt={order.approved_at}
            executionStartDate={order.execution_start_date}
            executionEndDate={order.execution_end_date}
            customerCompletionDate={order.customer_completion_date}
            rejectionReason={order.rejection_reason}
            approvals={approvals}
          />

          {/* Order Details from Notes or Payment Amount */}
          {(parsedNotes || order.payment_amount) && (
            <Card>
              <CardHeader>
                <CardTitle>جزئیات سفارش</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* نوع خدمت */}
                {parsedNotes?.service_type && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="font-medium">نوع داربست: </span>
                    <span className="text-lg">
                      {parsedNotes.service_type === 'facade' && 'داربست سطحی نما'}
                      {parsedNotes.service_type === 'formwork' && 'داربست کفراژ'}
                      {parsedNotes.service_type === 'ceiling-tiered' && 'داربست زیر بتن - تیرچه'}
                      {parsedNotes.service_type === 'ceiling-slab' && 'داربست زیر بتن - دال بتنی'}
                    </span>
                  </div>
                )}

                {/* ابعاد */}
                {parsedNotes?.dimensions && parsedNotes.dimensions.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">ابعاد</h3>
                    <div className="space-y-2">
                      {parsedNotes.dimensions.map((dim: any, index: number) => {
                        const length = typeof dim.length === 'number' ? dim.length : parseFloat(dim.length);
                        const width = dim.width ? (typeof dim.width === 'number' ? dim.width : parseFloat(dim.width)) : null;
                        const height = typeof dim.height === 'number' ? dim.height : parseFloat(dim.height);
                        const area = dim.area || (length * (width || 1) * height);
                        
                        return (
                          <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg flex-wrap">
                            <span className="font-medium">بعد {index + 1}:</span>
                            <span>طول: {length} متر</span>
                            {width && width !== 1 && <span>× عرض: {width} متر</span>}
                            <span>× ارتفاع: {height} متر</span>
                            <span className="text-muted-foreground">
                              = {area.toFixed(2)} متر مکعب
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* متراژ کل */}
                {parsedNotes?.totalArea && (
                  <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
                    <span className="font-medium">متراژ کل:</span>
                    <span className="text-lg font-bold">{parsedNotes.totalArea.toFixed(2)} متر مکعب</span>
                  </div>
                )}

                {/* شرایط خدمات */}
                {parsedNotes?.conditions && (
                  <div>
                    <h3 className="font-medium mb-3">شرایط خدمات</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {parsedNotes.conditions.totalMonths && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">مدت قرارداد: </span>
                          <span className="font-medium">{parsedNotes.conditions.totalMonths} ماه</span>
                        </div>
                      )}
                      {parsedNotes.conditions.currentMonth && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">ماه جاری: </span>
                          <span className="font-medium">ماه {parsedNotes.conditions.currentMonth}</span>
                        </div>
                      )}
                      {parsedNotes.conditions.distanceRange && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">فاصله: </span>
                          <span className="font-medium">{parsedNotes.conditions.distanceRange} کیلومتر</span>
                        </div>
                      )}
                      {parsedNotes.onGround !== undefined && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">محل نصب: </span>
                          <span className="font-medium">{parsedNotes.onGround ? 'روی زمین' : 'روی سکو/پشت‌بام'}</span>
                        </div>
                      )}
                      {!parsedNotes.onGround && parsedNotes.conditions.platformHeight && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">ارتفاع پای کار: </span>
                          <span className="font-medium">{parsedNotes.conditions.platformHeight} متر</span>
                        </div>
                      )}
                      {!parsedNotes.onGround && parsedNotes.conditions.scaffoldHeightFromPlatform && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">ارتفاع داربست از پای کار: </span>
                          <span className="font-medium">{parsedNotes.conditions.scaffoldHeightFromPlatform} متر</span>
                        </div>
                      )}
                      {parsedNotes.vehicleReachesSite !== undefined && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">دسترسی خودرو: </span>
                          <span className="font-medium">{parsedNotes.vehicleReachesSite ? 'خودرو به محل می‌رسد' : 'خودرو به محل نمی‌رسد'}</span>
                        </div>
                      )}
                      {!parsedNotes.vehicleReachesSite && parsedNotes.conditions.vehicleDistance && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">فاصله خودرو تا محل: </span>
                          <span className="font-medium">{parsedNotes.conditions.vehicleDistance} متر</span>
                        </div>
                      )}
                      {parsedNotes.isFacadeWidth2m !== undefined && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">عرض داربست نما: </span>
                          <span className="font-medium">{parsedNotes.isFacadeWidth2m ? '2 متر' : '1 متر'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* قیمت */}
                {((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice) || order.payment_amount) && (
                  <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <span className="font-medium text-lg">قیمت:</span>
                    <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice) || order.payment_amount)?.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                )}

                {/* جزئیات قیمت */}
                {parsedNotes?.price_breakdown && parsedNotes.price_breakdown.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">جزئیات محاسبه قیمت</h3>
                    <div className="space-y-2">
                      {parsedNotes.price_breakdown.map((item: string, index: number) => (
                        <div key={index} className="text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status Messages */}
          {order.status === 'pending' && (
            <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      در انتظار تایید مدیریت
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      سفارش شما در حال بررسی است. تا زمان تایید توسط مدیر، می‌توانید سفارش خود را ویرایش کنید.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'rejected' && order.rejection_reason && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-destructive mb-1">سفارش رد شده</p>
                    <p className="text-sm text-destructive/80">
                      دلیل رد: {order.rejection_reason}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'approved' && (
            <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                      سفارش تایید شده
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      سفارش شما توسط مدیریت تایید شده و به زودی عملیات اجرایی آغاز خواهد شد.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'in_progress' && order.execution_start_date && (
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      در حال اجرا
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      سفارش شما از تاریخ {new Date(order.execution_start_date).toLocaleDateString('fa-IR')} در حال اجراست.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'completed' && order.payment_amount && (
            <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100 mb-1">
                      اجرا تکمیل شد
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      مبلغ قابل پرداخت: {order.payment_amount.toLocaleString('fa-IR')} تومان
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'paid' && (
            <>
              <Card className="border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-purple-900 dark:text-purple-100 mb-1">
                          پرداخت انجام شد
                        </p>
                        <p className="text-sm text-purple-700 dark:text-purple-300">
                          پرداخت شما ثبت شد. جهت تایید نهایی اتمام پروژه، لطفا تاریخ اتمام را مشخص کنید.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <h4 className="font-semibold mb-2 text-sm">وضعیت تایید اتمام</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          {order.customer_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>تایید شما: {order.customer_completion_date 
                            ? new Date(order.customer_completion_date).toLocaleDateString('fa-IR')
                            : 'در انتظار'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {order.executive_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>مدیر اجرایی: {order.executive_completion_date 
                            ? new Date(order.executive_completion_date).toLocaleDateString('fa-IR')
                            : 'در انتظار'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!order.customer_completion_date && (
                <Card className="border-2 border-primary">
                  <CardHeader>
                    <CardTitle className="text-lg">تایید اتمام پروژه</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      با ثبت تاریخ اتمام، تایید می‌کنید که پروژه به درستی انجام شده است.
                    </p>
                    <div>
                      <Label htmlFor="completion-date">تاریخ اتمام پروژه</Label>
                      <Input
                        id="completion-date"
                        type="date"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <Button onClick={handleSetCompletionDate} className="gap-2 w-full">
                      <CheckCircle className="h-4 w-4" />
                      تایید اتمام پروژه
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {order.status === 'closed' && (
            <Card className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/20">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      پروژه با موفقیت به اتمام رسید
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      از اعتماد شما سپاسگزاریم
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* بخش نمایش عکس‌ها و ویدیوها */}
          {mediaFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>تصاویر و ویدیوهای پروژه</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaFiles.filter(m => m.file_type === 'image').map((media) => {
                    const { data } = supabase.storage
                      .from('order-media')
                      .getPublicUrl(media.file_path);
                    
                    return (
                      <div key={media.id} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={data.publicUrl}
                          alt="تصویر سفارش"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    );
                  })}
                  {mediaFiles.filter(m => m.file_type === 'video').map((media) => {
                    const { data } = supabase.storage
                      .from('order-media')
                      .getPublicUrl(media.file_path);
                    
                    // Get thumbnail if available
                    const thumbnailData = media.thumbnail_path 
                      ? supabase.storage.from('order-media').getPublicUrl(media.thumbnail_path)
                      : null;
                    
                    const handleDownload = async () => {
                      try {
                        const response = await fetch(data.publicUrl);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = media.file_path.split('/').pop() || 'video.mp4';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        toast({ title: 'موفق', description: 'دانلود ویدیو شروع شد' });
                      } catch (error) {
                        toast({ title: 'خطا', description: 'خطا در دانلود ویدیو', variant: 'destructive' });
                      }
                    };
                    
                    return (
                      <div key={media.id} className={`relative group transition-all duration-300 ${
                        expandedVideo === media.id ? 'col-span-full' : 'col-span-2'
                      }`}>
                        {expandedVideo === media.id ? (
                          /* Expanded Video Player */
                          <div className="w-full bg-black rounded-lg overflow-hidden">
                            <div className="aspect-video relative">
                              <video
                                src={data.publicUrl}
                                controls
                                autoPlay
                                className="w-full h-full"
                                poster={thumbnailData?.data.publicUrl}
                                preload="metadata"
                                playsInline
                              >
                                مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
                              </video>
                              {/* Close button */}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="absolute top-3 right-3 shadow-lg bg-white/95 hover:bg-white"
                                onClick={() => setExpandedVideo(null)}
                              >
                                <XCircle className="w-4 h-4 ml-1" />
                                بستن
                              </Button>
                            </div>
                            {/* Video controls row */}
                            <div className="bg-black/90 p-4 flex justify-between items-center">
                              <div className="text-white text-sm">
                                {media.file_path.split('/').pop()?.replace(/^\d+_[a-z0-9]+_/, '') || 'ویدیو پروژه'}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={handleDownload}
                                >
                                  <Download className="w-4 h-4 ml-1" />
                                  دانلود
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Thumbnail View */
                          <div 
                            className="aspect-video rounded-lg overflow-hidden border bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                            onClick={() => setExpandedVideo(media.id)}
                          >
                            {thumbnailData?.data.publicUrl ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={thumbnailData.data.publicUrl}
                                  alt="پیش‌نمایش ویدیو"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                  <div className="bg-white/90 rounded-full p-4 shadow-lg hover:scale-110 transition-transform">
                                    <Play className="w-8 h-8 text-primary fill-primary" />
                                  </div>
                                </div>
                                {/* Label showing video name */}
                                <div className="absolute top-2 left-2 right-2 bg-black/80 text-white text-sm px-3 py-1.5 rounded truncate">
                                  {media.file_path.split('/').pop()?.replace(/^\d+_[a-z0-9]+_/, '') || 'ویدیو پروژه'}
                                </div>
                              </div>
                            ) : (
                              <div className="relative w-full h-full bg-black/5 flex items-center justify-center">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                <Film className="w-16 h-16 text-primary opacity-60" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white/90 rounded-full p-4 shadow-lg hover:scale-110 transition-transform">
                                    <Play className="w-8 h-8 text-primary fill-primary" />
                                  </div>
                                </div>
                                {/* Label showing video name even without thumbnail */}
                                <div className="absolute top-2 left-2 right-2 bg-black/80 text-white text-sm px-3 py-1.5 rounded truncate">
                                  {media.file_path.split('/').pop()?.replace(/^\d+_[a-z0-9]+_/, '') || 'ویدیو پروژه'}
                                </div>
                              </div>
                            )}
                            
                            {/* Action buttons - only show when not expanded */}
                            <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="shadow-lg bg-white/95 hover:bg-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload();
                                }}
                              >
                                <Download className="w-4 h-4 ml-1" />
                                دانلود
                              </Button>
                            </div>
                            
                            {/* File info badge */}
                            <div className="absolute bottom-3 left-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                              <Film className="w-3.5 h-3.5" />
                              ویدیو
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Player Dialog */}
          <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
            <DialogContent className="max-w-5xl w-full p-0">
              <DialogHeader className="p-6 pb-4">
                <DialogTitle>پخش ویدیو</DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6">
                {selectedVideo && (
                  <div className="space-y-3">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                      {videoLoading && (
                        <div className="absolute inset-0 grid place-items-center text-white text-sm">
                          در حال آماده‌سازی ویدیو...
                        </div>
                      )}
                      <video
                        key={(videoSrc || selectedVideo.url) as string}
                        src={(videoSrc || selectedVideo.url) as string}
                        controls
                        className="w-full h-full"
                        poster={selectedVideo.poster}
                        preload="metadata"
                        playsInline
                        crossOrigin="anonymous"
                        onError={() => {
                          // اگر پخش مستقیم شکست خورد، به blob تبدیل کنیم
                          void fallbackToBlob();
                        }}
                      >
                        <source src={(videoSrc || selectedVideo.url) as string} type="video/mp4" />
                        مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
                      </video>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="secondary">
                        <a href={selectedVideo.url} target="_blank" rel="noreferrer">باز کردن در تب جدید</a>
                      </Button>
                      <Button asChild>
                        <a href={selectedVideo.url} download>دانلود ویدیو</a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* بخش چت و تعامل با مدیریت */}
          <OrderChat orderId={order.id} orderStatus={order.status} />

        </div>
      </div>
    </MainLayout>
  );
}
