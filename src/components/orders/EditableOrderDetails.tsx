import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ImageIcon, ChevronLeft, ChevronRight, Ruler, FileText, Layers, User, Phone, MapPin, 
  Calendar, Banknote, Edit, Save, X, Upload, Trash2, Loader2, Printer, Wrench, Truck, Home
} from 'lucide-react';
import { ManagerOrderInvoice } from './ManagerOrderInvoice';
import { formatPersianDate, formatPersianDateTime } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { parseOrderNotes } from './OrderDetailsView';
import VoiceCall from './VoiceCall';
import CallHistory from '@/components/calls/CallHistory';
import OrderChat from './OrderChat';
import { RepairRequestDialog } from './RepairRequestDialog';
import { CollectionRequestDialog } from './CollectionRequestDialog';
import StaticLocationMap from '@/components/locations/StaticLocationMap';
import { OrderCollaboratorsList } from './OrderCollaboratorsList';
import { OrderTimeline } from './OrderTimeline';
import { ManagerOwnershipChain } from './ManagerOwnershipChain';
import { CustomerOwnershipChain } from './CustomerOwnershipChain';

const scaffoldingTypeLabels: Record<string, string> = {
  facade: 'داربست سطحی نما',
  formwork: 'داربست حجمی کفراژ',
  ceiling: 'داربست زیربتن سقف',
  column: 'داربست ستونی',
  pipe_length: 'داربست به طول لوله مصرفی'
};

const ceilingSubtypeLabels: Record<string, string> = {
  yonolit: 'تیرچه یونولیت',
  ceramic: 'تیرچه سفال',
  slab: 'دال و وافل'
};

