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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ArrowLeftRight,
  Users,
  ChevronDown,
  ChevronUp,
  CalendarDays
} from "lucide-react";
import { OrderTransfer } from "@/components/orders/OrderTransfer";
import { AddCollaborator } from "@/components/orders/AddCollaborator";
import { OrderCollaboratorsList } from "@/components/orders/OrderCollaboratorsList";
import { OrderOwnershipChain } from "@/components/orders/OrderOwnershipChain";
import { RepairRequestDialog } from "@/components/orders/RepairRequestDialog";
import { CollectionRequestDialog } from "@/components/orders/CollectionRequestDialog";
import { ManagerOrderInvoice } from "@/components/orders/ManagerOrderInvoice";
import { OrderForOthersInfo } from "@/components/orders/OrderForOthersInfo";
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
  transferred_from_user_id?: string;
  transferred_from_phone?: string;
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
  const [approvedRepairCost, setApprovedRepairCost] = useState(0);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [showCollaboratorDialog, setShowCollaboratorDialog] = useState(false);
  const [isOrderDetailsExpanded, setIsOrderDetailsExpanded] = useState(false);
  const [isPriceDetailsExpanded, setIsPriceDetailsExpanded] = useState(false);
  const [isConfirmingPrice, setIsConfirmingPrice] = useState(false);
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

      // Fetch order using security definer function to ensure visibility
      const { data: orderData, error: orderError } = await supabase
        .rpc('get_my_projects_v3')
        .eq('id', id)
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

      // Fetch subcategory info separately since RPC doesn't join it
      let enrichedOrder: any = { ...orderData };
      if (orderData.subcategory_id) {
        const { data: subcategoryData } = await supabase
          .from('subcategories')
          .select('name, code, service_types_v3:service_type_id(name, code)')
          .eq('id', orderData.subcategory_id)
          .maybeSingle();
        
        if (subcategoryData) {
          enrichedOrder.subcategory = {
            name: subcategoryData.name,
            code: subcategoryData.code,
            service_type: subcategoryData.service_types_v3 as any
          };
        }
      }

      // Fetch province/district info
      if (orderData.province_id) {
        const { data: provinceData } = await supabase
          .from('provinces')
          .select('name, code')
          .eq('id', orderData.province_id)
          .maybeSingle();
        
        if (provinceData) {
          enrichedOrder.province = provinceData;
        }
      }

      if (orderData.district_id) {
        const { data: districtData } = await supabase
          .from('districts')
          .select('name')
          .eq('id', orderData.district_id)
          .maybeSingle();
        
        if (districtData) {
          enrichedOrder.district = districtData;
        }
      }

      setOrder(enrichedOrder as Order);

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

      // Fetch approved/completed repair costs
      const { data: repairData } = await supabase
        .from('repair_requests')
        .select('final_cost, status')
        .eq('order_id', id)
        .in('status', ['approved', 'completed']);

      if (repairData && repairData.length > 0) {
        const totalRepairCost = repairData.reduce((sum, r) => sum + (r.final_cost || 0), 0);
        setApprovedRepairCost(totalRepairCost);
      } else {
        setApprovedRepairCost(0);
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
          updated_at: new Date().toISOString(),
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

  // Handler for customer confirming expert pricing
  const handleConfirmExpertPrice = async () => {
    if (!order || !parsedNotes) return;
    
    setIsConfirmingPrice(true);
    try {
      const updatedNotes = {
        ...parsedNotes,
        customer_price_confirmed: true,
        customer_price_confirmed_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('projects_v3')
        .update({ notes: updatedNotes })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: '✓ قیمت تایید شد',
        description: 'سفارش شما وارد روال عادی شد و در انتظار بررسی مدیران قرار گرفت.',
      });

      // Refresh order details
      await fetchOrderDetails();
    } catch (error: any) {
      console.error('Error confirming price:', error);
      toast({
        title: 'خطا',
        description: 'خطا در تایید قیمت',
        variant: 'destructive',
      });
    } finally {
      setIsConfirmingPrice(false);
    }
  };

  // Check if this is an expert pricing request
  const isExpertPricingRequest = parsedNotes?.is_expert_pricing_request === true;
  const managerHasSetPrice = parsedNotes?.price_set_by_manager === true && (order?.payment_amount || parsedNotes?.manager_set_price);
  const customerHasConfirmedPrice = parsedNotes?.customer_price_confirmed === true;

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
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت
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
            {order.status !== 'rejected' && order.status !== 'closed' && (
              <Button
                variant="outline"
                onClick={() => setShowCollaboratorDialog(true)}
                size="sm"
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                افزودن همکار
              </Button>
            )}
            {/* دکمه پرینت فاکتور - برای همه سفارشات */}
            <ManagerOrderInvoice 
              order={{
                id: order.id,
                code: order.code,
                customer_name: order.customer_name || parsedNotes?.customerName,
                customer_phone: order.customer_phone || parsedNotes?.phoneNumber,
                address: order.address,
                detailed_address: order.detailed_address,
                created_at: order.created_at,
                notes: order.notes,
                payment_amount: order.payment_amount,
                status: order.status,
                province_id: order.province_id,
                subcategory_id: order.subcategory_id
              }}
            />
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

              {/* اطلاعات تماس مشتری */}
              {(order.customer_name || order.customer_phone || parsedNotes?.customerName || parsedNotes?.phoneNumber) && (
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
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
                </div>
              )}

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

          {/* Order For Others Info - نمایش اطلاعات سفارش برای دیگران */}
          <OrderForOthersInfo 
            orderId={order.id}
            onStatusChange={fetchOrderDetails}
          />

          {/* Expert Pricing Request Section */}
          {isExpertPricingRequest && (
            <Card className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  درخواست قیمت‌گذاری کارشناسی
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!managerHasSetPrice ? (
                  // Manager hasn't set price yet
                  <div className="flex items-center gap-3 p-4 bg-amber-100/50 dark:bg-amber-900/30 rounded-xl">
                    <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        در انتظار تعیین قیمت توسط کارشناس
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        کارشناس ما در حال بررسی درخواست شما هستند و به زودی قیمت مشخص خواهد شد.
                      </p>
                    </div>
                  </div>
                ) : !customerHasConfirmedPrice ? (
                  // Manager has set price, waiting for customer confirmation
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
                      <div className="text-center space-y-2">
                        <p className="text-sm text-green-700 dark:text-green-300">
                          قیمت تعیین شده توسط کارشناس
                        </p>
                        <p className="text-3xl font-extrabold text-green-700 dark:text-green-300">
                          {(order.payment_amount || parsedNotes?.manager_set_price)?.toLocaleString('fa-IR')} تومان
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        آیا قیمت تعیین شده را تایید می‌کنید؟ با تایید قیمت، سفارش شما وارد روال عادی بررسی و اجرا خواهد شد.
                      </p>
                      <Button
                        onClick={handleConfirmExpertPrice}
                        disabled={isConfirmingPrice}
                        className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                        size="lg"
                      >
                        {isConfirmingPrice ? (
                          <>
                            <Clock className="h-5 w-5 animate-spin" />
                            در حال ثبت...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5" />
                            تایید قیمت و ادامه سفارش
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Customer has confirmed price
                  <div className="flex items-center gap-3 p-4 bg-green-100/50 dark:bg-green-900/30 rounded-xl">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        قیمت تایید شده
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        سفارش شما با قیمت {(order.payment_amount || parsedNotes?.manager_set_price)?.toLocaleString('fa-IR')} تومان تایید شده و در روال عادی قرار گرفته است.
                      </p>
                    </div>
                  </div>
                )}

                {/* نمایش تاریخ درخواست اجرا */}
                {parsedNotes?.requested_date && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 mt-4">
                    <CalendarDays className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">تاریخ درخواست اجرا</p>
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        {new Date(parsedNotes.requested_date).toLocaleDateString('fa-IR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {/* نمایش ابعاد درخواستی */}
                {parsedNotes?.dimensions && parsedNotes.dimensions.length > 0 && parsedNotes.dimensions.some((d: any) => d.length || d.width || d.height) && (
                  <div className="p-4 bg-muted/30 rounded-xl mt-4">
                    <p className="text-sm text-muted-foreground mb-2">ابعاد درخواستی (متر)</p>
                    <div className="space-y-2">
                      {parsedNotes.dimensions.filter((d: any) => d.length || d.width || d.height).map((dim: any, index: number) => (
                        <div key={index} className="flex gap-4 text-sm">
                          {dim.length && <span>طول: {dim.length}</span>}
                          {dim.width && <span>عرض: {dim.width}</span>}
                          {dim.height && <span>ارتفاع: {dim.height}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* نمایش توضیحات */}
                {parsedNotes?.description && (
                  <div className="p-4 bg-muted/30 rounded-xl mt-4">
                    <p className="text-sm text-muted-foreground mb-2">توضیحات مشتری</p>
                    <p className="text-sm">{parsedNotes.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Order Details from Notes or Payment Amount */}
          {(parsedNotes || order.payment_amount || notesParseError) && (
            <Collapsible open={isOrderDetailsExpanded} onOpenChange={setIsOrderDetailsExpanded}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>جزئیات سفارش</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary View - Always Visible */}
                  {parsedNotes && (
                    <div className="space-y-3">
                      {/* نوع داربست یا کرایه اجناس */}
                      {parsedNotes.service_type && (
                        <div className="p-3 bg-primary/10 rounded-lg flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">نوع داربست</span>
                          <span className="font-semibold">
                            {parsedNotes.service_type === 'facade' && 'داربست سطحی نما'}
                            {parsedNotes.service_type === 'formwork' && 'داربست حجمی کفراژ'}
                            {parsedNotes.service_type === 'ceiling-tiered' && 'داربست زیر بتن - تیرچه'}
                            {parsedNotes.service_type === 'ceiling-slab' && 'داربست زیر بتن - دال بتنی'}
                            {parsedNotes.service_type === 'column' && 'داربست ستونی'}
                            {parsedNotes.service_type === 'کرایه اجناس داربست' && 'کرایه اجناس داربست'}
                            {!['facade', 'formwork', 'ceiling-tiered', 'ceiling-slab', 'column', 'کرایه اجناس داربست'].includes(parsedNotes.service_type) && parsedNotes.service_type}
                          </span>
                        </div>
                      )}

                      {/* جزئیات کرایه اجناس داربست - خلاصه */}
                      {parsedNotes.service_type === 'کرایه اجناس داربست' && (
                        <div className="space-y-3">
                          {parsedNotes.item_type && (
                            <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">نوع جنس</span>
                              <span className="font-semibold">{parsedNotes.item_type}</span>
                            </div>
                          )}
                          {parsedNotes.quantity && (
                            <div className="p-3 bg-primary/10 rounded-lg flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">تعداد سفارش</span>
                              <span className="font-bold text-lg">{parsedNotes.quantity.toLocaleString('fa-IR')} عدد</span>
                            </div>
                          )}
                          {parsedNotes.additional_notes && (
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">توضیحات</span>
                              <p className="text-sm leading-relaxed">{parsedNotes.additional_notes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* متراژ کل - فقط برای داربست */}
                      {parsedNotes.totalArea && parsedNotes.service_type !== 'کرایه اجناس داربست' && (
                        <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">متراژ کل داربست</span>
                          <span className="font-bold text-lg">
                            {parsedNotes.totalArea % 1 === 0 ? parsedNotes.totalArea : parsedNotes.totalArea.toFixed(2)}
                            <span className="text-sm font-normal ms-1">متر مکعب</span>
                          </span>
                        </div>
                      )}

                      {/* شرح محل نصب - خلاصه */}
                      {parsedNotes.locationPurpose && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">شرح محل نصب و فعالیت</span>
                          <p className="text-sm leading-relaxed">{parsedNotes.locationPurpose}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Toggle Button */}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full gap-2">
                      {isOrderDetailsExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          بستن جزئیات
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          دیگر جزئیات سفارش
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>

                  {/* Expanded Details */}
                  <CollapsibleContent className="space-y-6">
                    {/* بلوک کرایه اجناس داربست - جزئیات بیشتر */}
                    {parsedNotes && parsedNotes.service_type === 'کرایه اجناس داربست' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <section className="rounded-2xl border border-border bg-card/60 p-4 space-y-4">
                          <h3 className="font-semibold mb-1">مشخصات کرایه</h3>
                          
                          {parsedNotes.item_type && (
                            <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">نوع جنس</span>
                              <span className="font-semibold text-base">{parsedNotes.item_type}</span>
                            </div>
                          )}
                          
                          {parsedNotes.item_sub_type && (
                            <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">زیرمجموعه</span>
                              <span className="font-semibold text-base">{parsedNotes.item_sub_type}</span>
                            </div>
                          )}
                          
                          {parsedNotes.quantity && (
                            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">تعداد سفارش</span>
                              <span className="font-bold text-lg">{parsedNotes.quantity.toLocaleString('fa-IR')} عدد</span>
                            </div>
                          )}
                          
                          {parsedNotes.additional_notes && (
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <span className="text-xs text-muted-foreground block mb-1">توضیحات اضافی</span>
                              <p className="text-sm leading-relaxed">{parsedNotes.additional_notes}</p>
                            </div>
                          )}
                        </section>
                      </div>
                    )}

                    {/* بلوک ۱: مشخصات فنی داربست - فقط برای داربست معمولی */}
                    {parsedNotes && parsedNotes.service_type !== 'کرایه اجناس داربست' && (
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
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          )}

          {/* Repair and Collection Request Buttons - Outside the collapsible order details card */}
          {(parsedNotes || order.payment_amount || notesParseError) && (
            <>
                {/* دکمه درخواست تعمیر - فقط برای سفارش‌های تایید شده خدمات اجرای داربست به همراه اجناس */}
                {order.subcategory?.code === '10' && 
                 ['approved', 'in_progress', 'completed', 'paid', 'closed'].includes(order.status) && (
                  <section className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
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
                  </section>
                )}

                {/* دکمه درخواست جمع‌آوری - فقط برای سفارش‌های اجرا شده خدمات اجرای داربست به همراه اجناس */}
                {order.subcategory?.code === '10' && 
                 ['completed', 'paid'].includes(order.status) && (
                  <section className="rounded-2xl border-2 border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                          <p className="font-medium text-teal-900 dark:text-teal-100 mb-1">
                            درخواست جمع‌آوری داربست
                          </p>
                          <p className="text-sm text-teal-700 dark:text-teal-300">
                            برای اعلام تاریخ جمع‌آوری داربست و هماهنگی با تیم اجرایی، درخواست خود را ثبت کنید.
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowCollectionDialog(true)}
                        className="gap-2 bg-teal-600 hover:bg-teal-700 text-white whitespace-nowrap"
                      >
                        <Calendar className="h-4 w-4" />
                        درخواست جمع‌آوری
                      </Button>
                    </div>
                  </section>
                )}

                {/* بلوک ۳: قیمت و جدول زمان‌بندی */}
                {((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price) || order.payment_amount || approvedRepairCost > 0) && (
                  <Collapsible open={isPriceDetailsExpanded} onOpenChange={setIsPriceDetailsExpanded}>
                    <section className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-4">
                      {/* Summary View */}
                      <div className="flex flex-wrap items-center gap-3 justify-between">
                        <h3 className="font-semibold">هزینه قرارداد</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                            {(approvedRepairCost > 0 
                              ? (((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price) || order.payment_amount || 0) + approvedRepairCost)
                              : ((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price) || order.payment_amount || 0)
                            )?.toLocaleString('fa-IR')} تومان
                          </span>
                          {order.payment_confirmed_at ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 gap-1">
                              <CheckCircle className="h-3 w-3" />
                              پرداخت شده
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" />
                              پرداخت نشده
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Collapsible Price Details */}
                      <CollapsibleContent className="space-y-4">
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

                        {/* نمایش هزینه تعمیر تایید شده */}
                        {approvedRepairCost > 0 && (
                          <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                              <div className="flex items-center gap-2">
                                <Edit className="h-4 w-4 text-amber-600" />
                                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">هزینه تعمیر</span>
                              </div>
                              <span className="font-bold text-amber-700 dark:text-amber-300">
                                {approvedRepairCost.toLocaleString('fa-IR')} تومان
                              </span>
                            </div>
                          </div>
                        )}
                      </CollapsibleContent>

                      {/* Toggle Button */}
                      {parsedNotes?.price_breakdown && parsedNotes.price_breakdown.length > 0 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full gap-2">
                            {isPriceDetailsExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                بستن جزئیات
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                جزئیات محاسبه قیمت
                              </>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      )}

                      {notesParseError && (
                        <p className="text-xs text-muted-foreground">
                          جزئیات فنی این سفارش در دسترس نیست.
                        </p>
                      )}

                    {/* دکمه پرداخت - فقط بعد از تایید سفارش و برای درخواست کارشناسی فقط بعد از تایید قیمت توسط مشتری */}
                    {['approved', 'completed', 'in_progress', 'pending_execution'].includes(order.status) && 
                     ((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price) || order.payment_amount || approvedRepairCost > 0) && 
                     !order.payment_confirmed_at &&
                     (!isExpertPricingRequest || customerHasConfirmedPrice) && (
                      <div className="pt-4 border-t border-emerald-200 dark:border-emerald-800">
                        <Button 
                          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          size="lg"
                          onClick={async () => {
                            const baseAmount = order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price || 0;
                            const paymentAmount = baseAmount + approvedRepairCost;
                            if (!paymentAmount || paymentAmount <= 0) {
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
                                  description: `پرداخت سفارش ${order.code}${approvedRepairCost > 0 ? ' (شامل هزینه تعمیر)' : ''}`
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
                          پرداخت آنلاین - {(((parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || parsedNotes?.total_price) || order.payment_amount || 0) + approvedRepairCost).toLocaleString('fa-IR')} تومان
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
                  </Collapsible>
                )}

                {/* بلوک تاریخ‌های مهم - کادر جداگانه */}
                {(parsedNotes?.installDate || parsedNotes?.dueDate || parsedNotes?.installationDateTime || parsedNotes?.rental_start_date || parsedNotes?.rental_end_date) && (
                  <section className="rounded-2xl border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      تاریخ‌های مهم سفارش
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* تاریخ‌های داربست */}
                      {parsedNotes.installDate && (
                        <div className="p-4 bg-white dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
                          <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ نصب پیشنهادی</span>
                          <span className="font-bold text-base text-foreground">
                            {parsedNotes.installDate.includes('T') || parsedNotes.installDate.includes('-')
                              ? formatPersianDateTime(parsedNotes.installDate)
                              : parsedNotes.installDate}
                          </span>
                        </div>
                      )}
                      {parsedNotes.installationDateTime && (
                        <div className="p-4 bg-white dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
                          <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">زمان نصب درخواستی</span>
                          <span className="font-bold text-base text-foreground">
                            {parsedNotes.installationDateTime.includes('T') || parsedNotes.installationDateTime.includes('-')
                              ? formatPersianDateTime(parsedNotes.installationDateTime)
                              : parsedNotes.installationDateTime}
                          </span>
                        </div>
                      )}
                      {parsedNotes.dueDate && (
                        <div className="p-4 bg-white dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
                          <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">سررسید قرارداد</span>
                          <span className="font-bold text-base text-foreground">
                            {parsedNotes.dueDate.includes('T') || parsedNotes.dueDate.includes('-')
                              ? formatPersianDate(parsedNotes.dueDate)
                              : parsedNotes.dueDate}
                          </span>
                        </div>
                      )}
                      {/* تاریخ‌های کرایه */}
                      {parsedNotes.rental_start_date && (
                        <div className="p-4 bg-white dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
                          <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ شروع اجاره</span>
                          <span className="font-bold text-base text-foreground">
                            {formatPersianDate(parsedNotes.rental_start_date)}
                          </span>
                        </div>
                      )}
                      {parsedNotes.rental_end_date && (
                        <div className="p-4 bg-white dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
                          <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ پایان اجاره</span>
                          <span className="font-bold text-base text-foreground">
                            {formatPersianDate(parsedNotes.rental_end_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                )}
            </>
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
                    <p className="font-medium text-destructive mb-1">
                      {order.rejection_reason === 'لغو شده توسط کاربر' ? 'سفارش لغو شده' : 'سفارش رد شده'}
                    </p>
                    <p className="text-sm text-destructive/80">
                      دلیل: {order.rejection_reason}
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
                {/* امکان آپلود عکس برای همه سفارشات - برای مشتری و مدیر */}
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
                  <p className="text-sm mt-2">برای افزودن، روی دکمه بالا کلیک کنید</p>
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
                        
                        {/* دکمه حذف - فقط برای سفارش‌های تایید نشده توسط مدیر */}
                        {(!order.approved_at) && (
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

          {/* زنجیره مالکیت سفارش */}
          <OrderOwnershipChain
            orderId={order.id}
            currentOwnerId={order.customer_id}
            ownerName={order.customer_name || ''}
            ownerPhone={order.customer_phone || ''}
            transferredFromUserId={order.transferred_from_user_id}
            transferredFromPhone={order.transferred_from_phone}
            executedBy={order.executed_by}
            approvedBy={order.approved_by}
          />

          {/* لیست همکاران سفارش */}
          <OrderCollaboratorsList 
            orderId={order.id} 
            isOwner={true} 
            ownerName={order.customer_name || ''} 
            ownerPhone={order.customer_phone || ''} 
          />

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

          {/* Collection Request Dialog */}
          <CollectionRequestDialog
            open={showCollectionDialog}
            onOpenChange={setShowCollectionDialog}
            orderId={order.id}
            orderCode={order.code}
            customerId={(order as any).customer_id || ''}
          />

          {/* Add Collaborator Dialog */}
          <AddCollaborator
            orderId={order.id}
            orderCode={order.code}
            open={showCollaboratorDialog}
            onOpenChange={setShowCollaboratorDialog}
            onCollaboratorAdded={fetchOrderDetails}
            ownerName={order.customer_name || ''}
            ownerPhone={order.customer_phone || ''}
          />

          {/* Cancel Order Dialog */}
          <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>لغو سفارش</AlertDialogTitle>
                <AlertDialogDescription>
                  آیا مطمئن هستید که می‌خواهید این سفارش را لغو کنید؟ این عملیات قابل بازگشت نیست.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isCancelling}>انصراف</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleCancelOrder();
                  }}
                  disabled={isCancelling}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isCancelling ? 'در حال لغو...' : 'تایید لغو سفارش'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      </div>
    </MainLayout>
  );
}
