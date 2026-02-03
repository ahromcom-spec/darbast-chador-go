import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ImageIcon, ChevronLeft, ChevronRight, Ruler, FileText, Layers, User, Phone, MapPin, Calendar, Banknote, Upload, Trash2, Loader2, X, Film } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import { CentralizedVideoPlayer } from '@/components/media/CentralizedVideoPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useImageModeration } from '@/hooks/useImageModeration';
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

// Helper to parse order notes safely (handles double-stringified JSON)
export const parseOrderNotes = (notes: string | null | undefined): any => {
  if (!notes) return null;
  try {
    let parsed = notes;
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
};

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

interface OrderMediaGalleryProps {
  orderId: string;
  allowEdit?: boolean; // Allow customer to add/delete media
}

// Media gallery component for orders with add/delete capability
export const OrderMediaGallery = ({ orderId, allowEdit = true }: OrderMediaGalleryProps) => {
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string; mime_type?: string; user_id?: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { checkImage } = useImageModeration();

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('project_media')
        .select('id, file_path, file_type, mime_type, user_id')
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

  useEffect(() => {
    const fetchUrls = async () => {
      const urls: Record<string, string> = {};
      for (const item of media) {
        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('project-media')
            .createSignedUrl(item.file_path, 3600);
          
          if (signedData?.signedUrl && !signedError) {
            urls[item.id] = signedData.signedUrl;
          } else {
            const { data } = supabase.storage.from('project-media').getPublicUrl(item.file_path);
            urls[item.id] = data.publicUrl;
          }
        } catch (err) {
          console.error('Error getting URL for', item.file_path, err);
          const { data } = supabase.storage.from('project-media').getPublicUrl(item.file_path);
          urls[item.id] = data.publicUrl;
        }
      }
      setMediaUrls(urls);
    };
    
    if (media.length > 0) {
      fetchUrls();
    }
  }, [media]);

  const getMediaUrl = (mediaItem: { id: string; file_path: string }) => {
    return mediaUrls[mediaItem.id] || '';
  };

  // Upload file handler
  const handleFileUpload = async (files: FileList, type: 'image' | 'video') => {
    if (!user) {
      toast({ title: 'خطا', description: 'لطفاً وارد حساب کاربری شوید', variant: 'destructive' });
      return;
    }

    setUploading(true);
    
    for (const file of Array.from(files)) {
      // Validate size
      const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for videos
      if (file.size > maxSize) {
        toast({ 
          title: 'خطا', 
          description: `حجم ${type === 'image' ? 'عکس' : 'فیلم'} نباید بیشتر از ${type === 'image' ? '10' : '50'} مگابایت باشد`, 
          variant: 'destructive' 
        });
        continue;
      }

      // Check image moderation
      if (type === 'image') {
        const result = await checkImage(file);
        if (!result.safe) {
          toast({ title: 'تصویر نامناسب', description: result.reason, variant: 'destructive' });
          continue;
        }
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${orderId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('project-media')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({ title: 'خطا در آپلود', description: uploadError.message, variant: 'destructive' });
          continue;
        }

        // Save to database
        const { error: dbError } = await supabase.from('project_media').insert({
          project_id: orderId,
          user_id: user.id,
          file_path: fileName,
          file_type: type,
          file_size: file.size,
          mime_type: file.type
        });

        if (dbError) {
          console.error('DB error saving media:', dbError);
          toast({ title: 'خطا در ذخیره', description: dbError.message, variant: 'destructive' });
          continue;
        }

        toast({ title: 'موفق', description: `${type === 'image' ? 'عکس' : 'فیلم'} با موفقیت اضافه شد` });
      } catch (error: any) {
        console.error('Error uploading:', error);
        toast({ title: 'خطا', description: error.message, variant: 'destructive' });
      }
    }

    setUploading(false);
    fetchMedia(); // Refresh media list
  };

  // Delete media handler
  const handleDeleteMedia = async () => {
    if (!mediaToDelete) return;
    
    setDeleting(true);
    
    try {
      const mediaItem = media.find(m => m.id === mediaToDelete);
      if (!mediaItem) throw new Error('Media not found');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-media')
        .remove([mediaItem.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue to delete from DB anyway
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_media')
        .delete()
        .eq('id', mediaToDelete);

      if (dbError) throw dbError;

      toast({ title: 'موفق', description: 'فایل با موفقیت حذف شد' });
      
      // Adjust current index if needed
      if (currentIndex >= media.length - 1 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
      
      fetchMedia(); // Refresh media list
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast({ title: 'خطا در حذف', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setMediaToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentMedia = media[currentIndex];
  const isVideo = currentMedia?.file_type === 'video' || 
                  currentMedia?.file_type?.includes('video') || 
                  currentMedia?.mime_type?.includes('video') ||
                  currentMedia?.file_path?.toLowerCase().endsWith('.mp4') ||
                  currentMedia?.file_path?.toLowerCase().endsWith('.webm') ||
                  currentMedia?.file_path?.toLowerCase().endsWith('.mov');

  return (
    <div className="space-y-3">
      {/* Header with add buttons */}
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          تصاویر و فایل‌ها ({media.length})
        </Label>
        
        {allowEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              افزودن
            </Button>
            
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm,video/mov"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const files = Array.from(e.target.files);
                  const imageFiles = files.filter(f => f.type.startsWith('image/'));
                  const videoFiles = files.filter(f => f.type.startsWith('video/'));
                  
                  if (imageFiles.length > 0) {
                    const dt = new DataTransfer();
                    imageFiles.forEach(f => dt.items.add(f));
                    handleFileUpload(dt.files, 'image');
                  }
                  if (videoFiles.length > 0) {
                    const dt = new DataTransfer();
                    videoFiles.forEach(f => dt.items.add(f));
                    handleFileUpload(dt.files, 'video');
                  }
                }
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>

      {/* Empty state */}
      {media.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm p-6 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
          <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>هنوز تصویری ثبت نشده است</p>
          {allowEdit && (
            <p className="text-xs mt-1">از دکمه افزودن بالا استفاده کنید</p>
          )}
        </div>
      ) : (
        <>
          {/* Media display */}
          <div className="relative bg-black/5 rounded-lg overflow-hidden">
            {isVideo ? (
              <CentralizedVideoPlayer
                key={currentMedia?.id}
                src={getMediaUrl(currentMedia)}
                filePath={currentMedia.file_path}
                bucket="project-media"
                className="w-full max-h-64"
                showControls={true}
              />
            ) : (
              <img
                src={getMediaUrl(currentMedia)}
                alt={`تصویر ${currentIndex + 1}`}
                className="w-full max-h-64 object-contain"
              />
            )}
            
            {/* Delete button on current media */}
            {allowEdit && currentMedia && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 left-2 h-8 w-8 opacity-80 hover:opacity-100"
                onClick={() => {
                  setMediaToDelete(currentMedia.id);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            
            {/* Navigation buttons */}
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

          {/* Thumbnails */}
          {media.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {media.map((item, idx) => {
                const itemIsVideo = item.file_type === 'video' || 
                                   item.file_type?.includes('video') || 
                                   item.mime_type?.includes('video');
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      idx === currentIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    {itemIsVideo ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Film className="h-6 w-6 text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={getMediaUrl(item)}
                        alt={`تصویر ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف فایل</AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئن هستید که می‌خواهید این فایل را حذف کنید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMedia}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface OrderDetailsViewProps {
  order: {
    id: string;
    code: string;
    customer_name?: string;
    customer_phone?: string;
    address?: string;
    detailed_address?: string | null;
    created_at?: string;
    notes?: any;
    payment_amount?: number | null;
  };
  showMedia?: boolean;
  allowMediaEdit?: boolean; // Allow customer to add/delete media
  hidePrice?: boolean; // Hide price information (for executive managers in specific modules)
}

export const OrderDetailsView = ({ order, showMedia = true, allowMediaEdit = true, hidePrice = false }: OrderDetailsViewProps) => {
  const parsedNotes = typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);
  
  const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
  const dimensions = parsedNotes?.dimensions;
  const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area || parsedNotes?.total_volume;
  const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;
  const description = parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes || parsedNotes?.locationPurpose;
  const estimatedPrice = parsedNotes?.estimated_price || parsedNotes?.price || parsedNotes?.totalPrice || order.payment_amount;
  const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;
  const installationDate = parsedNotes?.installationDateTime || parsedNotes?.installation_date;
  const dueDate = parsedNotes?.dueDateTime || parsedNotes?.due_date;
  const priceBreakdown = parsedNotes?.price_breakdown;

  return (
    <div className="space-y-4">
      {/* Customer Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <Label className="text-xs text-muted-foreground">نام مشتری</Label>
            <p className="font-medium">{order.customer_name || 'نامشخص'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <Label className="text-xs text-muted-foreground">شماره تماس</Label>
            <p className="font-medium" dir="ltr">{order.customer_phone || '-'}</p>
          </div>
        </div>
      </div>
      
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <Label className="text-xs text-muted-foreground">آدرس</Label>
          <p className="font-medium">{order.address || '-'}</p>
          {order.detailed_address && (
            <p className="text-sm text-muted-foreground">{order.detailed_address}</p>
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
      {scaffoldingType && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-semibold">مشخصات فنی</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">نوع داربست</Label>
              <p className="font-medium">{scaffoldingTypeLabels[scaffoldingType] || scaffoldingType}</p>
            </div>
            
            {ceilingSubtype && (
              <div>
                <Label className="text-xs text-muted-foreground">زیرنوع</Label>
                <p className="font-medium">{ceilingSubtypeLabels[ceilingSubtype] || ceilingSubtype}</p>
              </div>
            )}
          </div>

          {/* Dimensions */}
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

          {/* Direct dimensions (not array) */}
          {dimensions && !Array.isArray(dimensions) && (
            <div className="bg-background p-2 rounded border text-sm">
              <Ruler className="h-4 w-4 inline mr-1 text-muted-foreground" />
              طول: {dimensions.length || '-'} × عرض: {dimensions.width || '-'} × ارتفاع: {dimensions.height || '-'} متر
            </div>
          )}

          {/* Single dimension fields */}
          {!dimensions && (parsedNotes?.length || parsedNotes?.width || parsedNotes?.height) && (
            <div className="bg-background p-2 rounded border text-sm">
              <Ruler className="h-4 w-4 inline mr-1 text-muted-foreground" />
              طول: {parsedNotes.length || '-'} × عرض: {parsedNotes.width || '-'} × ارتفاع: {parsedNotes.height || '-'} متر
            </div>
          )}

          {totalArea && (
            <div>
              <Label className="text-xs text-muted-foreground">متراژ کل</Label>
              <p className="font-medium">{typeof totalArea === 'number' ? totalArea.toLocaleString('fa-IR') : totalArea} {parsedNotes?.total_volume ? 'متر مکعب' : 'متر مربع'}</p>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {description && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">شرح محل نصب و نوع فعالیت</Label>
          </div>
          <p className="text-sm bg-muted/50 p-3 rounded-lg">{description}</p>
        </div>
      )}

      {/* Conditions */}
      {conditions && Array.isArray(conditions) && conditions.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">شرایط خدمات</Label>
          <div className="flex flex-wrap gap-1">
            {conditions.map((cond: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">{cond}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dates */}
      {(installationDate || dueDate) && (
        <div className="grid grid-cols-2 gap-4">
          {installationDate && (
            <div>
              <Label className="text-xs text-muted-foreground">تاریخ نصب</Label>
              <p className="font-medium">{formatPersianDate(installationDate, { showDayOfWeek: true })}</p>
            </div>
          )}
          {dueDate && (
            <div>
              <Label className="text-xs text-muted-foreground">تاریخ سررسید</Label>
              <p className="font-medium">{formatPersianDate(dueDate, { showDayOfWeek: true })}</p>
            </div>
          )}
        </div>
      )}

      {/* Price - hidden for executive managers in scaffold with materials module */}
      {estimatedPrice && !hidePrice && (
        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="h-4 w-4 text-green-600" />
            <Label className="text-xs text-muted-foreground">مبلغ سفارش</Label>
          </div>
          <p className="font-bold text-lg text-green-700 dark:text-green-300">
            {Number(estimatedPrice).toLocaleString('fa-IR')} تومان
          </p>
          {priceBreakdown && Array.isArray(priceBreakdown) && (
            <div className="mt-2 text-xs text-muted-foreground space-y-1">
              {priceBreakdown.map((item: string, idx: number) => (
                <div key={idx}>{item}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Media Gallery */}
      {showMedia && (
        <>
          <Separator />
          <OrderMediaGallery orderId={order.id} allowEdit={allowMediaEdit} />
        </>
      )}
    </div>
  );
};
