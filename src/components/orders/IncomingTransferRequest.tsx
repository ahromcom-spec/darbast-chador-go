import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeftRight, 
  CheckCircle, 
  XCircle, 
  User, 
  Hash, 
  MapPin, 
  Calendar, 
  Ruler,
  DollarSign,
  FileText,
  Layers,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Map,
  X,
  Eye
} from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StaticLocationMap from '@/components/locations/StaticLocationMap';

interface TransferRequest {
  id: string;
  order_id: string;
  from_user_id: string;
  to_user_id: string | null;
  to_phone_number: string;
  status: string;
  created_at: string;
  from_full_name: string | null;
  from_phone_number: string | null;
  order_code: string | null;
  order_status: string | null;
  order_address: string | null;
  order_detailed_address: string | null;
  order_notes: string | null;
  order_subcategory_id: string | null;
  subcategory_name: string | null;
  service_type_name: string | null;
  province_id: string | null;
  district_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  payment_amount: number | null;
  execution_stage: string | null;
}

interface ParsedNotes {
  length?: number;
  width?: number;
  height?: number;
  totalArea?: number;
  estimated_price?: number;
  estimatedPrice?: number;
  installationDate?: string;
  installationDateTime?: string;
  installation_date?: string;
  dueDate?: string;
  dueDateTime?: string;
  due_date?: string;
  additional_notes?: string;
  description?: string;
  activityDescription?: string;
  service_type?: string;
  scaffold_type?: string;
  dimensions?: Array<{ length?: number; width?: number; height?: number }>;
  conditions?: string[];
  customerName?: string;
  phoneNumber?: string;
  distanceRange?: string;
  [key: string]: any;
}

