import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, MapPin, Calendar, FileText, Ruler, CheckSquare, Phone, User, Clock, ExternalLink, Wrench } from 'lucide-react';
import { ApprovalProgress } from '@/components/orders/ApprovalProgress';
import { OrderWorkflowStatus } from '@/components/orders/OrderWorkflowStatus';
import { useOrderApprovals } from '@/hooks/useOrderApprovals';
import { useAuth } from '@/contexts/AuthContext';
import { formatPersianDate } from '@/lib/dateUtils';
import { IncomingTransferRequests } from '@/components/orders/IncomingTransferRequest';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  created_at: string;
  notes: any;
  hierarchy_project_id: string | null;
  payment_amount?: number;
  subcategories?: { name: string };
  provinces?: { name: string };
  districts?: { name: string };
  hierarchy_project?: {
    location?: {
      title: string | null;
      address_line: string;
    };
  };
}

interface OrderNotesSummary {
  hasDimensions: boolean;
  dimensionsText: string;
  totalValue: number;
  unit: string;
  estimatedPrice: number;
}

const parseOrderNotes = (raw: any): any | null => {
  if (!raw) return null;
  try {
    if (typeof raw === 'string') {
      return JSON.parse(raw);
    }
    if (typeof raw === 'object') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
};

const getOrderNotesSummary = (notes: any, paymentAmount?: number): OrderNotesSummary => {
  if (!notes || typeof notes !== 'object') {
    return {
      hasDimensions: false,
      dimensionsText: '',
      totalValue: 0,
      unit: 'متر مکعب',
      estimatedPrice: paymentAmount || 0,
    };
  }

  const dims = Array.isArray(notes.dimensions) ? notes.dimensions : [];
  const hasWidth =
    dims.length > 0 &&
    dims.some((d: any) => d && typeof d === 'object' && ('width' in d));

  const dimensionsText =
    dims.length > 0
      ? dims
          .map((d: any) => {
            const l = d.length ?? d.L ?? d.l;
            const w = d.width ?? d.W ?? d.w;
            const h = d.height ?? d.H ?? d.h;
            if (hasWidth) {
              return `${l}×${w}×${h}`;
            }
            return `${l}×${h}`;
          })
          .join(' + ')
      : '';

  const computedFromDims = () => {
    if (dims.length === 0) return 0;
    return dims.reduce((sum: number, d: any) => {
      const l = parseFloat(d.length ?? d.L ?? d.l ?? 0) || 0;
      const w = parseFloat(d.width ?? d.W ?? d.w ?? 0) || 0;
      const h = parseFloat(d.height ?? d.H ?? d.h ?? 0) || 0;
      return sum + (hasWidth ? l * w * h : l * h);
    }, 0);
  };

  const totalValue =
    typeof notes.totalArea === 'number'
      ? notes.totalArea
      : typeof notes.total_area === 'number'
      ? notes.total_area
      : computedFromDims();

  const isArea =
    (notes && typeof notes === 'object' && 'total_area' in notes) ||
    (!hasWidth && dims.length > 0);

  const unit = isArea ? 'متر مربع' : 'متر مکعب';

  const estimatedPrice =
    typeof notes.estimated_price === 'number'
      ? notes.estimated_price
      : paymentAmount || 0;

  return {
    hasDimensions: dims.length > 0,
    dimensionsText,
    totalValue,
    unit,
    estimatedPrice,
  };
};

export default function MyOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime changes on projects_v3
    const channel = supabase
      .channel('my-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects_v3'
        },
        (payload) => {
          console.log('Realtime order update:', payload);
          // Refetch orders when any change happens
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    
    try {
      // Use security definer function that bypasses RLS
      const { data, error } = await supabase.rpc('get_my_projects_v3');

      if (error) throw error;
      
      // Fetch related data for display
      if (data && data.length > 0) {
        const subcategoryIds = [...new Set(data.map((o: any) => o.subcategory_id).filter(Boolean))];
        const provinceIds = [...new Set(data.map((o: any) => o.province_id).filter(Boolean))];
        const districtIds = [...new Set(data.map((o: any) => o.district_id).filter(Boolean))];
        const hierarchyIds = [...new Set(data.map((o: any) => o.hierarchy_project_id).filter(Boolean))];
        
        const [subcatRes, provRes, distRes, hierRes] = await Promise.all([
          supabase.from('subcategories').select('id, name').in('id', subcategoryIds),
          supabase.from('provinces').select('id, name').in('id', provinceIds),
          districtIds.length > 0 ? supabase.from('districts').select('id, name').in('id', districtIds) : Promise.resolve({ data: [] }),
          hierarchyIds.length > 0 ? supabase.from('projects_hierarchy').select('id, location_id, locations(title, address_line)').in('id', hierarchyIds) : Promise.resolve({ data: [] })
        ]);
        
        const subcatMap = new Map((subcatRes.data || []).map((s: any) => [s.id, s]));
        const provMap = new Map((provRes.data || []).map((p: any) => [p.id, p]));
        const distMap = new Map((distRes.data || []).map((d: any) => [d.id, d]));
        const hierMap = new Map((hierRes.data || []).map((h: any) => [h.id, h]));
        
        const enrichedOrders = data.map((order: any) => ({
          ...order,
          subcategories: subcatMap.get(order.subcategory_id),
          provinces: provMap.get(order.province_id),
          districts: distMap.get(order.district_id),
          hierarchy_project: hierMap.get(order.hierarchy_project_id)
        }));
        
        setOrders(enrichedOrders.sort((a: any, b: any) => 
          b.code.localeCompare(a.code, undefined, { numeric: true })
        ));
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return <OrderWorkflowStatus status={status} />;
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const { approvals, loading: approvalsLoading } = useOrderApprovals(order.id);

    const notes = parseOrderNotes(order.notes);
    const summary = getOrderNotesSummary(notes, order.payment_amount);

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {formatPersianDate(order.created_at, { showDayOfWeek: true })}
              </CardDescription>
            </div>
            {getStatusBadge(order.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                {order.hierarchy_project?.location?.title && (
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    {order.hierarchy_project.location.title}
                  </p>
                )}
                <p className="text-sm">{order.address}</p>
              </div>
            </div>
            {order.subcategories && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{order.subcategories.name}</p>
              </div>
            )}

            {(summary.hasDimensions || summary.totalValue > 0 || summary.estimatedPrice > 0) && (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                {summary.hasDimensions && (
                  <div className="flex items-center gap-1">
                    <span>ابعاد:</span>
                    <span className="font-medium" dir="ltr">
                      {summary.dimensionsText}
                      {summary.dimensionsText ? ' متر' : ''}
                    </span>
                  </div>
                )}
                {summary.totalValue > 0 && (
                  <div className="flex items-center gap-1">
                    <span>متراژ:</span>
                    <span className="font-medium" dir="ltr">
                      {summary.totalValue.toFixed(2)} {summary.unit}
                    </span>
                  </div>
                )}
                {summary.estimatedPrice > 0 && (
                  <div className="flex items-center gap-1 col-span-2">
                    <span>قیمت:</span>
                    <span className="font-medium">
                      {summary.estimatedPrice.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {order.status === 'pending' && (
            <ApprovalProgress approvals={approvals} loading={approvalsLoading} />
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedOrder(order);
              setDetailsOpen(true);
            }}
            className="w-full"
          >
            مشاهده جزئیات
          </Button>
        </CardContent>
      </Card>
    );
  };

  const selectedNotes = selectedOrder ? parseOrderNotes(selectedOrder.notes) : null;
  const selectedSummary = selectedOrder ? getOrderNotesSummary(selectedNotes, selectedOrder.payment_amount) : null;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <PageHeader
        title="سفارشات من"
        description="مشاهده تمام سفارشات شما و وضعیت آن‌ها"
      />

      {/* کارتابل درخواست‌های انتقال سفارش به شما */}
      <div className="mt-6">
        <IncomingTransferRequests />
      </div>

      {orders.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">هیچ سفارشی یافت نشد</h3>
            <p className="text-muted-foreground">
              هنوز سفارشی ثبت نکرده‌اید
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-3">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              جزئیات سفارش {selectedOrder?.code}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-5">
              {/* Status Section */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">وضعیت سفارش</p>
                {getStatusBadge(selectedOrder.status)}
              </div>
              
              <Separator />

              {/* Address Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  آدرس
                </div>
                {selectedOrder.hierarchy_project?.location?.title && (
                  <Badge variant="outline" className="mb-1">
                    {selectedOrder.hierarchy_project.location.title}
                  </Badge>
                )}
                <p className="text-sm text-muted-foreground">{selectedOrder.address}</p>
                {selectedOrder.provinces?.name && (
                  <p className="text-xs text-muted-foreground">
                    استان: {selectedOrder.provinces.name}
                    {selectedOrder.districts?.name && ` - شهرستان: ${selectedOrder.districts.name}`}
                  </p>
                )}
              </div>

              <Separator />

              {/* Service Type */}
              {selectedOrder.subcategories && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary" />
                    نوع خدمت
                  </div>
                  <p className="text-sm">{selectedOrder.subcategories.name}</p>
                </div>
              )}

              {/* Notes Details */}
              {selectedNotes && (
                <>
                  {/* Scaffold Type */}
                  {selectedNotes.scaffold_type && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Wrench className="h-4 w-4 text-primary" />
                          نوع داربست
                        </div>
                        <p className="text-sm">{selectedNotes.scaffold_type}</p>
                      </div>
                    </>
                  )}

                  {/* Dimensions */}
                  {selectedSummary?.hasDimensions && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Ruler className="h-4 w-4 text-primary" />
                          ابعاد ثبت‌شده
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-sm font-medium" dir="ltr">
                            {selectedSummary.dimensionsText} متر
                          </p>
                          {selectedSummary.totalValue > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              متراژ کل: {selectedSummary.totalValue.toFixed(2)} {selectedSummary.unit}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Service Conditions */}
                  {selectedNotes.service_conditions && Array.isArray(selectedNotes.service_conditions) && selectedNotes.service_conditions.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <CheckSquare className="h-4 w-4 text-primary" />
                          شرایط خدمات
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedNotes.service_conditions.map((condition: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Location Purpose / Description */}
                  {(selectedNotes.locationPurpose || selectedNotes.description || selectedNotes.additional_notes) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <FileText className="h-4 w-4 text-primary" />
                          توضیحات محل نصب و فعالیت
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed bg-muted/50 p-3 rounded-lg">
                          {selectedNotes.locationPurpose || selectedNotes.description || selectedNotes.additional_notes}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Dates */}
                  {(selectedNotes.installationDate || selectedNotes.installationDateTime || selectedNotes.dueDate) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Clock className="h-4 w-4 text-primary" />
                          تاریخ‌ها
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(selectedNotes.installationDate || selectedNotes.installationDateTime) && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                              <p className="text-xs text-muted-foreground">تاریخ نصب</p>
                              <p className="text-sm font-medium">
                                {selectedNotes.installationDate || selectedNotes.installationDateTime}
                              </p>
                            </div>
                          )}
                          {selectedNotes.dueDate && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                              <p className="text-xs text-muted-foreground">تاریخ موعد</p>
                              <p className="text-sm font-medium">{selectedNotes.dueDate}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Customer Info */}
                  {(selectedNotes.customerName || selectedNotes.customerPhone) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <User className="h-4 w-4 text-primary" />
                          اطلاعات مشتری
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedNotes.customerName && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              {selectedNotes.customerName}
                            </div>
                          )}
                          {selectedNotes.customerPhone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <a href={`tel:${selectedNotes.customerPhone}`} className="text-primary hover:underline">
                                {selectedNotes.customerPhone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Price */}
                  {selectedSummary && selectedSummary.estimatedPrice > 0 && (
                    <>
                      <Separator />
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <p className="text-sm font-semibold mb-1">قیمت تخمینی</p>
                        <p className="text-xl font-bold text-primary">
                          {selectedSummary.estimatedPrice.toLocaleString('fa-IR')} تومان
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Registration Date */}
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                تاریخ ثبت: {formatPersianDate(selectedOrder.created_at, { showDayOfWeek: true })}
              </div>

              {/* Approval Progress */}
              {selectedOrder.status === 'pending' && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-semibold mb-2">وضعیت تایید</p>
                    <ApprovalProgressComponent orderId={selectedOrder.id} />
                  </div>
                </>
              )}

              {selectedOrder.notes && !selectedNotes && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  جزئیات فنی این سفارش در دسترس نیست.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setDetailsOpen(false);
                navigate(`/user/orders/${selectedOrder?.id}`);
              }}
              className="w-full gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              مشاهده صفحه کامل سفارش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate component for approval progress to use hook
function ApprovalProgressComponent({ orderId }: { orderId: string }) {
  const { approvals, loading } = useOrderApprovals(orderId);
  return <ApprovalProgress approvals={approvals} loading={loading} />;
}
