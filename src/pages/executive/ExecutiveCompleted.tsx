import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DollarSign, Eye, Search, MapPin, Phone, User, CheckCircle2, Calendar, ImageIcon, ChevronLeft, ChevronRight, Ruler, FileText, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProgressMediaUploader } from '@/components/executive/ProgressMediaUploader';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';

// Helper function to parse order notes (handles double-stringified JSON)
const parseOrderNotes = (notes: string | null | undefined): any => {
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
const OrderMediaGallery = ({ orderId }: { orderId: string }) => {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchMedia = async () => {
      const { data } = await supabase
        .from('project_media')
        .select('*')
        .eq('project_id', orderId)
        .order('created_at', { ascending: false });
      setMedia(data || []);
      setLoading(false);
    };
    fetchMedia();
  }, [orderId]);

  if (loading) return <div className="text-center py-4 text-muted-foreground text-sm">در حال بارگذاری...</div>;
  if (media.length === 0) return <div className="text-center py-4 text-muted-foreground text-sm flex flex-col items-center gap-2"><ImageIcon className="h-8 w-8 opacity-40" /><span>تصویری آپلود نشده است</span></div>;

  const currentMedia = media[currentIndex];
  const { data: urlData } = supabase.storage.from('project-media').getPublicUrl(currentMedia.file_path);

  return (
    <div className="space-y-2">
      <div className="relative bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        {currentMedia.file_type === 'video' ? (
          <video src={urlData.publicUrl} controls className="max-h-full max-w-full" />
        ) : (
          <img src={urlData.publicUrl} alt="Order media" className="max-h-full max-w-full object-contain" />
        )}
      </div>
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(i => i > 0 ? i - 1 : media.length - 1)}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">{currentIndex + 1} / {media.length}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(i => i < media.length - 1 ? i + 1 : 0)}><ChevronLeft className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
};

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  executive_completion_date: string | null;
  notes: any;
  payment_amount: number | null;
}

export default function ExecutiveCompleted() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

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
          executive_completion_date,
          notes,
          payment_amount,
          customer_id
        `)
        .eq('status', 'completed')
        .order('executive_completion_date', { ascending: false });

      if (error) throw error;

      const ordersWithCustomer = await Promise.all(
        (data || []).map(async (order: any) => {
          const { data: customerData } = await supabase
            .from('customers')
            .select('user_id')
            .eq('id', order.customer_id)
            .maybeSingle();

          let customerName = 'نامشخص';
          let customerPhone = '';

          if (customerData?.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, phone_number')
              .eq('user_id', customerData.user_id)
              .maybeSingle();

            customerName = profileData?.full_name || 'نامشخص';
            customerPhone = profileData?.phone_number || '';
          }

          return {
            ...order,
            notes: parseOrderNotes(order.notes),
            customer_name: customerName,
            customer_phone: customerPhone
          };
        })
      );

      setOrders(ordersWithCustomer as Order[]);
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سفارشات تکمیل شده - در انتظار پرداخت"
        description={`${orders.length} سفارش در انتظار پرداخت از سوی مشتری`}
      />

      {orders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجو..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>سفارشی در انتظار پرداخت وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-all border-l-4 border-l-yellow-500">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                      <StatusBadge status="completed" />
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{order.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span dir="ltr">{order.customer_phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{order.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Separator />
                
                {order.executive_completion_date && (
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-xs text-muted-foreground">تاریخ اتمام اجرا</div>
                        <div className="font-medium">
                          {new Date(order.executive_completion_date).toLocaleDateString('fa-IR')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
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
                    جزئیات
                  </Button>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-950 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-600" />
                    <span>در انتظار پرداخت توسط مشتری</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const parsedNotes = selectedOrder.notes;
            const scaffoldingType = parsedNotes?.service_type || parsedNotes?.scaffoldingType || parsedNotes?.scaffold_type;
            const dimensions = parsedNotes?.dimensions;
            const totalArea = parsedNotes?.totalArea || parsedNotes?.total_area;
            const conditions = parsedNotes?.conditions || parsedNotes?.serviceConditions;
            const description = parsedNotes?.description || parsedNotes?.installationDescription || parsedNotes?.additional_notes;
            const estimatedPrice = parsedNotes?.estimated_price || parsedNotes?.price || parsedNotes?.totalPrice || selectedOrder.payment_amount;
            const ceilingSubtype = parsedNotes?.ceilingSubtype || parsedNotes?.ceiling_subtype;

            return (
              <div className="space-y-4 py-4">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">نام مشتری</Label>
                    <p className="font-medium">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">شماره تماس</Label>
                    <p className="font-medium" dir="ltr">{selectedOrder.customer_phone}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">آدرس</Label>
                  <p className="font-medium">{selectedOrder.address}</p>
                </div>
                
                {selectedOrder.detailed_address && (
                  <div>
                    <Label className="text-xs text-muted-foreground">آدرس تفصیلی</Label>
                    <p className="font-medium">{selectedOrder.detailed_address}</p>
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
                              طول: {dim.length || '-'} × عرض: {dim.width || '-'} × ارتفاع: {dim.height || '-'} متر
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

                {/* Price */}
                {estimatedPrice && (
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                    <Label className="text-xs text-muted-foreground">مبلغ سفارش</Label>
                    <p className="font-bold text-lg text-green-700 dark:text-green-300">
                      {Number(estimatedPrice).toLocaleString('fa-IR')} تومان
                    </p>
                  </div>
                )}

                <Separator />

                {/* Media Gallery */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">تصاویر و ویدیوهای سفارش</Label>
                  <OrderMediaGallery orderId={selectedOrder.id} />
                </div>

                {/* Progress Media Uploader */}
                <ProgressMediaUploader
                  projectId={selectedOrder.id}
                  stage="completed"
                  stageName="تکمیل شده"
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