// Media Gallery component for transfer request preview
const TransferRequestMediaGallery = ({ requestId }: { requestId: string }) => {
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const { data, error } = await supabase.rpc('get_incoming_transfer_request_media', {
          p_request_id: requestId
        });
        
        if (error) throw error;
        setMedia((data as any) || []);
      } catch (err) {
        console.error('Error fetching media:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [requestId]);

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

  const currentMedia = media[currentIndex];
  const isVideo = currentMedia?.file_type?.includes('video');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ImageIcon className="h-4 w-4 text-blue-600" />
        <span>تصاویر و ویدیوهای سفارش ({media.length})</span>
      </div>
      <div className="relative bg-black/5 rounded-lg overflow-hidden">
        {isVideo ? (
          <video
            src={mediaUrls[currentMedia.id] || ''}
            controls
            className="w-full max-h-64 object-contain"
          />
        ) : (
          <img
            src={mediaUrls[currentMedia.id] || ''}
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
      
      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {media.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIndex ? 'border-primary' : 'border-transparent opacity-60'
              }`}
            >
              {item.file_type?.includes('video') ? (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={mediaUrls[item.id] || ''}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Full Order Details Dialog Component
const OrderDetailsDialog = ({
  request,
  open,
  onOpenChange,
  onAccept,
  onReject,
  processingId
}: {
  request: TransferRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (request: TransferRequest) => void;
  onReject: (request: TransferRequest) => void;
  processingId: string | null;
}) => {
  const notes = parseNotes(request.order_notes);
  
  // محاسبه ابعاد
  let dimensionsDisplay = '';
  if (notes?.dimensions && Array.isArray(notes.dimensions)) {
    dimensionsDisplay = notes.dimensions
      .map(d => `${d.length || '?'}×${d.width || '?'}×${d.height || '?'}`)
      .join(' | ');
  } else if (notes?.length || notes?.width || notes?.height) {
    dimensionsDisplay = `${notes.length || '?'}×${notes.width || '?'}×${notes.height || '?'}`;
  }
  
  const totalArea = notes?.totalArea;
  const price = notes?.estimated_price || notes?.estimatedPrice || request.payment_amount;
  const installDate = notes?.installationDate || notes?.installationDateTime || notes?.installation_date;
  const dueDate = notes?.dueDate || notes?.dueDateTime || notes?.due_date;
  const description = notes?.additional_notes || notes?.description || notes?.activityDescription;
  const conditions = notes?.conditions;
  const scaffoldType = notes?.scaffold_type || notes?.service_type;
  const distanceRange = notes?.distanceRange;

  // نوع داربست را ترجمه کن
  const getScaffoldTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'facade': 'داربست سطحی نما',
      'formwork': 'داربست حجمی کفراژ',
      'ceiling-tiered': 'داربست زیر بتن - تیرچه',
      'ceiling-slab': 'داربست زیر بتن - دال بتنی',
      'column': 'داربست ستونی',
      'کرایه اجناس داربست': 'کرایه اجناس داربست'
    };
    return types[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 bg-background z-10 p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              سفارش {request.order_code}
            </DialogTitle>
            <Badge variant="secondary" className="text-sm">
              {request.service_type_name || request.subcategory_name}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-6">
          {/* اطلاعات فرستنده */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">فرستنده سفارش</p>
                  <p className="font-semibold">{request.from_full_name || 'بدون نام'}</p>
                  <p className="text-sm text-muted-foreground" dir="ltr">{request.from_phone_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* نوع خدمت */}
          {(scaffoldType || request.subcategory_name) && (
            <div className="p-4 bg-primary/10 rounded-xl">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">نوع خدمت</p>
                  <p className="font-bold text-lg">{scaffoldType ? getScaffoldTypeLabel(scaffoldType) : request.subcategory_name}</p>
                </div>
              </div>
            </div>
          )}

          {/* آدرس */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">آدرس پروژه</p>
                  <p className="font-medium">{request.order_address}</p>
                  {request.order_detailed_address && (
                    <p className="text-sm text-muted-foreground mt-1">{request.order_detailed_address}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ابعاد و متراژ */}
          {(dimensionsDisplay || totalArea) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  ابعاد و متراژ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {notes?.dimensions && Array.isArray(notes.dimensions) && notes.dimensions.length > 0 && (
                  <div className="space-y-2">
                    {notes.dimensions.map((dim: any, index: number) => {
                      const length = typeof dim.length === 'number' ? dim.length : parseFloat(dim.length) || 0;
                      const width = dim.width ? (typeof dim.width === 'number' ? dim.width : parseFloat(dim.width)) : 1;
                      const height = typeof dim.height === 'number' ? dim.height : parseFloat(dim.height) || 0;
                      const area = length * width * height;
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                          <span className="text-sm">بعد {index + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">
                              {length}×{width}×{height}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              = {area.toFixed(2)} م³
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {totalArea && (
                  <div className="p-4 bg-primary/10 rounded-xl flex items-center justify-between">
                    <span className="font-medium">متراژ کل</span>
                    <span className="font-bold text-xl">
                      {totalArea % 1 === 0 ? totalArea : totalArea.toFixed(2)} متر مکعب
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* قیمت */}
          {price && (
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-6 w-6 text-green-600" />
                    <span className="font-medium">مبلغ سفارش</span>
                  </div>
                  <span className="font-bold text-2xl text-green-600">
                    {price.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* تاریخ‌ها */}
          {(installDate || dueDate) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  تاریخ‌ها
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {installDate && (
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">تاریخ نصب</p>
                    <p className="font-medium">{installDate}</p>
                  </div>
                )}
                {dueDate && (
                  <div className="p-3 bg-muted/40 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">تاریخ پایان</p>
                    <p className="font-medium">{dueDate}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* شرایط خدمت */}
          {conditions && conditions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">شرایط خدمت</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {conditions.map((c: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-sm">
                      {c}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* فاصله از مرکز استان */}
          {distanceRange && (
            <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between">
              <span className="text-sm text-muted-foreground">فاصله از مرکز استان</span>
              <span className="font-medium">{distanceRange}</span>
            </div>
          )}

          {/* توضیحات */}
          {description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  توضیحات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{description}</p>
              </CardContent>
            </Card>
          )}

          {/* تاریخ ثبت درخواست */}
          <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>تاریخ درخواست انتقال: {formatPersianDate(request.created_at)}</span>
          </div>

          {/* تصاویر سفارش */}
          <TransferRequestMediaGallery requestId={request.id} />

          {/* نقشه موقعیت */}
          {request.location_lat && request.location_lng && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  موقعیت پروژه
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 rounded-lg overflow-hidden border">
                  <StaticLocationMap
                    lat={request.location_lat}
                    lng={request.location_lng}
                    address={request.order_address || ''}
                    detailedAddress={request.order_detailed_address || ''}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* دکمه‌های عمل - ثابت پایین */}
        <div className="sticky bottom-0 bg-background border-t p-4">
          <div className="flex gap-3">
            <Button
              onClick={() => onAccept(request)}
              disabled={processingId === request.id}
              className="flex-1 gap-2 h-12 text-base"
              size="lg"
            >
              {processingId === request.id ? (
                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              پذیرش سفارش
            </Button>
            <Button
              variant="outline"
              onClick={() => onReject(request)}
              disabled={processingId === request.id}
              className="flex-1 gap-2 h-12 text-base"
              size="lg"
            >
              <XCircle className="h-5 w-5" />
              رد درخواست
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const parseNotes = (notesStr: string | null): ParsedNotes | null => {
  if (!notesStr) return null;
  try {
    let parsed = typeof notesStr === 'string' ? JSON.parse(notesStr) : notesStr;
    // Handle double-stringified
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
};

export function IncomingTransferRequests() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<TransferRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchIncomingRequests();
    }
  }, [user]);

  const fetchIncomingRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_incoming_transfer_requests');
      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (request: TransferRequest) => {
    setProcessingId(request.id);
    try {
      const { data: order, error: orderFetchError } = await supabase
        .from('projects_v3')
        .select('*')
        .eq('id', request.order_id)
        .maybeSingle();

      if (orderFetchError) throw orderFetchError;
      if (!order) throw new Error('سفارش یافت نشد');

      const { data: subcategory } = await supabase
        .from('subcategories')
        .select('id, name, service_type_id')
        .eq('id', order.subcategory_id)
        .maybeSingle();

      let { data: recipientCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!recipientCustomer) {
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({ user_id: user?.id })
          .select('id')
          .single();

        if (createError) throw createError;
        recipientCustomer = newCustomer;
      }

      const customerId = recipientCustomer?.id;
      if (!customerId) throw new Error('خطا در ایجاد پروفایل مشتری');

      const { data: fromProfile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', request.from_user_id)
        .maybeSingle();

      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          user_id: user?.id,
          address_line: order.address,
          title: order.detailed_address || 'آدرس انتقالی',
          lat: order.location_lat || 34.6401,
          lng: order.location_lng || 50.8764,
          province_id: order.province_id,
          district_id: order.district_id,
        })
        .select('id')
        .single();

      if (locationError) throw locationError;

      const serviceTypeId = subcategory?.service_type_id;
      if (!serviceTypeId) throw new Error('خطا در دریافت نوع خدمات');

      const { data: newHierarchy, error: hierarchyError } = await supabase
        .from('projects_hierarchy')
        .insert({
          user_id: user?.id,
          location_id: newLocation.id,
          service_type_id: serviceTypeId,
          subcategory_id: order.subcategory_id,
          title: `پروژه انتقالی - ${order.code}`,
          status: 'active',
        })
        .select('id')
        .single();

      if (hierarchyError) throw hierarchyError;

      const { error: transferError } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'completed',
          recipient_responded_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (transferError) throw transferError;

      const { error: orderError } = await supabase.rpc('transfer_order_ownership' as any, {
        p_order_id: request.order_id,
        p_new_customer_id: customerId,
        p_new_hierarchy_id: newHierarchy.id,
        p_transferred_from_user_id: request.from_user_id,
        p_transferred_from_phone: fromProfile?.phone_number || request.to_phone_number,
      });

      if (orderError) throw orderError;

      toast({
        title: '✓ موفق',
        description: 'سفارش با موفقیت به شما منتقل شد و در پروژه‌های شما قرار گرفت',
      });

      setSelectedRequest(null);
      fetchIncomingRequests();
    } catch (error: any) {
      console.error('Error accepting transfer:', error);
      toast({
        title: 'خطا',
        description: error.message || 'خطا در پذیرش انتقال سفارش',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (request: TransferRequest) => {
    setRejectingRequest(request);
    setShowRejectDialog(true);
    setSelectedRequest(null);
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;

    setProcessingId(rejectingRequest.id);
    try {
      const { error } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'recipient_rejected',
          recipient_responded_at: new Date().toISOString(),
          recipient_rejection_reason: rejectionReason || null,
        })
        .eq('id', rejectingRequest.id);

      if (error) throw error;

      toast({
        title: 'انجام شد',
        description: 'درخواست انتقال رد شد',
      });

      setShowRejectDialog(false);
      setRejectingRequest(null);
      setRejectionReason('');
      fetchIncomingRequests();
    } catch (error: any) {
      console.error('Error rejecting transfer:', error);
      toast({
        title: 'خطا',
        description: 'خطا در رد درخواست انتقال',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <ArrowLeftRight className="h-5 w-5" />
            درخواست‌های انتقال سفارش به شما
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.map((request) => {
            const notes = parseNotes(request.order_notes);
            const price = notes?.estimated_price || notes?.estimatedPrice || request.payment_amount;

            return (
              <Card key={request.id} className="overflow-hidden">
                <CardContent className="pt-4 space-y-3">
                  {/* هدر */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-lg">{request.order_code || 'سفارش'}</span>
                    </div>
                    <Badge variant="secondary">
                      {request.service_type_name || request.subcategory_name}
                    </Badge>
                  </div>

                  <Separator />

                  {/* خلاصه اطلاعات */}
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <span className="text-muted-foreground">فرستنده: </span>
                        <span className="font-medium">
                          {request.from_full_name || 'بدون نام'} ({request.from_phone_number})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <span className="text-muted-foreground">آدرس: </span>
                        <span>{request.order_address}</span>
                      </div>
                    </div>
                    {price && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-bold text-green-600">
                          {price.toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        تاریخ درخواست: {formatPersianDate(request.created_at)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* دکمه مشاهده جزئیات کامل */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <Eye className="h-4 w-4" />
                    مشاهده جزئیات کامل و پذیرش سفارش
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* Full Order Details Dialog */}
      {selectedRequest && (
        <OrderDetailsDialog
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          onAccept={handleAccept}
          onReject={handleRejectClick}
          processingId={processingId}
        />
      )}

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>رد درخواست انتقال</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از رد این درخواست انتقال سفارش اطمینان دارید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">دلیل رد (اختیاری):</label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="دلیل رد درخواست را وارد کنید..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive hover:bg-destructive/90">
              تایید رد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
