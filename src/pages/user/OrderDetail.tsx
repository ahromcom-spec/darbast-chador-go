import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Film,
  Star,
  RefreshCw,
  Upload,
  X
} from "lucide-react";
import { RatingForm } from "@/components/ratings/RatingForm";
import { useRatingCriteria, useProjectRatings, useCreateRating } from "@/hooks/useRatings";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { formatPersianDate, formatPersianDateTimeFull } from "@/lib/dateUtils";

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
  hierarchy_project_id?: string;
  subcategory_id?: string;
  province_id?: string;
  district_id?: string;
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
  hierarchy_project?: {
    location?: {
      title: string | null;
      address_line: string;
    };
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
  const [notesParseError, setNotesParseError] = useState(false);
  const [completionDate, setCompletionDate] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; poster?: string } | null>(null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingType, setRatingType] = useState<'customer_to_staff' | 'customer_to_contractor'>('customer_to_staff');
  const [staffId, setStaffId] = useState<string | null>(null);
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [ratedUserName, setRatedUserName] = useState<string>('');
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch rating data
  const { data: staffCriteria } = useRatingCriteria('customer_to_staff');
  const { data: contractorCriteria } = useRatingCriteria('customer_to_contractor');
  const { data: projectRatings, refetch: refetchRatings } = useProjectRatings(id || '');

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
        navigate("/user/orders");
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
          district:districts(name),
          hierarchy_project:projects_hierarchy!hierarchy_project_id(
            location:locations(title, address_line)
          )
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
        navigate("/user/orders");
        return;
      }

      setOrder(orderData);

      // Parse notes if exists
      setNotesParseError(false);
      if (orderData.notes) {
        try {
          const notes = typeof orderData.notes === 'string' 
            ? JSON.parse(orderData.notes) 
            : orderData.notes;
          
          const validated = orderNotesSchema.safeParse(notes);
          setParsedNotes(validated.success ? validated.data : notes);
        } catch (e) {
          console.error('Error parsing notes:', e);
          setParsedNotes(null);
          setNotesParseError(true);
        }
      } else {
        setParsedNotes(null);
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

  const handleRenewOrder = async () => {
    if (!order) return;
    
    setIsRenewing(true);
    try {
      // دریافت اطلاعات customer_id از جدول customers
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (customerError) throw customerError;

      // ایجاد سفارش جدید با همان مشخصات
      const newOrderData: any = {
        customer_id: customerData.id,
        subcategory_id: order.subcategory_id,
        province_id: order.province_id,
        district_id: order.district_id,
        address: order.address,
        notes: order.notes,
        status: 'pending',
        is_renewal: true,
        original_order_id: order.id,
        hierarchy_project_id: order.hierarchy_project_id
      };

      if (order.detailed_address) {
        newOrderData.detailed_address = order.detailed_address;
      }

      const { data: newOrder, error: createError } = await supabase
        .from('projects_v3')
        .insert(newOrderData)
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: "موفق",
        description: "سفارش تمدید با موفقیت ایجاد شد",
      });

      // هدایت به صفحه سفارش جدید
      navigate(`/order/${newOrder.id}`);
    } catch (error) {
      console.error('Error renewing order:', error);
      toast({
        title: "خطا",
        description: "خطا در ایجاد سفارش تمدید",
        variant: "destructive",
      });
    } finally {
      setIsRenewing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({ 
          status: 'rejected',
          rejection_reason: 'لغو شده توسط کاربر',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "✓ موفق",
        description: "سفارش شما با موفقیت لغو شد",
      });

      setShowCancelDialog(false);
      await fetchOrderDetails();
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      toast({
        title: "خطا",
        description: "خطا در لغو سفارش",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .delete()
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: "✓ موفق",
        description: "سفارش با موفقیت حذف شد",
      });

      setShowDeleteDialog(false);
      navigate('/user/projects');
    } catch (error: any) {
      console.error('Error deleting order:', error);
      toast({
        title: "خطا",
        description: "خطا در حذف سفارش",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!order || !files || files.length === 0) return;

    setUploadingMedia(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "خطا",
          description: "لطفاً وارد سیستم شوید",
          variant: "destructive"
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const fileType = file.type.startsWith('image/') ? 'image' : 'video';

        try {
          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('order-media')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Save to database
          const { error: dbError } = await supabase
            .from('project_media')
            .insert({
              project_id: order.id,
              file_path: filePath,
              file_type: fileType,
              file_size: file.size,
              mime_type: file.type,
              user_id: user.id
            });

          if (dbError) throw dbError;
          
          successCount++;
        } catch (err) {
          console.error('Error uploading file:', file.name, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "✓ موفق",
          description: `${successCount} فایل با موفقیت آپلود شد${errorCount > 0 ? ` (${errorCount} فایل با خطا مواجه شد)` : ''}`,
        });
        
        // Refresh media files
        await fetchOrderDetails();
      } else {
        toast({
          title: "خطا",
          description: "هیچ فایلی آپلود نشد",
          variant: "destructive",
        });
      }
      
      setShowMediaUpload(false);
    } catch (error: any) {
      console.error('Error uploading media:', error);
      toast({
        title: "خطا",
        description: error.message || "خطا در آپلود فایل‌ها",
        variant: "destructive",
      });
    } finally {
      setUploadingMedia(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDeleteMedia = async (mediaId: string, mediaPath: string) => {
    if (!confirm('آیا از حذف این رسانه اطمینان دارید؟')) {
      return;
    }

    setDeletingMediaId(mediaId);
    try {
      // حذف از storage
      const { error: storageError } = await supabase.storage
        .from('order-media')
        .remove([mediaPath]);
      
      if (storageError) {
        console.error('Storage delete error:', storageError);
      }
      
      // حذف از database
      const { error: dbError } = await supabase
        .from('project_media')
        .delete()
        .eq('id', mediaId);
      
      if (dbError) throw dbError;
      
      toast({
        title: '✓ موفق',
        description: 'رسانه با موفقیت حذف شد',
      });
      
      // بارگذاری مجدد جزئیات سفارش
      await fetchOrderDetails();
    } catch (error: any) {
      console.error('Error deleting media:', error);
      toast({
        title: 'خطا',
        description: 'خطا در حذف رسانه',
        variant: 'destructive',
      });
    } finally {
      setDeletingMediaId(null);
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
          onClick={() => navigate("/")}
          className="mb-6 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به صفحه نخست
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
                
                {order.subcategory?.code === 'scaffolding_with_materials_and_transport' && 
                 (order.status === 'completed' || order.status === 'paid') && (
                  <Button
                    onClick={handleRenewOrder}
                    disabled={isRenewing}
                    variant="default"
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRenewing ? 'animate-spin' : ''}`} />
                    تمدید سفارش
                  </Button>
                )}
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
              
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-1">آدرس</p>
                  {order.hierarchy_project?.location?.title && (
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      {order.hierarchy_project.location.title}
                    </p>
                  )}
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
                    ثبت شده: {formatPersianDateTimeFull(order.created_at)}
                  </span>
                </div>

                {order.approved_at && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      تایید شده: {formatPersianDate(order.approved_at, { showDayOfWeek: true })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Details from Notes or Payment Amount */}
          {(parsedNotes || order.payment_amount || notesParseError) && (
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
                              = {area % 1 === 0 ? area : area.toFixed(2)} متر مکعب
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
                    <span className="text-lg font-bold">{parsedNotes.totalArea % 1 === 0 ? parsedNotes.totalArea : parsedNotes.totalArea.toFixed(2)} متر مکعب</span>
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

                {notesParseError && (
                  <p className="text-sm text-muted-foreground">
                    جزئیات فنی این سفارش در دسترس نیست.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

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
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                      سفارش شما در حال بررسی است. تا زمان تایید توسط مدیر، می‌توانید سفارش خود را ویرایش یا لغو کنید.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => setShowCancelDialog(true)}
                      className="gap-2"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4" />
                      لغو سفارش
                    </Button>
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
                      سفارش شما از تاریخ {formatPersianDate(order.execution_start_date, { showDayOfWeek: true })} در حال اجراست.
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
                            ? formatPersianDate(order.customer_completion_date, { showDayOfWeek: true })
                            : 'در انتظار'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {order.executive_completion_date ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-yellow-600" />
                          )}
                          <span>مدیر اجرایی: {order.executive_completion_date 
                            ? formatPersianDate(order.executive_completion_date, { showDayOfWeek: true })
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تصاویر و ویدیوهای پروژه</CardTitle>
                {!order.approved_at && (
                  <Button
                    variant="default"
                    onClick={() => document.getElementById('media-upload-input')?.click()}
                    disabled={uploadingMedia}
                    className="gap-2"
                  >
                    {uploadingMedia ? (
                      <>
                        <Clock className="h-4 w-4 animate-spin" />
                        در حال آپلود...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        افزودن عکس/ویدیو
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <input
                id="media-upload-input"
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleMediaUpload}
                disabled={uploadingMedia}
              />
              
              {mediaFiles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>هنوز عکس یا ویدیویی اضافه نشده است</p>
                  {!order.approved_at && (
                    <p className="text-sm mt-2">برای افزودن، روی دکمه بالا کلیک کنید</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaFiles.filter(m => m.file_type === 'image').map((media) => {
                    const { data } = supabase.storage
                      .from('order-media')
                      .getPublicUrl(media.file_path);
                    
                    return (
                      <div 
                        key={media.id} 
                        className="relative aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                        onClick={() => setSelectedImage(data.publicUrl)}
                      >
                        <img
                          src={data.publicUrl}
                          alt="تصویر سفارش"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        
                        {/* دکمه حذف - فقط برای سفارش‌های تایید نشده */}
                        {!order.approved_at && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMedia(media.id, media.file_path);
                            }}
                            disabled={deletingMediaId === media.id}
                          >
                            {deletingMediaId === media.id ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
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
                      <div key={media.id} className="relative">
                        <div 
                          className="aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                          onClick={() => window.open(data.publicUrl, '_blank')}
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
                        </div>
                        
                        {/* دکمه حذف - فقط برای سفارش‌های تایید نشده */}
                        {!order.approved_at && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMedia(media.id, media.file_path);
                            }}
                            disabled={deletingMediaId === media.id}
                          >
                            {deletingMediaId === media.id ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        
                        {/* Action buttons */}
                        <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Image Zoom Dialog */}
          <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
            <DialogContent className="max-w-7xl w-full p-0">
              <DialogHeader className="p-6 pb-4">
                <DialogTitle>عکس پروژه</DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6">
                {selectedImage && (
                  <div className="relative w-full">
                    <img
                      src={selectedImage}
                      alt="عکس بزرگ پروژه"
                      className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                    />
                    <Button
                      variant="secondary"
                      className="mt-4 gap-2"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = selectedImage;
                        link.download = 'project-image.jpg';
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4" />
                      دانلود عکس
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>



          {/* بخش چت و تعامل با مدیریت */}
          <OrderChat orderId={order.id} orderStatus={order.status} />

          {/* بخش امتیازدهی - فقط برای سفارشات تکمیل شده یا بسته شده */}
          {(order.status === 'completed' || order.status === 'paid' || order.status === 'closed') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  امتیازدهی به سفارش
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  لطفا تجربه خود از همکاری با پرسنل و پیمانکار را با ما به اشتراک بگذارید.
                </p>

                {/* نمایش امتیازهای ثبت شده */}
                {projectRatings && projectRatings.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">امتیازهای ثبت شده شما:</h4>
                    {projectRatings
                      .filter(r => r.rater_id === user?.id)
                      .map((rating) => (
                        <div key={rating.id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">
                              {rating.rating_type === 'customer_to_staff' ? 'امتیاز به پرسنل' : 'امتیاز به پیمانکار'}
                            </span>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                              <span className="font-bold">{rating.overall_score.toFixed(1)}</span>
                            </div>
                          </div>
                          {rating.comment && (
                            <p className="text-xs text-muted-foreground">{rating.comment}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatPersianDate(rating.created_at, { showDayOfWeek: true })}
                          </p>
                        </div>
                      ))}
                  </div>
                )}

                {/* دکمه‌های امتیازدهی */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Get staff who worked on this project
                      const { data: approvals } = await supabase
                        .from('order_approvals')
                        .select('approver_user_id, approver_role')
                        .eq('order_id', order.id)
                        .not('approver_user_id', 'is', null);
                      
                      const staffApproval = approvals?.find(a => 
                        a.approver_role === 'scaffold_executive_manager' || 
                        a.approver_role === 'sales_manager'
                      );
                      
                      if (staffApproval?.approver_user_id) {
                        // Get staff name
                        const { data: profile } = await supabase
                          .from('profiles')
                          .select('full_name')
                          .eq('user_id', staffApproval.approver_user_id)
                          .single();
                        
                        setStaffId(staffApproval.approver_user_id);
                        setRatedUserName(profile?.full_name || 'پرسنل');
                        setRatingType('customer_to_staff');
                        setShowRatingForm(true);
                      } else {
                        toast({
                          title: 'خطا',
                          description: 'پرسنلی برای این سفارش یافت نشد',
                          variant: 'destructive'
                        });
                      }
                    }}
                    className="gap-2"
                    disabled={projectRatings?.some(r => r.rater_id === user?.id && r.rating_type === 'customer_to_staff')}
                  >
                    <Star className="h-4 w-4" />
                    {projectRatings?.some(r => r.rater_id === user?.id && r.rating_type === 'customer_to_staff')
                      ? 'امتیاز به پرسنل ثبت شده'
                      : 'امتیازدهی به پرسنل'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Get contractor assigned to this project
                      if (order.status === 'completed' || order.status === 'paid' || order.status === 'closed') {
                        const { data: projectData } = await supabase
                          .from('projects_v3')
                          .select('contractor_id')
                          .eq('id', order.id)
                          .single();
                        
                        if (projectData?.contractor_id) {
                          // Get contractor's user_id and name
                          const { data: contractorData } = await supabase
                            .from('contractors')
                            .select('user_id, company_name')
                            .eq('id', projectData.contractor_id)
                            .single();
                          
                          if (contractorData?.user_id) {
                            setContractorId(contractorData.user_id);
                            setRatedUserName(contractorData.company_name || 'پیمانکار');
                            setRatingType('customer_to_contractor');
                            setShowRatingForm(true);
                          } else {
                            toast({
                              title: 'اطلاع',
                              description: 'پیمانکاری برای این سفارش تخصیص داده نشده',
                              variant: 'default'
                            });
                          }
                        } else {
                          toast({
                            title: 'اطلاع',
                            description: 'پیمانکاری برای این سفارش تخصیص داده نشده',
                            variant: 'default'
                          });
                        }
                      }
                    }}
                    className="gap-2"
                    disabled={projectRatings?.some(r => r.rater_id === user?.id && r.rating_type === 'customer_to_contractor')}
                  >
                    <Star className="h-4 w-4" />
                    {projectRatings?.some(r => r.rater_id === user?.id && r.rating_type === 'customer_to_contractor')
                      ? 'امتیاز به پیمانکار ثبت شده'
                      : 'امتیازدهی به پیمانکار'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* فرم امتیازدهی */}
          <Dialog open={showRatingForm} onOpenChange={setShowRatingForm}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {ratingType === 'customer_to_staff' ? 'امتیازدهی به پرسنل' : 'امتیازدهی به پیمانکار'}
                </DialogTitle>
              </DialogHeader>
              {showRatingForm && (
                <RatingForm
                  projectId={order.id}
                  ratedUserId={ratingType === 'customer_to_staff' ? staffId! : contractorId!}
                  ratedUserName={ratedUserName}
                  ratingType={ratingType}
                  criteria={ratingType === 'customer_to_staff' ? staffCriteria || [] : contractorCriteria || []}
                  onSuccess={() => {
                    setShowRatingForm(false);
                    refetchRatings();
                    toast({
                      title: '✓ موفق',
                      description: 'امتیاز شما با موفقیت ثبت شد'
                    });
                  }}
                  onCancel={() => setShowRatingForm(false)}
                />
              )}
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </MainLayout>
  );
}
