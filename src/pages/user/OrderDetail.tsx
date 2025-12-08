import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
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
import VoiceCall from "@/components/orders/VoiceCall";
import CallHistory from "@/components/calls/CallHistory";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import StaticLocationMap from "@/components/locations/StaticLocationMap";
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
  X,
  CreditCard,
  Printer,
  ArrowLeftRight
} from "lucide-react";
import { OrderTransfer } from "@/components/orders/OrderTransfer";
import { RepairRequestDialog } from "@/components/orders/RepairRequestDialog";
import { RatingForm } from "@/components/ratings/RatingForm";
import { useProjectRatings, RatingCriteria } from "@/hooks/useRatings";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { formatPersianDate, formatPersianDateTime, formatPersianDateTimeFull } from "@/lib/dateUtils";

interface Order {
  id: string;
  code: string;
  customer_id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'scheduled' | 'active' | 'pending_execution' | 'completed' | 'in_progress' | 'paid' | 'closed';
  created_at: string;
  updated_at: string;
  address: string;
  detailed_address?: string;
  notes?: string;
  rejection_reason?: string;
  approved_at?: string;
  approved_by?: string;
  executed_by?: string;
  execution_start_date?: string;
  execution_end_date?: string;
  execution_stage?: string | null;
  execution_stage_updated_at?: string | null;
  payment_amount?: number;
  payment_method?: string;
  payment_confirmed_at?: string;
  transaction_reference?: string;
  customer_completion_date?: string;
  executive_completion_date?: string;
  location_lat?: number;
  location_lng?: number;
  hierarchy_project_id?: string;
  subcategory_id?: string;
  province_id?: string;
  district_id?: string;
  customer_name?: string;
  customer_phone?: string;
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
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showRepairDialog, setShowRepairDialog] = useState(false);
  const [repairCost, setRepairCost] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
   
  // معیارهای ثابت امتیازدهی - بدون نیاز به کوئری دیتابیس
  const staffCriteria: RatingCriteria[] = [
    { id: '1', rating_type: 'customer_to_staff', key: 'support', title: 'کیفیت پشتیبانی', description: 'نحوه پاسخگویی و پشتیبانی', weight: 1, is_active: true },
    { id: '2', rating_type: 'customer_to_staff', key: 'execution_quality', title: 'کیفیت اجرایی', description: 'کیفیت کار انجام شده', weight: 1, is_active: true },
    { id: '3', rating_type: 'customer_to_staff', key: 'staff_behavior', title: 'برخورد مناسب نیروها', description: 'نحوه برخورد و رفتار پرسنل', weight: 1, is_active: true },
  ];

  const contractorCriteria: RatingCriteria[] = [
    { id: '4', rating_type: 'customer_to_contractor', key: 'overall_performance', title: 'عملکرد کلی', description: 'عملکرد کلی مدیر اجرایی', weight: 1, is_active: true },
    { id: '5', rating_type: 'customer_to_contractor', key: 'timely_approval', title: 'تایید به موقع', description: 'سرعت تایید سفارش', weight: 1, is_active: true },
    { id: '6', rating_type: 'customer_to_contractor', key: 'order_followup', title: 'پیگیری سفارش', description: 'پیگیری و هماهنگی سفارش', weight: 1, is_active: true },
  ];

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

  // Check for payment result in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus) {
      if (paymentStatus === 'success') {
        toast({
          title: 'پرداخت موفق',
          description: 'پرداخت شما با موفقیت انجام شد',
          variant: 'default'
        });
      } else if (paymentStatus === 'failed') {
        toast({
          title: 'پرداخت ناموفق',
          description: 'پرداخت شما انجام نشد. لطفاً مجدداً تلاش کنید',
          variant: 'destructive'
        });
      } else if (paymentStatus === 'cancelled') {
        toast({
          title: 'پرداخت لغو شد',
          description: 'شما پرداخت را لغو کردید',
          variant: 'default'
        });
      } else if (paymentStatus === 'already_verified') {
        toast({
          title: 'پرداخت قبلاً تایید شده',
          description: 'این پرداخت قبلاً تایید شده است',
          variant: 'default'
        });
      }
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

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
          let notes = orderData.notes;
          
          // Handle string that needs parsing
          if (typeof notes === 'string') {
            notes = JSON.parse(notes);
          }
          
          // Handle double-stringified JSON (stored as '"{...}"')
          if (typeof notes === 'string') {
            notes = JSON.parse(notes);
          }
          
          // Ensure we have an object
          if (notes && typeof notes === 'object') {
            console.log('Parsed notes:', notes);
            setParsedNotes(notes);
          } else {
            console.warn('Notes is not a valid object:', notes);
            setParsedNotes(null);
          }
        } catch (e) {
          console.error('Error parsing notes:', e, 'Raw notes:', orderData.notes);
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

  const handlePrintInvoice = () => {
    if (!order) return;

    const notes = parsedNotes || {};
    const status = getStatusInfo(order.status).label;
    const priceValue = (notes.estimated_price || notes.estimatedPrice || order.payment_amount || 0) as number;
    const customerName = order.customer_name || notes.customerName || '';
    const customerPhone = order.customer_phone || notes.phoneNumber || '';

    const dimensionsHtml = Array.isArray(notes.dimensions)
      ? notes.dimensions
          .map((dim: any, index: number) => {
            const length = typeof dim.length === 'number' ? dim.length : parseFloat(dim.length);
            const width = dim.width ? (typeof dim.width === 'number' ? dim.width : parseFloat(dim.width)) : null;
            const height = typeof dim.height === 'number' ? dim.height : parseFloat(dim.height);
            return `
              <tr>
                <td style="padding:6px;border:1px solid #e5e7eb;">${index + 1}</td>
                <td style="padding:6px;border:1px solid #e5e7eb;">${length}</td>
                <td style="padding:6px;border:1px solid #e5e7eb;">${width ?? '-'}</td>
                <td style="padding:6px;border:1px solid #e5e7eb;">${height}</td>
              </tr>
            `;
          })
          .join('')
      : '';

    const conditionsParts: string[] = [];
    if (notes.conditions) {
      if (notes.conditions.rentalMonthsPlan) {
        const plan = notes.conditions.rentalMonthsPlan;
        const label = plan === '1' ? 'به شرط یک ماه' : plan === '2' ? 'به شرط دو ماه' : 'به شرط سه ماه و بیشتر';
        conditionsParts.push(`پلان اجاره: ${label}`);
      }
      if (notes.conditions.totalMonths) {
        conditionsParts.push(`مدت قرارداد: ${notes.conditions.totalMonths} ماه`);
      }
      if (notes.conditions.distanceRange) {
        conditionsParts.push(`فاصله تا پروژه: ${notes.conditions.distanceRange} کیلومتر`);
      }
      if (notes.platformHeight) {
        conditionsParts.push(`ارتفاع پای کار: ${notes.platformHeight} متر`);
      }
      if (notes.scaffoldHeightFromPlatform) {
        conditionsParts.push(`ارتفاع داربست از پای کار: ${notes.scaffoldHeightFromPlatform} متر`);
      }
      if (typeof notes.onGround === 'boolean') {
        conditionsParts.push(`محل نصب: ${notes.onGround ? 'روی زمین' : 'روی سکو/پشت‌بام'}`);
      }
      if (typeof notes.vehicleReachesSite === 'boolean') {
        conditionsParts.push(`دسترسی خودرو: ${notes.vehicleReachesSite ? 'خودرو به محل می‌رسد' : 'خودرو به محل نمی‌رسد'}`);
      }
    }

    const conditionsHtml = conditionsParts
      .map((c) => `<li style="margin-bottom:4px;">${c}</li>`)
      .join('');

    const priceBreakdownHtml = Array.isArray(notes.price_breakdown)
      ? notes.price_breakdown
          .map((item: string) => `<li style="margin-bottom:4px;">${item}</li>`)
          .join('')
      : '';

    const installationDate = notes.installationDateTime || notes.installDate || notes.dueDate || '';

    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) return;

    win.document.write(`<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>فاکتور سفارش ${order.code}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f3f4f6; margin:0; padding:24px; }
    .invoice { max-width:800px; margin:0 auto; background:#ffffff; border-radius:12px; padding:24px 32px; box-shadow:0 10px 40px rgba(15,23,42,0.15); }
    h1 { font-size:22px; margin-bottom:4px; }
    h2 { font-size:16px; margin:24px 0 8px; }
    .muted { color:#6b7280; font-size:13px; }
    .row { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:8px; }
    .label { font-weight:600; min-width:90px; }
    .box { border:1px solid #e5e7eb; border-radius:10px; padding:12px 16px; margin-top:8px; }
    .price { font-size:20px; font-weight:700; color:#15803d; }
    table { width:100%; border-collapse:collapse; margin-top:4px; font-size:13px; }
    th { background:#f3f4f6; padding:6px; border:1px solid #e5e7eb; text-align:center; }
    td { text-align:center; }
    ul { margin:4px 0 0; padding-right:18px; font-size:13px; }
    @media print { body { background:#ffffff; padding:0; } .invoice { box-shadow:none; border-radius:0; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:16px;">
      <div>
        <h1>فاکتور سفارش ${order.code}</h1>
        <div class="muted">وضعیت سفارش: ${status}</div>
      </div>
      <div style="text-align:left; font-size:13px;">
        <div>تاریخ ثبت: ${formatPersianDateTimeFull(order.created_at)}</div>
        ${order.approved_at ? `<div>تاریخ تایید: ${formatPersianDate(order.approved_at)}</div>` : ''}
      </div>
    </div>

    <div class="box">
      <div class="row">
        <div class="label">نام مشتری</div>
        <div>${customerName || '---'}</div>
      </div>
      <div class="row">
        <div class="label">شماره تماس</div>
        <div>${customerPhone || '---'}</div>
      </div>
      <div class="row" style="margin-top:4px;">
        <div class="label">آدرس پروژه</div>
        <div>${order.address}</div>
      </div>
    </div>

    ${dimensionsHtml ? `
      <h2>ابعاد پروژه</h2>
      <div class="box">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>طول (متر)</th>
              <th>عرض (متر)</th>
              <th>ارتفاع (متر)</th>
            </tr>
          </thead>
          <tbody>
            ${dimensionsHtml}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${conditionsHtml ? `
      <h2>شرایط خدمات</h2>
      <div class="box">
        <ul>${conditionsHtml}</ul>
      </div>
    ` : ''}

    ${notes.locationPurpose ? `
      <h2>شرح محل نصب و فعالیت</h2>
      <div class="box">${notes.locationPurpose}</div>
    ` : ''}

    ${installationDate ? `
      <h2>زمان نصب درخواستی</h2>
      <div class="box">${formatPersianDateTimeFull(installationDate)}</div>
    ` : ''}

    <h2>خلاصه مالی</h2>
    <div class="box">
      <div class="row">
        <div class="label">مبلغ کل</div>
        <div class="price">${priceValue.toLocaleString('fa-IR')} تومان</div>
      </div>
      ${priceBreakdownHtml ? `<ul>${priceBreakdownHtml}</ul>` : ''}
    </div>
  </div>
</body>
</html>`);

    win.document.close();
    win.focus();
    win.print();
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
          {/* Action Buttons - Above Card */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {order.subcategory?.code === 'scaffolding_with_materials_and_transport' && 
             (order.status === 'completed' || order.status === 'paid') && (
              <Button
                onClick={handleRenewOrder}
                disabled={isRenewing}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRenewing ? 'animate-spin' : ''}`} />
                تمدید سفارش
              </Button>
            )}
            {canEdit && (
              <Button
                onClick={() => navigate(`/scaffolding/form?edit=${order.id}`)}
                size="sm"
              >
                <Edit className="h-4 w-4 ml-2" />
                ویرایش سفارش
              </Button>
            )}
            {order.status !== 'rejected' && order.status !== 'closed' && (
              <Button
                variant="outline"
                onClick={() => setShowTransferDialog(true)}
                size="sm"
                className="gap-2"
              >
                <ArrowLeftRight className="h-4 w-4" />
                انتقال سفارش
              </Button>
            )}
          </div>

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
              <CardContent className="space-y-6">
                {/* بلوک ۱: مشخصات فنی داربست */}
                {parsedNotes && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-4">
                      <h3 className="font-semibold mb-1">مشخصات داربست</h3>

                      {/* نوع خدمت */}
                      {parsedNotes.service_type && (
                        <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">نوع داربست</span>
                          <span className="font-semibold text-base">
                            {parsedNotes.service_type === 'facade' && 'داربست سطحی نما'}
                            {parsedNotes.service_type === 'formwork' && 'داربست حجمی کفراژ'}
                            {parsedNotes.service_type === 'ceiling-tiered' && 'داربست زیر بتن - تیرچه'}
                            {parsedNotes.service_type === 'ceiling-slab' && 'داربست زیر بتن - دال بتنی'}
                            {parsedNotes.service_type === 'column' && 'داربست ستونی، نورگیر، چاله آسانسور و ...'}
                            {!['facade', 'formwork', 'ceiling-tiered', 'ceiling-slab', 'column'].includes(parsedNotes.service_type) && parsedNotes.service_type}
                          </span>
                        </div>
                      )}

                      {/* ابعاد */}
                      {parsedNotes.dimensions && parsedNotes.dimensions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">ابعاد ثبت‌شده</h4>
                            <span className="text-xs text-muted-foreground">به متر</span>
                          </div>
                          <div className="space-y-2">
                            {parsedNotes.dimensions.map((dim: any, index: number) => {
                              const length = typeof dim.length === 'number' ? dim.length : parseFloat(dim.length);
                              const width = dim.width ? (typeof dim.width === 'number' ? dim.width : parseFloat(dim.width)) : 1;
                              const height = typeof dim.height === 'number' ? dim.height : parseFloat(dim.height);

                              const actualHeight = parsedNotes.columnHeight || height;
                              const volume = length * width * actualHeight;

                              return (
                                <div
                                  key={index}
                                  className="flex flex-wrap items-center gap-2 md:gap-3 p-3 bg-muted/40 rounded-xl"
                                >
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-background text-xs font-medium border border-border/60">
                                    {parsedNotes.service_type === 'column'
                                      ? 'ابعاد'
                                      : `بعد ${index + 1}`}
                                  </span>
                                  <span className="text-sm">طول: <span className="font-medium">{length}</span> متر</span>
                                  <span className="text-sm">عرض: <span className="font-medium">{width}</span> متر</span>
                                  <span className="text-sm">ارتفاع: <span className="font-medium">{actualHeight}</span> متر</span>
                                  {parsedNotes.service_type !== 'column' && (
                                    <span className="text-xs text-muted-foreground ms-auto">
                                      حجم تقریبی: {volume % 1 === 0 ? volume : volume.toFixed(2)} متر مکعب
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* متراژ کل */}
                      {parsedNotes.totalArea && (
                        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">متراژ کل داربست</span>
                          <span className="font-bold text-lg">
                            {parsedNotes.totalArea % 1 === 0
                              ? parsedNotes.totalArea
                              : parsedNotes.totalArea.toFixed(2)}
                            
                            <span className="text-sm font-normal ms-1">متر مکعب</span>
                          </span>
                        </div>
                      )}

                      {/* واحدهای داربست ستونی */}
                      {parsedNotes.column_units && (
                        <div className="space-y-2">
                          <h4 className="font-medium">جزئیات واحدهای داربست ستونی</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {parsedNotes.column_units.length_units && (
                              <div className="p-3 bg-muted/40 rounded-lg">
                                <span className="text-xs text-muted-foreground block mb-1">واحد طول</span>
                                <span className="font-medium text-sm">{parsedNotes.column_units.length_units}</span>
                              </div>
                            )}
                            {parsedNotes.column_units.width_units && (
                              <div className="p-3 bg-muted/40 rounded-lg">
                                <span className="text-xs text-muted-foreground block mb-1">واحد عرض</span>
                                <span className="font-medium text-sm">{parsedNotes.column_units.width_units}</span>
                              </div>
                            )}
                            {parsedNotes.column_units.height_units && (
                              <div className="p-3 bg-muted/40 rounded-lg">
                                <span className="text-xs text-muted-foreground block mb-1">واحد ارتفاع</span>
                                <span className="font-medium text-sm">{parsedNotes.column_units.height_units}</span>
                              </div>
                            )}
                            {parsedNotes.column_units.total_units && (
                              <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                                <span className="text-xs text-muted-foreground block mb-1">مجموع واحدها</span>
                                <span className="font-bold text-base">{parsedNotes.column_units.total_units}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* بلوک ۲: شرایط اجرا و محل */}
                    <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-4">
                      <h3 className="font-semibold mb-1">شرایط اجرا و محل پروژه</h3>

                      {parsedNotes.conditions && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {parsedNotes.conditions.rentalMonthsPlan && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">پلان اجاره</span>
                              <span className="font-medium text-sm">
                                {parsedNotes.conditions.rentalMonthsPlan === '1' && 'به شرط یک ماه'}
                                {parsedNotes.conditions.rentalMonthsPlan === '2' && 'به شرط دو ماه'}
                                {parsedNotes.conditions.rentalMonthsPlan === '3+' && 'به شرط سه ماه و بیشتر'}
                              </span>
                            </div>
                          )}
                          {parsedNotes.conditions.totalMonths && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">مدت قرارداد</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.totalMonths} ماه</span>
                            </div>
                          )}
                          {parsedNotes.conditions.distanceRange && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">فاصله از قم</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.distanceRange} کیلومتر</span>
                            </div>
                          )}
                          {parsedNotes.onGround !== undefined && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">محل نصب داربست</span>
                              <span className="font-medium text-sm">
                                {parsedNotes.onGround ? 'روی زمین' : 'روی سکو / پشت‌بام / بالکن'}
                              </span>
                            </div>
                          )}
                          {!parsedNotes.onGround && parsedNotes.conditions.platformHeight && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">ارتفاع پای کار</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.platformHeight} متر</span>
                            </div>
                          )}
                          {!parsedNotes.onGround && parsedNotes.conditions.scaffoldHeightFromPlatform && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">ارتفاع داربست از پای کار</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.scaffoldHeightFromPlatform} متر</span>
                            </div>
                          )}
                          {parsedNotes.vehicleReachesSite !== undefined && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">دسترسی خودرو</span>
                              <span className="font-medium text-sm">
                                {parsedNotes.vehicleReachesSite ? 'خودرو به محل می‌رسد' : 'خودرو به محل نمی‌رسد'}
                              </span>
                            </div>
                          )}
                          {!parsedNotes.vehicleReachesSite && parsedNotes.conditions.vehicleDistance && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">فاصله خودرو تا محل</span>
                              <span className="font-medium text-sm">{parsedNotes.conditions.vehicleDistance} متر</span>
                            </div>
                          )}
                          {parsedNotes.isFacadeWidth2m !== undefined && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">عرض داربست نما</span>
                              <span className="font-medium text-sm">{parsedNotes.isFacadeWidth2m ? '2 متر' : '1 متر'}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* شرح محل نصب */}
                      {parsedNotes.locationPurpose && (
                        <div className="space-y-2">
                          <h4 className="font-medium">شرح محل نصب و فعالیت</h4>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-sm leading-relaxed">{parsedNotes.locationPurpose}</p>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* بلوک ۳: قیمت و جدول زمان‌بندی */}
                {((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice) || order.payment_amount) && (
                  <section className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                      <h3 className="font-semibold">هزینه قرارداد</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">قیمت تخمینی</span>
                        <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                          {((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice) || order.payment_amount)?.toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    </div>

                    {parsedNotes?.price_breakdown && parsedNotes.price_breakdown.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">جزئیات محاسبه قیمت</h4>
                        <div className="space-y-1">
                          {parsedNotes.price_breakdown.map((item: string, index: number) => (
                            <div
                              key={index}
                              className="text-xs sm:text-sm text-muted-foreground p-2 bg-muted/40 rounded-md border border-muted/60"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(parsedNotes?.installDate || parsedNotes?.dueDate || parsedNotes?.installationDateTime) && (
                      <div className="space-y-2">
                        <h4 className="font-medium">تاریخ‌های مهم سفارش</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {parsedNotes.installDate && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">تاریخ نصب پیشنهادی</span>
                              <span className="font-medium text-sm">
                                {parsedNotes.installDate.includes('T') || parsedNotes.installDate.includes('-')
                                  ? formatPersianDateTime(parsedNotes.installDate)
                                  : parsedNotes.installDate}
                              </span>
                            </div>
                          )}
                          {parsedNotes.installationDateTime && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">زمان نصب درخواستی</span>
                              <span className="font-medium text-sm">
                                {parsedNotes.installationDateTime.includes('T') || parsedNotes.installationDateTime.includes('-')
                                  ? formatPersianDateTime(parsedNotes.installationDateTime)
                                  : parsedNotes.installationDateTime}
                              </span>
                            </div>
                          )}
                          {parsedNotes.dueDate && (
                            <div className="p-3 bg-muted/40 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">سررسید قرارداد</span>
                              <span className="font-medium text-sm">
                                {parsedNotes.dueDate.includes('T') || parsedNotes.dueDate.includes('-')
                                  ? formatPersianDate(parsedNotes.dueDate)
                                  : parsedNotes.dueDate}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {notesParseError && (
                      <p className="text-xs text-muted-foreground">
                        جزئیات فنی این سفارش در دسترس نیست.
                      </p>
                    )}

                    {/* دکمه پرداخت - فقط بعد از تایید سفارش */}
                    {['approved', 'completed', 'in_progress', 'pending_execution'].includes(order.status) && 
                     ((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice) || order.payment_amount) && 
                     !order.payment_confirmed_at && (
                      <div className="pt-4 border-t border-emerald-200 dark:border-emerald-800">
                        <Button 
                          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          size="lg"
                          onClick={async () => {
                            const paymentAmount = order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice;
                            if (!paymentAmount) {
                              toast({
                                title: 'خطا',
                                description: 'مبلغ پرداخت مشخص نیست',
                                variant: 'destructive'
                              });
                              return;
                            }
                            
                            try {
                              toast({
                                title: 'در حال اتصال به درگاه پرداخت',
                                description: 'لطفاً صبر کنید...'
                              });
                              
                              const { data, error } = await supabase.functions.invoke('zarinpal-payment', {
                                body: {
                                  order_id: order.id,
                                  amount: paymentAmount,
                                  description: `پرداخت سفارش ${order.code}`
                                }
                              });
                              
                              if (error) {
                                console.error('Supabase function error:', error);
                                
                                if (error instanceof FunctionsHttpError) {
                                  try {
                                    const errorDetails = await error.context.json();
                                    const gatewayMessage =
                                      typeof errorDetails === 'object' && errorDetails !== null
                                        ? (errorDetails.error || errorDetails.message || 'خطای ناشناخته از درگاه پرداخت')
                                        : 'خطای ناشناخته از درگاه پرداخت';
                                    
                                    toast({
                                      title: 'خطا در اتصال به درگاه',
                                      description: gatewayMessage,
                                      variant: 'destructive'
                                    });
                                  } catch (parseError) {
                                    toast({
                                      title: 'خطا در اتصال به درگاه',
                                      description: 'پاسخی نامعتبر از درگاه پرداخت دریافت شد',
                                      variant: 'destructive'
                                    });
                                  }
                                } else {
                                  toast({
                                    title: 'خطا در اتصال به درگاه',
                                    description: 'لطفاً مجدداً تلاش کنید',
                                    variant: 'destructive'
                                  });
                                }
                                return;
                              }
                              
                              if (data?.payment_url) {
                                window.location.href = data.payment_url;
                              } else {
                                throw new Error('URL پرداخت دریافت نشد');
                              }
                            } catch (error) {
                              console.error('Payment error:', error);
                              toast({
                                title: 'خطا در اتصال به درگاه',
                                description: 'لطفاً مجدداً تلاش کنید',
                                variant: 'destructive'
                              });
                            }
                          }}
                        >
                          <CreditCard className="h-5 w-5" />
                          پرداخت آنلاین - {((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice) || order.payment_amount)?.toLocaleString('fa-IR')} تومان
                        </Button>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                          پرداخت از طریق درگاه امن زرین‌پال انجام می‌شود
                        </p>
                      </div>
                    )}

                    {/* نمایش وضعیت پرداخت شده */}
                    {order.payment_confirmed_at && (
                      <div className="pt-4 border-t border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-lg">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">پرداخت شده</span>
                          {order.transaction_reference && (
                            <span className="text-xs text-muted-foreground mr-auto" dir="ltr">
                              کد پیگیری: {order.transaction_reference}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* بلوک ۴: اطلاعات تماس */}
                {(order.customer_name || order.customer_phone || parsedNotes?.customerName || parsedNotes?.phoneNumber) && (
                  <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                    <h3 className="font-semibold">اطلاعات تماس مشتری</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(order.customer_name || parsedNotes?.customerName) && (
                        <div className="p-3 bg-muted/40 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">نام</span>
                          <span className="font-medium text-sm">{order.customer_name || parsedNotes?.customerName}</span>
                        </div>
                      )}
                      {(order.customer_phone || parsedNotes?.phoneNumber) && (
                        <div className="p-3 bg-muted/40 rounded-lg" dir="ltr">
                          <span className="text-xs text-muted-foreground block mb-1" dir="rtl">شماره تماس</span>
                          <span className="font-medium text-sm">{order.customer_phone || parsedNotes?.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </CardContent>
            </Card>
          )}

          {/* دکمه درخواست تعمیر - فقط برای سفارش‌های اجرا شده و پرداخت شده */}
          {order.subcategory?.code === 'scaffolding_with_materials_and_transport' && 
           ['approved', 'in_progress', 'completed', 'paid', 'closed'].includes(order.status) && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                      <Edit className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                        آیا نیاز به تعمیر داربست دارید؟
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        در صورت آسیب‌دیدگی یا نیاز به تعمیر داربست، درخواست خود را ثبت کنید.
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowRepairDialog(true)}
                    className="gap-2 bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap"
                  >
                    <Edit className="h-4 w-4" />
                    نیاز به تعمیر سفارش انجام شده داریم
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* نقشه موقعیت پروژه */}
          {order.location_lat && order.location_lng && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  موقعیت پروژه بر روی نقشه
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] rounded-lg overflow-hidden border-2 border-border">
                  <StaticLocationMap
                    lat={order.location_lat}
                    lng={order.location_lng}
                    address={order.address}
                    detailedAddress={order.detailed_address}
                  />
                </div>
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
            executionStage={order.execution_stage}
            executionStageUpdatedAt={order.execution_stage_updated_at}
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

          {/* دکمه چاپ فاکتور */}
          <Card>
            <CardContent className="pt-6 flex justify-end">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handlePrintInvoice}
              >
                <Printer className="h-4 w-4" />
                چاپ فاکتور سفارش
              </Button>
            </CardContent>
          </Card>

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

          {/* تماس صوتی اینترنتی با مدیر */}
          <VoiceCall 
            orderId={order.id} 
            managerId={order.executed_by || order.approved_by}
            isManager={false}
          />

          {/* تاریخچه تماس‌ها */}
          <CallHistory orderId={order.id} />

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
                  {/* امتیازدهی به پرسنل اداری - پیمانکار واقعی یا اجرایی */}
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // امتیازدهی به پرسنل اداری شرکت اهرم (contractor_id یا executed_by)
                      let staffUserId: string | null = null;
                      let staffName: string = 'پرسنل اداری';

                      // Query order details
                      const { data: orderData } = await supabase
                        .from('projects_v3')
                        .select('contractor_id, executed_by')
                        .eq('id', order.id)
                        .single();

                      // First check for contractor assigned to this project
                      if (orderData?.contractor_id) {
                        const { data: contractorData } = await supabase
                          .from('contractors')
                          .select('user_id, company_name')
                          .eq('id', orderData.contractor_id)
                          .single();
                        
                        if (contractorData?.user_id) {
                          staffUserId = contractorData.user_id;
                          staffName = contractorData.company_name || 'پرسنل اداری';
                        }
                      }
                      
                      // Fallback to executed_by if no contractor
                      if (!staffUserId && orderData?.executed_by) {
                        staffUserId = orderData.executed_by;
                        const { data: profile } = await supabase
                          .from('profiles')
                          .select('full_name')
                          .eq('user_id', staffUserId)
                          .single();
                        staffName = profile?.full_name || 'پرسنل اداری';
                      }
                      
                      if (staffUserId) {
                        setStaffId(staffUserId);
                        setRatedUserName(staffName);
                        setRatingType('customer_to_staff');
                        setShowRatingForm(true);
                      } else {
                        toast({
                          title: 'اطلاع',
                          description: 'پرسنل اداری برای این سفارش یافت نشد',
                          variant: 'default'
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

                  {/* امتیازدهی به پیمانکار - مدیر تایید کننده سفارش */}
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // امتیازدهی به مدیر تایید کننده سفارش (approved_by)
                      let contractorUserId: string | null = null;
                      let contractorName: string = 'پیمانکار';

                      // First try approved_by from order
                      if (order.approved_by) {
                        contractorUserId = order.approved_by;
                      } else {
                        // Fallback to order_approvals
                        const { data: approvals } = await supabase
                          .from('order_approvals')
                          .select('approver_user_id, approver_role')
                          .eq('order_id', order.id)
                          .not('approver_user_id', 'is', null);
                        
                        const staffApproval = approvals?.find(a => 
                          a.approver_role === 'scaffold_executive_manager' || 
                          a.approver_role === 'executive_manager_scaffold_execution_with_materials' ||
                          a.approver_role === 'sales_manager' ||
                          a.approver_role === 'ceo'
                        );
                        
                        if (staffApproval?.approver_user_id) {
                          contractorUserId = staffApproval.approver_user_id;
                        }
                      }
                      
                      if (contractorUserId) {
                        // Get manager name
                        const { data: profile } = await supabase
                          .from('profiles')
                          .select('full_name')
                          .eq('user_id', contractorUserId)
                          .single();
                        
                        contractorName = profile?.full_name || 'پیمانکار';
                        setContractorId(contractorUserId);
                        setRatedUserName(contractorName);
                        setRatingType('customer_to_contractor');
                        setShowRatingForm(true);
                      } else {
                        toast({
                          title: 'اطلاع',
                          description: 'مدیر تایید کننده برای این سفارش یافت نشد',
                          variant: 'default'
                        });
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
                  criteria={ratingType === 'customer_to_staff' ? staffCriteria : contractorCriteria}
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

          {/* Order Transfer Dialog */}
          <OrderTransfer
            orderId={order.id}
            orderCode={order.code}
            open={showTransferDialog}
            onOpenChange={setShowTransferDialog}
            onTransferRequested={fetchOrderDetails}
          />

          {/* Repair Request Dialog */}
          <RepairRequestDialog
            open={showRepairDialog}
            onOpenChange={setShowRepairDialog}
            orderId={order.id}
            orderCode={order.code}
            customerId={(order as any).customer_id || ''}
            onRepairCostChange={(cost) => setRepairCost(cost)}
          />

        </div>
      </div>
    </MainLayout>
  );
}
