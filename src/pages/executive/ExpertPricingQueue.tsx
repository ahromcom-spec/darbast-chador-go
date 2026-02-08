import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, Search, DollarSign, Ruler, CheckCircle, AlertCircle, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EditableOrderDetails } from '@/components/orders/EditableOrderDetails';
import { ExpertPricingDialog } from '@/components/orders/ExpertPricingDialog';
import { parseOrderNotes } from '@/components/orders/OrderDetailsView';
import { formatPersianDate } from '@/lib/dateUtils';
import { useModuleAssignmentInfo } from '@/hooks/useModuleAssignmentInfo';
import { parseLocalizedNumber } from '@/lib/numberParsing';

interface Order {
  id: string;
  code: string;
  status: string;
  address: string;
  detailed_address: string | null;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  notes: any;
  payment_amount: number | null;
  customer_id?: string;
  location_lat?: number | null;
  location_lng?: number | null;
}

export default function ExpertPricingQueue() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const { toast } = useToast();

  const activeModuleKey = searchParams.get('moduleKey') || '';
  const { moduleName } = useModuleAssignmentInfo(activeModuleKey, '', '');
  
  // برای ماژول 101010 یا بدون moduleKey، همه درخواست‌های کارشناسی قیمت را نشان بده
  const isScaffoldWithMaterialsModule = activeModuleKey === 'scaffold_execution_with_materials' ||
                                         activeModuleKey.includes('101010') ||
                                         moduleName.includes('داربست به همراه اجناس') ||
                                         !activeModuleKey; // اگر moduleKey نداریم، همه را نشان بده

  useEffect(() => {
    fetchExpertPricingOrders();
  }, [isScaffoldWithMaterialsModule]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOrders(orders);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = orders.filter(order =>
      order.code.toLowerCase().includes(term) ||
      order.customer_name?.toLowerCase().includes(term) ||
      order.customer_phone?.includes(term) ||
      order.address?.toLowerCase().includes(term)
    );
    setFilteredOrders(filtered);
  }, [searchTerm, orders]);

  const fetchExpertPricingOrders = async () => {
    try {
      setLoading(true);
      
      // فیلتر برای سفارشات درخواست کارشناسی قیمت
      let query = supabase
        .from('projects_v3')
        .select(`
          id,
          code,
          status,
          address,
          detailed_address,
          created_at,
          notes,
          payment_amount,
          customer_id,
          location_lat,
          location_lng,
          subcategory_id,
          customers!inner(
            user_id,
            profiles!inner(full_name, phone_number)
          )
        `)
        .order('code', { ascending: false });

      // فیلتر زیردسته داربست به همراه اجناس (کد 10)
      query = query.eq('subcategory_id', '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d');

      const { data, error } = await query;

      if (error) throw error;

      // فیلتر سفارشات که درخواست کارشناسی قیمت هستند
      const expertPricingOrders = (data || [])
        .map((order: any) => {
          const parsedNotes = parseOrderNotes(order.notes);
          const isExpertPricing = parsedNotes?.is_expert_pricing_request === true;
          const priceSetByManager = parsedNotes?.price_set_by_manager === true;
          const hasPaymentAmount = order.payment_amount && order.payment_amount > 0;
          
          return {
            id: order.id,
            code: order.code,
            status: order.status,
            address: order.address,
            detailed_address: order.detailed_address,
            created_at: order.created_at,
            notes: order.notes,
            payment_amount: order.payment_amount,
            customer_id: order.customer_id,
            location_lat: order.location_lat,
            location_lng: order.location_lng,
            customer_name: order.customers?.profiles?.full_name || 'نامشخص',
            customer_phone: order.customers?.profiles?.phone_number || '',
            isExpertPricing,
            priceSetByManager,
            hasPaymentAmount
          };
        })
        .filter((order: any) => order.isExpertPricing);

      setOrders(expertPricingOrders);
      setFilteredOrders(expertPricingOrders);
    } catch (error) {
      console.error('Error fetching expert pricing orders:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'دریافت سفارشات با خطا مواجه شد'
      });
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatus = (order: Order) => {
    const parsedNotes = parseOrderNotes(order.notes);
    const priceSetByManager = parsedNotes?.price_set_by_manager === true;
    const hasPaymentAmount = order.payment_amount && order.payment_amount > 0;

    if (!priceSetByManager && !hasPaymentAmount) {
      return { label: 'در انتظار تعیین قیمت', variant: 'destructive' as const, icon: AlertCircle };
    }
    
    // بعد از تعیین قیمت توسط کارشناس، سفارش مستقیماً به مرحله تایید مدیر می‌رود
    if (order.status === 'pending') {
      return { label: 'در انتظار تایید مدیران', variant: 'secondary' as const, icon: DollarSign };
    }
    if (['approved', 'pending_execution'].includes(order.status)) {
      return { label: 'تایید شده - در انتظار اجرا', variant: 'default' as const, icon: CheckCircle };
    }
    if (['in_progress', 'completed', 'paid', 'closed'].includes(order.status)) {
      return { label: 'در حال اجرا یا تکمیل شده', variant: 'default' as const, icon: CheckCircle };
    }
    
    return { label: 'قیمت‌گذاری شده', variant: 'default' as const, icon: CheckCircle };
  };

  const getDimensions = (order: Order) => {
    const parsedNotes = parseOrderNotes(order.notes);
    const dimensions = parsedNotes?.dimensions || [];
    return dimensions;
  };

  const getTotalMeasure = (order: Order) => {
    const dimensions = getDimensions(order);
    if (!dimensions.length) return null;

    const parsedNotes = parseOrderNotes(order.notes);
    const totalFromNotes = parseLocalizedNumber(parsedNotes?.total_volume ?? parsedNotes?.totalVolume);
    if (totalFromNotes > 0) return totalFromNotes;

    const hasAnyWidth = dimensions.some((d: any) => parseLocalizedNumber(d?.width) > 0);
    const isVolume = Boolean(parsedNotes?.total_volume ?? parsedNotes?.totalVolume) || hasAnyWidth;
    
    const total = dimensions.reduce((sum: number, dim: any) => {
      const length = parseLocalizedNumber(dim?.length);
      const height = parseLocalizedNumber(dim?.height);
      if (length <= 0 || height <= 0) return sum;

      if (isVolume) {
        const width = parseLocalizedNumber(dim?.width);
        const w = width > 0 ? width : 1;
        return sum + length * w * height;
      }

      return sum + length * height;
    }, 0);
    
    return total > 0 ? total : null;
  };

  const getMeasureUnit = (order: Order) => {
    const parsedNotes = parseOrderNotes(order.notes);
    const dimensions = getDimensions(order);
    const hasAnyWidth = dimensions.some((d: any) => parseLocalizedNumber(d?.width) > 0);
    const isVolume = Boolean(parsedNotes?.total_volume ?? parsedNotes?.totalVolume) || hasAnyWidth;
    return isVolume ? 'متر مکعب' : 'متر مربع';
  };

  // تفکیک سفارشات به قیمت‌گذاری نشده و قیمت‌گذاری شده
  const pendingPricingOrders = filteredOrders.filter(order => {
    const parsedNotes = parseOrderNotes(order.notes);
    return !parsedNotes?.price_set_by_manager && !(order.payment_amount && order.payment_amount > 0);
  });

  const pricedOrders = filteredOrders.filter(order => {
    const parsedNotes = parseOrderNotes(order.notes);
    return parsedNotes?.price_set_by_manager || (order.payment_amount && order.payment_amount > 0);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <PageHeader
        title="تعیین قیمت سفارشات"
        description="سفارشات درخواست کارشناسی قیمت که نیاز به قیمت‌گذاری دارند"
        showBackButton
        backTo="/executive"
      />

      {/* آمار کلی */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">در انتظار تعیین قیمت</p>
                <p className="text-3xl font-bold">{pendingPricingOrders.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قیمت‌گذاری شده</p>
                <p className="text-3xl font-bold">{pricedOrders.length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل درخواست‌ها</p>
                <p className="text-3xl font-bold">{filteredOrders.length}</p>
              </div>
              <Ruler className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* جستجو */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="جستجو بر اساس کد سفارش، نام مشتری، شماره تلفن یا آدرس..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* لیست سفارشات در انتظار قیمت‌گذاری */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          در انتظار تعیین قیمت ({pendingPricingOrders.length})
        </h2>
        
        {pendingPricingOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>همه سفارشات قیمت‌گذاری شده‌اند</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingPricingOrders.map((order) => {
              const status = getOrderStatus(order);
              const totalMeasure = getTotalMeasure(order);
              const dimensions = getDimensions(order);
              const measureUnit = getMeasureUnit(order);
              const StatusIcon = status.icon;

              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                        <CardDescription className="mt-1">
                          {order.customer_name} • {order.customer_phone}
                        </CardDescription>
                      </div>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">آدرس</Label>
                      <p className="text-sm">{order.address}</p>
                      {order.detailed_address && (
                        <p className="text-xs text-muted-foreground">{order.detailed_address}</p>
                      )}
                    </div>

                    {/* ابعاد و متراژ */}
                    {dimensions.length > 0 && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Ruler className="h-3 w-3" />
                          ابعاد درخواست شده
                        </Label>
                        <div className="mt-2 space-y-1">
                          {dimensions.map((dim: any, idx: number) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{idx + 1}</span>
                              {measureUnit === 'متر مکعب' ? (
                                <span>طول: {dim.length || '-'} × عرض: {dim.width || '-'} × ارتفاع: {dim.height || '-'}</span>
                              ) : (
                                <span>طول: {dim.length || '-'} × ارتفاع: {dim.height || '-'}</span>
                              )}
                              {dim.length && dim.height && (
                                <span className="text-muted-foreground">
                                  = {(
                                    measureUnit === 'متر مکعب'
                                      ? (parseLocalizedNumber(dim.length) * (parseLocalizedNumber(dim.width) || 1) * parseLocalizedNumber(dim.height))
                                      : (parseLocalizedNumber(dim.length) * parseLocalizedNumber(dim.height))
                                  ).toFixed(1)} {measureUnit}
                                </span>
                              )}
                            </div>
                          ))}
                          {totalMeasure && (
                            <div className="pt-2 border-t mt-2">
                              <span className="font-semibold text-primary">
                                جمع کل: {totalMeasure.toFixed(1)} {measureUnit}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      تاریخ ثبت: {formatPersianDate(order.created_at, { showDayOfWeek: true })}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setPricingDialogOpen(true);
                        }}
                      >
                        <Calculator className="h-4 w-4 ml-1" />
                        تعیین قیمت
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedOrder(order);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 ml-1" />
                        جزئیات کامل
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* لیست سفارشات قیمت‌گذاری شده */}
      {pricedOrders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            قیمت‌گذاری شده ({pricedOrders.length})
          </h2>
          
          <div className="grid gap-4">
            {pricedOrders.map((order) => {
              const status = getOrderStatus(order);
              const totalMeasure = getTotalMeasure(order);
              const measureUnit = getMeasureUnit(order);
              const StatusIcon = status.icon;

              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg">سفارش {order.code}</CardTitle>
                        <CardDescription className="mt-1">
                          {order.customer_name} • {order.customer_phone}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs text-muted-foreground">آدرس</Label>
                        <p className="text-sm">{order.address}</p>
                      </div>
                      <div className="text-left">
                        <Label className="text-xs text-muted-foreground">قیمت تعیین شده</Label>
                        <p className="text-lg font-bold text-primary">
                          {order.payment_amount?.toLocaleString('fa-IR')} تومان
                        </p>
                      </div>
                    </div>

                    {totalMeasure && (
                      <div className="text-sm text-muted-foreground">
                        متراژ کل: {totalMeasure.toFixed(1)} {measureUnit}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedOrder(order);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 ml-1" />
                        مشاهده جزئیات
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* دیالوگ تعیین قیمت */}
      {selectedOrder && (
        <ExpertPricingDialog
          open={pricingDialogOpen}
          onOpenChange={setPricingDialogOpen}
          order={selectedOrder}
          onSuccess={fetchExpertPricingOrders}
        />
      )}

      {/* دیالوگ جزئیات */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.code}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <EditableOrderDetails 
              order={selectedOrder} 
              onUpdate={() => {
                fetchExpertPricingOrders();
                setDetailsOpen(false);
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
