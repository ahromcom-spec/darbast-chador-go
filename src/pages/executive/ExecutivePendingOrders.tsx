import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, X, Eye, Search, MapPin, Phone, User, Ruler, FileText, Banknote, Wrench, Image as ImageIcon, ChevronLeft, ChevronRight, ArrowLeftRight, Users, Clock, Archive, CheckSquare, Square, Play, Film } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { CentralizedVideoPlayer } from '@/components/media/CentralizedVideoPlayer';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
// Helper to parse order notes safely - handles double-stringified JSON
const parseOrderNotes = (notes: any): any => {
  if (!notes) return null;
  
  // If notes is already an object, return it directly
  if (typeof notes === 'object' && notes !== null) {
    return notes;
  }
  
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

// Component to display order media with signed URLs - styled like OrderDetail
const OrderMediaGallery = ({ orderId }: { orderId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [media, setMedia] = useState<Array<{ id: string; file_path: string; file_type: string; mime_type?: string; created_at: string; user_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [selectedVideoPath, setSelectedVideoPath] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const { data, error } = await supabase
          .from('project_media')
          .select('id, file_path, file_type, mime_type, created_at, user_id')
          .eq('project_id', orderId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setMedia(data || []);

        // Fetch uploader names
        if (data && data.length > 0) {
          const userIds = [...new Set(data.map(m => m.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, phone_number')
            .in('user_id', userIds);
          
          if (profiles) {
            const names: Record<string, string> = {};
            profiles.forEach(p => {
              names[p.user_id] = p.full_name || p.phone_number || 'کاربر';
            });
            setUploaderNames(names);
          }
        }
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

  // Format upload time
  const formatUploadTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  // Check if item is video
  const isVideo = (item: typeof media[0]) => {
    return item.file_type === 'video' || 
           item.file_type?.includes('video') || 
           item.mime_type?.includes('video') ||
           item.file_path?.toLowerCase().endsWith('.mp4') ||
           item.file_path?.toLowerCase().endsWith('.webm') ||
           item.file_path?.toLowerCase().endsWith('.mov');
  };

  // Handle delete media
  const handleDeleteMedia = async (mediaId: string, filePath: string) => {
    if (deletingMediaId) return;
    
    setDeletingMediaId(mediaId);
    try {
      // Delete from storage
      await supabase.storage.from('project-media').remove([filePath]);
      
      // Delete from database
      const { error } = await supabase
        .from('project_media')
        .delete()
        .eq('id', mediaId);
      
      if (error) throw error;
      
      setMedia(prev => prev.filter(m => m.id !== mediaId));
      toast({ title: 'موفق', description: 'فایل حذف شد' });
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({ title: 'خطا', description: 'خطا در حذف فایل', variant: 'destructive' });
    } finally {
      setDeletingMediaId(null);
    }
  };

  // Handle video download
  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName || 'video.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
      toast({ title: 'موفق', description: 'دانلود شروع شد' });
    } catch (error) {
      toast({ title: 'خطا', description: 'خطا در دانلود', variant: 'destructive' });
    }
  };

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

  const images = media.filter(m => !isVideo(m));
  const videos = media.filter(m => isVideo(m));

  return (
    <>
      <div className="space-y-6">
        {/* Images Section */}
        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">تصاویر پروژه ({images.length})</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((item) => {
                const url = mediaUrls[item.id] || '';
                const uploaderName = uploaderNames[item.user_id] || 'نامشخص';
                const isOwnMedia = user?.id === item.user_id;
                
                return (
                  <div 
                    key={item.id} 
                    className="relative rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
                  >
                    <div 
                      className="aspect-square"
                      onClick={() => url && setSelectedImageUrl(url)}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt="تصویر سفارش"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      
                      {/* Delete button - only for own media */}
                      {isOwnMedia && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMedia(item.id, item.file_path);
                          }}
                          disabled={deletingMediaId === item.id}
                        >
                          {deletingMediaId === item.id ? (
                            <Clock className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {/* Uploader info */}
                    <div className="p-2 bg-muted/50 text-xs text-muted-foreground border-t">
                      <div className="flex items-center gap-1 mb-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{uploaderName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatUploadTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Videos Section */}
        {videos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">ویدیوهای پروژه ({videos.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((item) => {
                const url = mediaUrls[item.id] || '';
                const uploaderName = uploaderNames[item.user_id] || 'نامشخص';
                const isOwnMedia = user?.id === item.user_id;
                const fileName = item.file_path.split('/').pop()?.replace(/^\d+_[a-z0-9]+_/, '') || 'ویدیو پروژه';
                
                return (
                  <div key={item.id} className="relative group rounded-lg overflow-hidden border">
                    <div 
                      className="aspect-video bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => {
                        if (url) {
                          setSelectedVideoUrl(url);
                          setSelectedVideoPath(item.file_path);
                        }
                      }}
                    >
                      <div className="relative w-full h-full bg-black/5 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <Film className="w-16 h-16 text-primary opacity-60" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white/90 rounded-full p-4 shadow-lg hover:scale-110 transition-transform">
                            <Play className="w-8 h-8 text-primary" fill="currentColor" />
                          </div>
                        </div>
                        <div className="absolute top-2 left-2 right-2 bg-black/80 text-white text-sm px-3 py-1.5 rounded truncate">
                          {fileName}
                        </div>
                      </div>
                    </div>
                    
                    {/* Delete button - only for own media */}
                    {isOwnMedia && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-12 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMedia(item.id, item.file_path);
                        }}
                        disabled={deletingMediaId === item.id}
                      >
                        {deletingMediaId === item.id ? (
                          <Clock className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    
                    {/* Download button */}
                    <div className="absolute bottom-14 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shadow-lg bg-white/95 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (url) handleDownload(url, fileName);
                        }}
                      >
                        <Eye className="w-4 h-4 ml-1" />
                        دانلود
                      </Button>
                    </div>
                    
                    {/* Uploader info */}
                    <div className="p-2 bg-muted/50 text-xs text-muted-foreground border-t">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate">{uploaderName}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-black/70 text-white px-2 py-0.5 rounded-full">
                          <Film className="w-3 h-3" />
                          ویدیو
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatUploadTime(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideoUrl} onOpenChange={(open) => !open && setSelectedVideoUrl(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 bg-black overflow-hidden">
          <DialogHeader className="p-4 pb-2 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
            <DialogTitle className="text-white text-sm flex items-center gap-2">
              <Film className="h-4 w-4" />
              پخش ویدیو
            </DialogTitle>
          </DialogHeader>
          {selectedVideoUrl && (
            <div className="aspect-video w-full">
              <CentralizedVideoPlayer
                src={selectedVideoUrl}
                filePath={selectedVideoPath || undefined}
                bucket="project-media"
                className="w-full h-full"
                autoPlay
                showControls
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={!!selectedImageUrl} onOpenChange={(open) => !open && setSelectedImageUrl(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-2 bg-black/95">
          <DialogHeader className="sr-only">
            <DialogTitle>مشاهده تصویر</DialogTitle>
          </DialogHeader>
          {selectedImageUrl && (
            <img
              src={selectedImageUrl}
              alt="تصویر بزرگ"
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
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
  // اطلاعات سفارش برای دیگران
  transferred_from_user_id?: string | null;
  transferred_from_phone?: string | null;
  transfer_request?: any;
  registrant_name?: string | null;
  registrant_phone?: string | null;
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
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const { toast } = useToast();

  // Auto-open order from URL param
  const urlOrderId = searchParams.get('orderId');
  
  // Check if this is the "scaffold execution with materials" module (code 101010) - hide price for this module
  const activeModuleKey = searchParams.get('moduleKey') || '';
  // Also check moduleName for custom copies of the module  
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, '', '');
  const isScaffoldWithMaterialsModule = activeModuleKey === 'scaffold_execution_with_materials' ||
                                         activeModuleKey.includes('101010') ||
                                         moduleName.includes('داربست به همراه اجناس');
  
  // Check if this is an accounting module - hide order details, only show financial info
  const isAccountingModule = activeModuleKey.includes('حسابداری') ||
                              activeModuleKey === 'comprehensive_accounting' ||
                              activeModuleKey.includes('accounting');

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime changes on projects_v3
    const channel = supabase
      .channel('pending-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_v3'
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          // Refetch orders when any change happens
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          approved_by,
          transferred_from_user_id,
          transferred_from_phone
        `)
        .eq('status', 'pending')
        .or('is_archived.is.null,is_archived.eq.false')
        .order('code', { ascending: false });

      if (error) throw error;

      // Fetch transfer requests for these orders to check "order for others"
      const orderIds = (data || []).map((o: any) => o.id);
      const { data: transferRequests } = await supabase
        .from('order_transfer_requests')
        .select('order_id, from_user_id, to_phone_number, to_user_id, status')
        .in('order_id', orderIds);

      const transferMap = new Map<string, any>();
      (transferRequests || []).forEach((tr: any) => {
        transferMap.set(tr.order_id, tr);
      });

      // Fetch registrant names for orders placed for others
      const fromUserIds = (transferRequests || []).map((tr: any) => tr.from_user_id).filter(Boolean);
      const { data: registrantProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone_number')
        .in('user_id', fromUserIds);

      const registrantMap = new Map<string, any>();
      (registrantProfiles || []).forEach((p: any) => {
        registrantMap.set(p.user_id, p);
      });

      // Map orders with denormalized data
      const rows = (data || []).map((order: any) => {
        // Parse notes using robust parser that handles double-stringified JSON
        const notesObj = parseOrderNotes(order.notes) || {};
        const transferRequest = transferMap.get(order.id);
        const registrant = transferRequest ? registrantMap.get(transferRequest.from_user_id) : null;

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
          // اطلاعات سفارش برای دیگران
          transferred_from_user_id: order.transferred_from_user_id,
          transferred_from_phone: order.transferred_from_phone,
          transfer_request: transferRequest,
          registrant_name: registrant?.full_name,
          registrant_phone: registrant?.phone_number,
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
                link: '/profile?tab=orders',
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
                link: '/profile?tab=orders',
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

  const handleArchiveOrder = async () => {
    if (!selectedOrder || !user) return;

    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast({
        title: 'سفارش بایگانی شد',
        description: `سفارش ${selectedOrder.code} به بایگانی منتقل شد.`
      });

      setArchiveDialogOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error('Error archiving order:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در بایگانی سفارش'
      });
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedOrderIds.size === 0 || !user) return;

    setBulkArchiving(true);
    try {
      const orderIdsArray = Array.from(selectedOrderIds);
      
      const { error } = await supabase
        .from('projects_v3')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .in('id', orderIdsArray);

      if (error) throw error;

      toast({
        title: 'سفارشات بایگانی شدند',
        description: `${selectedOrderIds.size} سفارش به بایگانی منتقل شد.`
      });

      setBulkArchiveDialogOpen(false);
      setSelectedOrderIds(new Set());
      fetchOrders();
    } catch (error) {
      console.error('Error bulk archiving orders:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در بایگانی سفارشات'
      });
    } finally {
      setBulkArchiving(false);
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

      // تغییر وضعیت سفارش به pending_execution و ثبت تاریخ‌های اجرا + آپدیت notes
      const { error: updateError } = await supabase
        .from('projects_v3')
        .update({
          status: 'pending_execution',
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
            _link: '/profile?tab=orders',
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
                url: '/profile?tab=orders'
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
    const customerPriceConfirmed = orderNotes?.customer_price_confirmed === true;
    
    // For expert pricing requests, approval is disabled until price is set AND customer confirms price
    const canApprove = !isExpertPricingRequest || (priceSetByManager && hasPaymentAmount && customerPriceConfirmed);
    
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

    const isSelected = selectedOrderIds.has(order.id);

    return (
      <Card className={`hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500 ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleOrderSelection(order.id)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrder(order);
                  setArchiveDialogOpen(true);
                }}
                className="gap-1 text-muted-foreground hover:text-destructive h-8 w-8 p-0"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
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
                {order.transfer_request && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    <Users className="h-3 w-3 ml-1" />
                    سفارش برای دیگری
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
                {/* نمایش اطلاعات ثبت‌کننده سفارش برای دیگران */}
                {order.transfer_request && (
                  <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                    <Users className="h-4 w-4" />
                    <span className="text-xs">
                      ثبت‌کننده: {order.registrant_name || 'نامشخص'} ({order.registrant_phone || order.transfer_request.to_phone_number})
                      {order.transfer_request.status === 'pending_recipient' && ' - در انتظار تایید گیرنده'}
                      {order.transfer_request.status === 'pending_registration' && ' - در انتظار ثبت‌نام گیرنده'}
                    </span>
                  </div>
                )}
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
          {isExpertPricingRequest && !priceSetByManager && !hasPaymentAmount && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 text-sm">
                <Banknote className="h-4 w-4" />
                <span className="font-medium">ابتدا قیمت را برای این سفارش تعیین کنید</span>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                از طریق "جزئیات کامل" قیمت را وارد و ذخیره کنید.
              </p>
            </div>
          )}

          {isExpertPricingRequest && priceSetByManager && hasPaymentAmount && !customerPriceConfirmed && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm">
                <Clock className="h-4 w-4" />
                <span className="font-medium">قیمت تعیین شده: {Number(order.payment_amount).toLocaleString('fa-IR')} تومان</span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                در انتظار تایید قیمت توسط مشتری. پس از تایید مشتری می‌توانید سفارش را تایید کنید.
              </p>
            </div>
          )}

          {isExpertPricingRequest && canApprove && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">قیمت تعیین شده: {Number(order.payment_amount).toLocaleString('fa-IR')} تومان - مشتری تایید کرده</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                قیمت سفارش تعیین شده و مشتری تایید کرده است. می‌توانید سفارش را تایید کنید.
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
                // بررسی همه فیلدهای ممکن برای تاریخ درخواستی
                const customerRequestedDate = notes?.installationDateTime || notes?.installation_date || notes?.requested_date || '';
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

      {/* Bulk Action Bar */}
      {filteredOrders.length > 0 && (
        <Card className="sticky top-0 z-10 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedOrderIds.size > 0 
                    ? `${selectedOrderIds.size} سفارش انتخاب شده`
                    : 'انتخاب همه'}
                </span>
              </div>
              
              {selectedOrderIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkArchiveDialogOpen(true)}
                  className="gap-2"
                >
                  <Archive className="h-4 w-4" />
                  بایگانی {selectedOrderIds.size} سفارش
                </Button>
              )}
            </div>
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
                // بررسی همه فیلدهای ممکن برای تاریخ درخواستی مشتری
                const customerRequestedDate = orderNotes?.installationDateTime || orderNotes?.installation_date || orderNotes?.requested_date;
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
            }} hidePrice={isScaffoldWithMaterialsModule} hideDetails={isAccountingModule} />
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

      {/* Archive Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              بایگانی سفارش
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید سفارش {selectedOrder?.code} را بایگانی کنید؟
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            سفارش از دسترس مشتری و مدیران خارج می‌شود. می‌توانید بعداً از قسمت بایگانی آن را بازگردانید.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleArchiveOrder}>
              بایگانی سفارش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Archive Dialog */}
      <Dialog open={bulkArchiveDialogOpen} onOpenChange={setBulkArchiveDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              بایگانی دسته‌جمعی سفارشات
            </DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید {selectedOrderIds.size} سفارش را بایگانی کنید؟
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            تمام سفارشات انتخاب شده از دسترس مشتریان و مدیران خارج می‌شوند. می‌توانید بعداً از قسمت بایگانی آن‌ها را بازگردانید.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkArchiveDialogOpen(false)} disabled={bulkArchiving}>
              انصراف
            </Button>
            <Button onClick={handleBulkArchive} disabled={bulkArchiving}>
              {bulkArchiving ? 'در حال بایگانی...' : `بایگانی ${selectedOrderIds.size} سفارش`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}