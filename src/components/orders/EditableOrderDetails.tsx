import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Calendar, Banknote, Edit, Save, X, Upload, Trash2, Loader2, Printer, Wrench, Truck, Home, ExternalLink
} from 'lucide-react';
import { ManagerOrderInvoice } from './ManagerOrderInvoice';
import { formatPersianDate, formatPersianDateTime } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { parseOrderNotes } from './OrderDetailsView';
import { parseLocalizedNumber } from '@/lib/numberParsing';
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
import { CentralizedVideoPlayer } from '@/components/media/CentralizedVideoPlayer';
import { OrderMediaSection } from './OrderMediaSection';
import { ExpertPricingEditDialog } from './ExpertPricingEditDialog';

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
    rental_start_date?: string | null;
    total_price?: number | null;
    total_paid?: number | null;
  };
  onUpdate?: () => void;
  hidePrice?: boolean; // Hide price information (for executive managers in specific modules)
  hideDetails?: boolean; // Hide order details, only show financial info (for accounting module)
}

export const EditableOrderDetails = ({ order, onUpdate, hidePrice = false, hideDetails = false }: EditableOrderDetailsProps) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [expertPricingEditOpen, setExpertPricingEditOpen] = useState(false);
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

  // Unit price for expert pricing requests (price per square meter)
  const [unitPrice, setUnitPrice] = useState(parsedNotes?.unit_price?.toString() || '');
  const [savedUnitPrice, setSavedUnitPrice] = useState(parsedNotes?.unit_price?.toString() || '');
  const isUnitPriceChanged = unitPrice !== savedUnitPrice;

  // Check if this is an expert pricing request
  const isExpertPricingRequest = parsedNotes?.is_expert_pricing_request === true;

  // Calculate total measure (m² or m³) from dimensions for expert pricing
  const calculateExpertPricingTotalMeasure = () => {
    const dims = parsedNotes?.dimensions;

    const totalFromNotes = parseLocalizedNumber(
      parsedNotes?.total_volume ??
        parsedNotes?.totalVolume ??
        parsedNotes?.total_area ??
        parsedNotes?.totalArea
    );
    if (totalFromNotes > 0) return totalFromNotes;

    if (!dims || !Array.isArray(dims)) return 0;

    const hasAnyWidth = dims.some((d: any) => parseLocalizedNumber(d?.width) > 0);
    const isVolume = Boolean(parsedNotes?.total_volume ?? parsedNotes?.totalVolume) || hasAnyWidth;

    return dims.reduce((sum: number, dim: any) => {
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
  };

  const expertPricingTotalMeasure = calculateExpertPricingTotalMeasure();
  const expertPricingMeasureUnit = (() => {
    const dims = parsedNotes?.dimensions;
    const hasAnyWidth = Array.isArray(dims) && dims.some((d: any) => parseLocalizedNumber(d?.width) > 0);
    const isVolume = Boolean(parsedNotes?.total_volume ?? parsedNotes?.totalVolume) || hasAnyWidth;
    return isVolume ? 'متر مکعب' : 'متر مربع';
  })();

  // Auto-calculate total price when unit price changes
  useEffect(() => {
    if (isExpertPricingRequest && unitPrice && expertPricingTotalMeasure > 0) {
      const calculatedTotal = parseFloat(unitPrice) * expertPricingTotalMeasure;
      setPaymentAmount(Math.round(calculatedTotal).toString());
    }
  }, [unitPrice, expertPricingTotalMeasure, isExpertPricingRequest]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build updated notes
      const updatedNotes = {
        ...parsedNotes,
        description,
        service_type: scaffoldingType
      };

      // If manager is setting price on expert pricing request, mark it and auto-confirm
      if (isExpertPricingRequest && paymentAmount && parseFloat(paymentAmount) > 0) {
        updatedNotes.price_set_by_manager = true;
        updatedNotes.manager_set_price = parseFloat(paymentAmount);
        updatedNotes.pricing_date = new Date().toISOString();
        // تایید خودکار قیمت (بدون نیاز به تایید دستی مشتری)
        updatedNotes.customer_price_confirmed = true;
        updatedNotes.customer_price_confirmed_at = new Date().toISOString();
        updatedNotes.auto_confirmed_by_expert = true;
        // Store unit price if provided
        if (unitPrice && parseFloat(unitPrice) > 0) {
          updatedNotes.unit_price = parseFloat(unitPrice);
          if (expertPricingMeasureUnit === 'متر مکعب') {
            updatedNotes.total_volume = expertPricingTotalMeasure;
            updatedNotes.pricing_unit = 'm3';
          } else {
            updatedNotes.total_area = expertPricingTotalMeasure;
            updatedNotes.pricing_unit = 'm2';
          }
        }
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
      setSavedUnitPrice(unitPrice);

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

  // For accounting module, show only financial info
  if (hideDetails) {
    const paymentAmountValue = order.payment_amount || parsedNotes?.estimated_price || parsedNotes?.estimatedPrice || 0;
    const totalPaidValue = (order as any).total_paid || 0;
    const remainingValue = Math.max(0, paymentAmountValue - totalPaidValue);

    return (
      <div className="space-y-4">
        {/* Basic Order Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-xs text-muted-foreground">کد سفارش</Label>
            <p className="font-bold text-lg">{order.code}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">نام مشتری</Label>
            <p className="font-medium">{order.customer_name || 'نامشخص'}</p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-5 w-5 text-green-600" />
            <span className="text-lg font-bold">اطلاعات مالی سفارش</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-background p-4 rounded-lg border">
              <Label className="text-xs text-muted-foreground block mb-1">مبلغ کل سفارش</Label>
              <p className="font-bold text-xl text-green-700 dark:text-green-300">
                {Number(paymentAmountValue + approvedRepairCost).toLocaleString('fa-IR')} تومان
              </p>
            </div>
            
            <div className="bg-background p-4 rounded-lg border">
              <Label className="text-xs text-muted-foreground block mb-1">مبلغ پرداخت شده</Label>
              <p className="font-bold text-xl text-blue-700 dark:text-blue-300">
                {Number(totalPaidValue).toLocaleString('fa-IR')} تومان
              </p>
            </div>
            
            <div className="bg-background p-4 rounded-lg border">
              <Label className="text-xs text-muted-foreground block mb-1">مانده بدهکاری</Label>
              <p className={`font-bold text-xl ${remainingValue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {Number(remainingValue).toLocaleString('fa-IR')} تومان
              </p>
            </div>
          </div>

          {approvedRepairCost > 0 && (
            <div className="flex justify-between text-sm p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800">
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <Wrench className="h-3 w-3" />
                هزینه تعمیرات:
              </span>
              <span className="font-bold text-orange-700 dark:text-orange-300">{approvedRepairCost.toLocaleString('fa-IR')} تومان</span>
            </div>
          )}

          {/* Editable Price Input for Accounting */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-sm font-medium mb-2 block">ویرایش مبلغ سفارش</Label>
            <div className="flex gap-2">
              <Input 
                type="number"
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="مبلغ به تومان"
                className="flex-1"
                dir="ltr"
              />
              <Button 
                onClick={handleSave} 
                disabled={saving || !isPriceChanged}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {!isPriceChanged ? 'ذخیره شده' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Expert Pricing Request Badge with Price Input - shown only if hidePrice is false */}
      {isExpertPricingRequest && !hidePrice && (
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
          
          {/* Display Total Area from Customer Form */}
          {expertPricingTotalMeasure > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 text-center">
                <Ruler className="h-4 w-4 inline ml-1" />
                متراژ کل: <span className="font-bold text-lg">{expertPricingTotalMeasure.toLocaleString('fa-IR')}</span> {expertPricingMeasureUnit}
              </p>
            </div>
          )}
          
          {/* Unit Price Input for Expert Pricing */}
          <div className="bg-white dark:bg-amber-900/50 rounded-lg p-4 border border-amber-200 dark:border-amber-600 space-y-4">
            <div>
              <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">
                قیمت فی (تومان به ازای هر {expertPricingMeasureUnit})
              </Label>
              <Input 
                type="text"
                inputMode="numeric"
                value={unitPrice ? Number(unitPrice).toLocaleString('fa-IR') : ''} 
                onChange={(e) => {
                  // Remove all non-digit characters and convert Persian digits to English
                  const rawValue = e.target.value
                    .replace(/[^\d۰-۹]/g, '')
                    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                  setUnitPrice(rawValue);
                }}
                placeholder="قیمت فی را وارد کنید"
                className="text-lg font-bold"
                dir="ltr"
              />
              {unitPrice && parseFloat(unitPrice) > 0 && expertPricingTotalMeasure > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  محاسبه: {parseFloat(unitPrice).toLocaleString('fa-IR')} × {expertPricingTotalMeasure.toLocaleString('fa-IR')} = {(parseFloat(unitPrice) * expertPricingTotalMeasure).toLocaleString('fa-IR')} تومان
                </p>
              )}
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2 block">
                قیمت کل (تومان)
              </Label>
              <div className="flex gap-2">
                <Input 
                  type="text"
                  inputMode="numeric"
                  value={paymentAmount ? Number(paymentAmount).toLocaleString('fa-IR') : ''} 
                  onChange={(e) => {
                    // Remove all non-digit characters and convert Persian digits to English
                    const rawValue = e.target.value
                      .replace(/[^\d۰-۹]/g, '')
                      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                    setPaymentAmount(rawValue);
                    // If manually changed, clear unit price
                    if (unitPrice && parseFloat(unitPrice) > 0 && expertPricingTotalMeasure > 0) {
                      const calculated = parseFloat(unitPrice) * expertPricingTotalMeasure;
                      if (Math.abs(parseFloat(rawValue) - calculated) > 1) {
                        // User is overriding the calculated value
                      }
                    }
                  }}
                  placeholder="مبلغ کل را به تومان وارد کنید"
                  className="flex-1 text-lg font-bold"
                  dir="ltr"
                />
                <Button 
                  onClick={handleSave} 
                  disabled={saving || !paymentAmount || (!isPriceChanged && !isUnitPriceChanged)}
                  title={(!isPriceChanged && !isUnitPriceChanged) ? 'قیمت ذخیره شده است' : 'ذخیره قیمت'}
                  className={`bg-amber-600 hover:bg-amber-700 text-white px-6 ${
                    (!isPriceChanged && !isUnitPriceChanged) ? 'opacity-50 cursor-not-allowed hover:bg-amber-600' : ''
                  }`}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                  {(!isPriceChanged && !isUnitPriceChanged) ? 'ذخیره شده ✓' : 'ذخیره قیمت'}
                </Button>
              </div>
            </div>
          </div>

          {/* Price Status Card */}
          {paymentAmount && Number(paymentAmount) > 0 ? (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
              <p className="text-sm font-bold text-green-700 dark:text-green-400 text-center">
                قیمت تعیین شده: {Number(paymentAmount).toLocaleString('fa-IR')} تومان
                {unitPrice && parseFloat(unitPrice) > 0 && (
                  <span className="block text-xs font-normal mt-1">
                    (قیمت فی: {parseFloat(unitPrice).toLocaleString('fa-IR')} تومان × {expertPricingTotalMeasure.toLocaleString('fa-IR')} {expertPricingMeasureUnit})
                  </span>
                )}
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
      <div className="flex justify-end gap-2 flex-wrap">
        <ManagerOrderInvoice order={order} hidePrice={hidePrice} />
        
        {/* دکمه ویرایش کامل در فرم قیمت‌گذاری */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setExpertPricingEditOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
        >
          <ExternalLink className="h-4 w-4 ml-1" />
          ویرایش در فرم قیمت‌گزاری
        </Button>
        
        {/* دکمه ویرایش سریع در همین دیالوگ */}
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 ml-1" />
            ویرایش سریع
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
            {order.rental_start_date && (
              <div className="p-3 bg-white dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                <span className="text-xs text-green-600 dark:text-green-400 block mb-1">تاریخ شروع کرایه داربست</span>
                <span className="font-bold text-sm">{formatPersianDate(order.rental_start_date)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Price - Only show for non-expert pricing requests, as expert pricing has input at top */}
      {/* Also hide if hidePrice is true (for executive managers in scaffold with materials module) */}
      {!isExpertPricingRequest && !hidePrice && (
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

      {/* Media Section with separate images/videos and upload/delete for managers */}
      <OrderMediaSection 
        orderId={order.id} 
        canUpload={true} 
        canDelete={true} 
        onMediaChange={onUpdate} 
      />

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
            disabled={!order.rental_start_date || !order.customer_completion_date}
            title={!order.rental_start_date ? 'ابتدا تاریخ شروع کرایه را ثبت کنید' : !order.customer_completion_date ? 'ابتدا تاریخ جمع‌آوری را ثبت کنید' : ''}
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

      {/* Expert Pricing Edit Dialog */}
      <ExpertPricingEditDialog
        open={expertPricingEditOpen}
        onOpenChange={setExpertPricingEditOpen}
        order={{
          id: order.id,
          code: order.code,
          address: order.address,
          detailed_address: order.detailed_address,
          notes: order.notes,
          subcategory: order.subcategory
        }}
        onSuccess={onUpdate}
      />
    </div>
  );
};

export default EditableOrderDetails;
