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
  ChevronDown, 
  ChevronUp,
  Ruler,
  DollarSign,
  FileText,
  Layers,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Map
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
  dueDate?: string;
  dueDateTime?: string;
  additional_notes?: string;
  description?: string;
  activityDescription?: string;
  service_type?: string;
  scaffold_type?: string;
  dimensions?: Array<{ length?: number; width?: number; height?: number }>;
  conditions?: string[];
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <ImageIcon className="h-4 w-4 text-blue-600" />
        <span className="text-muted-foreground">تصاویر سفارش ({media.length})</span>
      </div>
      <div className="relative bg-black/5 rounded-lg overflow-hidden">
        {isVideo ? (
          <video
            src={mediaUrls[currentMedia.id] || ''}
            controls
            className="w-full max-h-48 object-contain"
          />
        ) : (
          <img
            src={mediaUrls[currentMedia.id] || ''}
            alt={`تصویر ${currentIndex + 1}`}
            className="w-full max-h-48 object-contain"
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

export function IncomingTransferRequests() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<TransferRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
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
      // استفاده از RPC جدید که جزئیات کامل سفارش را برمی‌گرداند
      const { data, error } = await supabase.rpc('get_incoming_transfer_requests');

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching incoming requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseNotes = (notesStr: string | null): ParsedNotes | null => {
    if (!notesStr) return null;
    try {
      return typeof notesStr === 'string' ? JSON.parse(notesStr) : notesStr;
    } catch {
      return null;
    }
  };

  const toggleExpand = (requestId: string) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const handleAccept = async (request: TransferRequest) => {
    setProcessingId(request.id);
    try {
      // Get the order details first - use separate queries to avoid coercion issues
      const { data: order, error: orderFetchError } = await supabase
        .from('projects_v3')
        .select('*')
        .eq('id', request.order_id)
        .maybeSingle();

      if (orderFetchError) throw orderFetchError;
      if (!order) throw new Error('سفارش یافت نشد');

      // Fetch subcategory separately
      const { data: subcategory } = await supabase
        .from('subcategories')
        .select('id, name, service_type_id')
        .eq('id', order.subcategory_id)
        .maybeSingle();

      // Get or create customer record for the recipient
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
      
      if (!customerId) {
        throw new Error('خطا در ایجاد پروفایل مشتری');
      }

      // Get original owner's phone
      const { data: fromProfile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('user_id', request.from_user_id)
        .maybeSingle();

      // Create a location for the recipient user with the order address
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

      // Get service_type_id from subcategory
      const serviceTypeId = subcategory?.service_type_id;
      if (!serviceTypeId) {
        throw new Error('خطا در دریافت نوع خدمات');
      }

      // Create a projects_hierarchy entry for the recipient
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

      // Update transfer request status to 'completed' first
      const { error: transferError } = await supabase
        .from('order_transfer_requests')
        .update({
          status: 'completed',
          recipient_responded_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (transferError) throw transferError;

      // Use RPC function to update order ownership (bypasses RLS)
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
            const isExpanded = expandedRequests.has(request.id);
            
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
            const installDate = notes?.installationDate || notes?.installationDateTime;
            const dueDate = notes?.dueDate || notes?.dueDateTime;
            const description = notes?.additional_notes || notes?.description || notes?.activityDescription;
            const conditions = notes?.conditions;
            const scaffoldType = notes?.scaffold_type || notes?.service_type;

            return (
              <Card key={request.id} className="overflow-hidden">
                <CardContent className="pt-4 space-y-3">
                  {/* هدر اصلی */}
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

                  {/* اطلاعات اصلی */}
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
                        {request.order_detailed_address && (
                          <span className="text-muted-foreground"> - {request.order_detailed_address}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        تاریخ درخواست: {formatPersianDate(request.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* دکمه نمایش جزئیات */}
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(request.id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        <span>جزئیات کامل سفارش</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="space-y-4 pt-3">
                      <Separator />
                      
                      {/* نوع خدمت */}
                      {(scaffoldType || request.subcategory_name) && (
                        <div className="flex items-start gap-2 text-sm">
                          <Layers className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">نوع خدمت: </span>
                            <span className="font-medium">{scaffoldType || request.subcategory_name}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* ابعاد */}
                      {dimensionsDisplay && (
                        <div className="flex items-start gap-2 text-sm">
                          <Ruler className="h-4 w-4 text-green-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">ابعاد (متر): </span>
                            <span className="font-medium font-mono">{dimensionsDisplay}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* متراژ کل */}
                      {totalArea && (
                        <div className="flex items-start gap-2 text-sm">
                          <Ruler className="h-4 w-4 text-green-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">متراژ کل: </span>
                            <span className="font-medium">{totalArea.toLocaleString('fa-IR')} متر مربع</span>
                          </div>
                        </div>
                      )}
                      
                      {/* قیمت */}
                      {price && (
                        <div className="flex items-start gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-emerald-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">مبلغ: </span>
                            <span className="font-bold text-emerald-600">
                              {price.toLocaleString('fa-IR')} تومان
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* تاریخ نصب */}
                      {installDate && (
                        <div className="flex items-start gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-purple-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">تاریخ نصب: </span>
                            <span className="font-medium">{installDate}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* تاریخ پایان */}
                      {dueDate && (
                        <div className="flex items-start gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-orange-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">تاریخ پایان: </span>
                            <span className="font-medium">{dueDate}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* شرایط خدمت */}
                      {conditions && conditions.length > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <FileText className="h-4 w-4 text-indigo-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">شرایط: </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {conditions.map((c, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* توضیحات */}
                      {description && (
                        <div className="flex items-start gap-2 text-sm">
                          <FileText className="h-4 w-4 text-gray-600 mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">توضیحات: </span>
                            <p className="text-foreground mt-1 leading-relaxed">{description}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* قیمت - نمایش بیرون از شروط */}
                      {!price && request.payment_amount && (
                        <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                          <div className="flex items-start gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <div>
                              <span className="text-muted-foreground">مبلغ سفارش: </span>
                              <span className="font-bold text-lg text-emerald-600">
                                {request.payment_amount.toLocaleString('fa-IR')} تومان
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* تصاویر سفارش */}
                      <Separator />
                      <TransferRequestMediaGallery requestId={request.id} />
                      
                      {/* نقشه موقعیت */}
                      {request.location_lat && request.location_lng && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Map className="h-4 w-4 text-blue-600" />
                              <span className="text-muted-foreground">موقعیت پروژه</span>
                            </div>
                            <div className="h-48 rounded-lg overflow-hidden border">
                              <StaticLocationMap
                                lat={request.location_lat}
                                lng={request.location_lng}
                                address={request.order_address || ''}
                                detailedAddress={request.order_detailed_address || ''}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* دکمه‌های عمل */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAccept(request)}
                      disabled={processingId === request.id}
                      className="flex-1 gap-2"
                    >
                      {processingId === request.id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      پذیرش سفارش
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejectingRequest(request);
                        setShowRejectDialog(true);
                      }}
                      disabled={processingId === request.id}
                      className="flex-1 gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      رد درخواست
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

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