// Manager Media Gallery with upload and delete
const ManagerMediaGallery = ({ orderId, onMediaChange }: { orderId: string; onMediaChange?: () => void }) => {
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string; mime_type?: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('project_media')
        .select('id, file_path, file_type, mime_type')
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

  useEffect(() => {
    fetchMedia();
  }, [orderId]);

  // For public bucket, use public URL directly (bucket: project-media)
  const getMediaUrl = (mediaItem: { file_path: string }) => {
    const { data } = supabase.storage.from('project-media').getPublicUrl(mediaItem.file_path);
    return data.publicUrl;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Not authenticated');

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${orderId}/${fileName}`;

        // Upload to storage (bucket: project-media)
        const { error: uploadError } = await supabase.storage
          .from('project-media')
          .upload(filePath, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        // Insert media record
        const fileType = file.type.startsWith('video/') ? 'video' : 'image';
        const { error: insertError } = await supabase
          .from('project_media')
          .insert({
            project_id: orderId,
            user_id: auth.user.id,
            file_path: filePath,
            file_type: fileType,
            mime_type: file.type,
            file_size: file.size
          });

        if (insertError) throw insertError;
      }

      toast({ title: 'موفق', description: 'فایل‌ها با موفقیت آپلود شدند' });
      fetchMedia();
      onMediaChange?.();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'خطا در آپلود فایل' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (mediaId: string, filePath: string) => {
    try {
      // Delete from storage (bucket: project-media)
      await supabase.storage.from('project-media').remove([filePath]);
      
      // Delete record
      const { error } = await supabase
        .from('project_media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;

      toast({ title: 'موفق', description: 'فایل حذف شد' });
      fetchMedia();
      setCurrentIndex(0);
      onMediaChange?.();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ variant: 'destructive', title: 'خطا', description: 'خطا در حذف فایل' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentMedia = media[currentIndex];
  // چک کردن نوع ویدیو با بررسی file_type، mime_type و file_path
  const isVideo = currentMedia?.file_type === 'video' || 
                  currentMedia?.file_type?.includes('video') || 
                  currentMedia?.mime_type?.includes('video') ||
                  currentMedia?.file_path?.toLowerCase().endsWith('.mp4') ||
                  currentMedia?.file_path?.toLowerCase().endsWith('.webm') ||
                  currentMedia?.file_path?.toLowerCase().endsWith('.mov');

  // تعیین MIME type برای ویدیو
  const getVideoMimeType = () => {
    if (currentMedia?.mime_type) return currentMedia.mime_type;
    const path = currentMedia?.file_path?.toLowerCase() || '';
    if (path.endsWith('.webm')) return 'video/webm';
    if (path.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          تصاویر و فایل‌ها ({media.length})
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            id={`media-upload-${orderId}`}
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => document.getElementById(`media-upload-${orderId}`)?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="mr-1">افزودن</span>
          </Button>
        </div>
      </div>

      {media.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm p-6 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/20">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          هنوز تصویری ثبت نشده است
        </div>
      ) : (
        <div className="relative bg-muted/30 rounded-lg overflow-hidden border">
          <div className="aspect-video flex items-center justify-center bg-black/5 min-h-[200px]">
            {isVideo ? (
              <video
                key={currentMedia?.id}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full max-h-[400px] object-contain"
              >
                <source src={getMediaUrl(currentMedia)} type={getVideoMimeType()} />
                مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند
              </video>
            ) : (
              <img
                src={getMediaUrl(currentMedia)}
                alt={`تصویر ${currentIndex + 1}`}
                className="w-full h-full max-h-[400px] object-contain"
                onError={(e) => {
                  console.error('Image load error:', currentMedia.file_path);
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            )}
          </div>
          
          {/* Delete button */}
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-3 left-3 h-9 w-9 shadow-lg"
            onClick={() => handleDelete(currentMedia.id, currentMedia.file_path)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Navigation controls */}
          {media.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 bg-background/90 hover:bg-background shadow-lg"
                  onClick={() => setCurrentIndex(i => (i + 1) % media.length)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <div className="bg-background/90 px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                  {currentIndex + 1} از {media.length}
                </div>
                
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 bg-background/90 hover:bg-background shadow-lg"
                  onClick={() => setCurrentIndex(i => (i - 1 + media.length) % media.length)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
          
          {/* Image counter badge */}
          {media.length === 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/90 px-4 py-2 rounded-full text-sm font-medium shadow-lg">
              تصویر ۱
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface EditableOrderDetailsProps {
  order: {
    id: string;
    code: string;
    status?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_id?: string;
    address?: string;
    detailed_address?: string | null;
    created_at?: string;
    notes?: any;
    payment_amount?: number | null;
    location_lat?: number | null;
    location_lng?: number | null;
    executed_by?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    execution_start_date?: string | null;
    execution_end_date?: string | null;
    execution_stage?: string | null;
    execution_stage_updated_at?: string | null;
    customer_completion_date?: string | null;
    rejection_reason?: string | null;
    subcategory_id?: string | null;
    subcategory?: { code?: string; name?: string } | null;
    transferred_from_user_id?: string | null;
    transferred_from_phone?: string | null;
  };
  onUpdate?: () => void;
}

export const EditableOrderDetails = ({ order, onUpdate }: EditableOrderDetailsProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [approvedRepairCost, setApprovedRepairCost] = useState(0);
  const [orderApprovals, setOrderApprovals] = useState<Array<{ approver_role: string; approved_at: string | null; approver_user_id: string | null }>>([]);
  const [approvedCollectionDate, setApprovedCollectionDate] = useState<string | null>(null);
  const { toast } = useToast();
  
  const parsedNotes = typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);

  // Fetch approved/completed repair costs, approvals, and collection date
  useEffect(() => {
    const fetchData = async () => {
      // Fetch repair costs
      const { data: repairData } = await supabase
        .from('repair_requests')
        .select('final_cost, status')
        .eq('order_id', order.id)
        .in('status', ['approved', 'completed']);

      if (repairData) {
        const totalRepairCost = repairData.reduce((sum, r) => sum + (r.final_cost || 0), 0);
        setApprovedRepairCost(totalRepairCost);
      }

      // Fetch order approvals
      const { data: approvalsData } = await supabase
        .from('order_approvals')
        .select('approver_role, approved_at, approver_user_id')
        .eq('order_id', order.id);

      if (approvalsData) {
        setOrderApprovals(approvalsData);
      }

      // Fetch approved collection request date
      const { data: collectionData } = await supabase
        .from('collection_requests')
        .select('requested_date, status')
        .eq('order_id', order.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (collectionData?.requested_date) {
        setApprovedCollectionDate(collectionData.requested_date);
      } else {
        setApprovedCollectionDate(null);
      }
    };
    fetchData();
  }, [order.id]);
  
  // Editable fields
  const [address, setAddress] = useState(order.address || '');
  const [detailedAddress, setDetailedAddress] = useState(order.detailed_address || '');
  const [customerName, setCustomerName] = useState(order.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone || '');
  const [paymentAmount, setPaymentAmount] = useState(order.payment_amount?.toString() || '');
  const [description, setDescription] = useState(
    parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || ''
  );
  const [scaffoldingType, setScaffoldingType] = useState(
    parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type || ''
  );

  // Track if price has been modified since last save (for save button state)
  const [savedPaymentAmount, setSavedPaymentAmount] = useState(order.payment_amount?.toString() || '');
  const isPriceChanged = paymentAmount !== savedPaymentAmount;

  // Check if this is an expert pricing request
  const isExpertPricingRequest = parsedNotes?.is_expert_pricing_request === true;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build updated notes
      const updatedNotes = {
        ...parsedNotes,
        description,
        service_type: scaffoldingType
      };

      // If manager is setting price on expert pricing request, mark it
      if (isExpertPricingRequest && paymentAmount && parseFloat(paymentAmount) > 0) {
        updatedNotes.price_set_by_manager = true;
        updatedNotes.manager_set_price = parseFloat(paymentAmount);
      }

      const { error } = await supabase
        .from('projects_v3')
        .update({
          address,
          detailed_address: detailedAddress,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          notes: updatedNotes
        })
        .eq('id', order.id);

      if (error) throw error;

      // بعد از ذخیره موفق، مقدار ذخیره شده قیمت را آپدیت کن تا دکمه غیرفعال شود
      setSavedPaymentAmount(paymentAmount);

      toast({ title: 'موفق', description: 'اطلاعات سفارش به‌روزرسانی شد' });
      setIsEditing(false);
      onUpdate?.();
    } catch (err: any) {
      console.error('Update error:', err);
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'خطا در ذخیره تغییرات' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setAddress(order.address || '');
    setDetailedAddress(order.detailed_address || '');
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setPaymentAmount(order.payment_amount?.toString() || '');
    setDescription(parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || '');
    setScaffoldingType(parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type || '');
    setIsEditing(false);
  };

  // Display values from notes
  const dimensions = parsedNotes?.dimensions;
  const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area;
  const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;
  const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;

  return (
    <div className="space-y-4">
      {/* Expert Pricing Request Badge with Price Input */}
      {isExpertPricingRequest && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full">
              <Banknote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-amber-800 dark:text-amber-200">درخواست قیمت‌گذاری کارشناسی</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {parsedNotes?.price_set_by_manager 
                  ? parsedNotes?.customer_price_confirmed 
                    ? '✓ قیمت توسط مشتری تایید شده است'
                    : '⏳ قیمت تعیین شده - در انتظار تایید مشتری'
                  : 'لطفاً قیمت را تعیین کنید تا برای تایید به مشتری نمایش داده شود'
                }
              </p>
            </div>
          </div>
          
          {/* Prominent Price Input for Expert Pricing */}
          <div className="bg-white dark:bg-amber-900/50 rounded-lg p-4 border border-amber-200 dark:border-amber-600">
            <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">
              تعیین قیمت (تومان)
            </Label>
            <div className="flex gap-2">
              <Input 
                type="number"
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="مبلغ را به تومان وارد کنید"
                className="flex-1 text-lg font-bold"
                dir="ltr"
              />
              <Button 
                onClick={handleSave} 
                disabled={saving || !paymentAmount || !isPriceChanged}
                title={!isPriceChanged ? 'قیمت ذخیره شده است' : 'ذخیره قیمت'}
                className={`bg-amber-600 hover:bg-amber-700 text-white px-6 ${
                  !isPriceChanged ? 'opacity-50 cursor-not-allowed hover:bg-amber-600' : ''
                }`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                {!isPriceChanged ? 'ذخیره شده ✓' : 'ذخیره قیمت'}
              </Button>
            </div>
          </div>

          {/* Price Status Card */}
          {paymentAmount && Number(paymentAmount) > 0 ? (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
              <p className="text-sm font-bold text-green-700 dark:text-green-400 text-center">
                قیمت تعیین شده: {Number(paymentAmount).toLocaleString('fa-IR')} تومان
              </p>
            </div>
          ) : (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 rounded-lg p-3">
              <p className="text-sm font-bold text-orange-700 dark:text-orange-400 text-center">
                در انتظار تعیین قیمت توسط مدیر
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Toggle Button & Print */}
      <div className="flex justify-end gap-2">
        <ManagerOrderInvoice order={order} />
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 ml-1" />
            ویرایش سفارش
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />}
              ذخیره
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 ml-1" />
              انصراف
            </Button>
          </div>
        )}
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">نام مشتری</Label>
            {isEditing ? (
              <Input 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1"
              />
            ) : (
              <p className="font-medium">{order.customer_name || 'نامشخص'}</p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">شماره تماس</Label>
            {isEditing ? (
              <Input 
                value={customerPhone} 
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1"
                dir="ltr"
              />
            ) : (
              <p className="font-medium" dir="ltr">{order.customer_phone || '-'}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Address */}
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">آدرس</Label>
          {isEditing ? (
            <div className="space-y-2 mt-1">
              <Input 
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                placeholder="آدرس اصلی"
              />
              <Textarea 
                value={detailedAddress} 
                onChange={(e) => setDetailedAddress(e.target.value)}
                placeholder="جزئیات آدرس"
                rows={2}
              />
            </div>
          ) : (
            <>
              <p className="font-medium">{order.address || '-'}</p>
              {order.detailed_address && (
                <p className="text-sm text-muted-foreground">{order.detailed_address}</p>
              )}
            </>
          )}
        </div>
      </div>

      {order.created_at && (
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <Label className="text-xs text-muted-foreground">تاریخ ثبت</Label>
            <p className="font-medium">{formatPersianDate(order.created_at, { showDayOfWeek: true })}</p>
          </div>
        </div>
      )}

      <Separator />

      {/* Technical Details */}
      <div className="bg-muted/50 p-4 rounded-lg space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-semibold">مشخصات فنی</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">نوع داربست</Label>
            {isEditing ? (
              <Select value={scaffoldingType} onValueChange={setScaffoldingType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="انتخاب نوع" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(scaffoldingTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="font-medium">{scaffoldingTypeLabels[scaffoldingType] || scaffoldingType || '-'}</p>
            )}
          </div>
          
          {ceilingSubtype && (
            <div>
              <Label className="text-xs text-muted-foreground">زیرنوع</Label>
              <p className="font-medium">{ceilingSubtypeLabels[ceilingSubtype] || ceilingSubtype}</p>
            </div>
          )}
        </div>

        {/* Dimensions (read-only for now) */}
        {dimensions && Array.isArray(dimensions) && dimensions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">ابعاد</Label>
            </div>
            <div className="grid gap-2">
              {dimensions.map((dim: any, idx: number) => (
                <div key={idx} className="bg-background p-2 rounded border text-sm">
                  طول: {dim.length || dim.l || '-'} × عرض: {dim.width || dim.w || '-'} × ارتفاع: {dim.height || dim.h || '-'} متر
                  {dim.unitCount && <span className="text-muted-foreground"> ({dim.unitCount} یونیت)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {dimensions && !Array.isArray(dimensions) && (
          <div className="bg-background p-2 rounded border text-sm">
            <Ruler className="h-4 w-4 inline mr-1 text-muted-foreground" />
            طول: {dimensions.length || '-'} × عرض: {dimensions.width || '-'} × ارتفاع: {dimensions.height || '-'} متر
          </div>
        )}

        {totalArea && (
          <div>
            <Label className="text-xs text-muted-foreground">مساحت کل</Label>
            <p className="font-medium">{totalArea} متر مربع</p>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">شرح محل نصب و نوع فعالیت</Label>
        </div>
        {isEditing ? (
          <Textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="شرح توضیحات..."
          />
        ) : (
          description && <p className="text-sm bg-muted/50 p-3 rounded-lg">{description}</p>
        )}
      </div>

      {/* Conditions - Detailed */}
      {parsedNotes?.conditions && (
        <div className="bg-muted/30 p-4 rounded-lg space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            شرایط اجرا و محل پروژه
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {parsedNotes.conditions.rentalMonthsPlan && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">پلان اجاره</span>
                <span className="font-medium text-sm">
                  {parsedNotes.conditions.rentalMonthsPlan === '1' && 'به شرط یک ماه'}
                  {parsedNotes.conditions.rentalMonthsPlan === '2' && 'به شرط دو ماه'}
                  {parsedNotes.conditions.rentalMonthsPlan === '3+' && 'به شرط سه ماه و بیشتر'}
                </span>
              </div>
            )}
            {parsedNotes.conditions.totalMonths && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">مدت قرارداد</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.totalMonths} ماه</span>
              </div>
            )}
            {parsedNotes.conditions.distanceRange && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">فاصله از قم</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.distanceRange} کیلومتر</span>
              </div>
            )}
            {parsedNotes.onGround !== undefined && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">محل نصب داربست</span>
                <span className="font-medium text-sm flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  {parsedNotes.onGround ? 'روی زمین' : 'روی سکو / پشت‌بام / بالکن'}
                </span>
              </div>
            )}
            {!parsedNotes.onGround && parsedNotes.conditions?.platformHeight && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">ارتفاع پای کار</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.platformHeight} متر</span>
              </div>
            )}
            {parsedNotes.vehicleReachesSite !== undefined && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">دسترسی خودرو</span>
                <span className="font-medium text-sm flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {parsedNotes.vehicleReachesSite ? 'خودرو به محل می‌رسد' : 'خودرو به محل نمی‌رسد'}
                </span>
              </div>
            )}
            {!parsedNotes.vehicleReachesSite && parsedNotes.conditions?.vehicleDistance && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">فاصله خودرو تا محل</span>
                <span className="font-medium text-sm">{parsedNotes.conditions.vehicleDistance} متر</span>
              </div>
            )}
            {parsedNotes.isFacadeWidth2m !== undefined && (
              <div className="p-3 bg-background rounded-lg border">
                <span className="text-xs text-muted-foreground block mb-1">عرض داربست نما</span>
                <span className="font-medium text-sm">{parsedNotes.isFacadeWidth2m ? '2 متر' : '1 متر'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location Purpose */}
      {parsedNotes?.locationPurpose && (
        <div className="bg-muted/30 p-4 rounded-lg">
          <Label className="text-xs text-muted-foreground mb-2 block">شرح محل نصب و فعالیت</Label>
          <p className="text-sm leading-relaxed">{parsedNotes.locationPurpose}</p>
        </div>
      )}

      {/* Important Dates */}
      {(parsedNotes?.installDate || parsedNotes?.dueDate || parsedNotes?.installationDateTime || order.execution_start_date) && (
        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Calendar className="h-4 w-4" />
            تاریخ‌های مهم سفارش
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {parsedNotes?.installDate && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ نصب پیشنهادی</span>
                <span className="font-bold text-sm">
                  {parsedNotes.installDate.includes('T') || parsedNotes.installDate.includes('-')
                    ? formatPersianDateTime(parsedNotes.installDate)
                    : parsedNotes.installDate}
                </span>
              </div>
            )}
            {parsedNotes?.installationDateTime && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">زمان نصب درخواستی</span>
                <span className="font-bold text-sm">
                  {parsedNotes.installationDateTime.includes('T') || parsedNotes.installationDateTime.includes('-')
                    ? formatPersianDateTime(parsedNotes.installationDateTime)
                    : parsedNotes.installationDateTime}
                </span>
              </div>
            )}
            {parsedNotes?.dueDate && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">سررسید قرارداد</span>
                <span className="font-bold text-sm">
                  {parsedNotes.dueDate.includes('T') || parsedNotes.dueDate.includes('-')
                    ? formatPersianDate(parsedNotes.dueDate)
                    : parsedNotes.dueDate}
                </span>
              </div>
            )}
            {order.execution_start_date && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ شروع اجرا</span>
                <span className="font-bold text-sm">{formatPersianDate(order.execution_start_date)}</span>
              </div>
            )}
            {order.execution_end_date && (
              <div className="p-3 bg-white dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs text-blue-600 dark:text-blue-400 block mb-1">تاریخ پایان اجرا</span>
                <span className="font-bold text-sm">{formatPersianDate(order.execution_end_date)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Price - Only show for non-expert pricing requests, as expert pricing has input at top */}
      {!isExpertPricingRequest && (
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-4 w-4 text-green-600" />
            <Label className="text-sm font-medium">مبلغ سفارش</Label>
          </div>
          
          {isEditing ? (
            <Input 
              type="number"
              value={paymentAmount} 
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="مبلغ به تومان"
              className="mt-1"
            />
          ) : (
            <>
              {(order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice) && (
                <>
                  <p className="font-bold text-xl text-green-700 dark:text-green-300">
                    {Number(
                      (order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || 0) + approvedRepairCost
                    ).toLocaleString('fa-IR')} تومان
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>هزینه قرارداد:</span>
                      <span>{Number(order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice).toLocaleString('fa-IR')} تومان</span>
                    </div>
                    {approvedRepairCost > 0 && (
                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          هزینه تعمیر:
                        </span>
                        <span>{approvedRepairCost.toLocaleString('fa-IR')} تومان</span>
                      </div>
                    )}
                  </div>
                </>
              )}
              {parsedNotes?.price_breakdown && parsedNotes.price_breakdown.length > 0 && (
                <div className="mt-3 space-y-1">
                  <Label className="text-xs text-muted-foreground">جزئیات محاسبه قیمت</Label>
                  {parsedNotes.price_breakdown.map((item: string, idx: number) => (
                    <div key={idx} className="text-xs text-muted-foreground p-2 bg-background rounded border">{item}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Separator />

      {/* Map Location */}
      {order.location_lat && order.location_lng && (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            موقعیت پروژه بر روی نقشه
          </Label>
          <div className="h-[300px] rounded-lg overflow-hidden border-2 border-border">
            <StaticLocationMap
              lat={order.location_lat}
              lng={order.location_lng}
              address={order.address}
              detailedAddress={order.detailed_address}
            />
          </div>
        </div>
      )}

      <Separator />

      {/* مراحل پیشرفت سفارش */}
      <OrderTimeline
        orderStatus={order.status || 'pending'}
        createdAt={order.created_at || new Date().toISOString()}
        approvedAt={order.approved_at || undefined}
        executionStartDate={order.execution_start_date || undefined}
        executionEndDate={order.execution_end_date || undefined}
        customerCompletionDate={order.customer_completion_date || undefined}
        rejectionReason={order.rejection_reason || undefined}
        executionStage={order.execution_stage}
        executionStageUpdatedAt={order.execution_stage_updated_at}
        approvedCollectionDate={approvedCollectionDate}
        approvals={orderApprovals}
      />

      {/* زنجیره انتقال و همکاری بین مدیران */}
      <ManagerOwnershipChain
        orderId={order.id}
        executedBy={order.executed_by || undefined}
        approvedBy={order.approved_by || undefined}
      />

      {/* زنجیره مالکیت و همکاری مشتریان */}
      <CustomerOwnershipChain
        orderId={order.id}
        currentOwnerId={order.customer_id || ''}
        ownerName={order.customer_name}
        ownerPhone={order.customer_phone}
        transferredFromUserId={order.transferred_from_user_id || undefined}
        transferredFromPhone={order.transferred_from_phone || undefined}
      />

      {/* لیست همکاران سفارش - قابل مشاهده برای مدیران */}
      <OrderCollaboratorsList orderId={order.id} showForManagers={true} />

      {/* Media Gallery with upload/delete for managers */}
      <ManagerMediaGallery orderId={order.id} onMediaChange={onUpdate} />

      {/* Voice Call for managers to call customers */}
      <VoiceCall 
        orderId={order.id}
        managerId={order.executed_by || order.approved_by}
        customerId={order.customer_id}
        isManager={true}
      />

      {/* Call History */}
      <CallHistory orderId={order.id} />

      {/* Chat with customer */}
      <Separator />
      <OrderChat orderId={order.id} orderStatus={order.status || 'pending'} />

      {/* Repair & Collection Requests Section for Managers */}
      <Separator />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => setRepairDialogOpen(true)}
        >
          <Wrench className="h-4 w-4" />
          نیاز به تعمیر داربست
        </Button>
        {['completed', 'paid'].includes(order.status || '') && (
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setCollectionDialogOpen(true)}
          >
            <Calendar className="h-4 w-4" />
            درخواست جمع‌آوری
          </Button>
        )}
      </div>

      {/* Repair Request Dialog - Manager Mode */}
      <RepairRequestDialog
        open={repairDialogOpen}
        onOpenChange={setRepairDialogOpen}
        orderId={order.id}
        orderCode={order.code}
        customerId={order.customer_id || ''}
        isManager={true}
        onRepairCostChange={onUpdate}
      />

      {/* Collection Request Dialog */}
      <CollectionRequestDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        orderId={order.id}
        orderCode={order.code}
        customerId={order.customer_id || ''}
      />
    </div>
  );
};

export default EditableOrderDetails;
