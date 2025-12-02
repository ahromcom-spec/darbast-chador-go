import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ImageIcon, ChevronLeft, ChevronRight, Ruler, FileText, Layers, User, Phone, MapPin, Calendar, Banknote } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

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

// Media gallery component for orders
export const OrderMediaGallery = ({ orderId }: { orderId: string }) => {
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const getMediaUrl = (filePath: string) => {
    const { data } = supabase.storage.from('project-media').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const currentMedia = media[currentIndex];
  const isVideo = currentMedia?.file_type?.includes('video');

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground flex items-center gap-2">
        <ImageIcon className="h-3 w-3" />
        تصاویر و فایل‌های سفارش ({media.length})
      </Label>
      <div className="relative bg-black/5 rounded-lg overflow-hidden">
        {isVideo ? (
          <video
            src={getMediaUrl(currentMedia.file_path)}
            controls
            className="w-full max-h-64 object-contain"
          />
        ) : (
          <img
            src={getMediaUrl(currentMedia.file_path)}
            alt={`تصویر ${currentIndex + 1}`}
            className="w-full max-h-64 object-contain"
          />
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
}

export const OrderDetailsView = ({ order, showMedia = true }: OrderDetailsViewProps) => {
  const parsedNotes = typeof order.notes === 'object' ? order.notes : parseOrderNotes(order.notes);
  
  const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
  const dimensions = parsedNotes?.dimensions;
  const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area;
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
              <Label className="text-xs text-muted-foreground">مساحت کل</Label>
              <p className="font-medium">{totalArea} متر مربع</p>
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

      {/* Price */}
      {estimatedPrice && (
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
          <OrderMediaGallery orderId={order.id} />
        </>
      )}
    </div>
  );
};
